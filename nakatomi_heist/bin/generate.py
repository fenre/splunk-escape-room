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
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = SCRIPT_DIR / "scenario.yaml"
TZ_OFFSET = timezone(timedelta(hours=-8))  # PST


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

def generate_badge_events(cfg, rng):
    """Generate nakatomi:access:badge events."""
    events = []
    tl = cfg["timeline"]
    floors_cfg = cfg["building"]["floors"]
    floor_nums = [f["number"] for f in floors_cfg]
    party_floors = [1, 15, 20, 30]
    rooms_by_floor = {
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

    for _ in range(200):
        ts = rand_ts(rng, t_setup, t_takeover)
        emp = rng.choice(all_employees)
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
        detail=f"exec_calendar: vault maintenance cycle {seal2_code} — rotation scheduled 2025-12-25T02:00",
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
    t_secured = parse_ts(tl["floors_secured"])
    crew = all_chars["protagonists"]
    for _ in range(60):
        ts = rand_ts(rng, t_takeover, t_secured + timedelta(minutes=20))
        actor = rng.choice(crew + employees[:3])
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
    for _ in range(30):
        ts = rand_ts(rng, parse_ts(tl["fbi_arrives"]), parse_ts(tl["midnight"]))
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="security",
            event_type=rng.choice(["perimeter_breach", "alarm_trigger", "camera_motion"]),
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
    for group in ["key_employees", "supporting", "protagonists"]:
        for c in cfg["characters"].get(group, []):
            rows.append({
                "badge_id": c["badge_id"],
                "name": c["name"],
                "department": c["department"],
                "clearance_level": c["clearance"],
                "status": "terminated" if c["badge_id"] == "JT-0001" else "active",
                "hire_date": f"20{rng.randint(16, 24)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            })
    for _ in range(40):
        rows.append({
            "badge_id": rand_badge(rng),
            "name": rand_name(rng),
            "department": rng.choice([
                "Finance", "HR", "Legal", "IT", "Facilities",
                "Marketing", "Sales", "R&D", "Admin",
            ]),
            "clearance_level": rng.choice(["LEVEL-1", "LEVEL-2", "LEVEL-3", "LEVEL-4"]),
            "status": "active",
            "hire_date": f"20{rng.randint(16, 24)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
        })
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
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    seed = args.seed if args.seed is not None else cfg.get("seed", 19881215)
    rng = random.Random(seed)
    print(f"Seed: {seed}")

    out_dir = SCRIPT_DIR / cfg["output"]["directory"]
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── generate events ──────────────────────────────────────────
    access_events = generate_badge_events(cfg, rng) + generate_door_events(cfg, rng)
    vault_events = generate_vault_events(cfg, rng)
    building_events = generate_building_events(cfg, rng)

    n1 = write_events(access_events, out_dir / "nakatomi_access.json")
    n2 = write_events(vault_events, out_dir / "nakatomi_vault.json")
    n3 = write_events(building_events, out_dir / "nakatomi_building.json")

    print(f"nakatomi_access.json : {n1} events")
    print(f"nakatomi_vault.json  : {n2} events")
    print(f"nakatomi_building.json: {n3} events")

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

    total = n1 + n2 + n3
    print(f"\nTotal: {total} events + 3 lookups → {out_dir}/")


if __name__ == "__main__":
    main()
