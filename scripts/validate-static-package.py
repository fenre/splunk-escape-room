#!/usr/bin/env python3
"""Validate the staged or archived self-seeding Nakatomi Splunk app."""

import argparse
import json
import re
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


REQUIRED_INDEXES = {
    "nakatomi_access",
    "nakatomi_vault",
    "nakatomi_building",
    "nakatomi_comms",
    "nakatomi_sessions",
}
REQUIRED_BUNDLES = (
    "appserver/static/pages/terminal.js",
    "appserver/static/visualizations/nakatomi_terminal/visualization.js",
    "appserver/static/visualizations/nakatomi_vault_display/visualization.js",
)
FORBIDDEN_PARTS = {"node_modules", "__pycache__", "local", ".git", "src"}
FORBIDDEN_NAMES = {"package.json", "package-lock.json", "webpack.config.js"}
FORBIDDEN_SUFFIXES = {".pyc", ".pyo", ".pem", ".key", ".crt", ".cer", ".der"}
SECRET_PATTERNS = (
    re.compile(rb"AKIA[0-9A-Z]{16}"),
    re.compile(rb"ghp_[0-9A-Za-z]{36,}"),
    re.compile(rb"sk_live_[0-9A-Za-z]{24,}"),
    re.compile(rb"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def parse_conf(path: Path) -> tuple[dict[str, dict[str, str]], list[str]]:
    stanzas: dict[str, dict[str, str]] = {}
    duplicates: list[str] = []
    current: dict[str, str] | None = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        section = re.match(r"^\[([^\]]+)\]$", line)
        if section:
            name = section.group(1)
            if name in stanzas:
                duplicates.append(name)
            current = stanzas.setdefault(name, {})
            continue
        if current is not None and "=" in line:
            key, value = line.split("=", 1)
            current[key.strip()] = value.strip().rstrip("\\").strip()
    return stanzas, duplicates


def _forbidden_path(relative: Path) -> bool:
    return (
        bool(FORBIDDEN_PARTS.intersection(relative.parts))
        or relative.name in FORBIDDEN_NAMES
        or relative.name == ".DS_Store"
        or relative.name.startswith("._")
        or relative.suffix.lower() in FORBIDDEN_SUFFIXES
    )


def _validate_xml(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        root = ET.parse(path).getroot()
        definition = root.find("definition")
        if definition is not None and definition.text:
            json.loads(definition.text.strip())
    except (ET.ParseError, json.JSONDecodeError) as exc:
        errors.append(f"invalid dashboard {path.name}: {exc}")
    return errors


def validate_app(app: Path) -> list[str]:
    errors: list[str] = []
    if not app.is_dir():
        return [f"app directory not found: {app}"]
    if app.name != "nakatomi_heist":
        errors.append(f"app root must be named nakatomi_heist, got {app.name}")

    files = [path for path in app.rglob("*") if path.is_file()]
    for path in files:
        relative = path.relative_to(app)
        if _forbidden_path(relative):
            errors.append(f"forbidden package path: {relative}")
        try:
            payload = path.read_bytes()
        except OSError as exc:
            errors.append(f"cannot read {relative}: {exc}")
            continue
        if any(pattern.search(payload) for pattern in SECRET_PATTERNS):
            errors.append(f"credential-like content in {relative}")

    for relative in REQUIRED_BUNDLES:
        bundle = app / relative
        if not bundle.is_file() or bundle.stat().st_size == 0:
            errors.append(f"missing bundle: {relative}")
        elif "visualization.js" in relative:
            prefix = bundle.read_text(encoding="utf-8")[:200]
            if not re.match(r"^define\(\[.*\],\s*function\s*\(", prefix):
                errors.append(f"custom visualization bundle is not ES5 AMD: {relative}")

    conf_dir = app / "default"
    required_conf = ("app.conf", "indexes.conf", "inputs.conf", "props.conf")
    parsed: dict[str, dict[str, dict[str, str]]] = {}
    for name in required_conf:
        path = conf_dir / name
        if not path.is_file():
            errors.append(f"missing configuration: default/{name}")
            continue
        stanzas, duplicates = parse_conf(path)
        parsed[name] = stanzas
        for stanza in duplicates:
            errors.append(f"duplicate stanza [{stanza}] in default/{name}")

    app_conf = parsed.get("app.conf", {})
    for stanza in ("install", "ui", "launcher", "package"):
        if stanza not in app_conf:
            errors.append(f"missing app.conf stanza [{stanza}]")
    if app_conf.get("package", {}).get("id") != "nakatomi_heist":
        errors.append("app.conf package id must be nakatomi_heist")

    index_stanzas = set(parsed.get("indexes.conf", {}))
    for index in sorted(REQUIRED_INDEXES - index_stanzas):
        errors.append(f"missing index stanza: {index}")

    manifest_path = app / "README" / "seed-data-manifest.json"
    if not manifest_path.is_file():
        errors.append("missing seed manifest: README/seed-data-manifest.json")
        return errors
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid seed manifest: {exc}")
        return errors

    shards = manifest.get("shards", [])
    manifest_files = {shard.get("file") for shard in shards}
    disk_files = {path.name for path in (app / "data").glob("*.log")}
    for filename in sorted(disk_files - manifest_files):
        errors.append(f"unmatched seed log not in manifest: {filename}")
    for filename in sorted(manifest_files - disk_files):
        errors.append(f"manifest seed log missing from data: {filename}")

    inputs = parsed.get("inputs.conf", {})
    props = parsed.get("props.conf", {})
    input_by_file: dict[str, dict[str, str]] = {}
    for stanza, values in inputs.items():
        match = re.search(r"/([^/]+\.log)$", stanza)
        if match:
            input_by_file[match.group(1)] = values

    counted_total = 0
    counted_indexes: dict[str, int] = {}
    counted_sourcetypes: dict[str, int] = {}
    for shard in shards:
        filename = shard.get("file", "")
        index = shard.get("index", "")
        sourcetype = shard.get("sourcetype", "")
        expected_events = shard.get("events", -1)
        seed_path = app / "data" / filename
        if seed_path.is_file():
            actual_events = sum(
                1
                for line in seed_path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            )
            if actual_events != expected_events:
                errors.append(
                    f"seed count mismatch for {filename}: "
                    f"manifest {expected_events}, file {actual_events}"
                )
        values = input_by_file.get(filename)
        if values is None:
            errors.append(f"unmatched seed manifest entry without input: {filename}")
        else:
            if values.get("index") != index:
                errors.append(f"seed input index mismatch for {filename}")
            if values.get("sourcetype") != sourcetype:
                errors.append(f"seed input sourcetype mismatch for {filename}")
            if values.get("move_policy") != "sinkhole":
                errors.append(f"seed input is not one-shot sinkhole: {filename}")
        if sourcetype not in props:
            errors.append(f"missing props stanza for seed sourcetype: {sourcetype}")
        counted_total += expected_events
        counted_indexes[index] = counted_indexes.get(index, 0) + expected_events
        counted_sourcetypes[sourcetype] = (
            counted_sourcetypes.get(sourcetype, 0) + expected_events
        )

    if counted_total != manifest.get("total_events"):
        errors.append("manifest total_events does not equal shard total")
    if counted_indexes != manifest.get("indexes"):
        errors.append("manifest index counts do not equal shard counts")
    if counted_sourcetypes != manifest.get("sourcetypes"):
        errors.append("manifest sourcetype counts do not equal shard counts")

    for path in (conf_dir / "data" / "ui" / "views").glob("*.xml"):
        errors.extend(_validate_xml(path))
    return errors


def validate_archive(archive: Path) -> list[str]:
    errors: list[str] = []
    if not archive.is_file():
        return [f"archive not found: {archive}"]
    try:
        with tarfile.open(archive, "r:gz") as tar:
            members = tar.getmembers()
            roots = {member.name.split("/", 1)[0] for member in members if member.name}
            if roots != {"nakatomi_heist"}:
                errors.append(
                    "archive must contain one top-level nakatomi_heist directory; "
                    f"found {sorted(roots)}"
                )
            for member in members:
                path = Path(member.name)
                if path.is_absolute() or ".." in path.parts:
                    errors.append(f"unsafe archive member: {member.name}")
                relative = Path(*path.parts[1:]) if len(path.parts) > 1 else Path()
                if _forbidden_path(relative):
                    errors.append(f"forbidden archive path: {member.name}")
                if member.issym() or member.islnk():
                    errors.append(f"links are not allowed in archive: {member.name}")
            if errors:
                return errors
            with tempfile.TemporaryDirectory() as temp_dir:
                tar.extractall(temp_dir)
                errors.extend(validate_app(Path(temp_dir) / "nakatomi_heist"))
    except (OSError, tarfile.TarError) as exc:
        errors.append(f"invalid archive: {exc}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    errors = (
        validate_archive(args.target)
        if args.target.is_file()
        else validate_app(args.target)
    )
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print(f"PASS: static package validated: {args.target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
