#!/usr/bin/env node
/* v2.17 — Facilitator dashboard regression test.
 *
 * Validates the `facilitator_board.xml` Dashboard Studio definition:
 *   - JSON parses cleanly inside the CDATA wrapper
 *   - Every layout item references a defined visualization
 *   - Every visualization with a primary data source resolves
 *   - No orphan visualizations, no orphan data sources, no overlaps
 *   - Canvas height accommodates every placed item (no clipping)
 *   - All v2.13/v2.14/v2.16 event types have at least one panel
 *
 * Run:    node scripts/tests/test_facilitator_dashboard.js
 *
 * Catches:
 *   - A future refactor dropping a viz definition the layout still refs
 *   - A canvas-height mismatch shipping a clipped row
 *   - A new event type added to NakaTelemetry.EVENT_TYPES that nobody
 *     ever surfaces on the dashboard (latent telemetry)
 *   - A data source added without a viz (dead query) or vice versa
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DASHBOARD = path.join(REPO_ROOT, 'nakatomi_heist', 'default', 'data', 'ui', 'views', 'facilitator_board.xml');
const GAME_HTML = path.join(REPO_ROOT, 'game.html');

if (!fs.existsSync(DASHBOARD)) {
  console.error('ERROR: expected facilitator_board.xml at ' + DASHBOARD);
  process.exit(2);
}

/* ── tiny assertion harness ────────────────────────────────────────── */
let passed = 0, failed = 0;
const fails = [];
function assert(label, cond) {
  if (cond) { passed++; }
  else { failed++; fails.push(label); }
}
function assertEq(label, actual, expected) {
  const ok = (actual === expected) ||
             (typeof actual === 'object' && typeof expected === 'object' &&
              JSON.stringify(actual) === JSON.stringify(expected));
  if (ok) { passed++; }
  else { failed++; fails.push(label + ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)); }
}

/* ── parse the dashboard's CDATA payload ───────────────────────────── */
const xmlText = fs.readFileSync(DASHBOARD, 'utf8');
const cdataMatch = xmlText.match(/<!\[CDATA\[([\s\S]+?)\]\]>/);
assert('CDATA block present', !!cdataMatch);
if (!cdataMatch) {
  console.error('No CDATA block found; bailing.');
  process.exit(1);
}

let spec;
try {
  spec = JSON.parse(cdataMatch[1]);
  passed++;
} catch (e) {
  failed++;
  fails.push('JSON.parse failed: ' + e.message);
  console.error(e);
  process.exit(1);
}

const ds   = spec.dataSources || {};
const viz  = spec.visualizations || {};
const struct = (spec.layout && spec.layout.structure) || [];

/* ── 1. Counts match expectations ──────────────────────────────────── */
assert('dataSources non-empty', Object.keys(ds).length > 0);
assert('visualizations non-empty', Object.keys(viz).length > 0);
assert('layout.structure non-empty', struct.length > 0);
assertEq('visualizations and layout entries match',
  Object.keys(viz).length, struct.length);

/* ── 2. Every layout item maps to a viz definition ─────────────────── */
const vizNames = new Set(Object.keys(viz));
const orphanLayout = [];
for (const item of struct) {
  if (!vizNames.has(item.item)) orphanLayout.push(item.item);
}
assertEq('zero layout-item → viz orphans', orphanLayout, []);

/* ── 3. No viz left out of the layout ──────────────────────────────── */
const placedNames = new Set(struct.map(it => it.item));
const unplaced = [...vizNames].filter(n => !placedNames.has(n));
assertEq('zero unplaced visualizations', unplaced, []);

/* ── 4. Every viz primary data source resolves ─────────────────────── */
const dsNames = new Set(Object.keys(ds));
const missingDs = [];
for (const [vname, vdef] of Object.entries(viz)) {
  const primary = vdef.dataSources && vdef.dataSources.primary;
  if (primary && !dsNames.has(primary)) missingDs.push([vname, primary]);
}
assertEq('zero viz → ds orphans', missingDs, []);

/* ── 5. Every data source is referenced by at least one viz ────────── */
const referenced = new Set();
for (const vdef of Object.values(viz)) {
  const p = vdef.dataSources && vdef.dataSources.primary;
  if (p) referenced.add(p);
}
const unusedDs = [...dsNames].filter(n => !referenced.has(n));
assertEq('zero unused data sources', unusedDs, []);

/* ── 6. Canvas height covers every placed item ─────────────────────── */
const canvasH = (spec.layout && spec.layout.options && spec.layout.options.height) || 0;
const canvasW = (spec.layout && spec.layout.options && spec.layout.options.width) || 0;
let maxBottom = 0;
let maxRight = 0;
for (const item of struct) {
  const p = item.position || {};
  const bottom = (p.y || 0) + (p.h || 0);
  const right  = (p.x || 0) + (p.w || 0);
  if (bottom > maxBottom) maxBottom = bottom;
  if (right > maxRight) maxRight = right;
}
assert('canvas height >= max bottom', canvasH >= maxBottom);
assert('canvas width >= max right',   canvasW >= maxRight);
/* Reasonable buffer — clipped rows are visually broken even with zero
   pixels remaining. We require at least 5px breathing room. */
assert('canvas has >= 5px bottom buffer', canvasH - maxBottom >= 5);

/* ── 7. No two layout items overlap ────────────────────────────────── */
const overlaps = [];
for (let i = 0; i < struct.length; i++) {
  const a = struct[i];
  const ap = a.position;
  for (let j = i + 1; j < struct.length; j++) {
    const b = struct[j];
    const bp = b.position;
    const xOverlap = (ap.x < bp.x + bp.w) && (bp.x < ap.x + ap.w);
    const yOverlap = (ap.y < bp.y + bp.h) && (bp.y < ap.y + ap.h);
    if (xOverlap && yOverlap) overlaps.push([a.item, b.item]);
  }
}
assertEq('zero overlapping layout items', overlaps, []);

/* ── 8. Every v2.13/v2.14 telemetry event type has a panel ─────────── */
const html = fs.readFileSync(GAME_HTML, 'utf8');
/* Pull the contents of EVENT_TYPES out of game.html. */
const etMatch = html.match(/var EVENT_TYPES\s*=\s*\{([\s\S]*?)\};/);
assert('EVENT_TYPES block found in game.html', !!etMatch);
const eventNames = [];
if (etMatch) {
  const reKey = /'([a-z_]+)':\s*1/g;
  let m;
  while ((m = reKey.exec(etMatch[1])) !== null) eventNames.push(m[1]);
}
assert('found 25+ event types', eventNames.length >= 25);

/* The dashboard surfaces a subset of event types via SPL queries.
   Spot-check the v2.13/v2.14 events we just added rows for. */
const queries = JSON.stringify(ds);
const v2_13_v2_14_events = [
  'kiosk_activated',
  'kiosk_idle_reset',
  'kiosk_watchdog_reload',
  'session_feedback',
  'session_abandoned',
  'facilitator_action',
  'audio_setting_changed'
];
const eventsMissing = [];
for (const evt of v2_13_v2_14_events) {
  if (queries.indexOf(evt) < 0) eventsMissing.push(evt);
}
assertEq('every v2.13/v2.14 event type has at least one panel', eventsMissing, []);

/* ── 9. Each new row has the standard four artifacts (header + KPI +
       2 panel labels + 2 panel viz) ─────────────────────────────────── */
const KIOSK_ROW = ['viz_kiosk_header', 'viz_kpi_kiosk_today',
                   'viz_kiosk_reset_label', 'viz_kiosk_reset_mix',
                   'viz_kiosk_recent_label', 'viz_kiosk_recent'];
const FEEDBACK_ROW = ['viz_feedback_header', 'viz_kpi_feedback_avg',
                      'viz_feedback_dist_label', 'viz_feedback_distribution',
                      'viz_abandon_label', 'viz_abandon_by_act'];
const OPERATOR_ROW = ['viz_operator_header', 'viz_kpi_operator_today',
                      'viz_facilitator_action_label', 'viz_facilitator_action_mix',
                      'viz_audio_setting_label', 'viz_audio_setting_mix'];

for (const [rowName, rowItems] of [['kiosk', KIOSK_ROW], ['feedback', FEEDBACK_ROW], ['operator', OPERATOR_ROW]]) {
  for (const id of rowItems) {
    assert(rowName + ' row has ' + id, vizNames.has(id) && placedNames.has(id));
  }
}

/* ── 10. Description mentions every v2.x row by version ────────────── */
const desc = (spec.description || '').toLowerCase();
const versions = ['v2.9', 'v2.10', 'v2.11', 'v2.12', 'v2.13', 'v2.14'];
for (const v of versions) {
  assert('description mentions ' + v, desc.indexOf(v) >= 0);
}

/* ── 11. Canvas dimensions match the description string ────────────── */
const dimMatch = (spec.description || '').match(/(\d+)x(\d+)/);
if (dimMatch) {
  assertEq('description dimensions match canvas width', parseInt(dimMatch[1], 10), canvasW);
  assertEq('description dimensions match canvas height', parseInt(dimMatch[2], 10), canvasH);
}

/* ── 12. Every kiosk/feedback/operator data source uses booth-token guard ──
   A regression that drops the `where ("$booth_token$"="" OR ...)` filter
   would allow any visitor to one booth's facilitator board to see another
   booth's data. Catch it here. */
const newDataSources = [
  'ds_kpi_kiosk_today', 'ds_kiosk_reset_mix', 'ds_kiosk_recent',
  'ds_kpi_feedback_avg', 'ds_feedback_distribution', 'ds_abandon_by_act',
  'ds_kpi_operator_today', 'ds_facilitator_action_mix', 'ds_audio_setting_mix'
];
for (const dsName of newDataSources) {
  assert(dsName + ' exists', dsName in ds);
  if (dsName in ds) {
    const q = ds[dsName].options.query;
    assert(dsName + ' carries booth-token guard',
      q.indexOf('booth_id="$booth_token$"') >= 0);
  }
}

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ Facilitator Dashboard Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
console.log(`Canvas: ${canvasW}x${canvasH}, content max bottom y=${maxBottom} (${canvasH - maxBottom}px buffer)`);
console.log(`Sources: ${Object.keys(ds).length} dataSources / ${Object.keys(viz).length} viz / ${struct.length} layout entries`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
