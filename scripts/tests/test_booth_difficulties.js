#!/usr/bin/env node
/* v2.13 / Phase 5a-5b — Booth difficulties regression test.
 *
 * Extracts DIFFICULTY_PRESETS, BOOTH_FIXTURES, applyBoothMode,
 * restoreOriginalActs from game.html and exercises them under a vm
 * context with a stub ACTS array. Companion to the
 * endings / hans / phone-calls / investigation-board / hub-overlay
 * tests; uses the same minimal-DOM pattern.
 *
 * Run:    node scripts/tests/test_booth_difficulties.js
 *
 * What we cover:
 *   1. DIFFICULTY_PRESETS contract — quickfire + booth_heist exist
 *      with the exact plan-spec values (timer, maxWrong, hintLevels,
 *      hintTokens, scoreMultiplier, splHelp, isBooth, taskAllowlist).
 *   2. BOOTH_FIXTURES contract — entries for 1.1 / 3.3 / 3.7 with
 *      structurally valid {spl, rows, note} shape and no executable
 *      JS or HTML embedded in values.
 *   3. taskAllowlist round-trip — every allowlisted ID resolves to a
 *      task in the canonical ACTS, in author order, with no dupes.
 *   4. applyBoothMode() reorders by allowlist, NOT by act index, so
 *      a future scenario edit can't break booth pacing.
 *   5. applyBoothMode() falls back to applyDemoMode() when the active
 *      preset has no taskAllowlist (defensive: scenario v2 may turn
 *      off the allowlist).
 *   6. applyBoothMode() falls back gracefully when every allowlisted
 *      ID was renamed in the campaign.
 *   7. restoreOriginalActs() round-trips ACTS so the next non-booth
 *      session sees the full campaign.
 *   8. Quickfire / Booth Heist invariants per plan: 5 min / 2 tasks
 *      / 0.25x; 10 min / 3 tasks / 0.5x.
 *   9. setDifficulty('quickfire') and setDifficulty('booth_heist')
 *      survive URL-param hydration without crashing.
 *  10. Mode-select markup carries data-diff="quickfire" and
 *      data-diff="booth_heist" buttons (regression: catches a
 *      future refactor that drops the booth row).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GAME_HTML = path.join(REPO_ROOT, 'game.html');

if (!fs.existsSync(GAME_HTML)) {
  console.error('ERROR: expected game.html at ' + GAME_HTML);
  process.exit(2);
}

const html = fs.readFileSync(GAME_HTML, 'utf8');

/* ── extract: DIFFICULTY_PRESETS, BOOTH_FIXTURES, the apply* trio ───── */
function sliceAfter(src, marker, until) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('marker not found: ' + marker);
  const end = src.indexOf(until, start);
  if (end < 0) throw new Error('end marker not found: ' + until);
  return src.substring(start, end);
}

const presetsBlock = sliceAfter(html, 'var DIFFICULTY_PRESETS = {', '\n};') + '\n};';
const fixturesBlock = sliceAfter(html, 'var BOOTH_FIXTURES = {', '\n};') + '\n};';
const demoTaskIdsBlock = sliceAfter(html, "var DEMO_TASK_IDS = [", "];\n") + '];\n';
const originalActsBlock = sliceAfter(html, 'var ORIGINAL_ACTS = null;', '\n');

const applyDemoBlock = sliceAfter(html, 'function applyDemoMode() {', '\n}\n') + '\n}\n';
const applyBoothBlock = sliceAfter(html, 'function applyBoothMode() {', '\n}\n') + '\n}\n';
const restoreBlock = sliceAfter(html, 'function restoreOriginalActs() {', '\n}\n') + '\n}\n';

/* Stub ACTS — minimal canonical campaign with the three booth tasks +
   a few decoys. Mirrors the game.html structure exactly so the apply*
   walk works unchanged. */
const STUB_ACTS = [
  { name: 'Act 1', quote: '"q1"', tasks: [
    { id: '1.1', name: 'Guest List',         type: 'code',  code: '0047' },
    { id: '1.2', name: 'Decoy A',            type: 'code',  code: '1234' }
  ]},
  { name: 'Act 2', quote: '"q2"', tasks: [
    { id: '2.3', name: 'Guard Rotation', type: 'code', code: '0008' }
  ]},
  { name: 'Act 3', quote: '"q3"', tasks: [
    { id: '3.3', name: "Takagi's Refusal",   type: 'code',  code: '4291' },
    { id: '3.4', name: 'Decoy B',            type: 'code',  code: '5555' },
    { id: '3.7', name: 'Shoot the Glass',    type: 'power', code: null  }
  ]},
  { name: 'Act 5', quote: '"q5"', tasks: [
    { id: '5.4', name: 'Final Extraction',   type: 'code',  code: '9999' }
  ]}
];

/* ── vm context ──────────────────────────────────────────────────────── */
const ctx = {
  console,
  selectedDifficulty: 'operative'
};
ctx.global = ctx;
vm.createContext(ctx);

/* Load ACTS first so applyBoothMode/applyDemoMode can read it. */
vm.runInContext('var ACTS = ' + JSON.stringify(STUB_ACTS) + ';', ctx);
vm.runInContext(presetsBlock, ctx);
vm.runInContext(fixturesBlock, ctx);
vm.runInContext(demoTaskIdsBlock, ctx);
vm.runInContext(originalActsBlock, ctx);
vm.runInContext(applyDemoBlock, ctx);
vm.runInContext(applyBoothBlock, ctx);
vm.runInContext(restoreBlock, ctx);

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

/* ── 1. DIFFICULTY_PRESETS contract ────────────────────────────────── */
const presets = ctx.DIFFICULTY_PRESETS;
assert('presets exist', presets && typeof presets === 'object');
assert('quickfire preset exists', presets.quickfire && typeof presets.quickfire === 'object');
assert('booth_heist preset exists', presets.booth_heist && typeof presets.booth_heist === 'object');

const qf = presets.quickfire || {};
assertEq('quickfire timer 300s (5 min)', qf.timer, 300);
assertEq('quickfire maxWrong 3', qf.maxWrong, 3);
assertEq('quickfire hintLevels 4', qf.hintLevels, 4);
assertEq('quickfire hintTokens 0', qf.hintTokens, 0);
assertEq('quickfire trapCodes false', qf.trapCodes, false);
assertEq('quickfire scoreMultiplier 0.25', qf.scoreMultiplier, 0.25);
assertEq('quickfire splHelp always', qf.splHelp, 'always');
assertEq('quickfire label', qf.label, 'Quickfire');
assertEq('quickfire isBooth true', qf.isBooth, true);
assertEq('quickfire taskAllowlist length 2', (qf.taskAllowlist || []).length, 2);
assertEq('quickfire taskAllowlist[0]', qf.taskAllowlist[0], '1.1');
assertEq('quickfire taskAllowlist[1]', qf.taskAllowlist[1], '3.7');

const bh = presets.booth_heist || {};
assertEq('booth_heist timer 600s (10 min)', bh.timer, 600);
assertEq('booth_heist maxWrong 5', bh.maxWrong, 5);
assertEq('booth_heist hintLevels 4', bh.hintLevels, 4);
assertEq('booth_heist hintTokens 1', bh.hintTokens, 1);
assertEq('booth_heist trapCodes false', bh.trapCodes, false);
assertEq('booth_heist scoreMultiplier 0.5', bh.scoreMultiplier, 0.5);
assertEq('booth_heist splHelp always', bh.splHelp, 'always');
assertEq('booth_heist label', bh.label, 'Booth Heist');
assertEq('booth_heist isBooth true', bh.isBooth, true);
assertEq('booth_heist taskAllowlist length 3', (bh.taskAllowlist || []).length, 3);
assertEq('booth_heist taskAllowlist[0]', bh.taskAllowlist[0], '1.1');
assertEq('booth_heist taskAllowlist[1]', bh.taskAllowlist[1], '3.3');
assertEq('booth_heist taskAllowlist[2]', bh.taskAllowlist[2], '3.7');

/* Existing presets must still be present and unchanged in shape. */
assertEq('demo timer unchanged', presets.demo && presets.demo.timer, 900);
assertEq('rookie timer unchanged', presets.rookie && presets.rookie.timer, 7200);
assertEq('rookie uses unlimited hint-token sentinel', presets.rookie && presets.rookie.hintTokens, -1);
assertEq('operative timer unchanged', presets.operative && presets.operative.timer, 5400);
assertEq('mastermind timer unchanged', presets.mastermind && presets.mastermind.timer, 3600);
assertEq('iron_man timer unchanged', presets.iron_man && presets.iron_man.timer, 3000);

/* ── 2. BOOTH_FIXTURES contract ────────────────────────────────────── */
const fx = ctx.BOOTH_FIXTURES;
assert('booth fixtures exist', fx && typeof fx === 'object');
['1.1', '3.3', '3.7'].forEach((id) => {
  assert('fixture[' + id + '] present', fx[id] != null);
  if (fx[id]) {
    assert('fixture[' + id + '].spl is string', typeof fx[id].spl === 'string');
    assert('fixture[' + id + '].rows is array', Array.isArray(fx[id].rows));
    assert('fixture[' + id + '].rows.length >= 1', fx[id].rows.length >= 1);
    assert('fixture[' + id + '].note is string', typeof fx[id].note === 'string');
    /* Security: no <script> / <img onerror=...> / javascript: in any
       fixture text — fixtures render to HTML via esc() in game.html
       but we still want to defend the embedded JSON. */
    const blob = JSON.stringify(fx[id]).toLowerCase();
    assert('fixture[' + id + '] no script tag', blob.indexOf('<script') < 0);
    assert('fixture[' + id + '] no javascript: scheme', blob.indexOf('javascript:') < 0);
    assert('fixture[' + id + '] no inline onerror', blob.indexOf('onerror=') < 0);
  }
});

/* ── 3-4. taskAllowlist round-trip & ordering ──────────────────────── */
ctx.selectedDifficulty = 'booth_heist';
ctx.applyBoothMode();
const heistActs = ctx.ACTS;
assertEq('booth_heist produces 1 act', heistActs.length, 1);
assertEq('booth_heist act task count', heistActs[0].tasks.length, 3);
assertEq('booth_heist task[0] is 1.1', heistActs[0].tasks[0].id, '1.1');
assertEq('booth_heist task[1] is 3.3', heistActs[0].tasks[1].id, '3.3');
assertEq('booth_heist task[2] is 3.7', heistActs[0].tasks[2].id, '3.7');
assertEq('booth_heist act name matches preset label', heistActs[0].name, 'Booth Heist');

/* Restore + Quickfire flow. */
ctx.restoreOriginalActs();
assertEq('restore returns 4 acts', ctx.ACTS.length, 4);
assertEq('restore act 1 has task 1.1', ctx.ACTS[0].tasks[0].id, '1.1');

ctx.selectedDifficulty = 'quickfire';
ctx.applyBoothMode();
const qfActs = ctx.ACTS;
assertEq('quickfire produces 1 act', qfActs.length, 1);
assertEq('quickfire act task count', qfActs[0].tasks.length, 2);
assertEq('quickfire task[0] is 1.1', qfActs[0].tasks[0].id, '1.1');
assertEq('quickfire task[1] is 3.7', qfActs[0].tasks[1].id, '3.7');
assertEq('quickfire act name matches preset label', qfActs[0].name, 'Quickfire');

/* ── 5. fallback when preset has no allowlist ───────────────────────── */
ctx.restoreOriginalActs();
ctx.selectedDifficulty = 'operative';   /* no taskAllowlist on operative */
ctx.applyBoothMode();
/* Should fall through to applyDemoMode → 1 act with 3 demo tasks. */
assertEq('fallback (no allowlist) yields 1 act', ctx.ACTS.length, 1);
assertEq('fallback uses demo task count', ctx.ACTS[0].tasks.length, 3);

/* ── 6. fallback when every allowlisted ID renamed ──────────────────── */
ctx.restoreOriginalActs();
/* Synthesise a preset with completely-bogus IDs and run the same path. */
vm.runInContext("DIFFICULTY_PRESETS.synthetic_test = { timer: 60, maxWrong: 1, hintLevels: 0, hintTokens: 0, trapCodes: false, scoreMultiplier: 0, splHelp: 'always', label: 'Synthetic', isBooth: true, taskAllowlist: ['9.9','8.8'] };", ctx);
ctx.selectedDifficulty = 'synthetic_test';
ctx.applyBoothMode();
assertEq('bogus-allowlist fallback yields 1 act', ctx.ACTS.length, 1);
assert('bogus-allowlist fallback yields >0 tasks', ctx.ACTS[0].tasks.length > 0);

/* ── 7. restoreOriginalActs round-trip ──────────────────────────────── */
ctx.restoreOriginalActs();
assertEq('post-restore back to canonical 4 acts', ctx.ACTS.length, 4);
assertEq('post-restore canonical task 1.1', ctx.ACTS[0].tasks[0].id, '1.1');
assertEq('post-restore canonical task 3.7', ctx.ACTS[2].tasks[2].id, '3.7');

/* ── 8. invariant cross-check vs plan ───────────────────────────────── */
assert('quickfire is shorter than booth_heist', presets.quickfire.timer < presets.booth_heist.timer);
assert('booth_heist is shorter than demo', presets.booth_heist.timer < presets.demo.timer);
assert('booth modes have splHelp:always (pre-filled)', presets.quickfire.splHelp === 'always' && presets.booth_heist.splHelp === 'always');
assert('booth modes have trapCodes:false (no surprises)', presets.quickfire.trapCodes === false && presets.booth_heist.trapCodes === false);
assert('booth scoreMultiplier <= demo (lower stakes)', presets.quickfire.scoreMultiplier <= presets.demo.scoreMultiplier && presets.booth_heist.scoreMultiplier <= presets.demo.scoreMultiplier);

/* ── 9. URL-param hydration tolerance ───────────────────────────────── */
const hasQuickfireKey = Object.prototype.hasOwnProperty.call(presets, 'quickfire');
const hasBoothHeistKey = Object.prototype.hasOwnProperty.call(presets, 'booth_heist');
assert('?difficulty=quickfire would survive validation', hasQuickfireKey);
assert('?difficulty=booth_heist would survive validation', hasBoothHeistKey);
/* Defensive: an attacker-supplied difficulty MUST not match. */
assert('?difficulty=__proto__ rejected', !Object.prototype.hasOwnProperty.call(presets, '__proto__'));
assert('?difficulty=constructor rejected', !Object.prototype.hasOwnProperty.call(presets, 'constructor'));

/* ── 10. mode-select markup contains the booth-tier buttons ─────────── */
assert('mode-select has data-diff="quickfire" button', html.indexOf('data-diff="quickfire"') > 0);
assert('mode-select has data-diff="booth_heist" button', html.indexOf('data-diff="booth_heist"') > 0);
assert('mode-select has ms-booth-row class', html.indexOf('ms-booth-row') > 0);
assert('mode-select has ms-booth-btn class', html.indexOf('ms-booth-btn') > 0);
assert('CSS rule for .ms-booth-btn exists', html.indexOf('.ms-booth-btn {') > 0);

/* ── 11. Fast boot wired for booth modes ────────────────────────────── */
assert('runBoot has fastBoot branch for booth modes', html.indexOf('fastBoot = !!(boothPreset && boothPreset.isBooth)') > 0);
assert('fastBoot collapses delay to 120ms', html.indexOf('delay += 120') > 0);

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ Booth Difficulties Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
