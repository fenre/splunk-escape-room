#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$REPO_DIR/nakatomi_heist"
VIZ_BASE="$APP_DIR/appserver/static/visualizations"

VIZS=("nakatomi_vault_display" "nakatomi_terminal")

echo "=== Nakatomi Heist — Visualization Builder ==="
echo ""

for VIZ_NAME in "${VIZS[@]}"; do
    VIZ_DIR="$VIZ_BASE/$VIZ_NAME"

    if [ ! -d "$VIZ_DIR" ]; then
        echo "SKIP: $VIZ_NAME — directory not found"
        continue
    fi

    echo "--- Building: $VIZ_NAME ---"

    if [ ! -d "$VIZ_DIR/node_modules" ]; then
        echo "  [1/2] Installing npm dependencies..."
        (cd "$VIZ_DIR" && npm install)
    else
        echo "  [1/2] Dependencies already installed, skipping."
    fi

    echo "  [2/2] Building visualization bundle..."
    (cd "$VIZ_DIR" && npm run build)
    echo "  Done: $VIZ_DIR/visualization.js"
    echo ""
done

echo "=== All visualizations built ==="
echo ""
echo "To use in Splunk:"
echo "  1. Copy or symlink nakatomi_heist/ to \$SPLUNK_HOME/etc/apps/"
echo "  2. Restart Splunk (or use /_bump for static assets)"
echo ""
echo "To package the app:"
echo "  tar czf nakatomi_heist.spl -C '$REPO_DIR' nakatomi_heist/"
