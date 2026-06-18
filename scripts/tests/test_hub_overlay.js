#!/usr/bin/env node
/* v2.11 / Phase 8a — HubOverlay regression test.
 *
 * Extracts NakaTelemetry + HubOverlay from game.html and exercises
 * them under a minimal browser stub (vm context). Companion to the
 * investigation-board / hans / phone-calls tests.
 *
 * Run:    node scripts/tests/test_hub_overlay.js
 *
 * What we cover:
 *   1. Module surface — public API matches the contract (init, open,
 *      close, toggle, isOpen, station, refresh, setAvailability).
 *   2. EVENT_TYPES allowlist — the three new hub events (hub_opened /
 *      hub_closed / hub_station_clicked) are allow-listed.
 *   3. STATION_IDS registry — exactly seven canonical stations.
 *   4. Availability defaults — derived from state.actIdx / gameState.
 *   5. open()/close() happy path — visible class flips, telemetry
 *      fires with {trigger, elapsed_ms}, refresh() tolerates a missing
 *      InvestigationBoard.
 *   6. toggle() — flips open state; telemetry alternates opened/closed.
 *   7. station() unknown ID — silently ignored (no telemetry leak).
 *   8. station() locked — fires hub_station_clicked with
 *      availability="locked", does NOT navigate.
 *   9. station() open — fires hub_station_clicked with
 *      availability="open" and closes the hub.
 *  10. setAvailability() — scenario override wins over defaults.
 *  11. Telemetry sanitization — invalid station IDs are rejected, no
 *      arbitrary string ever reaches the telemetry payload.
 *  12. Idempotency — init() twice does not double-wire; open() twice
 *      does not double-fire telemetry.
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

const naka = sliceIIFE(html, 'var NakaTelemetry = (function()');
const hub  = sliceIIFE(html, 'var HubOverlay = (function()');

/* ── DOM stub (shared pattern with test_investigation_board.js) ─────── */
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
  hecToken: '00000000-0000-4000-8000-000000000002',
  teamName: 'hub-test-team'
});
const CONFIG_ELEMENT = makeElement('script');
CONFIG_ELEMENT.id = 'nakatomi-config';
CONFIG_ELEMENT.textContent = NAKATOMI_CONFIG_JSON;

const body = makeElement('body');
const head = makeElement('head');
const docRoot = makeElement('html');
docRoot.appendChild(head);
docRoot.appendChild(body);

/* Pre-build the hub overlay DOM so HubOverlay.init() succeeds. */
const overlayEl = makeElement('div');
overlayEl.id = 'overlay-hub';

/* seven station buttons, each with data-station attribute */
const stationIds = ['terminal', 'keypad', 'leads', 'briefing', 'blueprint', 'comms', 'board'];
for (const id of stationIds) {
  const btn = makeElement('button');
  btn._attrs['data-station'] = id;
  btn.id = 'hub-station-' + id;
  overlayEl.appendChild(btn);
}

/* status panel key-value slots */
[
  'hub-kv-act', 'hub-kv-task', 'hub-kv-progress', 'hub-kv-tokens', 'hub-kv-elapsed',
  'hub-kv-pins', 'hub-kv-stories', 'hub-kv-eggs', 'hub-kv-traps'
].forEach(id => {
  const d = makeElement('span');
  d.id = id;
  overlayEl.appendChild(d);
});

/* pause overlay shim — open() inspects it for pause-state handoff */
const pauseEl = makeElement('div');
pauseEl.id = 'overlay-pause';
pauseEl._classSet.add('hidden');
body.appendChild(pauseEl);
body.appendChild(overlayEl);

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
  cancelAnimationFrame: () => {}
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
  /* Minimal globals referenced by the module. */
  state: {
    paused: false, gameState: 'playing', actIdx: 0, taskIdx: 0,
    hintTokensRemaining: 3, startTime: Date.now() - 60000,
    totalPauseTime: 0, discoveredStories: {}, discoveredEggs: {}
  },
  ACTS: [
    { tasks: [{ id: 'a1.1' }, { id: 'a1.2' }] },
    { tasks: [{ id: 'a2.1' }] },
    { tasks: [{ id: 'a3.1' }] }
  ],
  HINT_TOKENS_INITIAL: 3,
  currentTask: () => ({ id: 'a1.1' }),
  /* These are called by station() handlers — stub as no-ops and track
     invocations for the "station navigates" assertions. */
  __navCalls: {},
  toggleDossier: function() { ctx.__navCalls.dossier = (ctx.__navCalls.dossier || 0) + 1; },
  toggleFacilitator: function() { ctx.__navCalls.facilitator = (ctx.__navCalls.facilitator || 0) + 1; },
  showActIntro: function() { ctx.__navCalls.actIntro = (ctx.__navCalls.actIntro || 0) + 1; },
  togglePause: function() {
    /* flip pause overlay class — matches the real game behaviour */
    if (pauseEl._classSet.has('hidden')) pauseEl._classSet.delete('hidden');
    else pauseEl._classSet.add('hidden');
    ctx.state.paused = !ctx.state.paused;
  },
  a11yAnnounce: () => {},
  toast: () => {}
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
assert(HubOverlay && typeof HubOverlay === 'object', 'HubOverlay module loaded');
['init','open','close','toggle','isOpen','station','refresh','setAvailability']
  .forEach(function (name) {
    assert(typeof HubOverlay[name] === 'function',
           'HubOverlay.' + name + '() exposed');
  });
assert(Array.isArray(HubOverlay._STATION_IDS),
       '_STATION_IDS array exposed for tests');
assert(typeof HubOverlay._evaluate === 'function',
       '_evaluate() exposed for tests');

console.log('\\n── STATION_IDS registry ──');
assert(HubOverlay._STATION_IDS.length === 7, 'exactly seven stations declared (got ' + HubOverlay._STATION_IDS.length + ')');
['terminal','keypad','leads','briefing','blueprint','comms','board'].forEach(function (id) {
  assert(HubOverlay._STATION_IDS.indexOf(id) >= 0, 'station "' + id + '" present in registry');
});

console.log('\\n── EVENT_TYPES allowlist ──');
qClear();
NakaTelemetry.emit('hub_opened',          { trigger: 'probe' });
NakaTelemetry.emit('hub_closed',          { trigger: 'probe', elapsed_ms: 1 });
NakaTelemetry.emit('hub_station_clicked', { station_id: 'board', availability: 'open' });
var ptypes = q().map(function (ev) { return ev.event_type; });
assert(ptypes.indexOf('hub_opened')          >= 0, 'hub_opened is allow-listed');
assert(ptypes.indexOf('hub_closed')          >= 0, 'hub_closed is allow-listed');
assert(ptypes.indexOf('hub_station_clicked') >= 0, 'hub_station_clicked is allow-listed');
qClear();

console.log('\\n── init() ──');
HubOverlay.init();
assert(HubOverlay.isOpen() === false, 'hub starts closed after init()');
HubOverlay.init();  /* idempotency — must not throw */
assert(HubOverlay.isOpen() === false, 'second init() no-op, still closed');

console.log('\\n── Availability defaults ──');
/* State has gameState=playing, actIdx=0. So terminal/keypad/leads/briefing
   should be open; blueprint/comms require Act 1 and should be locked. */
var av;
av = HubOverlay._evaluate('terminal');  assert(av.open === true,  'terminal open during playing');
av = HubOverlay._evaluate('keypad');    assert(av.open === true,  'keypad open during playing');
av = HubOverlay._evaluate('leads');     assert(av.open === true,  'leads open during playing');
av = HubOverlay._evaluate('briefing');  assert(av.open === true,  'briefing open during playing');
av = HubOverlay._evaluate('blueprint'); assert(av.open === false, 'blueprint locked at actIdx=0');
av = HubOverlay._evaluate('comms');     assert(av.open === false, 'comms locked at actIdx=0');
av = HubOverlay._evaluate('board');     assert(av.open === true,  'board always open');
/* Advance to Act 2 and retest the gated ones */
state.actIdx = 1;
av = HubOverlay._evaluate('blueprint'); assert(av.open === true,  'blueprint unlocks at actIdx=1');
av = HubOverlay._evaluate('comms');     assert(av.open === true,  'comms unlocks at actIdx=1');
/* Pre-start: everything except board is locked */
state.actIdx = 0;
state.gameState = 'mode-select';
av = HubOverlay._evaluate('terminal');  assert(av.open === false, 'terminal locked pre-game');
av = HubOverlay._evaluate('board');     assert(av.open === true,  'board still open pre-game');
state.gameState = 'playing';  /* restore for subsequent tests */

console.log('\\n── open() / close() happy path ──');
qClear();
HubOverlay.open('test');
assert(HubOverlay.isOpen() === true, 'isOpen() true after open()');
var openEvs = q().filter(function (ev) { return ev.event_type === 'hub_opened'; });
assert(openEvs.length === 1, 'exactly one hub_opened telemetry event');
if (openEvs[0]) {
  assert(openEvs[0].trigger === 'test', 'hub_opened.trigger === test');
  assert(typeof openEvs[0].act === 'number', 'hub_opened.act is numeric');
  /* HEC token never leaks. */
  assert(JSON.stringify(openEvs[0]).indexOf('00000000-0000-4000-8000-000000000002') < 0,
         'HEC token not echoed in hub_opened payload');
}
qClear();
HubOverlay.close('test');
assert(HubOverlay.isOpen() === false, 'isOpen() false after close()');
var closeEvs = q().filter(function (ev) { return ev.event_type === 'hub_closed'; });
assert(closeEvs.length === 1, 'exactly one hub_closed telemetry event');
if (closeEvs[0]) {
  assert(closeEvs[0].trigger === 'test', 'hub_closed.trigger === test');
  assert(typeof closeEvs[0].elapsed_ms === 'number', 'hub_closed.elapsed_ms numeric');
  assert(closeEvs[0].elapsed_ms >= 0, 'hub_closed.elapsed_ms non-negative');
}
qClear();

console.log('\\n── open() idempotency ──');
HubOverlay.open('once');
HubOverlay.open('twice');  /* already open — should be a refresh, NOT a second telemetry */
var openEvs2 = q().filter(function (ev) { return ev.event_type === 'hub_opened'; });
assert(openEvs2.length === 1, 'second open() while already open does not re-emit hub_opened');
HubOverlay.close('cleanup');
qClear();

console.log('\\n── toggle() ──');
assert(HubOverlay.isOpen() === false, 'hub closed pre-toggle');
HubOverlay.toggle('hotkey');
assert(HubOverlay.isOpen() === true,  'toggle opens');
HubOverlay.toggle('hotkey');
assert(HubOverlay.isOpen() === false, 'toggle closes');
var evts = q().map(function (ev) { return ev.event_type; });
assert(evts.indexOf('hub_opened') >= 0,  'toggle emitted hub_opened');
assert(evts.indexOf('hub_closed') >= 0,  'toggle emitted hub_closed');
qClear();

console.log('\\n── station() unknown ID ──');
HubOverlay.station('__bogus__');
HubOverlay.station('<script>');
HubOverlay.station('');
HubOverlay.station(null);
var unkEvs = q().filter(function (ev) { return ev.event_type === 'hub_station_clicked'; });
assert(unkEvs.length === 0, 'unknown station IDs never emit telemetry (got ' + unkEvs.length + ')');
qClear();

console.log('\\n── station() locked → hub_station_clicked availability=locked ──');
/* blueprint is locked at actIdx=0 (reset from earlier test) */
state.actIdx = 0;
/* open hub so station() has context */
HubOverlay.open('test');
qClear();
HubOverlay.station('blueprint');
var lockEvs = q().filter(function (ev) { return ev.event_type === 'hub_station_clicked'; });
assert(lockEvs.length === 1, 'locked station click emits hub_station_clicked');
if (lockEvs[0]) {
  assert(lockEvs[0].station_id === 'blueprint', 'station_id === blueprint');
  assert(lockEvs[0].availability === 'locked', 'availability === locked');
}
assert(HubOverlay.isOpen() === true, 'locked click does NOT close the hub');
HubOverlay.close('cleanup');
qClear();

console.log('\\n── station() open → navigates + closes hub ──');
__navCalls.dossier = 0;
state.actIdx = 0;  /* leads is open at any playing state */
HubOverlay.open('test');
qClear();
HubOverlay.station('leads');
var navEvs = q().filter(function (ev) { return ev.event_type === 'hub_station_clicked'; });
assert(navEvs.length === 1, 'open station click emits hub_station_clicked');
if (navEvs[0]) {
  assert(navEvs[0].station_id === 'leads', 'station_id === leads');
  assert(navEvs[0].availability === 'open', 'availability === open');
}
assert(__navCalls.dossier === 1, 'leads station called toggleDossier() exactly once');
/* leads station closes the hub and opens dossier */
assert(HubOverlay.isOpen() === false, 'open station click closes the hub');
qClear();

console.log('\\n── setAvailability() scenario override ──');
/* Without override: terminal is open during playing. */
state.gameState = 'playing';
assert(HubOverlay._evaluate('terminal').open === true, 'pre-override: terminal open');
/* Override makes it locked with a custom reason. */
HubOverlay.setAvailability('terminal', { open: false, reason: 'Wait for Hans to leave.' });
var overrideAv = HubOverlay._evaluate('terminal');
assert(overrideAv.open === false, 'override: terminal now locked');
assert(overrideAv.reason === 'Wait for Hans to leave.', 'override: custom reason preserved');
/* Clear override returns to default behaviour. */
HubOverlay.setAvailability('terminal', null);
assert(HubOverlay._evaluate('terminal').open === true, 'override cleared: terminal open again');
/* Invalid station id is silently ignored. */
HubOverlay.setAvailability('__bogus__', { open: true });  /* must not throw */
assert(true, 'setAvailability() with bogus id does not throw');

console.log('\\n── station() sanitization: no token or arbitrary strings reach telemetry ──');
qClear();
HubOverlay.open('test');
qClear();
HubOverlay.station('board');  /* route to investigation board (stubbed) */
var safeEvs = q().filter(function (ev) { return ev.event_type === 'hub_station_clicked'; });
if (safeEvs.length) {
  assert(JSON.stringify(safeEvs[0]).indexOf('00000000-0000-4000-8000-000000000002') < 0,
         'HEC token never in hub_station_clicked payload');
}

console.log('\\n── pause-handoff behaviour ──');
/* Simulate pause-up state; open() should auto-dismiss pause. */
qClear();
state.paused = true;
var pauseEl = document.getElementById('overlay-pause');
pauseEl.classList.remove('hidden');   /* show pause */
HubOverlay.open('test');
assert(pauseEl.classList.contains('hidden') === true,
       'open() auto-dismissed the pause overlay when it was visible');
HubOverlay.close('cleanup');

console.log('\\n══ Summary ══ ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
`;

const combined = naka + '\n\n' + hub + '\n\n' + testSuite;

vm.createContext(ctx);
try {
  vm.runInContext(combined, ctx, { filename: 'test_hub_overlay.js' });
} catch (e) {
  console.error('\nERROR:', e.message);
  const m = (e.stack || '').match(/test_hub_overlay\.js:(\d+)/);
  if (m) {
    const ln = +m[1];
    const lines = combined.split('\n');
    const lo = Math.max(0, ln - 3), hi = Math.min(lines.length, ln + 3);
    for (let i = lo; i < hi; i++) {
      console.error('  ' + (i + 1).toString().padStart(5) + (i + 1 === ln ? '> ' : '  ') + lines[i]);
    }
  } else {
    console.error(e.stack);
  }
  process.exit(2);
}
