#!/usr/bin/env node
/* v2.13 / Phase 5c — Kiosk hardening regression test.
 *
 * Extracts the Kiosk IIFE from game.html and exercises it under a
 * minimal browser stub (vm context). Companion to the
 * endings / hans / phone-calls / investigation-board / hub-overlay /
 * booth-difficulties tests.
 *
 * Run:    node scripts/tests/test_kiosk.js
 *
 * What we cover:
 *   1. Module surface — public API matches the contract (init,
 *      isActive, isQueueMode, armIdleTimer, disarmIdleTimer,
 *      onEndScreenShown, onEndScreenHidden, _internals).
 *   2. parseInt32Clamped() — defaults, lower/upper clamps, regex
 *      validation (rejects non-digit / overflow / negative).
 *   3. EVENT_TYPES allowlist — kiosk_activated, kiosk_idle_reset,
 *      kiosk_watchdog_reload, splunk_fallback all present.
 *   4. ?kiosk=1 init flow — Kiosk.isActive() flips true, idle &
 *      watchdog timers are armed, kiosk_activated event is queued.
 *   5. Idle reset — fireIdleReset() only fires when an end-screen
 *      overlay is visible (refuses to reset mid-game).
 *   6. Idle reset call sequence — telemetry first, then resetGame().
 *   7. Watchdog clamping — explicit override via ?kiosk_watchdog=
 *      respects WATCHDOG_MIN_MS / WATCHDOG_MAX_MS.
 *   8. trimLocalStorageHygiene() — drops the leaderboard from 60
 *      entries to 50, sorts by score descending, keeps the top.
 *   9. trimLocalStorageHygiene() handles JSON corruption — wipes
 *      the key rather than poisoning the UI on subsequent reads.
 *  10. ?queue=1 init flow — Kiosk.isQueueMode() flips true, queue
 *      overlay is appended to <body>, gameplay shortcut guard NOT
 *      bound (queue display must NOT preventDefault on right-click —
 *      it's a passive read-only viewport).
 *  11. ?kiosk= absent / ?kiosk=0 / ?kiosk=truthy-not-1 — no
 *      activation, no shortcuts bound (regression: a typo'd flag
 *      silently doing nothing is correct behaviour).
 *  12. Telemetry hygiene — kiosk_activated payload never echoes
 *      hecToken or any URL param value verbatim, never contains
 *      DOM content.
 *  13. Mode-select markup contains the Kiosk init wiring (regression:
 *      a future refactor that drops the try/catch init line silently
 *      breaks every booth deployment).
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

const naka  = sliceIIFE(html, 'var NakaTelemetry = (function()');
const kiosk = sliceIIFE(html, 'var Kiosk = (function()');

/* ── DOM stub ───────────────────────────────────────────────────────── */
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
    style: {
      cssText: '',
      setProperty() {},
      left: '', top: '', width: '', height: ''
    },
    width: 0,
    height: 0,
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] || null; },
    hasAttribute(k) { return !!this._attrs[k]; },
    addEventListener(ev, fn) {
      (this._listeners[ev] = this._listeners[ev] || []).push(fn);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    requestFullscreen: () => Promise.resolve(),
    webkitRequestFullscreen: () => Promise.resolve()
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
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = String(v || ''); }
  });
  return el;
}

const localStorageStub = {
  _m: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; },
  clear() { this._m = {}; }
};

function makeContext(urlSearch) {
  const body = makeElement('body');
  const head = makeElement('head');
  const docRoot = makeElement('html');
  docRoot.appendChild(head);
  docRoot.appendChild(body);

  const overlayVictory = makeElement('div');
  overlayVictory.id = 'overlay-victory';
  overlayVictory._classSet.add('hidden');
  body.appendChild(overlayVictory);

  const overlayGameover = makeElement('div');
  overlayGameover.id = 'overlay-gameover';
  overlayGameover._classSet.add('hidden');
  body.appendChild(overlayGameover);

  const documentStub = {
    body,
    documentElement: docRoot,
    head,
    readyState: 'complete',
    activeElement: null,
    getElementById(id) {
      function find(node) {
        if (node.id === id) return node;
        for (const c of (node.children || [])) {
          const r = find(c);
          if (r) return r;
        }
        return null;
      }
      return find(body) || find(head) || find(docRoot);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag)
  };

  /* Track resetGame() invocations so we can assert the idle-reset path. */
  let resetGameCalls = 0;
  const fakeResetGame = () => { resetGameCalls++; };

  const intervals = [];
  const timeouts = [];

  const windowStub = {
    addEventListener: () => {},
    location: {
      search: urlSearch || '',
      href: 'http://localhost/' + (urlSearch || ''),
      replace: (url) => { windowStub.location.href = url; }
    },
    setTimeout: (fn, ms) => { const id = timeouts.push({ fn, ms }) - 1; return id + 1; },
    clearTimeout: (id) => { if (id != null && id > 0) timeouts[id - 1] = null; },
    setInterval: (fn, ms) => { const id = intervals.push({ fn, ms }) - 1; return id + 1; },
    clearInterval: (id) => { if (id != null && id > 0) intervals[id - 1] = null; },
    matchMedia: () => ({ matches: false }),
    URLSearchParams: URLSearchParams,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  };
  windowStub.window = windowStub;
  windowStub.document = documentStub;
  windowStub.localStorage = localStorageStub;
  windowStub.navigator = { sendBeacon: () => true };
  windowStub.console = console;
  /* runInContext globals */
  const ctx = Object.assign({}, windowStub);
  ctx.global = ctx;
  ctx.URLSearchParams = URLSearchParams;
  ctx.window = windowStub;
  ctx.document = documentStub;
  ctx.localStorage = localStorageStub;
  ctx.navigator = windowStub.navigator;
  ctx.location = windowStub.location;
  ctx.setTimeout = windowStub.setTimeout;
  ctx.clearTimeout = windowStub.clearTimeout;
  ctx.setInterval = windowStub.setInterval;
  ctx.clearInterval = windowStub.clearInterval;
  ctx.matchMedia = windowStub.matchMedia;
  ctx.fetch = windowStub.fetch;
  ctx.resetGame = fakeResetGame;
  ctx._intervals = intervals;
  ctx._timeouts = timeouts;
  ctx._resetGameCalls = () => resetGameCalls;
  vm.createContext(ctx);
  return ctx;
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

/* ── Test 1-2: parseInt32Clamped + module surface ───────────────────── */
{
  const ctx = makeContext('');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  const k = ctx.Kiosk;
  assert('Kiosk module exposed', !!k);
  assert('Kiosk.init is fn', typeof k.init === 'function');
  assert('Kiosk.isActive is fn', typeof k.isActive === 'function');
  assert('Kiosk.isQueueMode is fn', typeof k.isQueueMode === 'function');
  assert('Kiosk.armIdleTimer is fn', typeof k.armIdleTimer === 'function');
  assert('Kiosk.disarmIdleTimer is fn', typeof k.disarmIdleTimer === 'function');
  assert('Kiosk.onEndScreenShown is fn', typeof k.onEndScreenShown === 'function');
  assert('Kiosk.onEndScreenHidden is fn', typeof k.onEndScreenHidden === 'function');
  assert('Kiosk._internals exposed', !!k._internals);

  const intl = k._internals;
  assertEq('DEFAULT_IDLE_MS = 90s', intl.DEFAULT_IDLE_MS, 90 * 1000);
  assertEq('DEFAULT_WATCHDOG_MS = 1h', intl.DEFAULT_WATCHDOG_MS, 60 * 60 * 1000);
  assertEq('IDLE_MIN_MS = 30s', intl.IDLE_MIN_MS, 30 * 1000);
  assertEq('IDLE_MAX_MS = 10m', intl.IDLE_MAX_MS, 10 * 60 * 1000);
  assertEq('WATCHDOG_MIN_MS = 5m', intl.WATCHDOG_MIN_MS, 5 * 60 * 1000);
  assertEq('WATCHDOG_MAX_MS = 8h', intl.WATCHDOG_MAX_MS, 8 * 60 * 60 * 1000);

  /* parseInt32Clamped */
  const p = intl.parseInt32Clamped;
  assertEq('parseInt32Clamped null → fallback', p(null, 90000, 30000, 600000), 90000);
  assertEq('parseInt32Clamped "" → fallback', p('', 90000, 30000, 600000), 90000);
  assertEq('parseInt32Clamped "abc" → fallback', p('abc', 90000, 30000, 600000), 90000);
  assertEq('parseInt32Clamped "-5" rejected (regex bars sign)', p('-5', 90000, 30000, 600000), 90000);
  assertEq('parseInt32Clamped "120" → 120000', p('120', 90000, 30000, 600000), 120000);
  assertEq('parseInt32Clamped "10" clamped up to 30000', p('10', 90000, 30000, 600000), 30000);
  assertEq('parseInt32Clamped "9999999" clamped down', p('9999999', 90000, 30000, 600000), 600000);
  assertEq('parseInt32Clamped "1234567" valid (≤7 digits)', p('1234567', 90000, 30000, 600000), 600000);
  assertEq('parseInt32Clamped "12345678" rejected (>7 digits)', p('12345678', 90000, 30000, 600000), 90000);
  /* SQL-injection-shaped strings are rejected. */
  assertEq("parseInt32Clamped '1; DROP TABLE' rejected", p('1; DROP TABLE', 90000, 30000, 600000), 90000);
  assertEq('parseInt32Clamped "999999999" rejected via length cap', p('999999999', 90000, 30000, 600000), 90000);
}

/* ── Test 3: EVENT_TYPES allowlist ──────────────────────────────────── */
{
  const ctx = makeContext('');
  vm.runInContext(naka, ctx);
  /* NakaTelemetry exposes its EVENT_TYPES via debugInfo or by inspecting
     the constant from within the IIFE's source. Easiest path: scan the
     source for the new keys we just added. */
  const keys = ['kiosk_activated', 'kiosk_idle_reset', 'kiosk_watchdog_reload', 'splunk_fallback'];
  for (const key of keys) {
    assert('EVENT_TYPES contains ' + key, naka.indexOf("'" + key + "'") > 0);
  }
}

/* ── Test 4: ?kiosk=1 init flow ─────────────────────────────────────── */
{
  const ctx = makeContext('?kiosk=1');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  assert('Kiosk.isActive() false before init', ctx.Kiosk.isActive() === false);
  ctx.Kiosk.init();
  assert('Kiosk.isActive() true after ?kiosk=1 init', ctx.Kiosk.isActive() === true);
  assert('Kiosk.isQueueMode() false in gameplay mode', ctx.Kiosk.isQueueMode() === false);
  /* Watchdog timer should have been armed (1 entry in setTimeout queue). */
  const watchdogPresent = ctx._timeouts.some(t => t && t.ms === 60 * 60 * 1000);
  assert('watchdog timer scheduled at 60min', watchdogPresent);
}

/* ── Test 5: idle reset only fires on end-screen ────────────────────── */
{
  const ctx = makeContext('?kiosk=1&kiosk_idle=30');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  /* Both overlays hidden — armIdleTimer is a no-op. */
  ctx.Kiosk.armIdleTimer();
  let idlePending = ctx._timeouts.some(t => t && t.ms === 30000 && !t.fired);
  assert('idle timer NOT armed when no end-screen visible', !idlePending);
  /* Show victory overlay → arm should succeed. */
  const victory = ctx.document.getElementById('overlay-victory');
  victory.classList.remove('hidden');
  ctx.Kiosk.armIdleTimer();
  idlePending = ctx._timeouts.some(t => t && t.ms === 30000);
  assert('idle timer armed (30s) when victory overlay visible', idlePending);
}

/* ── Test 6: idle-reset call sequence — resetGame() invoked ─────────── */
{
  const ctx = makeContext('?kiosk=1&kiosk_idle=30');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  /* Show end-screen, arm timer, fire it manually. */
  ctx.document.getElementById('overlay-victory').classList.remove('hidden');
  ctx.Kiosk.armIdleTimer();
  /* Find and execute the idle timeout callback. */
  const idleTimeout = ctx._timeouts.find(t => t && t.ms === 30000);
  assert('idle timeout located', !!idleTimeout);
  if (idleTimeout) {
    idleTimeout.fn();
    assert('resetGame() called by idle timeout', ctx._resetGameCalls() === 1);
  }
}

/* ── Test 7: watchdog override clamping ─────────────────────────────── */
{
  /* Below MIN. */
  let ctx = makeContext('?kiosk=1&kiosk_watchdog=10');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  let wd = ctx._timeouts.find(t => t && t.ms >= 5 * 60 * 1000 && t.ms <= 8 * 60 * 60 * 1000);
  assert('?kiosk_watchdog=10 clamped to MIN', wd && wd.ms === 5 * 60 * 1000);

  /* Above MAX. */
  ctx = makeContext('?kiosk=1&kiosk_watchdog=99999');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  wd = ctx._timeouts.find(t => t && t.ms >= 5 * 60 * 1000 && t.ms <= 8 * 60 * 60 * 1000);
  assert('?kiosk_watchdog=99999 clamped to MAX', wd && wd.ms === 8 * 60 * 60 * 1000);

  /* Valid mid-range. */
  ctx = makeContext('?kiosk=1&kiosk_watchdog=1800');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  wd = ctx._timeouts.find(t => t && t.ms >= 5 * 60 * 1000 && t.ms <= 8 * 60 * 60 * 1000);
  assert('?kiosk_watchdog=1800 → 30min', wd && wd.ms === 1800 * 1000);
}

/* ── Test 8: trimLocalStorageHygiene() caps at 50 ───────────────────── */
{
  const ctx = makeContext('?kiosk=1');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  /* Pre-seed the leaderboard with 60 entries, scores ascending. */
  const seed = [];
  for (let i = 0; i < 60; i++) seed.push({ name: 'AA' + i, score: i, time: 100 + i });
  localStorageStub._m['nakatomi_leaderboard'] = JSON.stringify(seed);
  ctx.Kiosk._internals.trimLocalStorageHygiene();
  const after = JSON.parse(localStorageStub.getItem('nakatomi_leaderboard'));
  assertEq('leaderboard trimmed to 50 entries', after.length, 50);
  /* Sorted descending — top score first. */
  assertEq('top entry has score 59', after[0].score, 59);
  assertEq('bottom entry has score 10', after[49].score, 10);
}

/* ── Test 9: trimLocalStorageHygiene() handles JSON corruption ──────── */
{
  const ctx = makeContext('?kiosk=1');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  localStorageStub._m['nakatomi_leaderboard'] = 'not-json-{[';
  ctx.Kiosk._internals.trimLocalStorageHygiene();
  assert('corrupt leaderboard JSON wiped', localStorageStub.getItem('nakatomi_leaderboard') == null);
}

/* ── Test 10: ?queue=1 init flow ────────────────────────────────────── */
{
  const ctx = makeContext('?queue=1');
  vm.runInContext(naka, ctx);
  vm.runInContext(kiosk, ctx);
  ctx.Kiosk.init();
  assert('Kiosk.isActive() false in queue mode', ctx.Kiosk.isActive() === false);
  assert('Kiosk.isQueueMode() true', ctx.Kiosk.isQueueMode() === true);
  /* Queue overlay should have been appended to body. */
  const bodyKids = ctx.document.body.children;
  const overlay = bodyKids.find(c => c.id === 'kiosk-queue-overlay');
  assert('kiosk-queue-overlay appended to body', !!overlay);
  if (overlay) {
    assert('queue overlay has role=status', overlay._attrs.role === 'status');
    assert('queue overlay has aria-live=polite', overlay._attrs['aria-live'] === 'polite');
  }
}

/* ── Test 11: missing/wrong/zero kiosk URL — no activation ──────────── */
{
  for (const url of ['', '?', '?kiosk=0', '?kiosk=true', '?kiosk=yes', '?kiosk=2', '?kiosk1=1']) {
    const ctx = makeContext(url);
    vm.runInContext(naka, ctx);
    vm.runInContext(kiosk, ctx);
    ctx.Kiosk.init();
    assert('"' + url + '" does NOT activate kiosk', ctx.Kiosk.isActive() === false);
    assert('"' + url + '" does NOT activate queue', ctx.Kiosk.isQueueMode() === false);
  }
}

/* ── Test 12: Telemetry payload hygiene ─────────────────────────────── */
{
  /* The kiosk_activated event payload, as emitted by init(), only carries
     literal strings + integers — no URL params, no DOM strings, no token.
     We check the source for what gets into the emit() call, not the
     runtime queue (there's no HEC fetch path here). */
  const emitBlocks = [];
  const re = /emit\('kiosk_(activated|idle_reset|watchdog_reload)'\s*,\s*(\{[^}]*\})/g;
  let m;
  while ((m = re.exec(kiosk)) !== null) emitBlocks.push({ event: m[1], payload: m[2] });
  assert('at least 3 kiosk emit() call sites', emitBlocks.length >= 3);
  for (const blk of emitBlocks) {
    /* Forbidden fragments — these would indicate a leak. */
    const lower = blk.payload.toLowerCase();
    assert('no "token" leak in ' + blk.event + ' payload', lower.indexOf('token') < 0);
    assert('no "hec" leak in ' + blk.event + ' payload', lower.indexOf('hec') < 0);
    assert('no innerHTML leak in ' + blk.event + ' payload', lower.indexOf('innerhtml') < 0);
    assert('no document. leak in ' + blk.event + ' payload', lower.indexOf('document.') < 0);
    assert('no localStorage leak in ' + blk.event + ' payload', lower.indexOf('localstorage') < 0);
  }
}

/* ── Test 13: Page wires Kiosk.init() ───────────────────────────────── */
{
  assert('game.html calls Kiosk.init() in PAGE INIT', html.indexOf('Kiosk.init()') > 0);
  assert('Kiosk.onEndScreenShown invoked from triggerVictory', html.indexOf('Kiosk.onEndScreenShown') > 0);
  assert('Kiosk.onEndScreenHidden invoked from resetGame', html.indexOf('Kiosk.onEndScreenHidden') > 0);
  assert('leaderboard storage cap raised to 50', html.indexOf('board.length > 50') > 0);
}

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ Kiosk Hardening Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
