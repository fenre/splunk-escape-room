#!/usr/bin/env bash
# v2.15 / Q1 — Unified test runner.
#
# Runs every scripts/tests/test_*.js (the project's pure-Node
# regression harness) and reports a combined pass/fail tally. Used
# by both local pre-commit checks and the GitHub Actions CI workflow.
#
# Exit code: 0 if every test passes, 1 otherwise.
#
# Usage:
#     bash scripts/test.sh              # run all
#     bash scripts/test.sh --json       # emit JSON summary on stdout
#     bash scripts/test.sh --quiet      # only output the final summary
#
# Per the project's no-secrets-in-CI policy, this script never reads
# from environment variables containing tokens, never logs URL params,
# and never writes output beyond stdout. CI runners pipe the JSON
# summary into the build status badge.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/scripts/tests"

# ── arg parsing ────────────────────────────────────────────────────
JSON=0
QUIET=0
for arg in "$@"; do
  case "$arg" in
    --json)  JSON=1 ;;
    --quiet) QUIET=1 ;;
    -h|--help)
      cat <<USAGE
Nakatomi Heist test runner

Usage: bash scripts/test.sh [--json] [--quiet]

Runs every scripts/tests/test_*.js. Exit 0 on pass, 1 on any failure.
USAGE
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ── run every test_*.js ────────────────────────────────────────────
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FILES=()
TEST_RESULTS=()

shopt -s nullglob
for test_file in "$TESTS_DIR"/test_*.js; do
  name="$(basename "$test_file")"
  out=$(node "$test_file" 2>&1) || EXIT=$? || true
  EXIT=${EXIT:-0}

  # Extract the pass/fail count from the harness output.
  # Format:  "N pass, M fail"  or  "  passed: N"
  pf=$(echo "$out" | grep -oE '[0-9]+ pass, [0-9]+ fail' | tail -1 || echo "")
  pp=$(echo "$out" | grep -oE 'passed: *[0-9]+' | tail -1 || echo "")
  if [ -n "$pf" ]; then
    pass=$(echo "$pf" | awk '{print $1}')
    fail=$(echo "$pf" | awk '{print $3}')
  elif [ -n "$pp" ]; then
    pass=$(echo "$pp" | grep -oE '[0-9]+' | tail -1)
    fail=0
  else
    pass=0
    fail=$EXIT
  fi

  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
  TEST_RESULTS+=("$name|$pass|$fail|$EXIT")
  if [ "$EXIT" -ne 0 ] || [ "$fail" -gt 0 ]; then
    FAILED_FILES+=("$name")
    if [ "$QUIET" -ne 1 ] && [ "$JSON" -ne 1 ]; then
      echo "FAIL  $name"
      echo "$out" | sed 's/^/    /'
    fi
  else
    if [ "$QUIET" -ne 1 ] && [ "$JSON" -ne 1 ]; then
      printf "PASS  %-44s %4d assertions\n" "$name" "$pass"
    fi
  fi
done

# ── report ────────────────────────────────────────────────────────
if [ "$JSON" -eq 1 ]; then
  printf '{"total_pass":%d,"total_fail":%d,"failed_files":[' "$TOTAL_PASS" "$TOTAL_FAIL"
  first=1
  for f in "${FAILED_FILES[@]:-}"; do
    if [ -z "$f" ]; then continue; fi
    if [ $first -eq 0 ]; then printf ','; fi
    printf '"%s"' "$f"
    first=0
  done
  printf '],"results":['
  first=1
  for r in "${TEST_RESULTS[@]}"; do
    name="${r%%|*}"; rest="${r#*|}"
    pass="${rest%%|*}"; rest="${rest#*|}"
    fail="${rest%%|*}"; exitc="${rest##*|}"
    if [ $first -eq 0 ]; then printf ','; fi
    printf '{"name":"%s","pass":%d,"fail":%d,"exit":%d}' "$name" "$pass" "$fail" "$exitc"
    first=0
  done
  printf ']}\n'
else
  echo
  echo "════════════════════════════════════════════════════════════════"
  printf "  Total: %d pass, %d fail across %d test files\n" "$TOTAL_PASS" "$TOTAL_FAIL" "${#TEST_RESULTS[@]}"
  echo "════════════════════════════════════════════════════════════════"
fi

if [ "$TOTAL_FAIL" -gt 0 ] || [ "${#FAILED_FILES[@]}" -gt 0 ]; then
  exit 1
fi
exit 0
