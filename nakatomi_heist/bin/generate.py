#!/usr/bin/env python3
"""
Nakatomi Plaza: Vault Heist v2.0 — Data Generator

Produces Splunk-ingestible JSON event files and CSV lookup tables from
scenario.yaml.  Same seed = same dataset (deterministic).

Generates ~4,000 events across 11 sourcetypes in 4 indexes, plus 7 lookup
tables for the five-act game structure.

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

UNIQUE_BADGE_TARGET = 47


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}" + dt.strftime("%z")


def rot13(text: str) -> str:
    return codecs.encode(text, "rot_13")


def rand_ts(rng: random.Random, start: datetime, end: datetime) -> datetime:
    delta = (end - start).total_seconds()
    if delta <= 0:
        return start
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


def parse_ts(ts_str):
    return datetime.fromisoformat(ts_str).replace(tzinfo=TZ_OFFSET)


# ── Badge Events ─────────────────────────────────────────────────

def generate_badge_events(cfg, rng):
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
    employees = all_chars["key_employees"] + all_chars["supporting"]

    filler_needed = UNIQUE_BADGE_TARGET - len(employees) - len(all_chars["protagonists"])
    filler_employees = []
    used_badges = {e["badge_id"] for e in employees} | {p["badge_id"] for p in all_chars["protagonists"]}
    for _ in range(max(0, filler_needed)):
        badge = rand_badge(rng)
        while badge in used_badges:
            badge = rand_badge(rng)
        used_badges.add(badge)
        filler_employees.append({
            "badge_id": badge,
            "name": rand_name(rng),
            "department": rng.choice(["Finance", "HR", "Legal", "IT", "Facilities", "Marketing", "Sales", "R&D", "Admin"]),
            "clearance": rng.choice(["LEVEL-1", "LEVEL-2", "LEVEL-3"]),
        })
    all_employees = employees + filler_employees

    t_setup = parse_ts(tl["party_setup"])
    t_party = parse_ts(tl["party_start"])
    t_takeover = parse_ts(tl["takeover"])

    badge_pool = list(all_employees) + list(all_chars["protagonists"][:1])
    for emp in all_employees:
        ts = rand_ts(rng, t_setup, t_takeover)
        floor = rng.choice(party_floors if ts >= t_party else floor_nums[:8])
        if isinstance(floor, dict):
            floor = floor.get("number", 1)
        rooms = rooms_by_floor.get(floor, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=emp["badge_id"], name=emp["name"],
            department=emp.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action="swipe", outcome="allow", detail="regular access",
        ))

    for _ in range(250):
        ts = rand_ts(rng, t_setup, t_takeover)
        emp = rng.choice(all_employees)
        floor = rng.choice(party_floors if ts >= t_party else floor_nums[:8])
        if isinstance(floor, dict):
            floor = floor.get("number", 1)
        rooms = rooms_by_floor.get(floor, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=emp["badge_id"], name=emp["name"],
            department=emp.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action="swipe", outcome="allow", detail="regular access",
        ))

    # Seal 1 critical: lobby override
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

    # Seal 2 critical: Takagi schedule
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

    # Task 1.2: Takagi's latest badge swipe on floor 30
    events.append(make_event(
        parse_ts(tl["party_peak"]) + timedelta(minutes=45),
        "nakatomi_access", "nakatomi:access:badge",
        badge_id="JT-0001", name="Joseph Takagi",
        department="CEO", floor=30,
        room="Main Hall", action="swipe",
        outcome="allow", detail="party attendance",
    ))

    # Red herrings
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

    # Takeover badge activity — crew uses "forced" action (not "swipe")
    # to keep dc(badge_id) for action=swipe at exactly UNIQUE_BADGE_TARGET.
    # Takagi (JT-0001) is excluded — he is killed during the takeover.
    t_secured = parse_ts(tl["floors_secured"])
    crew = all_chars["protagonists"]
    live_employees = [e for e in employees[:3] if e["badge_id"] != "JT-0001"]
    for _ in range(80):
        ts = rand_ts(rng, t_takeover, t_secured + timedelta(minutes=20))
        actor = rng.choice(crew + live_employees)
        floor = rng.choice([1, 15, 20, 25, 28, 30, 35])
        rooms = rooms_by_floor.get(floor, ["General Area"])
        act = rng.choice(["forced", "forced", "forced", "scan"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=actor["badge_id"], name=actor["name"],
            department=actor.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action=act, outcome="allow",
            detail="post-takeover sweep",
        ))

    # Post-takeover crew movement — uses "forced" action
    t_midnight = parse_ts(tl["midnight"])
    for _ in range(60):
        ts = rand_ts(rng, t_secured + timedelta(minutes=20), t_midnight)
        actor = rng.choice(crew)
        floor = rng.choice([1, 30, "B1", "roof"])
        rooms = rooms_by_floor.get(floor, ["General Area"])
        events.append(make_event(
            ts, "nakatomi_access", "nakatomi:access:badge",
            badge_id=actor["badge_id"], name=actor["name"],
            department=actor.get("department", ""),
            floor=floor, room=rng.choice(rooms),
            action="forced", outcome="allow",
            detail="crew movement",
        ))

    return events


# ── Door Events ──────────────────────────────────────────────────

def generate_door_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
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

    for _ in range(300):
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


# ── Vault Events ─────────────────────────────────────────────────

def generate_vault_events(cfg, rng):
    events = []
    tl = cfg["timeline"]

    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])

    # System checks
    for i in range(50):
        ts = rand_ts(rng, t_start, t_end)
        sid = f"VS-{rng.randint(1, 37):04d}"
        events.append(make_event(
            ts, "nakatomi_vault", "nakatomi:vault:attempt",
            session_id=sid, user="system",
            action="system_check",
            detail="automated integrity verification",
            result="nominal",
        ))

    # Red herring sessions
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

    # Seal 3: Takagi session VS-0042
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

    # Vault system events
    events.append(make_event(
        parse_ts(tl["party_setup"]) - timedelta(hours=3, minutes=30),
        "nakatomi_vault", "nakatomi:vault:system",
        system="vault_protocol", event="documentation",
        action="system_note",
        message="VAULT PROTOCOL 7: Secondary release — electromagnetic failsafe. Final lock disengages on power loss. Not accessible via terminal. See facilities manual ref VP-7.",
    ))

    # Task 4.4: Detonator inventory
    events.append(make_event(
        parse_ts(tl["c4_planted"]) + timedelta(minutes=5),
        "nakatomi_vault", "nakatomi:vault:system",
        system="detonator_inventory", event="inventory_check",
        action="audit",
        message="Detonator inventory — original=12 current=9 missing=3. Discrepancy detected. Last access: floor 25 ventilation shaft.",
    ))

    for i in range(25):
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


# ── Building Events (HVAC, Security) ─────────────────────────────

def generate_building_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])

    zones = ["east_wing", "west_wing", "north_core", "south_core", "lobby", "mechanical"]
    hvac_floors = [1, 5, 10, 15, 20, 25, 28, 30, 35, "roof"]

    # HVAC telemetry
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

    # Seal 4: anomalous roof reading — value kept below 95 to not
    # overlap with C4 heat signatures (Task 4.2 counts value>95)
    seal4_plaintext = "THERE IS NO POWER WITHOUT CODE " + cfg["seals"][4]["code"]
    seal4_encoded = rot13(seal4_plaintext)
    t_roof = parse_ts(tl["roof_setup"]) - timedelta(minutes=18)
    events.append(make_event(
        t_roof, "nakatomi_building", "nakatomi:building:hvac",
        system="hvac", event="temp_reading",
        floor="roof", zone="mechanical",
        value=73.2, unit="F",
        encoded_message=seal4_encoded,
    ))

    # Task 4.2: C4 heat signatures (exactly 4 abnormal readings)
    c4_positions = ["north_section", "south_section", "east_section", "west_section"]
    for i, pos in enumerate(c4_positions):
        events.append(make_event(
            parse_ts(tl["c4_planted"]) + timedelta(minutes=i * 3),
            "nakatomi_building", "nakatomi:building:hvac",
            system="hvac", event="temp_reading",
            floor="roof", zone=pos,
            value=round(rng.uniform(96.0, 102.0), 1), unit="F",
        ))

    # Seal 4 red herrings
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

    # Elevator calls (generic, for existing data)
    for _ in range(80):
        ts = rand_ts(rng, t_start, t_end)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:hvac",
            system="elevator", event="car_call",
            floor=rng.choice([1, 10, 15, 20, 25, 30, 35]),
            zone="", value=rng.randint(1, 4), unit="car",
        ))

    # Power grid (generic)
    for _ in range(30):
        ts = rand_ts(rng, t_start, t_end)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:hvac",
            system="power", event="grid_status",
            floor=0, zone="utility",
            value=round(rng.gauss(480, 5), 1), unit="kW",
        ))

    # Security events (pre-FBI)
    for _ in range(60):
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

    # Task 4.1: Fire alarm trigger on floor 25
    events.append(make_event(
        parse_ts(tl["mcclane_fire_alarm"]),
        "nakatomi_building", "nakatomi:building:security",
        system="security", event_type="alarm_trigger",
        floor=25, zone="east_wing",
        channel="", severity="critical",
        message="FIRE ALARM ACTIVATED — floor 25 east wing — no smoke detected — manual pull station",
    ))

    # Decoy alarm triggers (earlier, different floors)
    for fl in [10, 20]:
        events.append(make_event(
            rand_ts(rng, t_start, parse_ts(tl["takeover"])),
            "nakatomi_building", "nakatomi:building:security",
            system="security", event_type="alarm_trigger",
            floor=fl, zone=rng.choice(zones),
            channel="", severity="medium",
            message="ALARM TEST — scheduled maintenance drill — disregard",
        ))

    # Seal 5: FBI radio intercept
    seal5_msg = cfg["seals"][5]["embed_value"]
    t_fbi = parse_ts(tl["power_cut"]) + timedelta(minutes=3, seconds=45)
    events.append(make_event(
        t_fbi, "nakatomi_building", "nakatomi:building:security",
        system="radio", event_type="radio_intercept",
        floor=0, zone="exterior",
        channel="freq_14", severity="high",
        message=seal5_msg,
    ))

    # Seal 5 red herrings
    for rh in cfg["red_herrings"]["seal_5"]:
        ts = rand_ts(rng, parse_ts(tl["fbi_arrives"]), parse_ts(tl["midnight"]))
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="radio", event_type="radio_intercept",
            floor=0, zone="exterior",
            channel=rh["channel"], severity="high",
            message=rh["message"],
        ))

    # Post-FBI security — uses perimeter_breach/camera_motion, NOT alarm_trigger
    for _ in range(40):
        ts = rand_ts(rng, parse_ts(tl["fbi_arrives"]), parse_ts(tl["midnight"]))
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:security",
            system="security",
            event_type=rng.choice(["perimeter_breach", "perimeter_breach", "camera_motion"]),
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

    # McClane hint events
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


# ── Camera Events ────────────────────────────────────────────────

def generate_camera_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])

    cameras = [
        ("CAM-B2-01", "B2", "parking"), ("CAM-B1-01", "B1", "vault"),
        ("CAM-01-01", 1, "lobby"), ("CAM-01-02", 1, "lobby"),
        ("CAM-02-01", 2, "loading"), ("CAM-05-01", 5, "office"),
        ("CAM-10-01", 10, "office"), ("CAM-15-01", 15, "office"),
        ("CAM-20-01", 20, "office"), ("CAM-25-01", 25, "lab"),
        ("CAM-28-01", 28, "office"), ("CAM-30-01", 30, "event"),
        ("CAM-30-02", 30, "event"), ("CAM-35-01", 35, "executive"),
        ("CAM-RF-01", "roof", "mechanical"),
    ]

    # Regular motion events
    for _ in range(350):
        ts = rand_ts(rng, t_start, t_end)
        cam_id, floor, zone = rng.choice(cameras)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:security:camera",
            camera_id=cam_id, floor=floor, zone=zone,
            event_type=rng.choice(["motion_detected", "area_clear", "recording"]),
            subject=rng.choice(["employee", "unknown", "group", "none"]),
            confidence=rng.randint(60, 99),
        ))

    # Task 2.3: Guard patrol events on floor 30 with a 12-min gap
    patrol_base = parse_ts(tl["party_start"])
    patrol_interval = timedelta(minutes=8)
    t_patrol = patrol_base
    gap_inserted = False
    while t_patrol < parse_ts(tl["takeover"]):
        events.append(make_event(
            t_patrol, "nakatomi_building", "nakatomi:security:camera",
            camera_id="CAM-30-01", floor=30, zone="event",
            event_type="guard_patrol",
            subject="security_guard",
            confidence=95,
        ))
        if not gap_inserted and t_patrol > patrol_base + timedelta(hours=1):
            t_patrol += timedelta(minutes=12)
            gap_inserted = True
        else:
            t_patrol += patrol_interval

    # Camera tamper events during takeover
    t_takeover = parse_ts(tl["takeover"])
    for cam_id, floor, zone in cameras:
        if floor in [25, 28, 30, 35, "roof"]:
            events.append(make_event(
                t_takeover + timedelta(minutes=rng.randint(5, 15)),
                "nakatomi_building", "nakatomi:security:camera",
                camera_id=cam_id, floor=floor, zone=zone,
                event_type="tamper_detected",
                subject="unknown",
                confidence=0,
            ))
            events.append(make_event(
                t_takeover + timedelta(minutes=rng.randint(16, 20)),
                "nakatomi_building", "nakatomi:security:camera",
                camera_id=cam_id, floor=floor, zone=zone,
                event_type="offline",
                subject="none",
                confidence=0,
            ))

    # SWAT coverage events
    t_fbi = parse_ts(tl["fbi_arrives"])
    swat_cams = [("CAM-01-01", 1, "lobby"), ("CAM-01-02", 1, "lobby"), ("CAM-RF-01", "roof", "mechanical")]
    for _ in range(40):
        ts = rand_ts(rng, t_fbi, parse_ts(tl["midnight"]))
        cam_id, floor, zone = rng.choice(swat_cams)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:security:camera",
            camera_id=cam_id, floor=floor, zone=zone,
            event_type="swat_position",
            subject="SWAT",
            confidence=99,
        ))

    return events


# ── Elevator Events ──────────────────────────────────────────────

def generate_elevator_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])
    t_takeover = parse_ts(tl["takeover"])

    cars = ["CAR-A", "CAR-B", "CAR-C", "CAR-D"]
    floors = [1, 5, 10, 15, 20, 25, 30, 35]

    # Normal operation
    for _ in range(200):
        ts = rand_ts(rng, t_start, t_takeover)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:elevator",
            car_id=rng.choice(cars), floor=rng.choice(floors),
            direction=rng.choice(["up", "down", "idle"]),
            status="active",
            passengers=rng.randint(0, 8),
        ))

    # Task 2.2: Override event with code 4401
    events.append(make_event(
        parse_ts(tl["elevators_locked"]),
        "nakatomi_building", "nakatomi:building:elevator",
        car_id="CAR-ALL", floor=0,
        direction="none",
        status="override",
        action="override",
        override_code="4401",
        passengers=0,
    ))

    # Post-lockdown: all locked
    for _ in range(60):
        ts = rand_ts(rng, t_takeover + timedelta(minutes=10), t_end)
        events.append(make_event(
            ts, "nakatomi_building", "nakatomi:building:elevator",
            car_id=rng.choice(cars),
            floor=rng.choice([1, 30]),
            direction="none",
            status="locked",
            passengers=0,
        ))

    return events


# ── Power Events ─────────────────────────────────────────────────

def generate_power_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])
    t_power_cut = parse_ts(tl["power_cut"])

    power_floors = [1, 2, 3, 5, 10, 15, 20, 25, 28, 30, 35, "roof"]

    # Normal readings
    interval = cfg["volume"]["power_readings_interval_minutes"]
    t_cursor = t_start
    while t_cursor < t_end:
        floor = rng.choice(power_floors)
        load = round(rng.gauss(45, 8), 1)
        status = "active"
        if t_cursor > t_power_cut:
            status = rng.choice(["active", "active", "offline", "standby"])
        events.append(make_event(
            t_cursor + timedelta(seconds=rng.randint(0, 30)),
            "nakatomi_building", "nakatomi:building:power",
            floor=floor,
            circuit_id=f"CKT-{floor}-MAIN",
            load_kw=load,
            status=status,
            breaker_state="closed" if status == "active" else "open",
        ))
        t_cursor += timedelta(minutes=interval)

    # Task 5.3: Post-power-cut, floor 2 still active (loading dock exit)
    for fl in power_floors:
        st = "active" if fl == 2 else "offline"
        events.append(make_event(
            t_power_cut + timedelta(minutes=5),
            "nakatomi_building", "nakatomi:building:power",
            floor=fl,
            circuit_id=f"CKT-{fl}-MAIN",
            load_kw=round(rng.gauss(45, 8), 1) if st == "active" else 0.0,
            status=st,
            breaker_state="closed" if st == "active" else "open",
        ))

    return events


# ── Radio Events ─────────────────────────────────────────────────

def generate_radio_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])
    t_takeover = parse_ts(tl["takeover"])
    t_fbi = parse_ts(tl["fbi_arrives"])

    # Task 1.4: Argyle's garbled radio (ROT13 encoded)
    argyle_plain = "PARKING BAY 1247 LIMO READY ARGYLE STANDING BY"
    events.append(make_event(
        parse_ts(tl["party_start"]) + timedelta(minutes=30),
        "nakatomi_comms", "nakatomi:comms:radio",
        channel="freq_18", callsign="ALPHA-INT",
        sender="Argyle", priority="low",
        signal_strength=72,
        message=rot13(argyle_plain),
    ))

    # Internal crew radio (pre-takeover)
    for _ in range(30):
        ts = rand_ts(rng, t_start, t_takeover)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:radio",
            channel="freq_10", callsign="BRAVO-OPS",
            sender=rng.choice(["Dispatch", "Control", "OpsCenter"]),
            priority="routine",
            signal_strength=rng.randint(80, 99),
            message=rng.choice([
                "Building ops check — all systems green",
                "Catering confirmed for floor 30",
                "Parking level normal occupancy",
                "Security rotation on schedule",
                "HVAC readings within parameters",
                "Visitor badge station closed for evening",
            ]),
        ))

    # Crew internal radio during takeover
    crew_msgs = [
        ("Karl", "Floor 25 clear. Moving up."),
        ("Theo", "Vault terminal access confirmed. Starting sequence."),
        ("Hans", "Bring Takagi to the 30th floor."),
        ("Karl", "Hostages secured. No resistance."),
        ("Theo", "Phone trunk lines — need the override."),
        ("Hans", "Everything according to plan. Stay on schedule."),
        ("Karl", "Someone tripped a fire alarm on 25. Checking."),
        ("Theo", "Ambulance in position. Bay confirmed."),
    ]
    for i, (sender, msg) in enumerate(crew_msgs):
        ts = t_takeover + timedelta(minutes=i * 7 + rng.randint(0, 5))
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:radio",
            channel="freq_18", callsign="ALPHA-INT",
            sender=sender, priority="high",
            signal_strength=rng.randint(85, 99),
            message=msg,
        ))

    # LAPD radio traffic
    for _ in range(50):
        ts = rand_ts(rng, t_takeover + timedelta(minutes=30), t_end)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:radio",
            channel="freq_12", callsign="SIERRA-TAC",
            sender=rng.choice(["Dispatch", "Unit-12", "Unit-7", "SWAT-Lead"]),
            priority=rng.choice(["routine", "urgent", "priority"]),
            signal_strength=rng.randint(70, 99),
            message=rng.choice([
                "Units hold perimeter — no entry authorized",
                "SWAT staging at north entrance",
                "Civilian evacuation complete — 2 block radius",
                "Helicopter requested — ETA pending",
                "Negotiator on scene — standby",
                "Shots fired report — upper floors — unconfirmed",
                "Media containment — push press back 500 feet",
            ]),
        ))

    # Task 4.3: Powell identification
    events.append(make_event(
        parse_ts(tl["powell_contact"]),
        "nakatomi_comms", "nakatomi:comms:radio",
        channel="freq_12", callsign="SIERRA-TAC",
        sender="Dispatch", priority="priority",
        signal_strength=95,
        message="PATROL UNIT RESPONDING — SGT AL POWELL BADGE-8114 — FIRST ON SCENE — ESTABLISHING CONTACT WITH INDIVIDUAL INSIDE BUILDING",
    ))

    # FBI radio traffic
    for _ in range(40):
        ts = rand_ts(rng, t_fbi, t_end)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:radio",
            channel="freq_14", callsign="KILO-FOXTROT-BRAVO",
            sender=rng.choice(["Agent Johnson", "Agent Johnson", "FBI-Lead", "FBI-HQ"]),
            priority=rng.choice(["priority", "urgent", "flash"]),
            signal_strength=rng.randint(75, 99),
            message=rng.choice([
                "FBI has jurisdiction — all local units stand down",
                "Thermal imaging shows hostages on floor 30",
                "Sniper teams in position — north and south",
                "Helicopter inbound from El Toro",
                "Confirm power grid access — awaiting authorization",
                "We'll need the building plans — contact city planning",
                "This is a federal operation now",
            ]),
        ))

    # Task 4.5: Helicopter ETA
    events.append(make_event(
        parse_ts(tl["fbi_arrives"]) + timedelta(minutes=20),
        "nakatomi_comms", "nakatomi:comms:radio",
        channel="freq_14", callsign="KILO-FOXTROT-BRAVO",
        sender="Agent Johnson", priority="flash",
        signal_strength=98,
        message="ASSAULT HELICOPTER ETA 2330 — REPEAT — ETA 2330 — ROOFTOP APPROACH — ALL UNITS PREPARE",
    ))

    # Task 5.4: Hans deadline
    events.append(make_event(
        parse_ts(tl["fbi_arrives"]) + timedelta(minutes=10),
        "nakatomi_comms", "nakatomi:comms:radio",
        channel="freq_14", callsign="KILO-FOXTROT-BRAVO",
        sender="Negotiator", priority="flash",
        signal_strength=97,
        message="SUBJECT GRUBER STATES DEADLINE 0200 — REPEAT — DEADLINE 0200 — DEMANDS NOT MET BUILDING WILL BE DESTROYED",
    ))

    # LAFD
    for _ in range(15):
        ts = rand_ts(rng, t_takeover + timedelta(minutes=45), t_end)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:radio",
            channel="freq_16", callsign="DELTA-FIRE",
            sender=rng.choice(["Engine-7", "Ladder-22", "LAFD-Command"]),
            priority="routine",
            signal_strength=rng.randint(80, 99),
            message=rng.choice([
                "Staged at south entrance — standby for medical",
                "Hazmat unit on scene — no chemical indicators",
                "Two ambulances standing by",
                "Fire alarm — building — likely false positive",
            ]),
        ))

    return events


# ── Phone Events ─────────────────────────────────────────────────

def generate_phone_events(cfg, rng):
    events = []
    tl = cfg["timeline"]
    t_start = parse_ts(tl["party_setup"])
    t_end = parse_ts(tl["midnight"])
    t_takeover = parse_ts(tl["takeover"])

    trunks = [
        ("TRUNK-7700", "external"),
        ("TRUNK-7701", "external"),
        ("TRUNK-5500", "internal"),
        ("TRUNK-5501", "internal"),
        ("TRUNK-9110", "emergency"),
    ]

    # Normal phone activity
    for _ in range(120):
        ts = rand_ts(rng, t_start, t_takeover)
        trunk_id, trunk_type = rng.choice(trunks)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:phone",
            trunk_id=trunk_id, trunk_type=trunk_type,
            direction=rng.choice(["inbound", "outbound"]),
            extension=f"x{rng.randint(1000, 9999)}",
            duration=rng.randint(10, 600),
            status="completed",
        ))

    # Task 2.1: External trunk — most traffic on TRUNK-7700
    for _ in range(30):
        ts = rand_ts(rng, t_start, t_takeover)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:phone",
            trunk_id="TRUNK-7700", trunk_type="external",
            direction="outbound",
            extension=f"x{rng.randint(1000, 9999)}",
            duration=rng.randint(30, 300),
            status="completed",
        ))

    # Comms cut event
    events.append(make_event(
        parse_ts(tl["comms_cut"]),
        "nakatomi_comms", "nakatomi:comms:phone",
        trunk_id="TRUNK-7700", trunk_type="external",
        direction="system",
        extension="x0000",
        duration=0,
        status="disconnected",
    ))

    # Task 2.5: Holly's intercepted 911 call
    events.append(make_event(
        parse_ts(tl["holly_911"]),
        "nakatomi_comms", "nakatomi:comms:phone",
        trunk_id="TRUNK-9110", trunk_type="emergency",
        direction="outbound",
        extension="x3015",
        caller_badge="HP-1015",
        caller_name="Holly Gennaro",
        duration=8,
        status="intercepted",
    ))

    # Red herring intercepted calls
    for _ in range(5):
        ts = rand_ts(rng, t_takeover, t_end)
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:phone",
            trunk_id="TRUNK-9110", trunk_type="emergency",
            direction="outbound",
            extension=f"x{rng.randint(1000, 9999)}",
            duration=rng.randint(1, 5),
            status="intercepted",
        ))

    # Post-takeover: failed calls
    for _ in range(40):
        ts = rand_ts(rng, t_takeover, t_end)
        trunk_id, trunk_type = rng.choice(trunks[:2])
        events.append(make_event(
            ts, "nakatomi_comms", "nakatomi:comms:phone",
            trunk_id=trunk_id, trunk_type=trunk_type,
            direction="outbound",
            extension=f"x{rng.randint(1000, 9999)}",
            duration=0,
            status="failed",
        ))

    return events


# ── Lookup Generators ────────────────────────────────────────────

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
    used_badges = {r["badge_id"] for r in rows}
    filler_needed = UNIQUE_BADGE_TARGET - len(rows)
    for _ in range(max(0, filler_needed)):
        badge = rand_badge(rng)
        while badge in used_badges:
            badge = rand_badge(rng)
        used_badges.add(badge)
        rows.append({
            "badge_id": badge,
            "name": rand_name(rng),
            "department": rng.choice(["Finance", "HR", "Legal", "IT", "Facilities", "Marketing", "Sales", "R&D", "Admin"]),
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


# ── Write Helpers ────────────────────────────────────────────────

def write_events(events, filepath):
    events.sort(key=lambda e: e["time"])
    with open(filepath, "w", encoding="utf-8") as f:
        for ev in events:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    return len(events)


def write_log_by_sourcetype(events, data_dir):
    """Split events by sourcetype and write raw KV log files for Splunk batch input."""
    by_st = {}
    for ev in events:
        st = ev["sourcetype"]
        by_st.setdefault(st, []).append(ev)

    counts = {}
    for st, evts in sorted(by_st.items()):
        evts.sort(key=lambda e: e["time"])
        safe_name = st.replace(":", "_")
        filepath = data_dir / f"{safe_name}.log"
        with open(filepath, "w", encoding="utf-8") as f:
            for ev in evts:
                f.write(ev["event"] + "\n")
        counts[st] = len(evts)
    return counts


def write_csv(rows, filepath, fieldnames):
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


# ── Main ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate Nakatomi Plaza escape room dataset (v2.0)")
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

    app_dir = SCRIPT_DIR.parent
    data_dir = app_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    lookups_dir = app_dir / "lookups"
    lookups_dir.mkdir(parents=True, exist_ok=True)

    # Generate events
    access_events = generate_badge_events(cfg, rng) + generate_door_events(cfg, rng)
    vault_events = generate_vault_events(cfg, rng)
    building_events = (
        generate_building_events(cfg, rng)
        + generate_camera_events(cfg, rng)
        + generate_elevator_events(cfg, rng)
        + generate_power_events(cfg, rng)
    )
    comms_events = generate_radio_events(cfg, rng) + generate_phone_events(cfg, rng)

    all_events = access_events + vault_events + building_events + comms_events

    # Write combined JSON to output/ (for reference)
    n1 = write_events(access_events, out_dir / "nakatomi_access.json")
    n2 = write_events(vault_events, out_dir / "nakatomi_vault.json")
    n3 = write_events(building_events, out_dir / "nakatomi_building.json")
    n4 = write_events(comms_events, out_dir / "nakatomi_comms.json")

    print(f"nakatomi_access.json  : {n1} events")
    print(f"nakatomi_vault.json   : {n2} events")
    print(f"nakatomi_building.json: {n3} events")
    print(f"nakatomi_comms.json   : {n4} events")

    # Write per-sourcetype .log files to data/ (for Splunk batch input)
    print(f"\n── Per-sourcetype log files → {data_dir}/")
    st_counts = write_log_by_sourcetype(all_events, data_dir)
    for st, count in sorted(st_counts.items()):
        print(f"  {st:40s}: {count} events")

    # Generate lookups → output/ and lookups/
    floors = generate_floor_directory(cfg)
    write_csv(floors, out_dir / "floor_directory.csv",
              ["floor", "floor_name", "tenant", "floor_group", "restricted"])
    write_csv(floors, lookups_dir / "floor_directory.csv",
              ["floor", "floor_name", "tenant", "floor_group", "restricted"])

    employees = generate_employee_directory(cfg, rng)
    write_csv(employees, out_dir / "employee_directory.csv",
              ["badge_id", "name", "department", "clearance_level", "status", "hire_date"])
    write_csv(employees, lookups_dir / "employee_directory.csv",
              ["badge_id", "name", "department", "clearance_level", "status", "hire_date"])

    codes = generate_system_codes(cfg)
    write_csv(codes, out_dir / "system_codes.csv",
              ["system_id", "description", "clearance_level", "vault_auth_code", "location"])
    write_csv(codes, lookups_dir / "system_codes.csv",
              ["system_id", "description", "clearance_level", "vault_auth_code", "location"])

    total = n1 + n2 + n3 + n4
    print(f"\nTotal: {total} events across {len(st_counts)} sourcetypes")
    print(f"Generated lookups: floor_directory, employee_directory, system_codes")
    print(f"Static lookups in lookups/: radio_channels, camera_coverage, bearer_bonds, vehicle_registry")


if __name__ == "__main__":
    main()
