#!/usr/bin/env python3
"""
Nakatomi Plaza: Vault Heist — Data Generator

Produces Splunk-ingestible JSON event files and CSV lookup tables from
scenario.yaml.  Same seed = same dataset (deterministic).

Usage:
    python generate.py                     # uses default scenario.yaml
    python generate.py -c custom.yaml      # uses a custom config
    python generate.py --seed 42           # override seed
"""

import argparse
import codecs
import csv
import json
import os
import random
import re
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = SCRIPT_DIR / "scenario.yaml"
TZ_OFFSET = timezone(timedelta(hours=-8))  # PST

# ── shared building map ──────────────────────────────────────────
# Lifted to module scope (v2.9 / Phase 6) so NPC-baseline emitters
# can reuse the same room layout as the puzzle-day generator. Keep
# in sync with scenario.yaml building.floors.
ROOMS_BY_FLOOR = {
    1: ["Main Entrance", "Security Office", "Reception", "Parking Garage Entry"],
    2: ["Mail Room", "Loading Dock"],
    3: ["Maintenance Shop", "Storage"],
    5: ["Legal Suite A", "Legal Suite B"],
    10: ["HR Open Floor", "Interview Room"],
    15: ["Trading Floor", "Conference Room A"],
    20: ["Finance Suite", "Records"],
    25: ["R&D Lab", "Server Room"],
    28: ["Exec Support", "Copy Center"],
    30: ["Main Hall", "Conference Room A", "Conference Room B", "Corner Office"],
    35: ["CEO Office", "Board Room"],
    "roof": ["Mechanical Room", "Helipad Access"],
    "B1": ["Vault Anteroom", "Vault Terminal"],
    "B2": ["Parking Level 2"],
}


def parse_iso(ts: str) -> datetime:
    """Parse an ISO 8601 string from scenario.yaml as PST."""
    return datetime.fromisoformat(ts).replace(tzinfo=TZ_OFFSET)


# ── helpers ──────────────────────────────────────────────────────

def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}" + dt.strftime("%z")


def rot13(text: str) -> str:
    return codecs.encode(text, "rot_13")


def rand_ts(rng: random.Random, start: datetime, end: datetime) -> datetime:
    delta = (end - start).total_seconds()
    return start + timedelta(seconds=rng.uniform(0, delta))


def rand_name(rng: random.Random) -> str:
    firsts = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley",
        "Jamie", "Drew", "Quinn", "Avery", "Blake", "Cameron",
        "Dana", "Emery", "Frankie", "Glenn", "Harper", "Kendall",
        "Lane", "Micah", "Pat", "Reese", "Sage", "Terry",
        "Yuki", "Sam", "Robin", "Lee", "Chris", "Noel",
    ]
    lasts = [
        "Adams", "Brooks", "Carter", "Diaz", "Evans", "Foster",
        "Garcia", "Hayes", "Ito", "Jensen", "Kim", "Lawson",
        "Miller", "Nguyen", "Olsen", "Patel", "Quinn", "Rivera",
        "Singh", "Torres", "Ueda", "Valdez", "Walsh", "Xu",
        "Yates", "Zhang", "Clark", "Dunn", "Fong", "Grant",
    ]
    return f"{rng.choice(firsts)} {rng.choice(lasts)}"


def rand_badge(rng: random.Random) -> str:
    prefix = rng.choice(["NP", "NP", "NP", "SE", "VIS", "TMP"])
    num = rng.randint(1000, 9999)
    return f"{prefix}-{num}"


def kv_raw(ts: datetime, **fields) -> str:
    """Build a key=value _raw string with leading timestamp."""
    parts = [iso(ts)]
    for k, v in fields.items():
        if v is None:
            continue
        sv = str(v)
        if " " in sv or '"' in sv or "=" in sv:
            sv = f'"{sv}"'
        parts.append(f"{k}={sv}")
    return " ".join(parts)


def make_event(ts: datetime, index: str, sourcetype: str, **fields) -> dict:
    return {
        "time": ts.timestamp(),
        "host": "nakatomi-bms",
        "source": f"nakatomi:{sourcetype.split(':')[-1]}",
        "sourcetype": sourcetype,
        "index": index,
        "event": kv_raw(ts, **fields),
    }


# ── generators ───────────────────────────────────────────────────

def generate_npc_baseline_events(cfg, rng):
    """
    Phase 6 / v2.9 — emit pre-heist baseline traffic from the
    NPC roster in scenario.yaml.

    Returns a dict of three lists (access / vault / building) so
    main() can append them to the existing per-index buckets. The
    function is a no-op when ``cfg["npcs"]`` is missing or when
    ``cfg["volume"]["npc_baseline_window_hours"]`` is 0 (i.e.
    booth mode disables it from main()).

    Realistic patterns covered:
      - day_shift        morning/lunch/exit swipes per workday
      - late_engineers   extended evening shift on floor 25
      - cleaning_crew    nightly floor-by-floor sweeps
      - security_rotation  hourly checkpoint patrols, 24/7
      - vendors          sporadic loading-dock or service visits
    """
    npcs = cfg.get("npcs") or {}
    if not npcs:
        return {"access": [], "vault": [], "building": []}

    vol = cfg["volume"]
    window_hours = int(vol.get("npc_baseline_window_hours", 0))
    if window_hours <= 0:
        return {"access": [], "vault": [], "building": []}

    party_setup = parse_iso(cfg["timeline"]["party_setup"])
    window_start = party_setup - timedelta(hours=window_hours)

    access_events = []
    building_events = []
    emit_door = bool(vol.get("npc_emit_paired_door_event", True))

    door_id_for = {
        1: "D1-MAIN-01", 2: "D2-MAIL-01", 3: "D3-MAINT-01", 5: "D5-LEGAL-01",
        10: "D10-HR-01", 15: "D15-TRADE-01", 20: "D20-FIN-01", 25: "D25-LAB-01",
        28: "D28-EXEC-01", 30: "D30-HALL-01", 35: "D35-CEO-01",
        "B1": "DB1-VAULT-01", "B2": "DB2-PARK-01", "roof": "DROOF-MECH-01",
    }

    # ── helpers ──────────────────────────────────────────────────
    def daily_iter(start, end):
        """Yield (day_start_at_midnight, end_of_day_or_window_end)."""
        cur = start.replace(hour=0, minute=0, second=0, microsecond=0)
        while cur < end:
            day_end = cur + timedelta(days=1)
            yield max(cur, start), min(day_end, end)
            cur = day_end

    def hour_jitter(base, hour, max_minutes=20):
        """Anchor on ``hour`` of ``base.date()``, jitter ±max_minutes."""
        anchor = base.replace(hour=hour % 24, minute=0, second=0, microsecond=0)
        if hour >= 24:
            anchor += timedelta(days=hour // 24)
        return anchor + timedelta(minutes=rng.randint(-max_minutes, max_minutes))

    def emit_badge(ts, npc, floor, room, action="swipe", outcome="allow", detail=""):
        # Skip events that drift past the puzzle handoff time;
        # the existing party / takeover generators own that window.
        if ts >= party_setup:
            return
        access_events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=npc["badge_id"], name=npc["name"],
            department=npc.get("department", ""),
            floor=floor, room=room,
            action=action, outcome=outcome,
            detail=detail or f"npc baseline ({npc['badge_id']})",
        ))
        if emit_door and outcome == "allow":
            door_id = door_id_for.get(floor)
            if door_id:
                access_events.append(make_event(
                    ts + timedelta(seconds=rng.randint(1, 4)),
                    "nakatomi_access", "nakatomi:access:door",
                    door_id=door_id, floor=floor, room=room,
                    state=rng.choice(["open", "closed", "open"]),
                    method="badge",
                ))

    def safe_room(floor):
        rooms = ROOMS_BY_FLOOR.get(floor)
        return rng.choice(rooms) if rooms else "General Area"

    swipes_per_person = int(vol.get("npc_per_person_daily_swipes", 12))

    # ── 1) day shift ─────────────────────────────────────────────
    for npc in npcs.get("day_shift", []) or []:
        for day_start, _day_end in daily_iter(window_start, party_setup):
            if vol.get("npc_workdays_only", False) and day_start.weekday() >= 5:
                continue
            home_floors = npc.get("home_floors") or [10]
            start_h = int(npc.get("start_hour", 9))
            end_h = int(npc.get("end_hour", 17))
            if end_h <= start_h:
                continue

            # Morning entry swipe at the lobby
            t_in = hour_jitter(day_start, start_h, max_minutes=25)
            emit_badge(t_in, npc, 1, "Main Entrance", detail="morning entry")

            # Internal moves spread across the workday
            internal = max(0, swipes_per_person - 3)
            for _ in range(internal):
                hour = rng.randint(start_h, end_h - 1)
                ts = hour_jitter(day_start, hour, max_minutes=29)
                if ts <= t_in:
                    ts = t_in + timedelta(minutes=rng.randint(5, 90))
                floor = rng.choice(home_floors)
                emit_badge(ts, npc, floor, safe_room(floor), detail="floor access")

            # Lunch swipe (down to lobby and back)
            lunch_h = rng.choice([12, 13])
            t_lunch = hour_jitter(day_start, lunch_h, max_minutes=20)
            emit_badge(t_lunch, npc, 1, "Reception", detail="lunch break")

            # Departure
            t_out = hour_jitter(day_start, end_h, max_minutes=30)
            emit_badge(t_out, npc, 1, "Main Entrance", detail="end of day")

    # ── 2) late engineers ────────────────────────────────────────
    for npc in npcs.get("late_engineers", []) or []:
        for day_start, _day_end in daily_iter(window_start, party_setup):
            home_floors = npc.get("home_floors") or [25]
            start_h = int(npc.get("start_hour", 12))
            end_h = int(npc.get("end_hour", 22))
            if end_h <= start_h:
                continue
            t_in = hour_jitter(day_start, start_h, max_minutes=30)
            emit_badge(t_in, npc, 1, "Main Entrance", detail="late shift entry")

            # ~14 swipes/day: server-room access, copier, restroom, vending
            for _ in range(rng.randint(10, 16)):
                hour = rng.randint(start_h, end_h - 1)
                ts = hour_jitter(day_start, hour, max_minutes=29)
                floor = rng.choice(home_floors)
                room = rng.choice(["R&D Lab", "Server Room", "R&D Lab"])
                emit_badge(ts, npc, floor, room, detail="engineering access")

            t_out = hour_jitter(day_start, end_h, max_minutes=25)
            emit_badge(t_out, npc, 1, "Main Entrance", detail="late departure")

    # ── 3) cleaning crew ─────────────────────────────────────────
    swipes_per_floor = int(vol.get("npc_cleaning_swipes_per_floor", 3))
    for npc in npcs.get("cleaning_crew", []) or []:
        for day_start, _day_end in daily_iter(window_start, party_setup):
            shift_start_h = int(npc.get("shift_start_hour", 22))
            shift_end_h = int(npc.get("shift_end_hour", 26))  # may roll past midnight
            route = npc.get("route") or [1, 10, 20, 30]

            t_clock_in = hour_jitter(day_start, shift_start_h, max_minutes=15)
            emit_badge(t_clock_in, npc, 1, "Security Office", detail="cleaning shift start")

            # walk the route — multiple swipes per floor
            duration_minutes = max(60, (shift_end_h - shift_start_h) * 60)
            per_floor_minutes = duration_minutes / max(1, len(route))
            for idx, floor in enumerate(route):
                base_minute_offset = int(idx * per_floor_minutes)
                for swipe_idx in range(swipes_per_floor):
                    minute = base_minute_offset + swipe_idx * 15 + rng.randint(0, 12)
                    ts = t_clock_in + timedelta(minutes=minute)
                    emit_badge(ts, npc, floor, safe_room(floor), detail="cleaning route")

            t_clock_out = hour_jitter(day_start, shift_end_h, max_minutes=20)
            emit_badge(t_clock_out, npc, 1, "Security Office", detail="cleaning shift end")

    # ── 4) security rotation (24/7) ──────────────────────────────
    checkpoints_per_hour = int(vol.get("npc_security_checkpoints_per_hour", 8))
    patrol_floors = [1, 5, 10, 15, 20, 25, 28, 30, 35, "B1", "B2"]
    for npc in npcs.get("security_rotation", []) or []:
        for day_start, _day_end in daily_iter(window_start, party_setup):
            shift_start_h = int(npc.get("shift_start_hour", 6))
            shift_end_h = int(npc.get("shift_end_hour", 14))
            t_in = hour_jitter(day_start, shift_start_h, max_minutes=10)
            emit_badge(t_in, npc, 1, "Security Office", detail=f"shift start ({npc.get('shift', 'rotation')})")

            shift_hours = max(1, shift_end_h - shift_start_h)
            for hour_offset in range(shift_hours):
                for _ in range(checkpoints_per_hour):
                    minute = rng.randint(0, 59)
                    second = rng.randint(0, 59)
                    ts = t_in + timedelta(hours=hour_offset, minutes=minute, seconds=second)
                    floor = rng.choice(patrol_floors)
                    emit_badge(ts, npc, floor, safe_room(floor),
                               action="swipe", outcome="allow",
                               detail="patrol checkpoint")
                    # Occasional "deny" attempt at restricted floors mid-patrol
                    if rng.random() < 0.05 and floor in ("B1", 35):
                        emit_badge(ts + timedelta(seconds=rng.randint(2, 12)),
                                   npc, floor, safe_room(floor),
                                   action="attempt", outcome="deny",
                                   detail="restricted access — escalation drill")

            t_out = t_in + timedelta(hours=shift_hours, minutes=rng.randint(0, 25))
            emit_badge(t_out, npc, 1, "Security Office", detail="shift end")

    # ── 5) vendors ───────────────────────────────────────────────
    visits_per_day = int(vol.get("npc_vendor_visits_per_day", 6))
    vendor_pool = npcs.get("vendors", []) or []
    if vendor_pool:
        for day_start, _day_end in daily_iter(window_start, party_setup):
            for _ in range(visits_per_day):
                npc = rng.choice(vendor_pool)
                hour = rng.randint(8, 19)
                t_arrive = hour_jitter(day_start, hour, max_minutes=29)
                emit_badge(t_arrive, npc, 1, "Reception",
                           detail=f"vendor arrival ({npc.get('vendor_kind', 'general')})")
                # 1–4 internal swipes depending on vendor kind
                visits = rng.randint(1, 4)
                floors = npc.get("typical_floors") or [1, 2]
                for visit_idx in range(visits):
                    ts = t_arrive + timedelta(minutes=rng.randint(5, 60))
                    floor = rng.choice(floors)
                    emit_badge(ts, npc, floor, safe_room(floor),
                               detail=f"vendor visit ({npc.get('vendor_kind', 'general')})")
                t_depart = t_arrive + timedelta(hours=rng.randint(1, 3))
                emit_badge(t_depart, npc, 1, "Main Entrance", detail="vendor departure")

    return {"access": access_events, "vault": [], "building": building_events}


def generate_badge_events(cfg, rng):
    """Generate nakatomi:access:badge events."""
    events = []
    tl = cfg["timeline"]
    floors_cfg = cfg["building"]["floors"]
    floor_nums = [f["number"] for f in floors_cfg]
    party_floors = [1, 15, 20, 30]
    rooms_by_floor = ROOMS_BY_FLOOR

    all_chars = cfg["characters"]
    employees = (
        all_chars["key_employees"]
        + all_chars["supporting"]
    )
    filler_employees = []
    for _ in range(40):
        filler_employees.append({
            "badge_id": rand_badge(rng),
            "name": rand_name(rng),
            "department": rng.choice([
                "Finance", "HR", "Legal", "IT", "Facilities",
                "Marketing", "Sales", "R&D", "Admin",
            ]),
            "clearance": rng.choice(["LEVEL-1", "LEVEL-2", "LEVEL-3"]),
        })
    all_employees = employees + filler_employees

    parse_ts = lambda s: datetime.fromisoformat(s).replace(tzinfo=TZ_OFFSET)

    # ── normal hours (18:00–22:00) ───────────────────────────────
    t_setup = parse_ts(tl["party_setup"])
    t_party = parse_ts(tl["party_start"])
    t_takeover = parse_ts(tl["takeover"])

    # Discovery 1.2 ("Find Takagi") expects JT-0001's *latest* swipe
    # to be on floor 30 (the Conference Room B calendar entry at
    # 19:45). Excluding Takagi from the random 200-event pool keeps
    # the canonical Seal 2 schedule event as his last-known location
    # — otherwise the random walker would put him on a random floor
    # at a random time and break `| sort -_time | head 1`.
    party_pool = [e for e in all_employees if e.get("badge_id") != "JT-0001"]
    for _ in range(200):
        ts = rand_ts(rng, t_setup, t_takeover)
        emp = rng.choice(party_pool)
        floor = rng.choice(party_floors if ts >= t_party else floor_nums[:8])
        if isinstance(floor, dict):
            floor = floor.get("number", 1)
        rooms = rooms_by_floor.get(floor, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=emp["badge_id"], name=emp["name"],
            department=emp["department"], floor=floor,
            room=rng.choice(rooms), action="swipe",
            outcome="allow", detail="regular access",
        ))

    # ── Christmas-party guest crowd (Phase 6a / v2.9) ─────────────
    # Seal 2 ("Hostage Floor") query is:
    #   index=nakatomi_access earliest=1988-12-24T20:00:00 ...
    #   | stats dc(badge_id) by floor | sort -dc(badge_id)
    # Floor 30 must beat every other floor by `dc(badge_id)`. The
    # legacy 200-event block above only guarantees ~12 distinct
    # badges on floor 30 (random spread across [1,15,20,30]) and
    # was unreliable as soon as the v2.9 NPC baseline gave other
    # floors comparable distinct-badge counts. The party-guest
    # roster below dependably puts ~50+ distinct attendees on
    # floor 30 between 20:00–22:00 — making the puzzle answer
    # deterministic again. Booth mode runs this block as well so
    # the curated dataset still solves Seal 2.
    vol_cfg = cfg.get("volume", {}) or {}
    guest_count = int(vol_cfg.get("party_guest_count", 65))
    swipes_per_guest = max(2, int(vol_cfg.get("party_guest_swipes_per_attendee", 4)))
    overflow_15_pct = max(0, int(vol_cfg.get("party_overflow_floor_15_pct", 12)))
    overflow_20_pct = max(0, int(vol_cfg.get("party_overflow_floor_20_pct", 8)))
    floor30_rooms = rooms_by_floor.get(30, ["Main Hall"])
    floor15_rooms = rooms_by_floor.get(15, ["Trading Floor"])
    floor20_rooms = rooms_by_floor.get(20, ["Finance Suite"])
    guest_departments = [
        "Trade Partners", "Catering", "Vendor", "Family", "Press",
        "Board Member", "Friend of Holly", "Investor", "Consultant",
    ]
    party_guest_records = []
    for guest_idx in range(guest_count):
        gid = f"GUEST-{guest_idx + 1:03d}"
        gname = rand_name(rng)
        gdept = rng.choice(guest_departments)
        party_guest_records.append({
            "badge_id": gid, "name": gname, "department": gdept,
            "clearance": "LEVEL-1",
        })

        arrival = t_party + timedelta(minutes=rng.randint(-15, 25))
        events.append(make_event(
            arrival, "nakatomi_access", "nakatomi:access:badge",
            badge_id=gid, name=gname, department=gdept,
            floor=1, room="Reception",
            action="swipe", outcome="allow",
            detail="christmas party guest arrival",
        ))

        for swipe_idx in range(swipes_per_guest):
            jitter_minutes = rng.randint(5, max(15, 110 - swipe_idx * 10))
            ts = arrival + timedelta(minutes=jitter_minutes,
                                     seconds=rng.randint(0, 59))
            if ts >= t_takeover:
                ts = t_takeover - timedelta(minutes=rng.randint(1, 8))
            roll = rng.randint(1, 100)
            if roll <= overflow_15_pct:
                floor, rooms = 15, floor15_rooms
                detail = "party overflow — trading floor mingling"
            elif roll <= overflow_15_pct + overflow_20_pct:
                floor, rooms = 20, floor20_rooms
                detail = "party overflow — finance suite tour"
            else:
                floor, rooms = 30, floor30_rooms
                detail = "christmas party — floor 30"
            events.append(make_event(
                ts, "nakatomi_access", "nakatomi:access:badge",
                badge_id=gid, name=gname, department=gdept,
                floor=floor, room=rng.choice(rooms),
                action="swipe", outcome="allow", detail=detail,
            ))

    # Stash the guest roster on cfg so generate_employee_directory
    # can register them in the lookup (so SPL `lookup` joins still
    # resolve `GUEST-###` to a name + dept).
    cfg["_party_guest_records"] = party_guest_records

    # ── Seal 1 critical event: lobby override ────────────────────
    t_lobby = parse_ts(tl["lobby_secured"])
    seal1_code = cfg["seals"][1]["code"]
    events.append(make_event(
        t_lobby + timedelta(seconds=47),
        "nakatomi_access", "nakatomi:access:badge",
        badge_id="HG-1988", name="Hans Gruber",
        department="External Contractor", floor=1,
        room="Security Office", action="override",
        outcome="success",
        detail=f"security override engaged, vault protocol initiated, access_code={seal1_code}",
    ))

    # ── Seal 2 critical event: Takagi schedule ───────────────────
    seal2_code = cfg["seals"][2]["code"]
    events.append(make_event(
        parse_ts(tl["party_setup"]) + timedelta(hours=1, minutes=45),
        "nakatomi_access", "nakatomi:access:badge",
        badge_id="JT-0001", name="Joseph Takagi",
        department="CEO", floor=30,
        room="Conference Room B", action="swipe",
        outcome="allow",
        detail=f"exec_calendar: vault maintenance cycle {seal2_code} — rotation scheduled 1988-12-25T02:00",
    ))

    # ── Seal 1 red herrings ──────────────────────────────────────
    for rh in cfg["red_herrings"]["seal_1"]:
        ts = t_takeover + timedelta(minutes=rh.get("time_offset_minutes", 0))
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=rh["badge_id"], name="",
            department="", floor=rh["floor"],
            room=rh.get("room", ""), action=rh.get("action", "swipe"),
            outcome=rh.get("outcome", "allow"),
            detail=rh.get("detail", ""),
        ))

    # ── Seal 2 red herrings ──────────────────────────────────────
    for rh in cfg["red_herrings"]["seal_2"]:
        ts = rand_ts(rng, t_setup, t_takeover)
        fl = rh.get("floor", 30)
        rooms = rooms_by_floor.get(fl, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=rand_badge(rng), name=rand_name(rng),
            department="", floor=fl,
            room=rh.get("room", rng.choice(rooms)),
            action="swipe", outcome="allow",
            detail=rh.get("detail", ""),
        ))

    # ── takeover badge activity (22:00–22:30) ────────────────────
    # Post-takeover floor sweep: Hans's crew (protagonists) clearing
    # the building. Previously this also pulled from employees[:3]
    # which included Takagi (JT-0001) — but Takagi has been killed
    # by 22:20, so his badge swiping at 22:28 broke Discovery 1.2
    # ("Find Takagi" — last swipe should be floor 30, not floor 20).
    # Restricted the actor pool to crew + non-VIP supporting staff
    # (Theo's hostage-handler aliases) so the deceased VIP badges
    # stay quiet after takeover.
    t_secured = parse_ts(tl["floors_secured"])
    crew = all_chars["protagonists"]
    DECEASED_OR_VIP = {"JT-0001", "HG-1988", "HP-1015"}  # Takagi, Hans (uses override line), Holly (hostage)
    sweep_actors = list(crew) + [
        e for e in employees[:6]
        if e.get("badge_id") not in DECEASED_OR_VIP
    ]
    for _ in range(60):
        ts = rand_ts(rng, t_takeover, t_secured + timedelta(minutes=20))
        actor = rng.choice(sweep_actors)
        floor = rng.choice([1, 15, 20, 25, 28, 30, 35])
        rooms = rooms_by_floor.get(floor, ["General Area"])
        act = rng.choice(["swipe", "swipe", "swipe", "attempt"])
        out = "allow" if act == "swipe" else rng.choice(["allow", "deny"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=actor["badge_id"], name=actor["name"],
            department=actor.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action=act, outcome=out,
            detail="post-takeover sweep" if act == "swipe" else "access attempt",
        ))

    # ── post-takeover (22:30–00:00) ──────────────────────────────
    t_midnight = parse_ts(tl["midnight"])
    for _ in range(40):
        ts = rand_ts(rng, t_secured + timedelta(minutes=20), t_midnight)
        actor = rng.choice(crew)
        floor = rng.choice([1, 30, "B1", "roof"])
        rooms = rooms_by_floor.get(floor, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=actor["badge_id"], name=actor["name"],
            department=actor.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action="swipe", outcome="allow",
            detail="crew movement",
        ))

    return events


def generate_door_events(cfg, rng):
    """Generate nakatomi:access:door events."""
    events = []
    tl = cfg["timeline"]
    parse_ts = lambda s: datetime.fromisoformat(s).replace(tzinfo=TZ_OFFSET)
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])

    doors = [
        ("D1-MAIN-01", 1, "Main Entrance"),
        ("D1-SEC-01", 1, "Security Office"),
        ("D1-PARK-01", 1, "Parking Garage Entry"),
        ("D15-TRADE-01", 15, "Trading Floor"),
        ("D20-FIN-01", 20, "Finance Suite"),
        ("D25-LAB-01", 25, "R&D Lab"),
        ("D30-HALL-01", 30, "Main Hall"),
        ("D30-CONF-A", 30, "Conference Room A"),
        ("D30-CONF-B", 30, "Conference Room B"),
        ("D35-CEO-01", 35, "CEO Office"),
        ("DB1-VAULT-01", "B1", "Vault Anteroom"),
        ("DROOF-MECH-01", "roof", "Mechanical Room"),
    ]

    for _ in range(200):
        ts = rand_ts(rng, t_start, t_end)
        door_id, floor, room = rng.choice(doors)
        state = rng.choice(["open", "closed", "open", "closed", "locked", "unlocked"])
        method = rng.choice(["badge", "badge", "badge", "manual", "auto", "remote"])
        t_takeover = parse_ts(tl["takeover"])
        if ts > t_takeover and rng.random() < 0.15:
            method = "forced"
            state = "open"
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:door",
            door_id=door_id, floor=floor, room=room,
            state=state, method=method,
        ))

    return events


def generate_vault_events(cfg, rng):
    """Generate nakatomi:vault:attempt and nakatomi:vault:system events."""
    events = []
    tl = cfg["timeline"]
    parse_ts = lambda s: datetime.fromisoformat(s).replace(tzinfo=TZ_OFFSET)

    # ── automated system checks (throughout the day) ─────────────
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])
    for i in range(40):
        ts = rand_ts(rng, t_start, t_end)
        sid = f"VS-{rng.randint(1, 37):04d}"
        events.append(make_event(
            ts, "nakatomi_vault", "nakatomi:vault:attempt",
            session_id=sid, user="system",
            action="system_check",
            detail="automated integrity verification",
            result="nominal",
        ))

    # ── Seal 3 red herring: maintenance test VS-0038 ────────────
    for rh in cfg["red_herrings"]["seal_3"]:
        sid = rh["session_id"]
        user = rh["user"]
        ts_base = parse_ts(tl["party_setup"]) + timedelta(
            hours=rng.randint(0, 3), minutes=rng.randint(0, 59)
        )
        events.append(make_event(
            ts_base, "nakatomi_vault", "nakatomi:vault:attempt",
            session_id=sid, user=user,
            action="session_begin",
            detail=f"terminal_auth={'automated' if user == 'system' else 'badge'}",
            result="pending",
        ))
        for j, inp in enumerate(rh["inputs"]):
            events.append(make_event(
                ts_base + timedelta(seconds=15 + j * 12),
                "nakatomi_vault", "nakatomi:vault:attempt",
                session_id=sid, user=user,
                action="code_attempt",
                detail=f"input={inp}",
                result="fail",
            ))
        events.append(make_event(
            ts_base + timedelta(seconds=15 + len(rh["inputs"]) * 12 + 5),
            "nakatomi_vault", "nakatomi:vault:attempt",
            session_id=sid, user=user,
            action="session_end",
            detail=rh.get("detail", "session ended"),
            result="abort",
        ))

    # ── Seal 3 critical: Takagi session VS-0042 ──────────────────
    t_takagi = parse_ts(tl["takagi_confrontation"])
    seal3_seq = cfg["seals"][3]["embed_sequence"]
    events.append(make_event(
        t_takagi + timedelta(seconds=28),
        "nakatomi_vault", "nakatomi:vault:attempt",
        session_id="VS-0042", user="takagi",
        action="session_begin",
        detail="terminal_auth=biometric",
        result="pending",
    ))
    for j, inp in enumerate(seal3_seq):
        events.append(make_event(
            t_takagi + timedelta(seconds=75 + j * 48),
            "nakatomi_vault", "nakatomi:vault:attempt",
            session_id="VS-0042", user="takagi",
            action="code_attempt",
            detail=inp,
            result="fail",
        ))
    events.append(make_event(
        t_takagi + timedelta(seconds=75 + len(seal3_seq) * 48 + 20),
        "nakatomi_vault", "nakatomi:vault:attempt",
        session_id="VS-0042", user="takagi",
        action="session_end",
        detail="max_attempts_exceeded",
        result="abort",
    ))

    # ── vault system / protocol docs (nakatomi:vault:system) ─────
    # Seal 7 hint: vault protocol documentation
    events.append(make_event(
        parse_ts(tl["party_setup"]) - timedelta(hours=3, minutes=30),
        "nakatomi_vault", "nakatomi:vault:system",
        system="vault_protocol", event="documentation",
        action="system_note",
        message="VAULT PROTOCOL 7: Secondary release — electromagnetic failsafe. Final lock disengages on power loss. Not accessible via terminal. See facilities manual ref VP-7.",
    ))

    # Other vault system events
    for i in range(15):
        ts = rand_ts(rng, t_start, t_end)
        events.append(make_event(
            ts, "nakatomi_vault", "nakatomi:vault:system",
            system=rng.choice(["vault_monitor", "vault_power", "vault_env"]),
            event="status",
            action="heartbeat",
            message=rng.choice([
                "All systems nominal",
                "Temperature within parameters",
                "Humidity check passed",
                "Power supply stable",
                "Door sensor check: sealed",
                "Vibration sensor: no anomaly",
            ]),
        ))

    # ── Puzzle 4.4 ("The Detonators") ────────────────────────────
    # Hans's crew brought 12 detonators in a sealed crate; they're
    # tracked by the vault inventory subsystem as a kind of weapon
    # asset. After the takeover, McClane discovers the cache and
    # walks off with 3 of them (his "I have your detonators" gag
    # in the film). The puzzle SPL is:
    #   index=nakatomi_vault sourcetype="nakatomi:vault:system"
    #     system=detonator_inventory
    # …and the player needs to read across the events to see the
    # count drop from 12 → 9 (delta = 3). We emit a verification
    # baseline, a mid-night recount, an alert, and a final audit.
    det_events = [
        # Initial sealed inventory (pre-takeover, when the crew
        # smuggled the C4 + detonator crate into the vault staging
        # area as part of the "audit" cover story).
        (parse_ts(tl["party_setup"]) - timedelta(hours=4), "verify",
         12, 12, 0, "secured",
         "Detonator inventory verified — 12 units sealed in case D-7"),
        # Post-takeover spot check by Theo while running vault prep.
        (parse_ts(tl["takeover"]) + timedelta(minutes=14), "spot_check",
         12, 12, 0, "secured",
         "Pre-vault-work inventory check — 12 units, all seals intact"),
        # McClane discovers the crate during his floor crawl
        # (between mcclane_first and fbi_arrives) — the next audit
        # detects the discrepancy.
        (parse_ts(tl["mcclane_first"]) + timedelta(minutes=22), "audit",
         9, 12, 3, "anomaly",
         "ALERT: detonator inventory discrepancy — expected=12 counted=9 missing=3"),
        # Theo runs a final reconciliation right after the FBI
        # arrives, confirming the loss for Hans.
        (parse_ts(tl["fbi_arrives"]) + timedelta(minutes=8), "reconcile",
         9, 12, 3, "missing",
         "Reconciliation complete — missing=3 last_seal_break=22:47 PST suspect=unknown_intruder"),
        # Final pre-vault-open audit just before the climax. Same
        # numbers — confirms the 3 detonators are gone for good.
        (parse_ts(tl["roof_setup"]) + timedelta(minutes=12), "audit",
         9, 12, 3, "missing",
         "Final audit — missing=3 — escalated to operations leader"),
    ]
    for ts, action, count, expected, missing, status, msg in det_events:
        events.append(make_event(
            ts, "nakatomi_vault", "nakatomi:vault:system",
            system="detonator_inventory", event="inventory_check",
            action=action,
            count=count, expected=expected, missing=missing,
            status=status,
            message=msg,
        ))

    return events


def generate_building_events(cfg, rng):
    """Generate nakatomi:building:hvac and nakatomi:building:security events."""
    events = []
    tl = cfg["timeline"]
    parse_ts = lambda s: datetime.fromisoformat(s).replace(tzinfo=TZ_OFFSET)
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])

    zones = ["east_wing", "west_wing", "north_core", "south_core", "lobby", "mechanical"]
    hvac_floors = [1, 5, 10, 15, 20, 25, 28, 30, 35, "roof"]

    # ── HVAC telemetry ───────────────────────────────────────────
    interval = cfg["volume"]["hvac_readings_interval_minutes"]
    t_cursor = t_start
    while t_cursor < t_end:
        floor = rng.choice(hvac_floors)
        zone = rng.choice(zones)
        temp = round(rng.gauss(72.0, 1.5), 1)
        events.append(make_event(
            t_cursor + timedelta(seconds=rng.randint(0, 30)),
            "nakatomi_building", "nakatomi:building:hvac",
            system="hvac", event="temp_reading",
            floor=floor, zone=zone,
            value=temp, unit="F",
        ))
        t_cursor += timedelta(minutes=interval)

    # ── Seal 4 critical: anomalous roof reading with encoded msg ─
    seal4_plaintext = "THERE IS NO POWER WITHOUT CODE " + cfg["seals"][4]["code"]
    seal4_encoded = rot13(seal4_plaintext)
    t_roof = parse_ts(tl["roof_setup"]) - timedelta(minutes=18)
    events.append(make_event(
        t_roof, "nakatomi_building", "nakatomi:building:hvac",
        system="hvac", event="temp_reading",
        floor="roof", zone="mechanical",
        value=98.7, unit="F",
        encoded_message=seal4_encoded,
    ))

    # ── Puzzle 4.2 ("The C4") ────────────────────────────────────
    # Hans's crew planted 4 C4 charges on the roof. HVAC sensors
    # detect 4 distinct heat anomalies at the charge locations.
    # The puzzle SPL filters to value>95 explicitly because the
    # narrative also seeds 2 lukewarm anomalies (87°F / 89°F) as
    # red herrings that the player must exclude. The first C4
    # signature is the Seal 4 message reading above (98.7°F) so
    # we add 3 more here to reach the canonical answer of 4.
    c4_signatures = [
        # (offset from roof_setup, zone, value)
        (-25, "north_corner",  96.4),
        (-22, "south_corner",  97.8),
        (-15, "east_corner",   99.1),
    ]
    for offset_min, zone, val in c4_signatures:
        events.append(make_event(
            parse_ts(tl["roof_setup"]) + timedelta(minutes=offset_min),
            "nakatomi_building", "nakatomi:building:hvac",
            system="hvac", event="temp_reading",
            floor="roof", zone=zone,
            value=val, unit="F",
        ))
    # Two lukewarm anomalies on the roof — NOT C4 (filtered out by
    # the value>95 clause in puzzle 4.2's SPL). These match the
    # objective text "the maintenance log mentions 6 HVAC anomalies
    # but not all are C4".
    for offset_min, zone, val, msg in [
        (-30, "mechanical", 87.3, "Helipad de-icing system test — heat trace active"),
        (-12, "mechanical", 89.1, "Exhaust vent recirculation — operator notified"),
    ]:
        events.append(make_event(
            parse_ts(tl["roof_setup"]) + timedelta(minutes=offset_min),
            "nakatomi_building", "nakatomi:building:hvac",
            system="hvac", event="temp_reading",
            floor="roof", zone=zone,
            value=val, unit="F",
            note=msg,
        ))

    # ── Seal 4 red herring encoded messages ──────────────────────
    for rh in cfg["red_herrings"]["seal_4"]:
        if "encoded_message_rot13" in rh:
            ts = rand_ts(rng, t_start, t_end - timedelta(hours=1))
            events.append(make_event(
                ts, "nakatomi_building", "nakatomi:building:hvac",
                system="hvac", event="temp_reading",
                floor=rh.get("floor", rng.choice(hvac_floors)),
                zone=rng.choice(zones),
                value=round(rng.gauss(72.0, 1.0), 1), unit="F",
                encoded_message=rot13(rh["encoded_message_rot13"]),
            ))
        elif rh.get("event") == "elevator_call":
            ts = rand_ts(rng, t_start, t_end)
            events.append(make_event(
                ts, "nakatomi_building", "nakatomi:building:hvac",
                system="elevator", event="car_call",
                floor=rh.get("floor", 1), zone="",
                value=0, unit="",
                detail=rh.get("detail", ""),
            ))

    # ── elevator calls ───────────────────────────────────────────
    for _ in range(60):
        ts = rand_ts(rng, t_start, t_end)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:hvac",
            system="elevator", event="car_call",
            floor=rng.choice([1, 10, 15, 20, 25, 30, 35]),
            zone="", value=rng.randint(1, 4), unit="car",
        ))

    # ── power grid events ────────────────────────────────────────
    for _ in range(20):
        ts = rand_ts(rng, t_start, t_end)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:hvac",
            system="power", event="grid_status",
            floor=0, zone="utility",
            value=round(rng.gauss(480, 5), 1), unit="kW",
        ))

    # ── SECURITY events ──────────────────────────────────────────
    # Normal security (pre-FBI)
    for _ in range(50):
        ts = rand_ts(rng, t_start, parse_ts(tl["fbi_arrives"]))
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="security",
            event_type=rng.choice(["camera_motion", "alarm_check", "perimeter_status"]),
            floor=rng.choice([1, 10, 20, 30, "roof"]),
            zone=rng.choice(["north_entrance", "south_entrance", "parking", "lobby"]),
            channel="", severity="info",
            message=rng.choice([
                "Motion detected — identified as employee",
                "Perimeter status: secure",
                "Camera check: nominal",
                "Alarm system heartbeat",
                "Door sensor check passed",
            ]),
        ))

    # ── Seal 5 critical: FBI radio intercept on freq_14 ──────────
    seal5_msg = cfg["seals"][5]["embed_value"]
    t_fbi = parse_ts(tl["power_cut"]) + timedelta(minutes=3, seconds=45)
    events.append(make_event(
        t_fbi, "nakatomi_building", "nakatomi:building:security",
        system="radio", event_type="radio_intercept",
        floor=0, zone="exterior",
        channel="freq_14", severity="high",
        message=seal5_msg,
    ))

    # ── Seal 5 red herring radio traffic ─────────────────────────
    for rh in cfg["red_herrings"]["seal_5"]:
        ts = rand_ts(
            rng,
            parse_ts(tl["fbi_arrives"]),
            parse_ts(tl["midnight"]),
        )
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="radio", event_type="radio_intercept",
            floor=0, zone="exterior",
            channel=rh["channel"], severity="high",
            message=rh["message"],
        ))

    # ── post-FBI security events ─────────────────────────────────
    # NOTE: deliberately NOT using event_type="alarm_trigger" here.
    # Puzzle 4.1 ("The Fire Alarm") relies on a stable set of
    # alarm_trigger events whose LATEST is on floor 25 (McClane).
    # A random alarm_trigger from this background-noise loop on a
    # different floor would land after McClane's pull and break the
    # `| sort -_time | head 1` query, so we use motion_anomaly /
    # intrusion_alert here instead.
    for _ in range(30):
        ts = rand_ts(rng, parse_ts(tl["fbi_arrives"]), parse_ts(tl["midnight"]))
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="security",
            event_type=rng.choice(["perimeter_breach", "intrusion_alert", "motion_anomaly", "camera_motion"]),
            floor=rng.choice([1, 0, 30, "roof"]),
            zone=rng.choice(["exterior", "perimeter", "north_entrance"]),
            channel="", severity=rng.choice(["medium", "high"]),
            message=rng.choice([
                "Perimeter activity — multiple vehicles",
                "Helicopter approach — low altitude",
                "Spotlight activation — exterior",
                "Movement detected — unidentified",
                "Window breach — upper floor",
            ]),
        ))

    # ── Puzzle 4.1 ("The Fire Alarm") ────────────────────────────
    # McClane sets off the fire alarm on floor 25 to call attention
    # from outside. The puzzle SPL is:
    #   index=nakatomi_building event_type=alarm_trigger
    #     | sort -_time | head 1
    # …so the LATEST alarm_trigger must be on floor 25. We seed a
    # few earlier false-pull alarms on the trap-code floors
    # (24/26/30) so the puzzle isn't trivial — players have to
    # actually scan the timeline rather than just count.
    fire_alarm_events = [
        # Pre-takeover false pulls (party-related, so they land
        # earlier in `| sort -_time` than McClane's pull and act as
        # red-herring "trap code" answers 24 / 26 / 30).
        (parse_ts(tl["party_start"]) + timedelta(minutes=12),  24, "Smoke detected — kitchen prep area",                         "low"),
        (parse_ts(tl["party_start"]) + timedelta(minutes=37),  26, "Manual pull station 26-N — false alarm, reset by maintenance", "low"),
        (parse_ts(tl["party_start"]) + timedelta(hours=1, minutes=8),  30, "Smoke from sterno warmer — buffet station, reset",   "low"),
        # McClane's pull — narratively just before the FBI arrive
        # so the alarm is what brings outside attention. Placed
        # after roof_setup (23:30) so no random alarm_trigger from
        # other generators can land later.
        (parse_ts(tl["roof_setup"]) + timedelta(minutes=8), 25, "Manual pull station 25-W activated — UNKNOWN OPERATOR — no badge swipe", "high"),
    ]
    for ts, floor, msg, sev in fire_alarm_events:
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="fire_alarm", event_type="alarm_trigger",
            floor=floor, zone="interior",
            channel="", severity=sev,
            message=msg,
        ))

    # ── McClane hint events ──────────────────────────────────────
    mcclane_hints = [
        (tl["mcclane_first"], "Unaccounted personnel — floor sweep incomplete. One individual not in hostage count."),
        (tl["fbi_arrives"], "Radio traffic — unknown unit on building frequency. Officer requesting backup — wrong channel."),
        (tl["power_cut"], "Personnel down — floor 25. We've lost contact with Karl's team."),
        (tl["roof_setup"], "Movement in HVAC ducting — sensor trigger, no ID badge. Just another American who saw too many movies."),
        (tl["final_act"], "He's here. Hostile contact on floor 30. All units respond."),
    ]
    for ts_str, msg in mcclane_hints:
        events.append(make_event(
            parse_ts(ts_str),
            "nakatomi_building", "nakatomi:building:security",
            system="security", event_type="incident",
            floor=0, zone="building-wide",
            channel="internal", severity="critical",
            message=msg,
        ))

    return events


# ── side-story emitters (v2.9 / Phase 6 — id: p6-side-stories) ───
#
# Each function below seeds a narrative trail for one side mystery.
# They share a convention: put the 4-digit `discovery_code` into a
# unique `detail=` or `message=` field so a focused SPL query will
# surface it, but keep the seeded events low-volume so they don't
# distort the puzzle day. The in-game keypad listens for those
# codes (see game.html SIDE_STORIES) and fires the reveal toast.
#
# Helpers:
#   side_story_by_id(cfg, story_id) → dict lookup with id/code/etc.
#   _ss_code_for(cfg, story_id)     → just the 4-digit discovery code
# These are safe no-ops when scenario.yaml has no side_stories
# block (e.g. a legacy config loaded against a newer generator).

def _side_story_by_id(cfg, story_id):
    for s in cfg.get("side_stories") or []:
        if s.get("id") == story_id:
            return s
    return None


def _ss_code_for(cfg, story_id):
    s = _side_story_by_id(cfg, story_id)
    return (s or {}).get("discovery_code", "0000")


def generate_side_story_events(cfg, rng):
    """
    Emit the event trail for each of the Phase-6 side mysteries.

    Returns ``{"access": [...], "vault": [...], "building": [...]}``.
    Safe to run in both full and booth modes — the total event
    footprint is well under 200 events, so even booth demos carry
    the full curated side-story set. No-op when scenario.yaml has
    no ``side_stories:`` block.
    """
    if not cfg.get("side_stories"):
        return {"access": [], "vault": [], "building": []}

    access_events = []
    building_events = []

    tl = cfg["timeline"]
    party_setup = parse_iso(tl["party_setup"])
    heist_day = party_setup.date()

    def _days_before(days, hour, minute=0):
        """Timestamp ``days`` days before heist day at given H:M."""
        base = party_setup - timedelta(days=days)
        return base.replace(hour=hour, minute=minute, second=0, microsecond=0)

    def _emit_access(ts, **fields):
        access_events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge", **fields
        ))

    def _emit_building(ts, sourcetype, **fields):
        building_events.append(make_event(
            ts, "nakatomi_building", sourcetype, **fields
        ))

    # ── 1) The Affair ────────────────────────────────────────────
    # Harry Ellis pops up on floor 30 after hours Dec 17, 19, 20
    # (Holly's office). Discovery code 9012 goes in the last
    # "rose delivery log" reference.
    aff_code = _ss_code_for(cfg, "affair")
    affair_visits = [
        (_days_before(7, 21, 14), "late-night check-in to floor 30"),
        (_days_before(5, 22, 47), "after-hours floor 30 — exec suite"),
        (_days_before(4, 23, 3),  f"late-night visit to floor 30 (rose delivery log ref={aff_code})"),
    ]
    for ts, detail in affair_visits:
        _emit_access(
            ts, badge_id="HE-3301", name="Harry Ellis",
            department="International Trade", floor=30,
            room="Corner Office", action="swipe", outcome="allow",
            detail=detail,
        )

    # ── 2) Petty Cash Skim ───────────────────────────────────────
    # 6 small finance transactions by NP-2802 over a month,
    # summary memo with the discovery code.
    pc_code = _ss_code_for(cfg, "petty_cash")
    skim_amounts = [42.18, 51.04, 38.75, 47.50, 49.92, 45.33]
    for idx, amt in enumerate(skim_amounts):
        ts = party_setup - timedelta(days=30 - idx * 5, hours=rng.randint(10, 16))
        _emit_building(
            ts, "intranet:finance",
            system="expense_report", event_type="submission",
            requester="NP-2802", requester_name="Ulysses Bekele",
            department="Admin", floor=28,
            amount=amt, category="office supplies",
            memo="coffee fund replenishment",
        )
    _emit_building(
        _days_before(1, 14, 32),
        "intranet:finance",
        system="audit_queue", event_type="flag",
        requester="NP-2802", requester_name="Ulysses Bekele",
        flag_reason=f"pattern_small_amount_repeat threshold={pc_code}",
        total_flagged=4892.11,
        memo=f"Q4 audit preview: 6-month skim pattern detected on NP-2802 (threshold ref={pc_code}).",
    )

    # ── 3) Ghost Account ─────────────────────────────────────────
    # Terminated badge XG-9999 still used for server-room access
    # on floor 25 at night. The discovery code is embedded in the
    # swipe's detail field.
    ga_code = _ss_code_for(cfg, "ghost_account")
    ghost_nights = [_days_before(6, 1, 12), _days_before(3, 2, 41), _days_before(1, 1, 58)]
    for ts in ghost_nights:
        _emit_access(
            ts, badge_id="XG-9999", name="Evan Rutherford",
            department="(terminated)", floor=25,
            room="Server Room", action="swipe", outcome="allow",
            detail=f"terminated_badge_active ref={ga_code} — badge not revoked",
        )

    # ── 4) Y2K Test ──────────────────────────────────────────────
    y2k_code = _ss_code_for(cfg, "y2k")
    _emit_building(
        _days_before(2, 9, 17),
        "intranet:it",
        system="it_ops", event_type="scheduled_test",
        ticket=f"IT-{y2k_code}",
        affected_hosts=14, duration_seconds=40,
        message=f'Y2K date-rollover test on legacy fleet: system_time forced to "1900-01-01T00:00:00" — do NOT tell the auditors (ticket={y2k_code}).',
    )
    _emit_building(
        _days_before(2, 9, 17) + timedelta(seconds=40),
        "intranet:it",
        system="it_ops", event_type="rollback",
        ticket=f"IT-{y2k_code}",
        message="Rollback complete — system_time restored. Memo follows.",
    )

    # ── 5) Disgruntled Sysadmin ──────────────────────────────────
    # Robert Chen (NP-4471) with after-hours swipes on floors 25
    # and B1 across the week. HR PIP memo ties it together.
    dis_code = _ss_code_for(cfg, "disgruntled_it")
    late_swipes = [
        (_days_before(6, 22, 14), 25, "R&D Lab"),
        (_days_before(6, 23, 47), "B1", "Vault Anteroom"),
        (_days_before(4, 22, 12), 25, "Server Room"),
        (_days_before(4, 23, 58), "B1", "Vault Anteroom"),
        (_days_before(2, 22, 33), 25, "Server Room"),
    ]
    for ts, floor, room in late_swipes:
        _emit_access(
            ts, badge_id="NP-4471", name="Robert Chen",
            department="IT Operations", floor=floor, room=room,
            action="swipe", outcome="allow",
            detail="after-hours admin access",
        )
    _emit_building(
        _days_before(5, 10, 20),
        "intranet:hr",
        system="hr_memo", event_type="pip_opened",
        case_id=f"HR-{dis_code}",
        subject="NP-4471",
        subject_name="Robert Chen",
        message=f"PIP opened (case={dis_code}) — employee passed over for VP slot in October; behaviour under review. See drafted-then-deleted email at timestamp.",
    )

    # ── 6) Pineapple Incident ────────────────────────────────────
    pz_code = _ss_code_for(cfg, "pizza")
    pizza_ts = _days_before(1, 13, 14)
    _emit_building(
        pizza_ts, "intranet:catering",
        system="catering", event_type="delivery",
        order_id=f"CAT-{pz_code}",
        destination_floor=15, destination_room="Trading Floor",
        items="12 pizzas (1 Hawaiian)",
        message=f"Delivery confirmed — pineapple detected on order {pz_code}.",
    )
    rant_times = [pizza_ts + timedelta(minutes=m) for m in (3, 7, 11, 18, 24, 33, 39)]
    rant_lines = [
        "Whoever ordered Hawaiian for the trading floor: explain yourself.",
        "Pineapple does not belong on pizza. This is a boundary issue.",
        "I specifically flagged no pineapple in the email last week. EVERY week.",
        "It's fine. It's ALL fine. We can just eat around the pineapple.",
        "IT just muted the channel. Fascist response.",
        "Update: the Hawaiian was eaten. By Kevin. Obviously.",
        "Thread closed. Pineapple is a workplace hazard. — Compliance",
    ]
    for ts, line in zip(rant_times, rant_lines):
        _emit_building(
            ts, "intranet:chat",
            system="intranet", event_type="chat_message",
            channel="floor-15-general",
            author=f"NP-{1500 + rng.randint(1, 10)}",
            message=line,
        )

    # ── 7) Theo's Homework ───────────────────────────────────────
    th_code = _ss_code_for(cfg, "theo_browser")
    proxy_pages = [
        ("security-research", "whitepaper: Physical vault failure modes (NIST)"),
        ("security-research", "paper: Seismic demolition & controlled collapse"),
        ("financial-filings", "SEC EDGAR: Nakatomi Trading 10-K (2023)"),
        ("security-research", "whitepaper: Electromagnetic locks — failure modes"),
        ("financial-filings", "SEC EDGAR: bearer-bond custody disclosure"),
        ("news", "LATimes: Nakatomi plaza Christmas party guest list leaks (1987)"),
        ("security-research", "video: Vault drill bit specifications"),
        ("technical-support", "forum: Mitsubishi 2600 elevator override"),
    ]
    start_ts = _days_before(21, 2, 0)
    for idx, (cat, title) in enumerate(proxy_pages):
        ts = start_ts + timedelta(days=idx * 2, hours=rng.randint(0, 3), minutes=rng.randint(0, 59))
        _emit_building(
            ts, "proxy:http",
            system="proxy", event_type="http_request",
            user_badge="TH-0099", user_name="Theo",
            url_category=cat,
            url_title=title,
            ticket=f"PX-{th_code}",
        )
    _emit_building(
        _days_before(1, 18, 5),
        "proxy:http",
        system="proxy", event_type="summary",
        user_badge="TH-0099", user_name="Theo",
        request_count=147,
        categories="security-research,financial-filings,news,technical-support",
        message=f"3-week summary — 147 hits concentrated on vault research (ref={th_code}).",
    )

    # ── 8) Bypassed Camera ───────────────────────────────────────
    cam_code = _ss_code_for(cfg, "bypassed_camera")
    takeover = parse_iso(tl["takeover"])
    # "Scheduled maintenance" 18 minutes before the takeover.
    cam_down = takeover - timedelta(minutes=18)
    _emit_building(
        cam_down, "nakatomi:building:security",
        system="security", event_type="camera_offline",
        floor=25, camera_id="CAM-25-NORTH",
        zone="north_loading",
        severity="low",
        scheduled_by="UNKNOWN",
        ticket=f"MAINT-{cam_code}",
        message=f"Scheduled maintenance — CAM-25-NORTH offline (ticket={cam_code}). No scheduler on record.",
    )
    _emit_building(
        cam_down + timedelta(minutes=18),
        "nakatomi:building:security",
        system="security", event_type="camera_offline_continued",
        floor=25, camera_id="CAM-25-NORTH",
        zone="north_loading",
        severity="medium",
        message="Crew movement detected in loading dock — no video coverage.",
    )

    return {
        "access": access_events,
        "vault": [],
        "building": building_events,
    }


def generate_red_herring_events(cfg, rng):
    """
    v2.9 / Phase 6 — promote red herrings to full teaching moments.

    Returns ``{"access": [...], "building": [...]}``.

    Emits two families of events:

    1. **Dedup traps** — near-duplicate badge swipes (0.4–0.8s apart)
       on known-glitchy readers. Teaches players that raw
       ``| stats count by badge_id`` can overcount when a reader
       debounces; correct technique is ``| dedup _time badge_id``
       or ``| bin _time span=2s | stats …``.

    2. **Cross-index echoes** — events in nakatomi_building whose
       MESSAGE text references a puzzle-critical badge ID but whose
       source is intranet:it / intranet:hr / proxy:http, NOT
       nakatomi:access:*. Teaches proper index + sourcetype scoping.

    Both are deliberately low-volume (~30 events total) so they add
    realism without drowning the main puzzle queries. Scope of the
    scenario.yaml driver section:

        red_herrings:
          dedup_traps:        [ … per-badge config … ]
          cross_index_echoes: [ … per-badge config … ]

    Missing config => empty result. Safe to call in both booth and
    full modes.
    """
    rh = (cfg.get("red_herrings") or {})
    access_events = []
    building_events = []

    tl = cfg["timeline"]
    party_start = parse_iso(tl["party_start"])
    takeover = parse_iso(tl["takeover"])

    # Employee directory lookup for ``name``/``department`` fields on
    # the duplicate badge reads. Small O(N) helper — N ≤ ~90.
    all_chars = (
        (cfg.get("characters", {}).get("key_employees") or [])
        + (cfg.get("characters", {}).get("supporting") or [])
    )
    by_badge = {c.get("badge_id"): c for c in all_chars if c.get("badge_id")}

    # ── Dedup traps ──────────────────────────────────────────────
    for cfg_row in (rh.get("dedup_traps") or []):
        badge = cfg_row.get("badge_id")
        if not badge:
            continue
        emp = by_badge.get(badge, {})
        count = int(cfg_row.get("count", 6))
        floor = cfg_row.get("floor", 1)
        room = cfg_row.get("room", "Unknown")
        reader = cfg_row.get("reader", "RDR-UNKNOWN")
        detail = cfg_row.get("detail", "badge reader glitch")
        ghost_min = float(cfg_row.get("ghost_delay_seconds_min", 0.4))
        ghost_max = float(cfg_row.get("ghost_delay_seconds_max", 0.8))

        # Spread the primary swipes across the party window so they
        # blend into the rest of the dataset. Each primary swipe gets
        # a "ghost" duplicate 0.4-0.8s later from the same reader.
        for _ in range(count):
            ts_primary = rand_ts(rng, party_start, takeover)
            ghost_offset = rng.uniform(ghost_min, ghost_max)
            ts_ghost = ts_primary + timedelta(seconds=ghost_offset)

            base_kwargs = dict(
                badge_id=badge,
                name=emp.get("name", ""),
                department=emp.get("department", ""),
                floor=floor,
                room=room,
                reader=reader,
                action="swipe",
                outcome="allow",
                detail=detail,
            )
            access_events.append(make_event(
                ts_primary, "nakatomi_access", "nakatomi:access:badge",
                **base_kwargs
            ))
            # Second (ghost) read — same payload, later timestamp. The
            # reader is identical, so a correctly scoped dedup by
            # (_time bucket, badge_id, reader) collapses both into
            # one. Marking it ``ghost_read=true`` gives facilitators
            # a clean back-channel to debug and doesn't appear in the
            # puzzle hints.
            access_events.append(make_event(
                ts_ghost, "nakatomi_access", "nakatomi:access:badge",
                ghost_read="true",
                **base_kwargs
            ))

    # ── Cross-index echoes ───────────────────────────────────────
    # These are deliberately in nakatomi_building so a player doing
    # `index=* badge_id=…` sees them and has to learn to scope.
    # 300-number monotonic ticket IDs so they stand out from the
    # real nakatomi_access events (which carry no ``ticket_id``).
    next_tid = 3101
    for cfg_row in (rh.get("cross_index_echoes") or []):
        badge = cfg_row.get("badge_id")
        count = int(cfg_row.get("count", 3))
        source = cfg_row.get("source", "intranet:it")
        tmpl = cfg_row.get("message_template", "ref badge={badge}")
        for _ in range(count):
            tid = next_tid
            next_tid += 1
            ts = rand_ts(rng, party_start, takeover)
            msg = tmpl.format(tid=tid, badge=badge)
            building_events.append(make_event(
                ts, "nakatomi_building", source,
                ticket_id=str(tid),
                ref_badge=badge,
                message=msg,
            ))

    return {
        "access": access_events,
        "building": building_events,
    }


def generate_easter_egg_events(cfg, rng):
    """
    v2.9 / Phase 6d — emit one data anchor per keypad-triggerable
    easter egg.

    The UI-side registry (``game.html`` → ``EASTER_EGGS``) is the
    source of truth for narrative text, ordering, and keypad codes.
    This function reads ``cfg["easter_eggs"]`` (see ``scenario.yaml``)
    and emits a single event per egg into the matching index so that
    a curious analyst can find it via SPL rather than brute-forcing
    the ``6xxx`` keypad namespace.

    Invariants:
      * Every discovery_code MUST be unique across the file.
      * Every discovery_code MUST live in the ``6xxx`` range (the
        UI-side namespace for easter eggs) and must NOT collide with
        vault seals (2512/7439/4291/8086/5765/3940), trap codes
        (1990/0911/1666/1988/1215), or side-story codes (9xxx).
      * The Konami-code egg has ``discovery_code: null`` / missing
        and is skipped here (it's a pure UI gesture, no data anchor).
      * Timestamps in YAML are naive ISO strings in PST; they are
        rehydrated with the TZ_OFFSET used across the rest of the
        generator so downstream ``_time`` queries stay consistent.

    Returns ``{"access": [...], "building": [...], "vault": [...],
    "comms": [...]}`` so ``main()`` can append to each per-index
    bucket. Missing config => empty buckets.

    Low-volume: exactly 14 events for the shipping v2.9 scenario.
    Cheap to generate in both booth and full modes.
    """
    eggs = (cfg.get("easter_eggs") or [])
    buckets = {
        "access": [],
        "building": [],
        "vault": [],
        "comms": [],
    }
    if not eggs:
        return buckets

    # Index → bucket routing. Keep the mapping explicit so a typo in
    # YAML surfaces as a KeyError at generation time rather than
    # silently dropping events.
    index_bucket = {
        "nakatomi_access": "access",
        "nakatomi_building": "building",
        "nakatomi_vault": "vault",
        "nakatomi_comms": "comms",
    }

    # Sync-check against vault/trap/side-story codes so we fail loud
    # if a future edit to scenario.yaml introduces a collision. This
    # is cheap (O(eggs * seals)) and keeps the generator honest.
    # ``seals`` in scenario.yaml is a dict keyed 1..6, not a list.
    seal_codes = {
        s["code"] for s in (cfg.get("seals") or {}).values()
        if isinstance(s, dict) and s.get("code")
    }
    side_codes = {s["discovery_code"] for s in (cfg.get("side_stories") or [])
                  if s.get("discovery_code")}
    trap_codes = set((cfg.get("trap_code_lore") or {}).keys())

    seen_codes = set()
    for egg in eggs:
        eid = egg.get("id", "<unknown>")
        code = egg.get("discovery_code")
        # Konami-style eggs (no discovery_code) have no data anchor.
        if not code:
            continue

        if code in seen_codes:
            raise ValueError(f"easter_eggs: duplicate discovery_code {code} (id={eid})")
        seen_codes.add(code)

        if not (code.isdigit() and len(code) == 4 and code.startswith("6")):
            raise ValueError(
                f"easter_eggs: discovery_code {code!r} (id={eid}) must be a 4-digit "
                f"value in the 6xxx namespace (see game.html EASTER_EGGS)."
            )
        if code in seal_codes:
            raise ValueError(f"easter_eggs: code {code} (id={eid}) collides with a vault seal.")
        if code in side_codes:
            raise ValueError(f"easter_eggs: code {code} (id={eid}) collides with a side story.")
        if code in trap_codes:
            raise ValueError(f"easter_eggs: code {code} (id={eid}) collides with a trap code.")

        index = egg.get("index", "nakatomi_building")
        sourcetype = egg.get("sourcetype", "intranet:it")
        bucket_name = index_bucket.get(index)
        if bucket_name is None:
            raise ValueError(
                f"easter_eggs: unknown index {index!r} for egg {eid}; "
                f"expected one of {sorted(index_bucket)}"
            )

        ts_hint = egg.get("timestamp_hint")
        if not ts_hint:
            raise ValueError(f"easter_eggs: missing timestamp_hint for egg {eid}")
        try:
            # Authored as naive ISO in PST; attach TZ_OFFSET so the
            # resulting _time lines up with the rest of the scenario.
            ts = datetime.fromisoformat(ts_hint).replace(tzinfo=TZ_OFFSET)
        except ValueError as exc:
            raise ValueError(
                f"easter_eggs: invalid timestamp_hint {ts_hint!r} for egg {eid}"
            ) from exc

        # Build the event payload. Always tag it with ``egg_id`` and
        # the discovery code so facilitators can audit which eggs
        # actually shipped in the dataset without scraping text —
        # but keep user-facing fields (message, etc.) free of any
        # literal "easter egg" markers so the mystery stays intact.
        fields = dict(egg.get("fields") or {})
        fields.setdefault("egg_id", eid)
        fields.setdefault("egg_code", code)

        ev = make_event(ts, index, sourcetype, **fields)
        buckets[bucket_name].append(ev)

    return buckets


def generate_intranet_announcements(cfg, rng):
    """
    v2.9 / Phase 6e — emit the lore bulletin board.

    Reads ``cfg["announcements"]`` (see ``scenario.yaml``) and emits
    one event per bulletin into ``nakatomi_building`` with sourcetype
    ``intranet:announcements``. Pure texture — the bulletins build
    out the Nakatomi Plaza world referenced by
    ``docs/NAKATOMI_LORE.md`` and give a curious analyst something
    to find outside the main puzzle chain.

    Invariants (enforced here so a future lore edit can't silently
    clash with a puzzle answer):

      * Every ``bulletin_id`` MUST be unique across the file.
      * Every text field (``subject``, ``message``) is scanned for
        4-digit numbers; if ANY 4-digit substring matches a live
        seal code, trap code, side-story code, or easter-egg code
        the generator raises ``ValueError``.
      * Timestamps are naive PST ISO strings. They are rehydrated
        with ``TZ_OFFSET`` so the ``_time`` field lines up with
        the rest of the scenario.

    Returns a list of events. Always safe to call in booth mode —
    the total volume is ~7 events and booth visitors benefit from
    seeing the bulletin board even in a 5-minute slot.
    """
    ann_cfg = cfg.get("announcements") or []
    if not ann_cfg:
        return []

    events = []

    # Build a guard-rail set of all 4-digit codes that ALREADY have
    # a puzzle meaning. If an author accidentally drops "2512" or
    # "6024" into a bulletin message, discovery SPL queries would
    # return the wrong anchor event. Fail loud at generation time.
    # ``seals`` in scenario.yaml is a dict keyed 1..6.
    seal_codes = {
        s["code"] for s in (cfg.get("seals") or {}).values()
        if isinstance(s, dict) and s.get("code")
    }
    side_codes = {s["discovery_code"] for s in (cfg.get("side_stories") or [])
                  if s.get("discovery_code")}
    trap_codes = set((cfg.get("trap_code_lore") or {}).keys())
    egg_codes = {e["discovery_code"] for e in (cfg.get("easter_eggs") or [])
                 if e.get("discovery_code")}
    reserved_codes = seal_codes | side_codes | trap_codes | egg_codes

    # Pattern is intentionally strict: any isolated 4-digit run in
    # the bulletin text must not collide. We allow the codes to
    # appear inside longer digit strings (5+ digits are usually
    # dates or ticket IDs, which we don't reserve) — the check is
    # for standalone 4-digit tokens that an analyst would punch
    # into the keypad.
    four_digit_re = re.compile(r"(?<!\d)\d{4}(?!\d)")

    seen_ids = set()
    for ann in ann_cfg:
        aid = ann.get("bulletin_id")
        if not aid:
            raise ValueError(
                f"announcements: entry is missing required 'bulletin_id' field: {ann!r}"
            )
        if aid in seen_ids:
            raise ValueError(f"announcements: duplicate bulletin_id {aid}")
        seen_ids.add(aid)

        ts_hint = ann.get("timestamp")
        if not ts_hint:
            raise ValueError(f"announcements: missing timestamp for {aid}")
        try:
            ts = datetime.fromisoformat(ts_hint).replace(tzinfo=TZ_OFFSET)
        except ValueError as exc:
            raise ValueError(
                f"announcements: invalid timestamp {ts_hint!r} for {aid}"
            ) from exc

        subject = ann.get("subject", "")
        message = ann.get("message", "")
        for field_name, field_value in (("subject", subject), ("message", message)):
            for hit in four_digit_re.findall(field_value or ""):
                if hit in reserved_codes:
                    raise ValueError(
                        f"announcements: bulletin {aid} {field_name!r} contains "
                        f"reserved 4-digit code {hit!r} — collides with a seal, "
                        f"trap, side-story, or easter-egg answer. Rewrite the "
                        f"copy to avoid that number."
                    )

        events.append(make_event(
            ts, "nakatomi_building", "intranet:announcements",
            bulletin_id=aid,
            author=ann.get("author", "intranet.system"),
            author_name=ann.get("author_name", ""),
            author_title=ann.get("author_title", ""),
            department=ann.get("department", "General"),
            subject=subject,
            message=message,
        ))

    return events


# ── lookup generators ────────────────────────────────────────────

def generate_floor_directory(cfg):
    rows = []
    for f in cfg["building"]["floors"]:
        rows.append({
            "floor": str(f["number"]),
            "floor_name": f["name"],
            "tenant": f.get("tenant", "Nakatomi Corp"),
            "floor_group": f["group"],
            "restricted": str(f["restricted"]).lower(),
        })
    return rows


def generate_employee_directory(cfg, rng):
    rows = []
    seen_badges = set()

    def _add(badge_id, name, department, clearance, status="active"):
        if badge_id in seen_badges:
            return
        seen_badges.add(badge_id)
        rows.append({
            "badge_id": badge_id,
            "name": name,
            "department": department,
            "clearance_level": clearance,
            "status": status,
            "hire_date": f"20{rng.randint(16, 24)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
        })

    for group in ["key_employees", "supporting", "protagonists"]:
        for c in cfg["characters"].get(group, []):
            _add(
                c["badge_id"], c["name"], c["department"], c["clearance"],
                status="terminated" if c["badge_id"] == "JT-0001" else "active",
            )

    # v2.9 / Phase 6 — register every NPC so the directory lookup
    # returns hits for the new badge traffic. Booth mode still
    # generates the same lookup (intentional: facilitator queries
    # like `lookup employee_directory.csv badge_id` keep working).
    for group_name, group_list in (cfg.get("npcs") or {}).items():
        for npc in group_list or []:
            _add(npc["badge_id"], npc["name"], npc["department"], npc["clearance"])

    # v2.9 / Phase 6a — register Christmas-party guest crowd so the
    # `lookup employee_directory badge_id` join used by Seal 2
    # follow-up queries still returns a name + department for
    # GUEST-### badges. Stashed on cfg by generate_badge_events().
    for guest in cfg.get("_party_guest_records") or []:
        _add(
            guest["badge_id"], guest["name"], guest["department"],
            guest.get("clearance", "LEVEL-1"), status="visitor",
        )

    # v2.9 / Phase 6 — side-story extras. The Ghost Account story
    # (id: ghost_account) needs a *terminated* lookup hit for
    # badge XG-9999 so the join in the SPL hint actually surfaces
    # the discovery. All other side-story actors already live in
    # characters / npcs, so they're registered above.
    if any((s.get("id") == "ghost_account") for s in (cfg.get("side_stories") or [])):
        _add("XG-9999", "Evan Rutherford", "IT Operations", "LEVEL-3",
             status="terminated")

    # Tail of legacy random fillers (kept so existing SPL queries
    # that count "≥40 fillers" still hold). New badges are unique.
    for _ in range(40):
        bid = rand_badge(rng)
        if bid in seen_badges:
            continue
        _add(
            bid, rand_name(rng),
            rng.choice(["Finance", "HR", "Legal", "IT", "Facilities",
                        "Marketing", "Sales", "R&D", "Admin"]),
            rng.choice(["LEVEL-1", "LEVEL-2", "LEVEL-3", "LEVEL-4"]),
        )
    return rows


def generate_system_codes(cfg):
    return [
        {"system_id": "SYS-MAIN", "description": "Building Master Control", "clearance_level": "LEVEL-1", "vault_auth_code": "", "location": "Lobby"},
        {"system_id": "SYS-ELEV", "description": "Elevator Override", "clearance_level": "LEVEL-2", "vault_auth_code": "", "location": "All floors"},
        {"system_id": "SYS-HVAC", "description": "HVAC Master Control", "clearance_level": "LEVEL-3", "vault_auth_code": "", "location": "Mechanical"},
        {"system_id": "SYS-FIRE", "description": "Fire Suppression Override", "clearance_level": "LEVEL-4", "vault_auth_code": "2817", "location": "All floors"},
        {"system_id": "SYS-VAULT", "description": "Vault Primary Authorization", "clearance_level": "LEVEL-5", "vault_auth_code": cfg["seals"][6]["code"], "location": "B1"},
        {"system_id": "SYS-EXEC", "description": "Executive Override", "clearance_level": "LEVEL-6", "vault_auth_code": "6102", "location": "Floor 35"},
    ]


# ── infrastructure seed (puzzle-critical sourcetypes) ─────────────
#
# Phone, radio, camera, elevator, and power-grid events are authored
# as curated seed files under generator/infrastructure/. They are
# merged into the canonical HEC outputs on every run so
# load_data.sh / batch inputs always carry Act 2–5 puzzle data even
# though the procedural generators above only emit access/vault/hvac.

INFRA_SEED_DIR = SCRIPT_DIR / "infrastructure"


def load_infrastructure_seed_events():
    """Return (building_events, comms_events) from infrastructure/*.json."""
    building: list[dict] = []
    comms: list[dict] = []
    if not INFRA_SEED_DIR.is_dir():
        return building, comms
    for path in sorted(INFRA_SEED_DIR.glob("*.json")):
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                ev = json.loads(line)
                idx = ev.get("index")
                if idx == "nakatomi_building":
                    building.append(ev)
                elif idx == "nakatomi_comms":
                    comms.append(ev)
    return building, comms


def purge_legacy_output_shards(out_dir: Path) -> int:
    """Remove per-sourcetype shard JSON files superseded by canonical outputs."""
    removed = 0
    for path in out_dir.glob("nakatomi_*_*.json"):
        path.unlink()
        removed += 1
    return removed


# ── write helpers ────────────────────────────────────────────────

def write_events(events, filepath):
    events.sort(key=lambda e: e["time"])
    with open(filepath, "w", encoding="utf-8") as f:
        for ev in events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    return len(events)


def write_csv(rows, filepath, fieldnames):
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


# ── main ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate Nakatomi Plaza escape room dataset")
    parser.add_argument("-c", "--config", default=str(DEFAULT_CONFIG), help="Path to scenario YAML")
    parser.add_argument("--seed", type=int, default=None, help="Override random seed")
    parser.add_argument(
        "--booth-mode",
        action="store_true",
        help="Booth/conference build: skip the 50k-event NPC baseline so demos stay puzzle-only.",
    )
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    seed = args.seed if args.seed is not None else cfg.get("seed", 19881215)
    rng = random.Random(seed)
    print(f"Seed: {seed}")
    if args.booth_mode:
        print("Booth mode: NPC baseline disabled — puzzle-only dataset.")

    out_dir = SCRIPT_DIR / cfg["output"]["directory"]
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── generate events ──────────────────────────────────────────
    access_events = generate_badge_events(cfg, rng) + generate_door_events(cfg, rng)
    vault_events = generate_vault_events(cfg, rng)
    building_events = generate_building_events(cfg, rng)

    npc_added = 0
    if not args.booth_mode:
        npc_buckets = generate_npc_baseline_events(cfg, rng)
        access_events.extend(npc_buckets["access"])
        vault_events.extend(npc_buckets["vault"])
        building_events.extend(npc_buckets["building"])
        npc_added = sum(len(v) for v in npc_buckets.values())

    # Side-story trails run in BOTH modes — the curated set is only
    # ~60 events total, so booth demos still get the full mystery
    # roster (players rarely discover these in a 15-min slot, but
    # facilitators and reruns benefit from them).
    side_buckets = generate_side_story_events(cfg, rng)
    access_events.extend(side_buckets["access"])
    vault_events.extend(side_buckets["vault"])
    building_events.extend(side_buckets["building"])
    side_added = sum(len(v) for v in side_buckets.values())

    # Red-herrings (dedup traps + cross-index echoes) run in both
    # booth and full modes — ~30 events total, cheap.
    rh_buckets = generate_red_herring_events(cfg, rng)
    access_events.extend(rh_buckets["access"])
    building_events.extend(rh_buckets["building"])
    rh_added = sum(len(v) for v in rh_buckets.values())

    # Easter eggs (v2.9 / Phase 6d) — 14 data-anchor events across
    # four indexes. Always generated: the volume is trivial and
    # booth players benefit from the same discovery surface as full
    # scenarios. The nakatomi_comms output file is NEW in v2.9 (no
    # existing generator writes to comms today) and only emitted
    # when at least one egg lands in that bucket.
    egg_buckets = generate_easter_egg_events(cfg, rng)
    access_events.extend(egg_buckets["access"])
    vault_events.extend(egg_buckets["vault"])
    building_events.extend(egg_buckets["building"])
    comms_events = list(egg_buckets["comms"])
    egg_added = (
        len(egg_buckets["access"])
        + len(egg_buckets["vault"])
        + len(egg_buckets["building"])
        + len(comms_events)
    )

    # Intranet announcements (v2.9 / Phase 6e) — ~7 bulletin-board
    # events in index=nakatomi_building sourcetype=intranet:announcements.
    # Pure world-building texture (see docs/NAKATOMI_LORE.md § 5.1).
    # Always generated — trivial volume, booth demos still get the
    # lore layer on floor 1.
    ann_events = generate_intranet_announcements(cfg, rng)
    building_events.extend(ann_events)
    ann_added = len(ann_events)

    infra_b, infra_c = load_infrastructure_seed_events()
    building_events.extend(infra_b)
    comms_events.extend(infra_c)
    infra_added = len(infra_b) + len(infra_c)
    shards_removed = purge_legacy_output_shards(out_dir)

    n1 = write_events(access_events, out_dir / "nakatomi_access.json")
    n2 = write_events(vault_events, out_dir / "nakatomi_vault.json")
    n3 = write_events(building_events, out_dir / "nakatomi_building.json")
    n4 = write_events(comms_events, out_dir / "nakatomi_comms.json") if comms_events else 0

    print(f"nakatomi_access.json : {n1} events")
    print(f"nakatomi_vault.json  : {n2} events")
    print(f"nakatomi_building.json: {n3} events")
    if n4:
        print(f"nakatomi_comms.json  : {n4} events")
    if npc_added:
        print(f"  (includes {npc_added} NPC baseline events)")
    if side_added:
        print(f"  (includes {side_added} side-story events)")
    if rh_added:
        print(f"  (includes {rh_added} red-herring events)")
    if egg_added:
        print(f"  (includes {egg_added} easter-egg events)")
    if ann_added:
        print(f"  (includes {ann_added} intranet-announcement events)")
    if infra_added:
        print(f"  (includes {infra_added} infrastructure seed events)")
    if shards_removed:
        print(f"  (removed {shards_removed} legacy output shard file(s))")

    # ── generate lookups ─────────────────────────────────────────
    floors = generate_floor_directory(cfg)
    write_csv(floors, out_dir / "floor_directory.csv",
              ["floor", "floor_name", "tenant", "floor_group", "restricted"])

    employees = generate_employee_directory(cfg, rng)
    write_csv(employees, out_dir / "employee_directory.csv",
              ["badge_id", "name", "department", "clearance_level", "status", "hire_date"])

    codes = generate_system_codes(cfg)
    write_csv(codes, out_dir / "system_codes.csv",
              ["system_id", "description", "clearance_level", "vault_auth_code", "location"])

    print(f"floor_directory.csv  : {len(floors)} rows")
    print(f"employee_directory.csv: {len(employees)} rows")
    print(f"system_codes.csv     : {len(codes)} rows")

    total = n1 + n2 + n3 + n4
    print(f"\nTotal: {total} events + 3 lookups → {out_dir}/")


if __name__ == "__main__":
    main()
