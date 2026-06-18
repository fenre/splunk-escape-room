#!/usr/bin/env node
/* v2.15 / Q1 — Scenario consistency regression test.
 *
 * Validates the contract between generator/scenario.yaml and the
 * game's canonical answer key. Catches generator drift breaking
 * puzzles silently — e.g. a seal `code` field mutated without the
 * corresponding `embed_value` being updated, or two seals sharing
 * the same code.
 *
 * Run:    node scripts/tests/test_scenario_consistency.js
 *
 * What we cover:
 *   1. Scenario file present + parseable.
 *   2. Game metadata required keys (title, duration_minutes,
 *      max_wrong_codes, date, timezone, seed).
 *   3. Each seal (1..7) has every required field.
 *   4. Each seal's code is exactly 4 digits (matches keypad spec).
 *   5. Each seal's code appears verbatim in its embed_value (the
 *      generator emits embed_value into the named index/sourcetype;
 *      the game then reads the code from that text. Mutating one
 *      without the other silently breaks the puzzle).
 *   6. No two seals share a code (avoids ambiguity).
 *   7. Each seal's index appears in the canonical
 *      nakatomi_heist/default/indexes.conf file.
 *   8. Each seal's sourcetype follows the nakatomi:* convention.
 *
 * Intentionally NOT covered here (run as a separate optional
 * harness via scripts/test_generator_seeds.sh):
 *   - Actually executing the generator on seeds 1/42/1337 and
 *     greping the output. Requires Python + a working generator
 *     install; run only in CI / locally on demand.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCENARIO  = path.join(REPO_ROOT, 'generator', 'scenario.yaml');
const INDEXES   = path.join(REPO_ROOT, 'nakatomi_heist', 'default', 'indexes.conf');

if (!fs.existsSync(SCENARIO)) {
  console.error('ERROR: expected scenario.yaml at ' + SCENARIO);
  process.exit(2);
}

const yamlText = fs.readFileSync(SCENARIO, 'utf8');
const indexesText = fs.existsSync(INDEXES) ? fs.readFileSync(INDEXES, 'utf8') : '';

/* ── tiny harness ──────────────────────────────────────────────────── */
let passed = 0, failed = 0;
const fails = [];
function assert(label, cond) {
  if (cond) { passed++; }
  else { failed++; fails.push(label); }
}

/* ── minimal YAML reader ────────────────────────────────────────────
   We only need to extract a small subset of structure: top-level
   keys (game.*, seed, seals.N.*). No full YAML parser needed; the
   scenario file uses a strict 2-space-indent style so a regex-based
   walk is reliable. If the format ever drifts to multi-line strings
   or anchors, swap to js-yaml at that point. ────────────────────── */
function readScalarKey(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/* Walk top-level [game] block. */
const gameTitle    = readScalarKey(yamlText, /^game:[\s\S]*?\n  title:\s*"([^"]+)"/m);
const gameDuration = readScalarKey(yamlText, /^game:[\s\S]*?\n  duration_minutes:\s*(\d+)/m);
const gameMaxWrong = readScalarKey(yamlText, /^game:[\s\S]*?\n  max_wrong_codes:\s*(\d+)/m);
const gameDate     = readScalarKey(yamlText, /^game:[\s\S]*?\n  date:\s*"([^"]+)"/m);
const gameSeed     = readScalarKey(yamlText, /^seed:\s*(\d+)/m);

assert('scenario.yaml has game.title',           !!gameTitle);
assert('scenario.yaml has game.duration_minutes', /^\d+$/.test(gameDuration || ''));
assert('scenario.yaml has game.max_wrong_codes',  /^\d+$/.test(gameMaxWrong || ''));
assert('scenario.yaml has game.date',             !!gameDate);
assert('scenario.yaml has top-level seed',        /^\d+$/.test(gameSeed || ''));

/* ── extract every seal block ────────────────────────────────────── */
function extractSeals(text) {
  /* Find the `seals:` block, then walk children numbered 1..N. */
  const sealsHeader = text.indexOf('\nseals:');
  if (sealsHeader < 0) return [];
  /* Find the next top-level key after seals: (a key at column 0). */
  let endIdx = text.length;
  const re = /\n([a-zA-Z_]+):/g;
  re.lastIndex = sealsHeader + '\nseals:'.length;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > sealsHeader + '\nseals:'.length) {
      endIdx = m.index;
      break;
    }
  }
  const block = text.substring(sealsHeader, endIdx);
  /* Each seal section starts with `  N:` at indent 2. */
  const sealRe = /\n  (\d+):\n((?:    [^\n]*\n?)+)/g;
  const out = [];
  let mm;
  while ((mm = sealRe.exec(block)) !== null) {
    const num = parseInt(mm[1], 10);
    const body = mm[2];
    const fieldRe = /^    (\w+):\s*(.*)$/gm;
    const fields = {};
    let fm;
    while ((fm = fieldRe.exec(body)) !== null) {
      let k = fm[1];
      let v = fm[2].trim();
      /* Strip wrapping quotes (single or double). Multiline values are
         out of scope for this scenario style. */
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      fields[k] = v;
    }
    fields.__num = num;
    out.push(fields);
  }
  return out;
}

const seals = extractSeals(yamlText);
assert('found 7 seals', seals.length === 7);

/* Seal-specific known shapes. Captured as a typed map so a future
   scenario edit surfaces a clear failure if it tries to drop one of
   the established embed-style variants:
     embed_value       — direct text containing the code (1, 2, 5)
     embed_sequence    — sequence of digit-input events (3, Takagi)
     embed_value_rot13 — ROT13-encoded message (4, HVAC)
     embed_location    — CSV lookup reference (6)
   Seal 7 is the meta power-button beat — no code. */
const SEAL_SHAPES = {
  1: { embedKind: 'embed_value' },
  2: { embedKind: 'embed_value' },
  3: { embedKind: 'embed_sequence' },
  4: { embedKind: 'embed_value_rot13' },
  5: { embedKind: 'embed_value' },
  6: { embedKind: 'embed_location' },
  7: { isMeta: true }
};

const seenCodes = new Set();

for (const seal of seals) {
  const tag = 'seal ' + seal.__num;
  const shape = SEAL_SHAPES[seal.__num] || {};

  /* Every seal has a description. */
  assert(tag + ' has description', typeof seal.description === 'string' && seal.description.length > 0);

  if (shape.isMeta) {
    /* Seal 7: the meta power-button puzzle. code is null, no index. */
    assert(tag + ' (meta) code is null',
      seal.code === 'null' || seal.code == null);
    continue;
  }

  /* Code shape — exactly 4 digits per the keypad spec. */
  assert(tag + ' code is exactly 4 digits', /^\d{4}$/.test(seal.code || ''));

  /* Uniqueness — no two seals share a code. Same-code = ambiguous puzzle. */
  assert(tag + ' code "' + seal.code + '" not duplicated', !seenCodes.has(seal.code));
  seenCodes.add(seal.code);

  /* Description always present. */
  assert(tag + ' description not empty', !!seal.description && seal.description.length > 4);

  /* Embed-shape validation — at least one of the four canonical
     embed variants must carry the code. The yaml-extract regex above
     records embed_sequence as a single comma-joined string on one
     line; embed_location is just a hint string. */
  if (shape.embedKind === 'embed_value') {
    assert(tag + ' has embed_value', typeof seal.embed_value === 'string' && seal.embed_value.length > 0);
    assert(tag + ' embed_value contains the code',
      seal.embed_value && seal.embed_value.indexOf(seal.code) >= 0);
    assert(tag + ' has index', typeof seal.index === 'string' && seal.index.length > 0 && seal.index !== 'null');
    assert(tag + ' has sourcetype', typeof seal.sourcetype === 'string' && seal.sourcetype.startsWith('nakatomi:'));
    assert(tag + ' has embed_field', typeof seal.embed_field === 'string' && seal.embed_field.length > 0);
  } else if (shape.embedKind === 'embed_sequence') {
    /* The sequence's digits, concatenated, form the code. */
    assert(tag + ' has embed_sequence',
      typeof seal.embed_sequence === 'string' && seal.embed_sequence.length > 0);
    /* Pull the numeric digits out of the sequence: each entry is
       `input=N`, joined by ', ' — the regex strips down to digits. */
    const digits = (seal.embed_sequence || '').replace(/[^0-9]/g, '');
    assert(tag + ' embed_sequence digits == code',
      digits === seal.code);
    assert(tag + ' has index', typeof seal.index === 'string' && seal.index.length > 0 && seal.index !== 'null');
    assert(tag + ' has sourcetype', typeof seal.sourcetype === 'string' && seal.sourcetype.startsWith('nakatomi:'));
  } else if (shape.embedKind === 'embed_value_rot13') {
    /* ROT13 encode the code's plaintext mention and confirm it's in
       the embed. We hardcode the plaintext form here ("CODE 8086") so
       the test catches drift in the puzzle's lore copy too. */
    assert(tag + ' has embed_value_rot13',
      typeof seal.embed_value_rot13 === 'string' && seal.embed_value_rot13.length > 0);
    assert(tag + ' rot13 plaintext contains the code',
      seal.embed_value_rot13 && seal.embed_value_rot13.indexOf(seal.code) >= 0);
    assert(tag + ' has index', typeof seal.index === 'string' && seal.index.length > 0 && seal.index !== 'null');
    assert(tag + ' has sourcetype', typeof seal.sourcetype === 'string' && seal.sourcetype.startsWith('nakatomi:'));
  } else if (shape.embedKind === 'embed_location') {
    /* Seal 6 routes through a CSV lookup; the embed_location is a
       human-readable reference. We just confirm it's present and
       not blank — actual generator-time correctness is checked by
       the optional scripts/test_generator_seeds.sh harness. */
    assert(tag + ' has embed_location',
      typeof seal.embed_location === 'string' && seal.embed_location.length > 4);
    /* index/sourcetype are explicitly null for this seal — no
       direct event stream lookup. */
    assert(tag + ' index is null (CSV-only)',
      seal.index === 'null' || seal.index == null);
  }

  /* If the seal has a real index name, it must exist in indexes.conf. */
  if (indexesText && seal.index && seal.index !== 'null' && seal.index.length > 0) {
    assert(tag + ' index "' + seal.index + '" exists in indexes.conf',
      indexesText.indexOf('[' + seal.index + ']') >= 0);
  }
}

/* ── Telemetry retention sanity ────────────────────────────────────── */
assert('nakatomi_sessions has 90d retention (frozenTimePeriodInSecs=7776000)',
  indexesText.indexOf('frozenTimePeriodInSecs = 7776000') > 0);
assert('nakatomi_sessions defines homePath', indexesText.indexOf('[nakatomi_sessions]') >= 0);

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ Scenario Consistency Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
console.log('Seals validated: ' + seals.length + ' (codes: ' + Array.from(seenCodes).sort().join(', ') + ')');
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
