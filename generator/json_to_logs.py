#!/usr/bin/env python3
"""Export generator HEC JSON output into nakatomi_heist/data/*.log batch files.

Splunk batch inputs in default/inputs.conf expect one log file per sourcetype.
The generator writes newline-delimited JSON with an ``event`` field holding the
raw log line (already 1988-dated). This script groups events by sourcetype and
writes the batch files the app ships for offline / app-only installs.

Usage:
    cd generator && python3 generate.py && python3 json_to_logs.py
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
DATA_DIR = Path(__file__).resolve().parent.parent / "nakatomi_heist" / "data"

# Only read canonical HEC outputs (infrastructure is merged into these by generate.py).
CANONICAL_JSON = (
    "nakatomi_access.json",
    "nakatomi_vault.json",
    "nakatomi_building.json",
    "nakatomi_comms.json",
)

# sourcetype -> batch log filename (must match inputs.conf)
SOURCETYPE_FILES = {
    "nakatomi:access:badge": "nakatomi_access_badge.log",
    "nakatomi:access:door": "nakatomi_access_door.log",
    "nakatomi:vault:attempt": "nakatomi_vault_attempt.log",
    "nakatomi:vault:system": "nakatomi_vault_system.log",
    "nakatomi:building:hvac": "nakatomi_building_hvac.log",
    "nakatomi:building:security": "nakatomi_building_security.log",
    "nakatomi:security:camera": "nakatomi_security_camera.log",
    "nakatomi:building:elevator": "nakatomi_building_elevator.log",
    "nakatomi:building:power": "nakatomi_building_power.log",
    "nakatomi:comms:radio": "nakatomi_comms_radio.log",
    "nakatomi:comms:phone": "nakatomi_comms_phone.log",
}


def main() -> int:
    if not OUTPUT_DIR.is_dir():
        print(f"ERROR: run generate.py first — missing {OUTPUT_DIR}", file=sys.stderr)
        return 1

    buckets: dict[str, list[tuple[float, str]]] = defaultdict(list)
    skipped = 0

    for name in CANONICAL_JSON:
        json_path = OUTPUT_DIR / name
        if not json_path.is_file():
            print(f"WARNING: missing {name} — run generate.py first", file=sys.stderr)
            continue
        with json_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                st = rec.get("sourcetype", "")
                if st not in SOURCETYPE_FILES:
                    skipped += 1
                    continue
                event = rec.get("event", "")
                if not event:
                    skipped += 1
                    continue
                buckets[st].append((float(rec.get("time", 0)), event))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for st, fname in sorted(SOURCETYPE_FILES.items()):
        events = buckets.get(st, [])
        events.sort(key=lambda x: x[0])
        out_path = DATA_DIR / fname
        with out_path.open("w", encoding="utf-8", newline="\n") as out:
            for _t, raw in events:
                out.write(raw.rstrip("\n") + "\n")
        print(f"  {fname}: {len(events)} lines ({st})")
        total += len(events)

    print(f"Done. {total} events written to {DATA_DIR} ({skipped} non-batch events skipped).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
