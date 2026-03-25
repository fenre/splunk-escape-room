#!/usr/bin/env bash
set -euo pipefail

# ── Nakatomi Heist — One-Shot Setup ──────────────────────────────
# Generates scenario data and loads it into Splunk via HEC.
#
# Usage:
#   ./setup.sh --token <HEC_TOKEN> [--url <HEC_URL>] [--seed <SEED>]
#
# Prerequisites:
#   1. Install the nakatomi_heist app on your Splunk instance
#   2. Enable HEC: Settings > Data Inputs > HTTP Event Collector > Global Settings > Enabled
#   3. Create a HEC token with access to: nakatomi_access, nakatomi_vault, nakatomi_building
#   4. Python 3 with PyYAML installed (pip3 install pyyaml)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SPLUNK_URL="${SPLUNK_HEC_URL:-https://localhost:8088}"
TOKEN="${SPLUNK_HEC_TOKEN:-}"
SEED=""
OUTPUT_DIR=""

usage() {
    cat <<EOF
Usage: $0 --token <HEC_TOKEN> [--url <HEC_URL>] [--seed <SEED>]

Options:
  --token TOKEN    HEC token (or set SPLUNK_HEC_TOKEN env var)
  --url   URL      HEC endpoint (default: https://localhost:8088, or set SPLUNK_HEC_URL)
  --seed  SEED     Override random seed for data generation
  -h, --help       Show this help
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift 2 ;;
        --url)   SPLUNK_URL="$2"; shift 2 ;;
        --seed)  SEED="--seed $2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [[ -z "$TOKEN" ]]; then
    echo "Error: HEC token required. Use --token or set SPLUNK_HEC_TOKEN."
    usage
fi

echo "═══════════════════════════════════════════════════════════"
echo "  NAKATOMI PLAZA: VAULT HEIST — SETUP"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Generate data ────────────────────────────────────────
OUTPUT_DIR=$(mktemp -d)
trap 'rm -rf "$OUTPUT_DIR"' EXIT

echo "[1/3] Generating scenario data..."

# Temporarily patch the generator to use our output dir
GENERATOR="$SCRIPT_DIR/generate.py"
SCENARIO="$SCRIPT_DIR/scenario.yaml"

if ! command -v python3 &>/dev/null; then
    echo "Error: python3 is required. Install Python 3 and PyYAML (pip3 install pyyaml)."
    exit 1
fi

python3 -c "import yaml" 2>/dev/null || {
    echo "Error: PyYAML is required. Install it: pip3 install pyyaml"
    exit 1
}

# Run generator with output to temp dir
cd "$SCRIPT_DIR"
python3 "$GENERATOR" -c "$SCENARIO" $SEED
GENERATED_DIR="$SCRIPT_DIR/output"

echo ""

# ── Step 2: Copy lookups into the app ────────────────────────────
echo "[2/3] Installing lookup tables..."
LOOKUPS_DIR="$(dirname "$SCRIPT_DIR")/lookups"
mkdir -p "$LOOKUPS_DIR"

for csv_file in employee_directory.csv floor_directory.csv system_codes.csv; do
    if [[ -f "$GENERATED_DIR/$csv_file" ]]; then
        cp "$GENERATED_DIR/$csv_file" "$LOOKUPS_DIR/$csv_file"
        ROWS=$(wc -l < "$LOOKUPS_DIR/$csv_file" | tr -d ' ')
        echo "  $csv_file ($((ROWS - 1)) rows)"
    fi
done

echo ""

# ── Step 3: Load events via HEC ──────────────────────────────────
echo "[3/3] Loading events into Splunk via HEC at $SPLUNK_URL..."
echo ""

ENDPOINT="$SPLUNK_URL/services/collector"
TOTAL=0

for f in "$GENERATED_DIR"/nakatomi_*.json; do
    BASENAME=$(basename "$f")
    COUNT=$(wc -l < "$f" | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))

    printf "  %-30s (%s events) ... " "$BASENAME" "$COUNT"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k \
        "$ENDPOINT" \
        -H "Authorization: Splunk $TOKEN" \
        -H "Content-Type: application/json" \
        --data-binary @"$f")

    if [[ "$HTTP_CODE" == "200" ]]; then
        echo "OK"
    else
        echo "FAILED (HTTP $HTTP_CODE)"
        echo ""
        echo "  Troubleshooting:"
        echo "  - Is HEC enabled? Settings > Data Inputs > HTTP Event Collector > Global Settings"
        echo "  - Does the token have access to nakatomi_* indexes?"
        echo "  - Is the URL correct? (current: $SPLUNK_URL)"
        exit 1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  SETUP COMPLETE"
echo "  $TOTAL events loaded across 3 indexes"
echo "  3 lookup tables installed"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Verify in Splunk:"
echo "    index=nakatomi_access | stats count"
echo "    index=nakatomi_vault | stats count"
echo "    index=nakatomi_building | stats count"
echo ""
echo "  Open the terminal:"
echo "    https://<your-splunk>:8000/app/nakatomi_heist/terminal"
echo ""
