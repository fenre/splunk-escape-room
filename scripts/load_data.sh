#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/generator/output"

SPLUNK_URL="${SPLUNK_HEC_URL:-https://localhost:8088}"
TOKEN="${SPLUNK_HEC_TOKEN:-}"

usage() {
    cat <<EOF
Usage: $0 [--token TOKEN] [--url URL]

Load generated Nakatomi Heist data into Splunk via HTTP Event Collector (HEC).

Options:
  --token TOKEN    HEC token (or set SPLUNK_HEC_TOKEN env var)
  --url   URL      HEC endpoint (default: https://localhost:8088, or set SPLUNK_HEC_URL)

Prerequisites:
  1. Install the nakatomi_heist Splunk app (creates indexes + configurations)
  2. Enable HEC: Settings > Data Inputs > HTTP Event Collector > Global Settings > Enabled
  3. Create a HEC token: New Token > name it "nakatomi" > select these allowed indexes:
       nakatomi_access, nakatomi_vault, nakatomi_building
  4. Generate data first: cd generator && python3 generate.py

Example:
  $0 --token 12345678-1234-1234-1234-123456789012
  SPLUNK_HEC_TOKEN=mytoken $0
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift 2 ;;
        --url)   SPLUNK_URL="$2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [[ -z "$TOKEN" ]]; then
    echo "Error: HEC token required. Use --token or set SPLUNK_HEC_TOKEN."
    usage
fi

if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Error: No generated data found at $OUTPUT_DIR"
    echo "Run: cd generator && python3 generate.py"
    exit 1
fi

ENDPOINT="$SPLUNK_URL/services/collector"
echo "Loading data into Splunk via HEC at $SPLUNK_URL"
echo ""

TOTAL=0
for f in "$OUTPUT_DIR"/nakatomi_*.json; do
    BASENAME=$(basename "$f")
    COUNT=$(wc -l < "$f" | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))

    echo -n "  $BASENAME ($COUNT events)... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k \
        "$ENDPOINT" \
        -H "Authorization: Splunk $TOKEN" \
        -H "Content-Type: application/json" \
        --data-binary @"$f")

    if [[ "$HTTP_CODE" == "200" ]]; then
        echo "OK"
    else
        echo "FAILED (HTTP $HTTP_CODE)"
        echo "  Check that HEC is enabled and the token has access to nakatomi_* indexes."
        exit 1
    fi
done

echo ""
echo "Done. $TOTAL events loaded across 3 indexes."
echo ""
echo "Verify in Splunk:"
echo "  index=nakatomi_access | stats count"
echo "  index=nakatomi_vault | stats count"
echo "  index=nakatomi_building | stats count"
