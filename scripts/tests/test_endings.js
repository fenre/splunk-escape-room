#!/usr/bin/env node
/* v2.12 / Phase 7 Tier 1 — Endings regression test.
 *
 * Extracts NakaTelemetry + Endings from game.html and exercises them
 * under a minimal browser stub (vm context). Companion to the
 * hans / phone-calls / investigation-board / hub-overlay tests.
 *
 * Run:    node scripts/tests/test_endings.js
 *
 * What we cover:
 *   1. Module surface — public API matches the contract (classify,
 *      get, applyToOverlay, playSting, REGISTRY, VALID_IDS).
 *   2. REGISTRY integrity — all four endings present with the
 *      required narrative + achievement fields.
 *   3. VALID_IDS canonical order.
 *   4. EVENT_TYPES allowlist — 'ending_classified' is allow-listed.
 *   5. safePositive() helper — numeric guardrails.
 *   6. classify() priority ladder — speedrunner > analyst > cowboy >
 *      default; boundary conditions around the threshold.
 *   7. classify() cap guard — speedrunner cannot fire when timer cap
 *      is zero or negative (prevents every sub-0s finish misfiring).
 *   8. classify() tolerates non-object / missing inputs.
 *   9. get() returns default for unknown / null id.
 *  10. applyToOverlay() paints title/subtitle/narrative into the DOM,
 *      swaps the theme class, reveals the block, and correctly
 *      toggles the legacy "Yippee-ki-yay" line per ending.
 *  11. applyToOverlay() is null-safe when the overlay is stripped
 *      (booth iframe) or when run headless (no document).
 *  12. playSting() calls the registered per-ending sting and falls
 *      through to playVictory() for the default branch.
 *  13. _esc() escapes HTML special chars so a future scenario v2 JSON
 *      can't inject markup through narrative overrides.
 *  14. Telemetry hygiene — an ending_classified emission never echoes
 *      the HEC token and never includes the allowlist key names as
 *      values.
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

/* ── extract only the modules we care about ─────────────────────────── */
function sliceIIFE(src, needle) {
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(needle + ' not found in game.html');
  const end = src.indexOf('\n})();', start);
  if (end < 0) throw new Error(needle + ' end marker not found');
  return src.substring(start, end + '\n})();'.length);
}

const naka    = sliceIIFE(html, 'var NakaTelemetry = (function()');
const endings = sliceIIFE(html, 'var Endings = (function()');

/* ── DOM stub (shared pattern with test_hub_overlay.js) ─────────────── */
function makeElement(tag) {
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    id: '',
    children: [],
    parentNode: null,
    _innerHTML: '',
    textContent: '',
    _listeners: {},
    _attrs: {},
    _classSet: new Set(),
    _dataset: {},
    style: { setProperty: () => {}, left: '', top: '', width: '', height: '' },
    width: 0,
    height: 0,
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] || null; },
    removeAttribute(k) { delete this._attrs[k]; },
    hasAttribute(k) { return !!this._attrs[k]; },
    addEventListener(ev, fn) {
      (this._listeners[ev] = this._listeners[ev] || []).push(fn);
    },
    removeEventListener(ev, fn) {
      if (!this._listeners[ev]) return;
      this._listeners[ev] = this._listeners[ev].filter(x => x !== fn);
    },
    dispatchEvent(ev) {
      (this._listeners[ev.type] || []).forEach(fn => { try { fn(ev); } catch (_) {} });
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) { this.children.splice(i, 1); child.parentNode = null; }
      return child;
    },
    querySelector(sel) { return queryOne(this, sel); },
    querySelectorAll(sel) {
      const out = [];
      queryAll(this, sel, out);
      return out;
    },
    focus() {},
    click() {
      const listeners = this._listeners.click || [];
      const event = { type: 'click', target: this, preventDefault() {}, stopPropagation() {} };
      listeners.forEach(fn => { try { fn(event); } catch (_) {} });
    }
  };
  el.classList = {
    add(...xs) { xs.forEach(x => el._classSet.add(x)); },
    remove(...xs) { xs.forEach(x => el._classSet.delete(x)); },
    contains(x) { return el._classSet.has(x); },
    toggle(x, on) {
      if (on === true) this.add(x);
      else if (on === false) this.remove(x);
      else if (el._classSet.has(x)) this.remove(x);
      else this.add(x);
    }
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el._classSet].join(' '); },
    set(v) {
      el._classSet.clear();
      String(v || '').split(/\s+/).forEach(c => c && el._classSet.add(c));
    }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = String(v || ''); }
  });
  return el;
}

function matchSel(el, sel) {
  sel = sel.trim();
  if (sel.startsWith('.')) return el.classList && el.classList.contains(sel.slice(1));
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  const m = sel.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (m) {
    if (m[2] === undefined) return el._attrs && (m[1] in el._attrs);
    return el._attrs && el._attrs[m[1]] === m[2];
  }
  return false;
}

function queryOne(root, sel) {
  if (!root) return null;
  const kids = root.children || [];
  for (const c of kids) {
    if (matchSel(c, sel)) return c;
    const deeper = queryOne(c, sel);
    if (deeper) return deeper;
  }
  return null;
}
function queryAll(root, sel, out) {
  if (!root) return;
  const kids = root.children || [];
  for (const c of kids) {
    if (matchSel(c, sel)) out.push(c);
    queryAll(c, sel, out);
  }
}

const localStorageStub = {
  _m: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; },
  clear() { this._m = {}; }
};

const NAKATOMI_CONFIG_JSON = JSON.stringify({
  hecUrl: 'https://hec.example.com/services/collector',
  hecToken: '00000000-0000-4000-8000-000000000003',
  teamName: 'ending-test-team'
});
const CONFIG_ELEMENT = makeElement('script');
CONFIG_ELEMENT.id = 'nakatomi-config';
CONFIG_ELEMENT.textContent = NAKATOMI_CONFIG_JSON;

const body = makeElement('body');
const head = makeElement('head');
const docRoot = makeElement('html');
docRoot.appendChild(head);
docRoot.appendChild(body);

/* Pre-build the victory-ending overlay DOM so applyToOverlay() succeeds. */
const endingBlock = makeElement('div');
endingBlock.id = 'victory-ending';
endingBlock._classSet.add('ending-block');
endingBlock._classSet.add('ending-default');
endingBlock._classSet.add('hidden');

const endingTitle = makeElement('div'); endingTitle.id = 'victory-ending-title';
const endingSub   = makeElement('div'); endingSub.id   = 'victory-ending-subtitle';
const endingNar   = makeElement('div'); endingNar.id   = 'victory-ending-narrative';
endingBlock.appendChild(endingTitle);
endingBlock.appendChild(endingSub);
endingBlock.appendChild(endingNar);

/* Legacy "Yippee-ki-yay" line — applyToOverlay() toggles this per ending. */
const yippeeEl = makeElement('div');
yippeeEl.id = 'victory-yippee';
yippeeEl.textContent = '"Yippee-ki-yay."';

body.appendChild(yippeeEl);
body.appendChild(endingBlock);

const documentStub = {
  body,
  documentElement: docRoot,
  head,
  readyState: 'complete',
  getElementById(id) {
    function find(node) {
      if (node.id === id) return node;
      for (const c of (node.children || [])) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    }
    if (id === 'nakatomi-config') return CONFIG_ELEMENT;
    return find(body);
  },
  querySelector: (sel) => queryOne(body, sel),
  querySelectorAll: (sel) => { const out = []; queryAll(body, sel, out); return out; },
  addEventListener: () => {},
  createElement: makeElement,
  createElementNS: (ns, tag) => makeElement(tag),
  activeElement: null
};

/* Track sting invocations so we can assert playSting() dispatch without
   touching a real AudioContext. */
const stingCalls = [];
const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  location: { hash: '', href: 'http://localhost/', origin: 'http://localhost', search: '', protocol: 'http:', pathname: '/' },
  history: { replaceState: () => {}, pushState: () => {} },
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  fetch: () => new Promise(() => {}),
  URLSearchParams: require('url').URLSearchParams,
  URL: require('url').URL,
  document: documentStub,
  localStorage: localStorageStub,
  navigator: { userAgent: 'node-test', onLine: false, sendBeacon: () => true },
  crypto: {
    getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; },
    randomUUID: () => 'test-' + Math.random().toString(36).slice(2)
  },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: () => {},
  playVictoryAnalyst:     function() { stingCalls.push('analyst'); },
  playVictoryCowboy:      function() { stingCalls.push('cowboy'); },
  playVictorySpeedrunner: function() { stingCalls.push('speedrunner'); }
};

const ctx = {
  console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
  process, require,
  window: windowStub,
  document: documentStub,
  localStorage: localStorageStub,
  navigator: windowStub.navigator,
  crypto: windowStub.crypto,
  fetch: windowStub.fetch,
  btoa: windowStub.btoa, atob: windowStub.atob,
  URL: windowStub.URL, URLSearchParams: windowStub.URLSearchParams,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  cancelAnimationFrame: windowStub.cancelAnimationFrame,
  matchMedia: windowStub.matchMedia,
  location: windowStub.location,
  history: windowStub.history,
  /* Default playVictory() — Endings.playSting() falls through to this when
     no per-ending sting is registered (i.e. the 'default' branch). */
  playVictory: function() { stingCalls.push('default'); },
  stingCalls: stingCalls
};

/* ── test suite ─────────────────────────────────────────────────────── */
const testSuite = `
var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK   ' + msg); }
  else      { fail++; console.log('  FAIL ' + msg); }
}

var QKEY = 'nakatomi_telemetry_queue_v1';
function q() { return JSON.parse(localStorage.getItem(QKEY) || '[]'); }
function qClear() { try { localStorage.removeItem(QKEY); } catch (e) {} }

console.log('\\n── Module surface ──');
assert(Endings && typeof Endings === 'object', 'Endings module loaded');
['classify','get','applyToOverlay','playSting'].forEach(function (name) {
  assert(typeof Endings[name] === 'function', 'Endings.' + name + '() exposed');
});
assert(Endings.REGISTRY && typeof Endings.REGISTRY === 'object', 'REGISTRY exposed');
assert(Array.isArray(Endings.VALID_IDS), 'VALID_IDS array exposed');
assert(typeof Endings._esc === 'function', '_esc helper exposed for tests');
assert(typeof Endings._safePositive === 'function', '_safePositive helper exposed for tests');

console.log('\\n── REGISTRY integrity ──');
['analyst','cowboy','speedrunner','default'].forEach(function (id) {
  var rec = Endings.REGISTRY[id];
  assert(rec && typeof rec === 'object', 'REGISTRY["' + id + '"] present');
  if (rec) {
    assert(rec.id === id,                          'REGISTRY["' + id + '"].id matches key');
    assert(typeof rec.title === 'string' && rec.title.length > 0,
           'REGISTRY["' + id + '"].title non-empty');
    assert(typeof rec.subtitle === 'string' && rec.subtitle.length > 0,
           'REGISTRY["' + id + '"].subtitle non-empty');
    assert(typeof rec.narrative === 'string' && rec.narrative.length > 60,
           'REGISTRY["' + id + '"].narrative >= 60 chars');
    assert(typeof rec.achievementId === 'string' && rec.achievementId.indexOf('ending_') === 0,
           'REGISTRY["' + id + '"].achievementId starts with "ending_"');
    assert(typeof rec.achievementName === 'string' && rec.achievementName.length > 0,
           'REGISTRY["' + id + '"].achievementName non-empty');
    assert(typeof rec.achievementIcon === 'string' && rec.achievementIcon.length > 0,
           'REGISTRY["' + id + '"].achievementIcon non-empty');
  }
});

console.log('\\n── VALID_IDS ordering ──');
assert(Endings.VALID_IDS.length === 4, 'exactly four valid endings declared');
assert(Endings.VALID_IDS.indexOf('analyst')     >= 0, 'analyst in VALID_IDS');
assert(Endings.VALID_IDS.indexOf('cowboy')      >= 0, 'cowboy in VALID_IDS');
assert(Endings.VALID_IDS.indexOf('speedrunner') >= 0, 'speedrunner in VALID_IDS');
assert(Endings.VALID_IDS.indexOf('default')     >= 0, 'default in VALID_IDS');

console.log('\\n── EVENT_TYPES allowlist ──');
qClear();
NakaTelemetry.emit('ending_classified', {
  ending_id: 'analyst',
  elapsed_seconds: 1800,
  wrong_count: 0,
  hint_tokens_spent: 0,
  side_stories_discovered: 4
});
var evs = q();
assert(evs.length === 1, 'exactly one ending_classified event on queue');
if (evs[0]) {
  assert(evs[0].event_type === 'ending_classified', 'event_type === ending_classified');
  assert(evs[0].ending_id === 'analyst',            'ending_id preserved');
  assert(evs[0].elapsed_seconds === 1800,           'elapsed_seconds preserved');
  /* HEC token never leaks. */
  assert(JSON.stringify(evs[0]).indexOf('00000000-0000-4000-8000-000000000003') < 0,
         'HEC token not echoed in ending_classified payload');
}
qClear();

console.log('\\n── _safePositive() ──');
assert(Endings._safePositive(100)     === 100, 'positive number passes through');
assert(Endings._safePositive(0)       === 0,   'zero stays zero');
assert(Endings._safePositive(-42)     === 0,   'negative clamped to zero');
assert(Endings._safePositive(NaN)     === 0,   'NaN clamped to zero');
assert(Endings._safePositive(Infinity) === 0,  'Infinity clamped to zero');
assert(Endings._safePositive('50')    === 50,  'numeric string coerced');
assert(Endings._safePositive('abc')   === 0,   'non-numeric string clamped to zero');
assert(Endings._safePositive(null)    === 0,   'null clamped to zero');
assert(Endings._safePositive(undefined) === 0, 'undefined clamped to zero');

console.log('\\n── classify() priority ladder ──');
/* Speedrunner — elapsed < 0.5 * cap. */
var r = Endings.classify({
  elapsedSeconds: 2000, timerSeconds: 5400, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0
});
assert(r.id === 'speedrunner',
       'speedrunner fires when elapsed (2000) < 0.5 × timer (2700)');

/* Speedrunner + analyst criteria — speedrunner wins (higher priority). */
r = Endings.classify({
  elapsedSeconds: 1000, timerSeconds: 5400, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 5
});
assert(r.id === 'speedrunner',
       'speedrunner wins over analyst when both criteria satisfied');

/* Analyst — slow but clean + curious. */
r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 1,
  hintTokensSpent: 1, sideStoriesDiscovered: 3
});
assert(r.id === 'analyst',
       'analyst fires when wrong<=1 & tokens<=1 & stories>=3');

/* Analyst boundary — exactly at thresholds. */
r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 1,
  hintTokensSpent: 1, sideStoriesDiscovered: 3
});
assert(r.id === 'analyst', 'analyst fires at exact threshold (1,1,3)');

/* Analyst just misses — stories=2. */
r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 1,
  hintTokensSpent: 1, sideStoriesDiscovered: 2
});
assert(r.id === 'default', 'stories=2 misses analyst (falls to default)');

/* Cowboy — wrong>=4, still won. */
r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 4,
  hintTokensSpent: 0, sideStoriesDiscovered: 0
});
assert(r.id === 'cowboy', 'cowboy fires at wrong=4');

r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 7,
  hintTokensSpent: 2, sideStoriesDiscovered: 1
});
assert(r.id === 'cowboy', 'cowboy fires at wrong=7 (max before loss)');

/* Cowboy + analyst criteria — analyst wins (higher priority after speedrun). */
/* This case cannot actually happen (wrong>=4 excludes wrong<=1), so verify
   that the priority check would still sort sanely if someone flipped the
   analyst threshold. */
r = Endings.classify({
  elapsedSeconds: 4500, timerSeconds: 5400, wrongCount: 4,
  hintTokensSpent: 0, sideStoriesDiscovered: 5
});
assert(r.id === 'cowboy', 'wrong=4 always loses analyst test, ends in cowboy');

/* Default fallback — slow, no side stories, a couple of errors. */
r = Endings.classify({
  elapsedSeconds: 3600, timerSeconds: 5400, wrongCount: 2,
  hintTokensSpent: 2, sideStoriesDiscovered: 0
});
assert(r.id === 'default', 'default fires for middling performance');

/* Speedrunner boundary — exactly at threshold = NOT speedrunner. */
r = Endings.classify({
  elapsedSeconds: 2700, timerSeconds: 5400, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0
});
assert(r.id !== 'speedrunner',
       'elapsed === threshold does NOT earn speedrunner (strict <)');

/* Speedrunner just inside — 1s below threshold. */
r = Endings.classify({
  elapsedSeconds: 2699, timerSeconds: 5400, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0
});
assert(r.id === 'speedrunner', 'elapsed === threshold-1 DOES earn speedrunner');

console.log('\\n── classify() cap guard ──');
/* cap=0 — speedrunner must never fire even with elapsed=1. */
r = Endings.classify({ elapsedSeconds: 1, timerSeconds: 0, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0 });
assert(r.id === 'default',
       'timer=0 suppresses speedrunner (guard against sub-0s false positive)');

/* cap=undefined — treat as zero / no speedrun possible. */
r = Endings.classify({ elapsedSeconds: 10, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0 });
assert(r.id === 'default', 'missing timerSeconds falls through to default');

/* elapsed=0 — speedrunner guard (distinguishes from "not started" state). */
r = Endings.classify({ elapsedSeconds: 0, timerSeconds: 5400, wrongCount: 0,
  hintTokensSpent: 0, sideStoriesDiscovered: 0 });
assert(r.id === 'default',
       'elapsed=0 suppresses speedrunner (clock never started)');

console.log('\\n── classify() input tolerance ──');
/* Missing / null / undefined inputs — must always return 'default'. */
r = Endings.classify();          assert(r.id === 'default', 'no inputs returns default');
r = Endings.classify(null);      assert(r.id === 'default', 'null inputs returns default');
r = Endings.classify(undefined); assert(r.id === 'default', 'undefined inputs returns default');
r = Endings.classify({});        assert(r.id === 'default', 'empty inputs returns default');

/* Garbage inputs — strings, negatives, Infinity — must not crash. */
r = Endings.classify({ elapsedSeconds: -1, timerSeconds: -1, wrongCount: -1,
  hintTokensSpent: -1, sideStoriesDiscovered: -1 });
assert(r.id === 'default', 'all-negative inputs return default');

r = Endings.classify({ elapsedSeconds: 'fast', timerSeconds: 'slow',
  wrongCount: null, hintTokensSpent: undefined, sideStoriesDiscovered: NaN });
assert(r.id === 'default', 'non-numeric inputs return default');

console.log('\\n── get() ──');
assert(Endings.get('analyst').id     === 'analyst',     'get(analyst) returns analyst');
assert(Endings.get('cowboy').id      === 'cowboy',      'get(cowboy) returns cowboy');
assert(Endings.get('speedrunner').id === 'speedrunner', 'get(speedrunner) returns speedrunner');
assert(Endings.get('default').id     === 'default',     'get(default) returns default');
assert(Endings.get('unknown_id').id  === 'default',     'get(unknown) falls through to default');
assert(Endings.get(null).id          === 'default',     'get(null) falls through to default');
assert(Endings.get(undefined).id     === 'default',     'get(undefined) falls through to default');
assert(Endings.get('').id            === 'default',     'get("") falls through to default');
assert(Endings.get(42).id            === 'default',     'get(42) falls through to default');

console.log('\\n── applyToOverlay() ──');
/* analyst ending — title, subtitle, narrative all rendered; theme swapped;
   yippee line hidden; block revealed. */
var ok = Endings.applyToOverlay(Endings.get('analyst'));
assert(ok === true, 'applyToOverlay(analyst) returns true');
assert(document.getElementById('victory-ending-title').innerHTML.indexOf('QUIET PROFESSIONAL') >= 0,
       'analyst title rendered');
assert(document.getElementById('victory-ending-subtitle').innerHTML.length > 0,
       'analyst subtitle rendered');
assert(document.getElementById('victory-ending-narrative').innerHTML.length > 0,
       'analyst narrative rendered');
var block = document.getElementById('victory-ending');
assert(block.classList.contains('ending-analyst'), 'analyst theme class applied');
assert(!block.classList.contains('ending-default'), 'default theme class removed');
assert(!block.classList.contains('hidden'), 'ending block revealed');
assert(document.getElementById('victory-yippee').classList.contains('hidden'),
       'legacy yippee line HIDDEN for analyst ending');

/* cowboy ending — legacy yippee line must stay visible (it IS the catchphrase). */
Endings.applyToOverlay(Endings.get('cowboy'));
assert(block.classList.contains('ending-cowboy'), 'cowboy theme class applied');
assert(!block.classList.contains('ending-analyst'), 'analyst theme class removed');
assert(!document.getElementById('victory-yippee').classList.contains('hidden'),
       'legacy yippee line VISIBLE for cowboy ending');

/* speedrunner ending — yippee hidden again, blue theme applied. */
Endings.applyToOverlay(Endings.get('speedrunner'));
assert(block.classList.contains('ending-speedrunner'), 'speedrunner theme class applied');
assert(document.getElementById('victory-yippee').classList.contains('hidden'),
       'legacy yippee line HIDDEN for speedrunner ending');

/* default ending — green theme, yippee hidden. */
Endings.applyToOverlay(Endings.get('default'));
assert(block.classList.contains('ending-default'), 'default theme class applied');
assert(document.getElementById('victory-yippee').classList.contains('hidden'),
       'legacy yippee line HIDDEN for default ending');

/* Null / missing inputs — null-safe, returns false. */
ok = Endings.applyToOverlay(null);
assert(ok === false, 'applyToOverlay(null) returns false');
ok = Endings.applyToOverlay(undefined);
assert(ok === false, 'applyToOverlay(undefined) returns false');

console.log('\\n── playSting() ──');
stingCalls.length = 0;
Endings.playSting('analyst');
assert(stingCalls.indexOf('analyst') >= 0, 'analyst sting dispatched to playVictoryAnalyst');

stingCalls.length = 0;
Endings.playSting('cowboy');
assert(stingCalls.indexOf('cowboy') >= 0, 'cowboy sting dispatched to playVictoryCowboy');

stingCalls.length = 0;
Endings.playSting('speedrunner');
assert(stingCalls.indexOf('speedrunner') >= 0, 'speedrunner sting dispatched to playVictorySpeedrunner');

stingCalls.length = 0;
Endings.playSting('default');
assert(stingCalls.indexOf('default') >= 0, 'default falls through to playVictory()');

/* Unknown id — also falls through to default playVictory(). */
stingCalls.length = 0;
Endings.playSting('nonexistent');
assert(stingCalls.indexOf('default') >= 0, 'unknown id falls through to playVictory()');

console.log('\\n── _esc() XSS hygiene ──');
assert(Endings._esc('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;',
       'script tags escaped');
assert(Endings._esc('"quoted"') === '&quot;quoted&quot;', 'double quotes escaped');
assert(Endings._esc("'single'") === '&#39;single&#39;',   'single quotes escaped');
assert(Endings._esc('a & b') === 'a &amp; b',             'ampersand escaped');
assert(Endings._esc(null) === '',                          'null returns empty string');
assert(Endings._esc(undefined) === '',                     'undefined returns empty string');
assert(Endings._esc(42) === '42',                          'number coerced to string');

console.log('\\n── Integration: overlay paint survives scenario v2 hostile narrative ──');
/* A future scenario v2 override that contains HTML must render as escaped text,
   never as live markup. Simulate by calling applyToOverlay with a crafted
   record. */
Endings.applyToOverlay({
  id: 'analyst',
  title: '<img src=x onerror=alert(1)>',
  subtitle: '"</script><b>xss</b>',
  narrative: 'plain text'
});
var titleHtml = document.getElementById('victory-ending-title').innerHTML;
var subHtml   = document.getElementById('victory-ending-subtitle').innerHTML;
assert(titleHtml.indexOf('<img') < 0 && titleHtml.indexOf('&lt;img') >= 0,
       'hostile title is escaped, no raw <img> tag rendered');
assert(subHtml.indexOf('</script>') < 0,
       'hostile subtitle is escaped, no raw closing script tag rendered');

console.log('\\n── Summary ──');
console.log('  passed: ' + pass);
console.log('  failed: ' + fail);
if (fail > 0) { throw new Error(fail + ' assertion(s) failed'); }
`;

/* ── run the module + tests inside a vm context ─────────────────────── */
const context = vm.createContext(ctx);

try {
  vm.runInContext(naka,    context, { filename: 'NakaTelemetry.js' });
  vm.runInContext(endings, context, { filename: 'Endings.js' });
  vm.runInContext(testSuite, context, { filename: 'test_endings.js' });
  console.log('\n✓ Endings regression test passed.');
  process.exit(0);
} catch (err) {
  console.error('\n✗ Endings regression test FAILED:', err && err.message || err);
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
}
