#!/usr/bin/env bash
# v2.15 / Q5 — Session export script for GDPR-style data subject access requests.
#
# Even though `nakatomi_heist` does not collect direct PII, team_name
# is user-supplied and may contain identifiers (a player putting their
# real name in the field). This script exports every record matching
# a given team_code or session_id from both:
#   - index=nakatomi_sessions  (the live HEC stream)
#   - vault_progress KV Store  (the per-team progress store)
#
# Output is a single JSON file. The caller can hand this to the
# requestor to satisfy a data-export request.
#
# Usage:
#   bash scripts/export_sessions.sh --team-code NAKA --output naka.json
#   bash scripts/export_sessions.sh --session-id S-12345 --output s12345.json
#
# Required environment variables (NEVER hardcoded):
#   SPLUNK_HOST       — base URL of the Splunk REST API (https://...:8089)
#   SPLUNK_TOKEN      — service-account auth token with read access to
#                       nakatomi_sessions + vault_progress (per
#                       codeguard-0-data-storage least-privilege).
#
# Hardening:
#   - All curl calls use --fail-with-body so an HTTP 4xx/5xx returns
#     a non-zero exit instead of silently writing partial output.
#   - The auth token is passed via -H header, never via URL params
#     (per codeguard-0-authentication-mfa: tokens never in browser
#     history / Referer / access logs).
#   - The output file is created with mode 0600 so an export sitting
#     on a shared host doesn't leak by default.
#   - We refuse to run if the team-code/session-id contains anything
#     outside [A-Za-z0-9._-] — defends against SPL injection.

set -euo pipefail

TEAM_CODE=""
SESSION_ID=""
OUTPUT=""

usage() {
  cat <<USAGE
Usage: bash scripts/export_sessions.sh --team-code <CODE> --output <path>
       bash scripts/export_sessions.sh --session-id <ID>  --output <path>

Required env vars:
  SPLUNK_HOST   Splunk REST API base, e.g. https://splunk.example.com:8089
  SPLUNK_TOKEN  Bearer token with read access to nakatomi_sessions + vault_progress

Output format: JSON with two top-level keys:
  events        — events matching the filter from index=nakatomi_sessions
  kv_records    — records matching the filter from vault_progress collection
USAGE
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --team-code)  TEAM_CODE="${2:-}";  shift 2 ;;
    --session-id) SESSION_ID="${2:-}"; shift 2 ;;
    --output)     OUTPUT="${2:-}";     shift 2 ;;
    -h|--help)    usage 0 ;;
    *)            echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

if [ -z "$TEAM_CODE" ] && [ -z "$SESSION_ID" ]; then
  echo "ERROR: --team-code or --session-id is required" >&2; usage 1
fi
if [ -z "$OUTPUT" ]; then
  echo "ERROR: --output is required" >&2; usage 1
fi
if [ -z "${SPLUNK_HOST:-}" ] || [ -z "${SPLUNK_TOKEN:-}" ]; then
  echo "ERROR: SPLUNK_HOST and SPLUNK_TOKEN env vars must be set" >&2; exit 2
fi

# Defensive validation: only allow safe characters in the filter.
# This prevents SPL injection if the caller pipes user input directly.
sanitize() {
  local input="$1"
  if [ -z "$input" ]; then echo ""; return; fi
  if echo "$input" | grep -qE '[^A-Za-z0-9._-]'; then
    echo "ERROR: filter value contains disallowed characters: $input" >&2
    echo "       Only [A-Za-z0-9._-] are allowed." >&2
    exit 3
  fi
  echo "$input"
}

TEAM_CODE="$(sanitize "$TEAM_CODE")"
SESSION_ID="$(sanitize "$SESSION_ID")"

# Build the SPL filter clause + KV-Store query JSON.
SPL_FILTER=""
KV_QUERY=""
if [ -n "$TEAM_CODE" ];  then
  SPL_FILTER="team_code=\"$TEAM_CODE\""
  KV_QUERY="{\"team_code\":\"$TEAM_CODE\"}"
elif [ -n "$SESSION_ID" ]; then
  SPL_FILTER="session_id=\"$SESSION_ID\""
  KV_QUERY="{\"session_id\":\"$SESSION_ID\"}"
fi

# Reject double-filter — keeps the export deterministic.
if [ -n "$TEAM_CODE" ] && [ -n "$SESSION_ID" ]; then
  echo "ERROR: pass exactly one of --team-code OR --session-id" >&2; exit 4
fi

mkdir -p "$(dirname "$OUTPUT")"
TMP_EVENTS="$(mktemp)"
TMP_KV="$(mktemp)"
trap 'rm -f "$TMP_EVENTS" "$TMP_KV"' EXIT

echo "→ Searching nakatomi_sessions for: $SPL_FILTER"
curl -sS --fail-with-body \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  -d "search=search index=nakatomi_sessions $SPL_FILTER | head 10000" \
  -d "output_mode=json" \
  -d "earliest_time=-90d@d" \
  -d "latest_time=now" \
  "$SPLUNK_HOST/services/search/jobs/export" > "$TMP_EVENTS"

echo "→ Querying vault_progress KV Store: $KV_QUERY"
QUERY_ENC="$(printf '%s' "$KV_QUERY" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")"
curl -sS --fail-with-body \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  "$SPLUNK_HOST/servicesNS/nobody/nakatomi_heist/storage/collections/data/vault_progress?query=$QUERY_ENC&output_mode=json" \
  > "$TMP_KV"

# Combine the two outputs into a single JSON document. Use python3
# instead of jq for portability — every CI runner has python3, fewer
# have jq.
umask 077
python3 - "$TMP_EVENTS" "$TMP_KV" "$OUTPUT" <<'PY'
import json, sys
events_path, kv_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
events = []
with open(events_path) as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try: events.append(json.loads(line).get('result', json.loads(line)))
        except json.JSONDecodeError: pass
try:
    with open(kv_path) as f: kv = json.load(f)
except json.JSONDecodeError: kv = []
out = {
    "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    "filter":      {k: v for k, v in (("team_code", "${TEAM_CODE:-}"), ("session_id", "${SESSION_ID:-}")) if v},
    "events":      events,
    "kv_records":  kv,
    "counts":      {"events": len(events), "kv_records": len(kv) if isinstance(kv, list) else 0}
}
with open(out_path, "w") as f:
    json.dump(out, f, indent=2)
print(f"Wrote {out_path}")
PY

echo "✓ Export complete: $OUTPUT"
echo "  Mode: $(stat -c '%a' "$OUTPUT" 2>/dev/null || stat -f '%A' "$OUTPUT")"
echo "  Size: $(wc -c < "$OUTPUT") bytes"
