#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SOURCE="$REPO_ROOT/nakatomi_heist"
STAGE_ROOT="$REPO_ROOT/build/static-package"
STAGE_APP="$STAGE_ROOT/nakatomi_heist"
DIST_DIR="$REPO_ROOT/dist"

version="$(
  awk '
    /^\[launcher\]$/ { in_launcher=1; next }
    /^\[/ { in_launcher=0 }
    in_launcher && /^version[[:space:]]*=/ {
      sub(/^[^=]*=[[:space:]]*/, "")
      print
      exit
    }
  ' "$APP_SOURCE/default/app.conf"
)"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: invalid or missing app version: $version" >&2
  exit 1
fi

echo "==> Generating canonical puzzle data"
(
  cd "$REPO_ROOT/generator"
  python3 generate.py
)

echo "==> Preparing clean staged app"
rm -rf "$STAGE_ROOT"
mkdir -p "$STAGE_ROOT" "$DIST_DIR"
COPYFILE_DISABLE=1 tar \
  --exclude='nakatomi_heist/node_modules' \
  --exclude='nakatomi_heist/src' \
  --exclude='nakatomi_heist/package.json' \
  --exclude='nakatomi_heist/package-lock.json' \
  --exclude='nakatomi_heist/webpack.config.js' \
  --exclude='*/node_modules' \
  --exclude='*/src' \
  --exclude='*/package.json' \
  --exclude='*/package-lock.json' \
  --exclude='*/webpack.config.js' \
  --exclude='*/.gitignore' \
  --exclude='*/.DS_Store' \
  --exclude='*/._*' \
  --exclude='*/__pycache__' \
  --exclude='*/local' \
  -cf - -C "$REPO_ROOT" nakatomi_heist |
  tar -xf - -C "$STAGE_ROOT"

echo "==> Compiling Splunk browser assets"
npm --prefix "$APP_SOURCE" ci
npm --prefix "$APP_SOURCE" run build -- \
  --output-path "$STAGE_APP/appserver/static/pages"

for viz in nakatomi_terminal nakatomi_vault_display; do
  viz_source="$APP_SOURCE/appserver/static/visualizations/$viz"
  viz_output="$STAGE_APP/appserver/static/visualizations/$viz"
  npm --prefix "$viz_source" ci
  npm --prefix "$viz_source" run build -- --output-path "$viz_output"
done

echo "==> Converting every canonical event into one-shot seed shards"
python3 "$REPO_ROOT/generator/json_to_logs.py" \
  --output-dir "$REPO_ROOT/generator/output" \
  --data-dir "$STAGE_APP/data" \
  --inputs-path "$STAGE_APP/default/inputs.conf" \
  --props-path "$STAGE_APP/default/props.conf" \
  --manifest-path "$STAGE_APP/README/seed-data-manifest.json"

echo "==> Validating staged app"
python3 "$REPO_ROOT/scripts/validate-static-package.py" "$STAGE_APP"

artifact="$DIST_DIR/nakatomi_heist-$version.spl"
rm -f "$artifact" "$DIST_DIR/SHA256SUMS" "$DIST_DIR/seed-data-manifest.json"

echo "==> Creating $artifact"
COPYFILE_DISABLE=1 tar -czf "$artifact" -C "$STAGE_ROOT" nakatomi_heist
cp "$STAGE_APP/README/seed-data-manifest.json" "$DIST_DIR/seed-data-manifest.json"

echo "==> Validating release archive"
python3 "$REPO_ROOT/scripts/validate-static-package.py" "$artifact"

(
  cd "$DIST_DIR"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$(basename "$artifact")" > SHA256SUMS
  else
    sha256sum "$(basename "$artifact")" > SHA256SUMS
  fi
)

total_events="$(
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["total_events"])' \
    "$DIST_DIR/seed-data-manifest.json"
)"
echo "PASS: built $(basename "$artifact") with $total_events static events"
echo "Checksum: $DIST_DIR/SHA256SUMS"
