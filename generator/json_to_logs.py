#!/usr/bin/env python3
"""Build complete one-shot Splunk seed inputs from canonical HEC JSON output."""
import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
APP_DIR = Path(__file__).resolve().parent.parent / "nakatomi_heist"
DATA_DIR = APP_DIR / "data"
INPUTS_PATH = APP_DIR / "default" / "inputs.conf"
PROPS_PATH = APP_DIR / "default" / "props.conf"
MANIFEST_PATH = APP_DIR / "README" / "seed-data-manifest.json"

CANONICAL_JSON = (
    "nakatomi_access.json",
    "nakatomi_vault.json",
    "nakatomi_building.json",
    "nakatomi_comms.json",
)

ALLOWED_INDEXES = {
    "nakatomi_access",
    "nakatomi_vault",
    "nakatomi_building",
    "nakatomi_comms",
}

PARSING_DEFAULTS = {
    "SHOULD_LINEMERGE": "false",
    "LINE_BREAKER": r"([\r\n]+)",
    "TIME_PREFIX": "^",
    "MAX_TIMESTAMP_LOOKAHEAD": "32",
    "TIME_FORMAT": "%Y-%m-%dT%H:%M:%S.%3N%z",
    "TRUNCATE": "999999",
    "EVENT_BREAKER_ENABLE": "true",
    "EVENT_BREAKER": r"([\r\n]+)",
    "KV_MODE": "auto",
}


def _seed_filename(index: str, sourcetype: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", sourcetype.lower()).strip("_")
    digest = hashlib.sha256(f"{index}\0{sourcetype}".encode()).hexdigest()[:10]
    return f"seed_{index}_{slug}_{digest}.log"


def _augment_props(props_text: str, sourcetypes: set[str]) -> str:
    lines = props_text.splitlines()
    section_starts: list[tuple[int, str]] = []
    for position, line in enumerate(lines):
        match = re.match(r"^\[([^\]]+)\]\s*$", line.strip())
        if match:
            section_starts.append((position, match.group(1)))

    additions: dict[int, list[str]] = {}
    existing_sections = {name for _, name in section_starts}
    for number, (start, name) in enumerate(section_starts):
        if name not in sourcetypes:
            continue
        end = section_starts[number + 1][0] if number + 1 < len(section_starts) else len(lines)
        keys = {
            match.group(1)
            for line in lines[start + 1:end]
            if (match := re.match(r"^([A-Za-z0-9_-]+)\s*=", line.strip()))
        }
        additions[end] = [
            f"{key} = {value}"
            for key, value in PARSING_DEFAULTS.items()
            if key not in keys
        ]

    result: list[str] = []
    for position in range(len(lines) + 1):
        if position in additions:
            if result and result[-1] != "":
                result.append("")
            result.extend(additions[position])
        if position < len(lines):
            result.append(lines[position])

    for sourcetype in sorted(sourcetypes - existing_sections):
        if result and result[-1] != "":
            result.append("")
        result.append(f"[{sourcetype}]")
        result.extend(
            f"{key} = {value}" for key, value in PARSING_DEFAULTS.items()
        )

    return "\n".join(result).rstrip() + "\n"


def convert_all(
    output_dir: Path,
    data_dir: Path,
    inputs_path: Path,
    props_path: Path,
    manifest_path: Path,
) -> dict:
    missing = [name for name in CANONICAL_JSON if not (output_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(
            "missing canonical generator output: " + ", ".join(missing)
        )

    grouped: dict[tuple[str, str], list[tuple[float, str]]] = defaultdict(list)
    index_counts: dict[str, int] = defaultdict(int)
    sourcetype_counts: dict[str, int] = defaultdict(int)
    input_count = 0

    for canonical_name in CANONICAL_JSON:
        expected_index = canonical_name.removesuffix(".json")
        with (output_dir / canonical_name).open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, 1):
                if not raw_line.strip():
                    continue
                record = json.loads(raw_line)
                index = record.get("index", "")
                sourcetype = record.get("sourcetype", "")
                event = record.get("event", "")
                location = f"{canonical_name}:{line_number}"
                if index not in ALLOWED_INDEXES:
                    raise ValueError(f"{location}: unexpected index {index!r}")
                if index != expected_index:
                    raise ValueError(
                        f"{location}: index {index!r} does not match canonical file"
                    )
                if not sourcetype:
                    raise ValueError(f"{location}: missing sourcetype")
                if not event:
                    raise ValueError(f"{location}: missing event body")
                grouped[(index, sourcetype)].append(
                    (float(record.get("time", 0)), str(event))
                )
                index_counts[index] += 1
                sourcetype_counts[sourcetype] += 1
                input_count += 1

    data_dir.mkdir(parents=True, exist_ok=True)
    for old_log in data_dir.glob("*.log"):
        old_log.unlink()

    inputs_lines = [
        "# Generated by generator/json_to_logs.py. Do not edit release copies.",
        "# One-shot seed inputs are removed after successful ingestion.",
        "",
    ]
    shards = []
    filenames: set[str] = set()
    written_count = 0
    for (index, sourcetype), events in sorted(grouped.items()):
        filename = _seed_filename(index, sourcetype)
        if filename in filenames:
            raise ValueError(f"duplicate seed filename collision: {filename}")
        filenames.add(filename)
        events.sort(key=lambda item: item[0])
        with (data_dir / filename).open("w", encoding="utf-8", newline="\n") as out:
            for _, event in events:
                out.write(event.rstrip("\n") + "\n")
                written_count += 1
        inputs_lines.extend(
            [
                f"[batch://$SPLUNK_HOME/etc/apps/nakatomi_heist/data/{filename}]",
                "disabled = false",
                f"index = {index}",
                f"sourcetype = {sourcetype}",
                "host = nakatomi-bms",
                "move_policy = sinkhole",
                "",
            ]
        )
        shards.append(
            {
                "file": filename,
                "index": index,
                "sourcetype": sourcetype,
                "events": len(events),
            }
        )

    if written_count != input_count:
        raise RuntimeError(
            f"seed count mismatch: read {input_count}, wrote {written_count}"
        )

    inputs_path.parent.mkdir(parents=True, exist_ok=True)
    inputs_path.write_text("\n".join(inputs_lines).rstrip() + "\n", encoding="utf-8")
    props_text = props_path.read_text(encoding="utf-8")
    props_path.write_text(
        _augment_props(props_text, set(sourcetype_counts)),
        encoding="utf-8",
    )

    manifest = {
        "schema_version": 1,
        "total_events": input_count,
        "indexes": dict(sorted(index_counts.items())),
        "sourcetypes": dict(sorted(sourcetype_counts.items())),
        "shards": shards,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--inputs-path", type=Path, default=INPUTS_PATH)
    parser.add_argument("--props-path", type=Path, default=PROPS_PATH)
    parser.add_argument("--manifest-path", type=Path, default=MANIFEST_PATH)
    args = parser.parse_args()
    manifest = convert_all(
        args.output_dir,
        args.data_dir,
        args.inputs_path,
        args.props_path,
        args.manifest_path,
    )
    print(
        f"Done. {manifest['total_events']} events written across "
        f"{len(manifest['sourcetypes'])} sourcetypes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
