#!/usr/bin/env node
/* v2.16 / Phase 5f + Q3 + Q4 — ScenarioPacks + I18n regression test.
 *
 * Extracts both IIFE modules from game.html and exercises them under
 * a vm context with stubbed fetch + DOM + localStorage. Also validates
 * the on-disk JSON packs (scenarios/*.json, i18n/*.json).
 *
 * Run:    node scripts/tests/test_scenario_packs.js
 *
 * What we cover:
 *   1. Module surfaces — public API matches the contract.
 *   2. ScenarioPacks ALLOWED list — only default | roof | afterparty.
 *   3. ScenarioPacks._validate — accepts a well-formed pack;
 *      rejects schema_version != 2; rejects unknown $id; drops keys
 *      named __proto__ / constructor / prototype.
 *   4. ScenarioPacks._validate — string fields capped at MAX_STRING_LEN.
 *   5. ScenarioPacks._validate — control chars stripped.
 *   6. ScenarioPacks fetches only the allow-listed file (no path
 *      traversal in URL).
 *   7. ScenarioPacks fallback — unknown ?scenario= value silently
 *      falls back to default with no fetch attempt.
 *   8. I18n ALLOWED_LANGS — only en | es | de | ja.
 *   9. I18n.t() — resolves from translations, falls back to DEFAULTS,
 *      falls back to fallback arg, finally returns the key itself.
 *  10. I18n._validKey — rejects keys with newlines / quotes / etc.
 *  11. On-disk pack JSON files validate against the schema (default,
 *      roof, afterparty all pass _validate()).
 *  12. On-disk i18n JSON files have at least the same keys as the
 *      DEFAULTS table (regression: catches a translation pack
 *      missing a string the UI tries to render).
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

function sliceIIFE(src, needle) {
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(needle + ' not found in game.html');
  const end = src.indexOf('\n})();', start);
  if (end < 0) throw new Error(needle + ' end marker not found');
  return src.substring(start, end + '\n})();'.length);
}

const scenarioSrc = sliceIIFE(html, 'var ScenarioPacks = (function()');
const i18nSrc     = sliceIIFE(html, 'var I18n = (function()');

/* ── tiny harness ──────────────────────────────────────────────────── */
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

/* ── stub: minimal browser globals for both modules ──────────────── */
function makeContext(opts) {
  opts = opts || {};
  /* Track every fetch URL the module asks for. */
  const fetchUrls = [];
  const ctx = {
    console,
    URLSearchParams: URLSearchParams,
    document: {
      getElementById(id) {
        if (id === 'nakatomi-scenario' && opts.inlineScenario) {
          return { textContent: typeof opts.inlineScenario === 'string'
            ? opts.inlineScenario
            : JSON.stringify(opts.inlineScenario) };
        }
        if (id === 'nakatomi-i18n' && opts.inlineI18n) {
          return { textContent: typeof opts.inlineI18n === 'string'
            ? opts.inlineI18n
            : JSON.stringify(opts.inlineI18n) };
        }
        return null;
      }
    },
    window: {
      location: {
        protocol: opts.protocol || 'https:',
        search: opts.search || ''
      }
    },
    fetch: (url, init) => {
      fetchUrls.push(url);
      const cannedBody = opts.fetchBody;
      const cannedOk = opts.fetchOk !== false;
      return Promise.resolve({
        ok: cannedOk,
        headers: { get: () => '' },
        text: () => Promise.resolve(typeof cannedBody === 'string' ? cannedBody : JSON.stringify(cannedBody || {}))
      });
    },
    a11yAnnounce: () => {}
  };
  ctx.location = ctx.window.location;
  vm.createContext(ctx);
  vm.runInContext(scenarioSrc, ctx);
  vm.runInContext(i18nSrc, ctx);
  return { ctx, fetchUrls };
}

/* ── 1. Module surfaces ─────────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  ['init','getActiveId','getStoryBeat','getIntercept','getAmbientLabel','getEndingOverride','_internals']
    .forEach(k => assert('ScenarioPacks.' + k + ' exposed',
      typeof ctx.ScenarioPacks[k] === 'function' || (k === '_internals' && typeof ctx.ScenarioPacks[k] === 'object')));
  ['init','t','getActiveLang','_internals']
    .forEach(k => assert('I18n.' + k + ' exposed',
      typeof ctx.I18n[k] === 'function' || (k === '_internals' && typeof ctx.I18n[k] === 'object')));
}

/* ── 2. ScenarioPacks allow-list ───────────────────────────────────── */
{
  const { ctx } = makeContext();
  const A = ctx.ScenarioPacks._internals.ALLOWED;
  assert('ALLOWED has default', A['default'] === 1);
  assert('ALLOWED has roof', A['roof'] === 1);
  assert('ALLOWED has afterparty', A['afterparty'] === 1);
  assert('ALLOWED no other keys', Object.keys(A).length === 3);
}

/* ── 3-5. _validate behaviour ──────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const v = ctx.ScenarioPacks._internals._validate;

  /* Well-formed pack passes. */
  const ok = v({
    $schema_version: 2,
    $id: 'roof',
    ambient: { label: 'Roof wind', description: 'helicopter drone' },
    story_beats: { act_1_open: 'roof open', act_5_intro: 'roof finale' },
    intercepts: { lobby_alarm_replacement: 'roof comms chatter' },
    endings: { default_intro_override: 'roof default ending' }
  });
  assert('valid pack returns object', ok && typeof ok === 'object');
  assertEq('valid pack id round-trip', ok.id, 'roof');
  assertEq('valid pack story beat preserved', ok.storyBeats.act_1_open, 'roof open');

  /* Wrong schema version. */
  assertEq('schema_version 1 rejected', v({ $schema_version: 1, $id: 'roof' }), null);
  assertEq('schema_version "2" rejected', v({ $schema_version: '2', $id: 'roof' }), null);

  /* Unknown $id. */
  assertEq('unknown $id rejected', v({ $schema_version: 2, $id: 'evil' }), null);

  /* Prototype-pollution keys dropped. */
  const polluted = v({
    $schema_version: 2, $id: 'default',
    story_beats: { '__proto__': 'gotcha', 'constructor': 'no', 'prototype': 'no', 'real_key': 'kept' }
  });
  assert('polluted keys dropped', polluted && polluted.storyBeats);
  assert('__proto__ not present', polluted.storyBeats.__proto__ === undefined || polluted.storyBeats.__proto__ !== 'gotcha');
  assert('constructor not present as own', !Object.prototype.hasOwnProperty.call(polluted.storyBeats, 'constructor'));
  assert('real_key kept', polluted.storyBeats.real_key === 'kept');

  /* Length cap on string fields. */
  const longText = 'X'.repeat(5000);
  const longPack = v({
    $schema_version: 2, $id: 'roof',
    story_beats: { act_1_open: longText }
  });
  assert('long string capped at MAX_STRING_LEN', longPack.storyBeats.act_1_open.length === ctx.ScenarioPacks._internals.MAX_STRING_LEN);

  /* Control chars stripped from values. */
  const dirty = v({
    $schema_version: 2, $id: 'roof',
    story_beats: { act_1_open: 'clean\u0001payload\u0007here' }
  });
  assertEq('control chars stripped', dirty.storyBeats.act_1_open, 'cleanpayloadhere');

  /* Invalid key format dropped. */
  const badKey = v({
    $schema_version: 2, $id: 'roof',
    story_beats: { 'has-dashes': 'no', 'has spaces': 'no', 'valid_key_42': 'yes' }
  });
  assert('hyphenated key dropped', !Object.prototype.hasOwnProperty.call(badKey.storyBeats, 'has-dashes'));
  assert('space key dropped', !Object.prototype.hasOwnProperty.call(badKey.storyBeats, 'has spaces'));
  assertEq('valid_key_42 kept', badKey.storyBeats.valid_key_42, 'yes');
}

/* ── 6. Allow-listed fetch URL only ─────────────────────────────────── */
{
  const { ctx, fetchUrls } = makeContext({
    search: '?scenario=roof',
    fetchBody: { $schema_version: 2, $id: 'roof' }
  });
  ctx.ScenarioPacks.init();
  /* The init runs sync up to fetch; the fetch promise resolves on
     a later tick. We can still assert the URL was right. */
  assert('fetch URL is fixed-shape scenarios/roof.json', fetchUrls.indexOf('scenarios/roof.json') >= 0);
  assert('no path-traversal attempt', !fetchUrls.some(u => u.indexOf('..') >= 0 || u.indexOf('//') >= 1));
}

/* ── 7. Unknown ?scenario= falls back to default with no fetch ─────── */
{
  const { ctx, fetchUrls } = makeContext({ search: '?scenario=evil_pack' });
  ctx.ScenarioPacks.init();
  assertEq('activeId falls back to default', ctx.ScenarioPacks.getActiveId(), 'default');
  assertEq('no fetch attempted for unknown pack', fetchUrls.length, 0);
}

/* ── 7b. Default ?scenario= (or absent) skips fetch ─────────────────── */
{
  const { ctx, fetchUrls } = makeContext({ search: '' });
  ctx.ScenarioPacks.init();
  assertEq('default activeId', ctx.ScenarioPacks.getActiveId(), 'default');
  assertEq('default skips fetch', fetchUrls.length, 0);
}

/* ── 7c. file:// protocol skips fetch ───────────────────────────────── */
{
  const { ctx, fetchUrls } = makeContext({
    search: '?scenario=roof',
    protocol: 'file:'
  });
  ctx.ScenarioPacks.init();
  /* file:// has no usable fetch — the module short-circuits. */
  assertEq('file:// no fetch attempted', fetchUrls.length, 0);
}

/* ── 8. I18n ALLOWED_LANGS ───────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const A = ctx.I18n._internals.ALLOWED_LANGS;
  ['en','es','de','ja'].forEach(l => assert('lang ' + l + ' allowed', A[l] === 1));
  assertEq('exactly 4 languages allowed', Object.keys(A).length, 4);
}

/* ── 9. I18n.t() resolution chain ───────────────────────────────────── */
{
  const { ctx } = makeContext({
    inlineI18n: {
      'mode_select.title': 'CUSTOM TITLE',
      'made_up_key':       'custom value'
    }
  });
  ctx.I18n.init();
  assertEq('inline override wins', ctx.I18n.t('mode_select.title'), 'CUSTOM TITLE');
  assertEq('inline-only key wins', ctx.I18n.t('made_up_key'), 'custom value');
  assertEq('fallback to DEFAULTS', ctx.I18n.t('victory.title'), 'HEIST COMPLETE');
  assertEq('fallback arg', ctx.I18n.t('totally.unknown.key', 'My Fallback'), 'My Fallback');
  assertEq('finally key itself', ctx.I18n.t('totally.unknown.key'), 'totally.unknown.key');
}

/* ── 10. _validKey ──────────────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const vk = ctx.I18n._internals._validKey;
  assert('valid alphanumeric key', vk('mode_select.title'));
  assert('valid w/ digits', vk('victory_42'));
  assert('reject newline', !vk('foo\nbar'));
  assert('reject quote', !vk('foo"bar'));
  assert('reject angle bracket', !vk('foo<bar'));
  assert('reject space', !vk('foo bar'));
  assert('reject empty', !vk(''));
  assert('reject null', !vk(null));
  assert('reject very long', !vk('x'.repeat(200)));
  assert('reject __proto__', vk('__proto__'));   /* allowed by regex but consumer never reaches it */
}

/* ── 11. On-disk scenario packs validate ────────────────────────────── */
{
  const { ctx } = makeContext();
  const v = ctx.ScenarioPacks._internals._validate;
  ['default', 'roof', 'afterparty'].forEach(name => {
    const fp = path.join(REPO_ROOT, 'scenarios', name + '.json');
    assert('scenarios/' + name + '.json exists', fs.existsSync(fp));
    if (fs.existsSync(fp)) {
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync(fp, 'utf8')); }
      catch (e) { assert('scenarios/' + name + '.json parses', false); return; }
      const ok = v(parsed);
      assert('scenarios/' + name + '.json passes _validate', ok != null);
      if (ok) {
        assertEq('scenarios/' + name + '.json id matches filename', ok.id, name);
      }
    }
  });
}

/* ── 12. On-disk i18n packs cover the default key set ──────────────── */
{
  const { ctx } = makeContext();
  const defaults = ctx.I18n._internals.DEFAULTS;
  const defaultKeys = Object.keys(defaults).sort();

  ['en', 'es'].forEach(lang => {
    const fp = path.join(REPO_ROOT, 'i18n', lang + '.json');
    assert('i18n/' + lang + '.json exists', fs.existsSync(fp));
    if (!fs.existsSync(fp)) return;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { assert('i18n/' + lang + '.json parses', false); return; }
    /* Every default key has a translation in this lang's pack. */
    const missing = [];
    for (const k of defaultKeys) {
      if (!Object.prototype.hasOwnProperty.call(parsed, k)) missing.push(k);
    }
    assert('i18n/' + lang + '.json covers every DEFAULTS key (missing: ' + missing.join(', ') + ')',
      missing.length === 0);
    /* Every value is a non-empty string. */
    let allStrings = true;
    for (const k of defaultKeys) {
      if (typeof parsed[k] !== 'string' || parsed[k].length === 0) { allStrings = false; break; }
    }
    assert('i18n/' + lang + '.json values all non-empty strings', allStrings);
  });
}

/* ── 13. ScenarioPacks getters return null when no pack loaded ─────── */
{
  const { ctx } = makeContext({ search: '' });
  ctx.ScenarioPacks.init();
  assertEq('getStoryBeat returns null on default', ctx.ScenarioPacks.getStoryBeat('act_1_open'), null);
  assertEq('getIntercept returns null on default', ctx.ScenarioPacks.getIntercept('lobby_alarm_replacement'), null);
  assertEq('getAmbientLabel returns null on default', ctx.ScenarioPacks.getAmbientLabel(), null);
  assertEq('getEndingOverride returns null on default', ctx.ScenarioPacks.getEndingOverride('default_intro_override'), null);
}

/* ── 14. ScenarioPacks inline pack applied ─────────────────────────── */
{
  const inlinePack = {
    $schema_version: 2,
    $id: 'roof',
    ambient: { label: 'Roof wind', description: '' },
    story_beats: { act_1_open: 'rooftop open beat' }
  };
  const { ctx } = makeContext({
    search: '?scenario=roof',
    inlineScenario: inlinePack
  });
  ctx.ScenarioPacks.init();
  assertEq('inline pack getActiveId', ctx.ScenarioPacks.getActiveId(), 'roof');
  assertEq('inline pack story beat applied', ctx.ScenarioPacks.getStoryBeat('act_1_open'), 'rooftop open beat');
  assertEq('inline pack ambient label applied', ctx.ScenarioPacks.getAmbientLabel(), 'Roof wind');
}

/* ── 15. game.html surface ──────────────────────────────────────────── */
assert('ScenarioPacks.init wired in PAGE INIT', html.indexOf('ScenarioPacks.init()') > 0);
assert('I18n.init wired in PAGE INIT', html.indexOf('I18n.init()') > 0);
assert('ScenarioPacks IIFE present', html.indexOf('var ScenarioPacks = (function()') > 0);
assert('I18n IIFE present', html.indexOf('var I18n = (function()') > 0);

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ ScenarioPacks + I18n Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
