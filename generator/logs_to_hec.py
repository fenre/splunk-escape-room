#!/usr/bin/env python3
"""Convert the static data/*.log sample files into the same HEC JSON shape
that generate.py produces, so they can be posted to /services/collector with
an explicit epoch ``time`` field (the reliable, parser-independent path).

Each output line is one JSON object:
    {"time": <epoch>, "host": ..., "source": ..., "sourcetype": ...,
     "index": ..., "event": "<original log line>"}

The leading token of every log line is an ISO-8601 timestamp with a numeric
offset, e.g. ``1988-12-24T18:02:19.946-0800``. We parse that to epoch seconds
so Splunk indexes the event at its in-world 1988 time regardless of any
index-time timestamp configuration.
"""
import datetime as dt
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "nakatomi_heist" / "data"
OUT_DIR = Path(__file__).resolve().parent / "output"

# logfile stem -> (sourcetype, index, source)
MAPPING = {
    "nakatomi_comms_phone":      ("nakatomi:comms:phone",      "nakatomi_comms",    "nakatomi:phone"),
    "nakatomi_comms_radio":      ("nakatomi:comms:radio",      "nakatomi_comms",    "nakatomi:radio"),
    "nakatomi_building_elevator":("nakatomi:building:elevator","nakatomi_building", "nakatomi:elevator"),
    "nakatomi_building_power":   ("nakatomi:building:power",   "nakatomi_building", "nakatomi:power"),
    "nakatomi_security_camera":  ("nakatomi:security:camera",  "nakatomi_building", "nakatomi:camera"),
}
HOST = "nakatomi-bms"
TS_FMT = "%Y-%m-%dT%H:%M:%S.%f%z"


def parse_epoch(line: str) -> float:
    token = line.split(" ", 1)[0]
    parsed = dt.datetime.strptime(token, TS_FMT)
    return parsed.timestamp()


def convert(stem: str) -> int:
    sourcetype, index, source = MAPPING[stem]
    src = DATA_DIR / f"{stem}.log"
    dst = OUT_DIR / f"{stem}.json"
    written = 0
    with src.open("r", encoding="utf-8") as fin, dst.open("w", encoding="utf-8") as fout:
        for raw in fin:
            raw = raw.rstrip("\n")
            if not raw.strip():
                continue
            rec = {
                "time": parse_epoch(raw),
                "host": HOST,
                "source": source,
                "sourcetype": sourcetype,
                "index": index,
                "event": raw,
            }
            fout.write(json.dumps(rec) + "\n")
            written += 1
    print(f"  {stem}.log -> output/{stem}.json  ({written} lines, sourcetype={sourcetype}, index={index})")
    return written


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for stem in MAPPING:
        total += convert(stem)
    print(f"Done. {total} lines converted across {len(MAPPING)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
