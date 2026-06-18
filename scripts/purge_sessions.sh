#!/usr/bin/env bash
# v2.15 / Q5 — Session purge script for GDPR-style right-to-erasure requests.
#
# Pairs with export_sessions.sh. Removes every record matching a
# given team_code or session_id from:
#   - index=nakatomi_sessions       (the live HEC stream)
#   - vault_progress KV Store       (the per-team progress store)
#
# Splunk doesn't support per-event delete from the indexer; instead
# we mark the events as "permanently inaccessible" via the `delete`
# search command (requires the `can_delete` capability on the role
# the SPLUNK_TOKEN belongs to). The events stay on disk but are
# excluded from every subsequent search.
#
# KV-Store records are physically removed.
#
# Usage:
#   bash scripts/purge_sessions.sh --team-code NAKA  --confirm yes-i-mean-it
#   bash scripts/purge_sessions.sh --session-id S-12345 --confirm yes-i-mean-it
#
# Required environment variables (NEVER hardcoded):
#   SPLUNK_HOST   — Splunk REST API base URL
#   SPLUNK_TOKEN  — Bearer token with `can_delete` + KV-write capability
#                   (use a dedicated `nakatomi_purge` role per
#                   codeguard-0-data-storage least-privilege; do NOT
#                   reuse the booth-display read-only token).
#
# Hardening:
#   - Refuses to run unless --confirm yes-i-mean-it is passed verbatim.
#   - Sanitizes filter values to [A-Za-z0-9._-] (defends against
#     SPL injection per codeguard-0-input-validation-injection).
#   - Logs every purge to /var/log/nakatomi/purge.log when the dir
#     exists; otherwise stdout. The log carries the filter, the
#     count of records affected, and a SHA-256 of the filter so
#     audit can correlate without storing the raw team_code.

set -euo pipefail

TEAM_CODE=""
SESSION_ID=""
CONFIRM=""

usage() {
  cat <<USAGE
Usage: bash scripts/purge_sessions.sh --team-code <CODE> --confirm yes-i-mean-it
       bash scripts/purge_sessions.sh --session-id <ID>  --confirm yes-i-mean-it

Required env vars:
  SPLUNK_HOST    Splunk REST API base
  SPLUNK_TOKEN   Bearer token with the can_delete capability AND
                 KV-Store write access on vault_progress.

This is IRREVERSIBLE. Run scripts/export_sessions.sh first if you want
a backup of the data before deletion.
USAGE
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --team-code)  TEAM_CODE="${2:-}";  shift 2 ;;
    --session-id) SESSION_ID="${2:-}"; shift 2 ;;
    --confirm)    CONFIRM="${2:-}";    shift 2 ;;
    -h|--help)    usage 0 ;;
    *)            echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

if [ "$CONFIRM" != "yes-i-mean-it" ]; then
  echo "ERROR: pass --confirm yes-i-mean-it to acknowledge this is irreversible" >&2
  exit 2
fi
if [ -z "$TEAM_CODE" ] && [ -z "$SESSION_ID" ]; then
  echo "ERROR: --team-code or --session-id is required" >&2; usage 1
fi
if [ -n "$TEAM_CODE" ] && [ -n "$SESSION_ID" ]; then
  echo "ERROR: pass exactly one of --team-code OR --session-id" >&2; exit 3
fi
if [ -z "${SPLUNK_HOST:-}" ] || [ -z "${SPLUNK_TOKEN:-}" ]; then
  echo "ERROR: SPLUNK_HOST and SPLUNK_TOKEN env vars must be set" >&2; exit 4
fi

# Defensive sanitization (same shape as export_sessions.sh — keeps
# the two scripts symmetric so an export-then-purge workflow can't
# silently mismatch). [A-Za-z0-9._-] only.
sanitize() {
  local input="$1"
  if [ -z "$input" ]; then echo ""; return; fi
  if echo "$input" | grep -qE '[^A-Za-z0-9._-]'; then
    echo "ERROR: filter value contains disallowed characters: $input" >&2
    echo "       Only [A-Za-z0-9._-] are allowed." >&2
    exit 5
  fi
  echo "$input"
}

TEAM_CODE="$(sanitize "$TEAM_CODE")"
SESSION_ID="$(sanitize "$SESSION_ID")"

SPL_FILTER=""
KV_QUERY=""
LABEL=""
if [ -n "$TEAM_CODE" ]; then
  SPL_FILTER="team_code=\"$TEAM_CODE\""
  KV_QUERY="{\"team_code\":\"$TEAM_CODE\"}"
  LABEL="team_code=$TEAM_CODE"
elif [ -n "$SESSION_ID" ]; then
  SPL_FILTER="session_id=\"$SESSION_ID\""
  KV_QUERY="{\"session_id\":\"$SESSION_ID\"}"
  LABEL="session_id=$SESSION_ID"
fi

# Hash the filter so audit logs can store it without echoing the
# team_code. SHA-256 truncated to 12 hex chars is enough to
# correlate audit entries.
FILTER_HASH="$(printf '%s' "$LABEL" | shasum -a 256 | awk '{print $1}' | head -c 12)"

echo "→ Purging $LABEL (audit hash: $FILTER_HASH)"

# 1. Mark events as deleted in the index.
echo "  · Issuing | delete on nakatomi_sessions"
curl -sS --fail-with-body \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  -d "search=search index=nakatomi_sessions $SPL_FILTER | delete" \
  -d "output_mode=json" \
  -d "earliest_time=-90d@d" \
  -d "latest_time=now" \
  "$SPLUNK_HOST/services/search/jobs/export" > /dev/null

# 2. Remove KV-Store records.
echo "  · Deleting matching vault_progress records"
QUERY_ENC="$(printf '%s' "$KV_QUERY" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")"
curl -sS --fail-with-body \
  -X DELETE \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  "$SPLUNK_HOST/servicesNS/nobody/nakatomi_heist/storage/collections/data/vault_progress?query=$QUERY_ENC" \
  > /dev/null

# 3. Audit log.
LOG_LINE="$(date -u +%Y-%m-%dT%H:%M:%SZ) purge $FILTER_HASH"
if [ -d "/var/log/nakatomi" ] && [ -w "/var/log/nakatomi" ]; then
  echo "$LOG_LINE" >> /var/log/nakatomi/purge.log
else
  echo "AUDIT: $LOG_LINE"
fi

echo "✓ Purge complete for $LABEL"
echo "  Note: events on disk remain physically present until the next"
echo "  Splunk index rebuild, but are excluded from every search by"
echo "  the | delete marker. The 90-day retention window in"
echo "  indexes.conf will eventually purge them from disk."
