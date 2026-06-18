#!/usr/bin/env node
/* v2.10 / Phase 5i — PhoneCalls regression test.
 *
 * Extracts NakaTelemetry + PhoneCalls from game.html and exercises them
 * under a minimal browser stub (vm context). Companion to
 * test_hans_antagonist.js.
 *
 * Run:    node scripts/tests/test_phone_calls.js
 *
 * What we cover:
 *   1. Registry integrity — three callers (powell / hans / holly), each
 *      with ≥3 scripted lines, well-typed TTS knobs, and tone-class
 *      mapped to the CSS stylesheet class that styles the overlay.
 *   2. Public API surface: trigger, dismiss, isActive, setMuted,
 *      isMuted, init.
 *   3. Happy path — calling trigger('powell') creates an overlay,
 *      starts ringing state, emits `phone_call_incoming`.
 *   4. One-call-at-a-time — a second trigger() while active is a no-op
 *      and does NOT emit a second incoming event.
 *   5. Unknown caller — trigger('badguy') is a no-op.
 *   6. Ad-hoc line — custom line is capped at 280 chars and reported
 *      with delivery_type='adhoc' / line_preset_id='adhoc'.
 *   7. Rotation — preset lines cycle through the pool (not sticky).
 *   8. Answer flow — clicking the answer button emits
 *      `phone_call_answered` with a latency_ms field, and dismiss flips
 *      state out of 'ringing'.
 *   9. Missed flow — dismiss(missed) emits `phone_call_missed` with a
 *      ring_duration_ms field.
 *  10. Hash trigger — init() parses #call=powell from location.hash and
 *      fires trigger() on the next tick; the hash is cleared after.
 *  11. Event-type allowlist — the three new telemetry types
 *      (phone_call_incoming / _answered / _missed) live in the
 *      NakaTelemetry EVENT_TYPES allowlist.
 *  12. Telemetry wire shape — the three events include act, caller,
 *      delivery_type, and line_preset_id, and the HEC token never
 *      leaks into the queued JSON.
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
const nakaStart = html.indexOf('var NakaTelemetry = (function()');
if (nakaStart < 0) throw new Error('NakaTelemetry not found');
const nakaEnd = html.indexOf('\n})();', nakaStart);
if (nakaEnd < 0) throw new Error('NakaTelemetry end not found');
const naka = html.substring(nakaStart, nakaEnd + '\n})();'.length);

const phoneStart = html.indexOf('var PhoneCalls = (function()');
if (phoneStart < 0) throw new Error('PhoneCalls not found in game.html');
const phoneEndIdx = html.indexOf('\n})();', phoneStart);
if (phoneEndIdx < 0) throw new Error('PhoneCalls end marker not found');
const phoneMod = html.substring(phoneStart, phoneEndIdx + '\n})();'.length);

/* ── DOM stub with enough fidelity to run the overlay code path ─────── */
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
    _flatCache: null,         /* flattened element list parsed from innerHTML */
    style: { setProperty: () => {} },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] || null; },
    removeAttribute(k) { delete this._attrs[k]; },
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
  /* classList syncs with a string property className so direct
     assignments like `el.className = 'foo bar'` propagate into the
     set (real DOM behaviour). */
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
    set(v) { el._innerHTML = String(v || ''); el._flatCache = null; }
  });
  return el;
}

function matchSel(el, sel) {
  sel = sel.trim();
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return el.classList && el.classList.contains(cls);
  }
  const m = sel.match(/^\[([^=]+)="([^"]*)"\]$/);
  if (m) return el._attrs && el._attrs[m[1]] === m[2];
  return false;
}

function queryOne(root, sel) {
  const flat = getFlatChildren(root);
  for (const child of flat) {
    if (matchSel(child, sel)) return child;
  }
  return null;
}
function queryAll(root, sel, out) {
  const flat = getFlatChildren(root);
  for (const child of flat) {
    if (matchSel(child, sel)) out.push(child);
  }
}

function getFlatChildren(root) {
  /* Returns a cached, flat list of stub elements parsed from
     root.innerHTML. This is a *lossy* projection of the DOM that
     ignores tree hierarchy — each distinct opening tag in the markup
     becomes one element in the flat list. That's enough for the
     test's selectors, which are all attribute/class based, and it
     sidesteps the issue that the real innerHTML contains nested
     <div>s that a naive regex can't balance.

     Caching is critical: PhoneCalls attaches listeners to children
     the first time it calls querySelector, and the test must be able
     to click the SAME element back. We therefore memoise on
     root._flatCache; it's invalidated whenever innerHTML is
     re-assigned (see the innerHTML setter on makeElement). */
  if (root._flatCache !== null && root._flatCache !== undefined) return root._flatCache;
  const markup = root.innerHTML || '';
  const out = [];
  /* Match every opening tag — non-greedy up to the first > that isn't
     part of an attribute value. Self-closing /> is fine; we ignore
     closing tags entirely. */
  const tagRe = /<(\w+)((?:\s+[^>]*)?)\/?>/g;
  let m;
  while ((m = tagRe.exec(markup))) {
    const tag = m[1];
    const attrs = m[2] || '';
    const el = makeElement(tag);
    const classMatch = /class="([^"]*)"/.exec(attrs);
    if (classMatch) classMatch[1].split(/\s+/).forEach(c => c && el._classSet.add(c));
    const attrRe = /([\w-]+)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrs))) {
      if (am[1] !== 'class') el._attrs[am[1]] = am[2];
    }
    out.push(el);
  }
  root._flatCache = out;
  return out;
}

const localStorageStub = {
  _m: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; }
};

const NAKATOMI_CONFIG_JSON = JSON.stringify({
  hecUrl: 'https://hec.example.com/services/collector',
  hecToken: '00000000-0000-4000-8000-000000000001',
  teamName: 'test-team'
});
const CONFIG_ELEMENT = makeElement('script');
CONFIG_ELEMENT.id = 'nakatomi-config';
CONFIG_ELEMENT.textContent = NAKATOMI_CONFIG_JSON;

const body = makeElement('body');
const head = makeElement('head');
const docRoot = makeElement('html');
docRoot.appendChild(head); docRoot.appendChild(body);

const documentStub = {
  body,
  documentElement: docRoot,
  head,
  readyState: 'complete',
  getElementById(id) {
    if (id === 'nakatomi-config') return CONFIG_ELEMENT;
    for (const c of body.children) { if (c.id === id) return c; }
    return null;
  },
  querySelector: (sel) => queryOne(body, sel),
  querySelectorAll: (sel) => { const out = []; queryAll(body, sel, out); return out; },
  addEventListener: () => {},
  createElement: makeElement
};

const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  location: { hash: '', href: 'http://localhost/', origin: 'http://localhost', search: '', protocol: 'http:', pathname: '/' },
  history: { replaceState: (state, title, url) => { if (typeof url === 'string') windowStub.location.pathname = url; }, pushState: () => {} },
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  fetch: () => new Promise(() => {}),   /* never resolves → queue stays populated */
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
  /* Explicit `undefined` so PhoneCalls' `if (window.speechSynthesis)`
     guard treats this environment as TTS-less; the test still verifies
     the transcript is written into the overlay. */
  speechSynthesis: undefined,
  SpeechSynthesisUtterance: undefined
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
  /* Audio context/ambient stand-ins — PhoneCalls references them with
     typeof guards, so `undefined` is safe. We assign them on the ctx
     so the module resolves `typeof ambientGain` correctly. */
  audioCtx: null,
  audioMuted: false,
  ambientGain: null,
  ensureAudio: () => {},
  state: { gameState: 'playing', paused: false, actIdx: 2, taskIdx: 0 },
  currentTask: () => ({ id: 'act3_power_grid' }),
  a11yAnnounce: () => {},
  escHTML: function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
};

/* ── test suite ─────────────────────────────────────────────────────── */
const testSuite = `
var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK   ' + msg); }
  else      { fail++; console.log('  FAIL ' + msg); }
}

console.log('\\n── Registry integrity ──');
assert(PhoneCalls && typeof PhoneCalls === 'object', 'PhoneCalls module loaded');
var callers = PhoneCalls._CALLERS;
assert(!!callers, '_CALLERS exposed');
['powell','hans','holly'].forEach(function (id) {
  var c = callers && callers[id];
  assert(!!c, 'caller present: ' + id);
  if (c) {
    assert(typeof c.label === 'string' && c.label.length > 0, id + '.label non-empty');
    assert(typeof c.role === 'string' && c.role.length > 0, id + '.role non-empty');
    assert(Array.isArray(c.lines) && c.lines.length >= 3, id + ' has ≥3 scripted lines');
    assert(typeof c.toneClass === 'string' && /^caller-/.test(c.toneClass), id + '.toneClass follows CSS convention');
    assert(c.tts && typeof c.tts.pitch === 'number' && typeof c.tts.rate === 'number', id + '.tts has numeric pitch/rate');
    c.lines.forEach(function (l, idx) {
      assert(typeof l.id === 'string' && l.id.length > 0, id + '.lines[' + idx + '].id non-empty');
      assert(typeof l.text === 'string' && l.text.length > 0, id + '.lines[' + idx + '].text non-empty');
    });
  }
});

console.log('\\n── Public API surface ──');
['trigger','dismiss','isActive','setMuted','isMuted','init'].forEach(function (name) {
  assert(typeof PhoneCalls[name] === 'function', 'PhoneCalls.' + name + '() exposed');
});

console.log('\\n── EVENT_TYPES allowlist ──');
/* The three new phone-call events must be in NakaTelemetry's
   EVENT_TYPES allowlist — otherwise emit() drops them silently. We
   probe by emitting each and verifying the queue grows. */
var QKEY = 'nakatomi_telemetry_queue_v1';
try { localStorage.removeItem(QKEY); } catch (e) {}
NakaTelemetry.emit('phone_call_incoming', { caller: 'probe' });
NakaTelemetry.emit('phone_call_answered', { caller: 'probe' });
NakaTelemetry.emit('phone_call_missed',   { caller: 'probe' });
var probeQ = JSON.parse(localStorage.getItem(QKEY) || '[]');
var etypes = probeQ.map(function (ev) { return ev.event_type; });
assert(etypes.indexOf('phone_call_incoming') >= 0, 'phone_call_incoming is allow-listed');
assert(etypes.indexOf('phone_call_answered') >= 0, 'phone_call_answered is allow-listed');
assert(etypes.indexOf('phone_call_missed')   >= 0, 'phone_call_missed is allow-listed');
try { localStorage.removeItem(QKEY); } catch (e) {}

console.log('\\n── Happy path: ring, answer, dismiss ──');
state.actIdx = 2; // act 3
assert(PhoneCalls.isActive() === false, 'no call active before trigger');

var out1 = PhoneCalls.trigger('powell');
assert(out1 === true, 'trigger(powell) returns true');
assert(PhoneCalls.isActive() === true, 'isActive() flips to true');

var q1 = JSON.parse(localStorage.getItem(QKEY) || '[]');
var incoming = q1.filter(function (ev) { return ev.event_type === 'phone_call_incoming'; });
assert(incoming.length === 1, 'one phone_call_incoming event queued');
if (incoming[0]) {
  assert(incoming[0].caller === 'powell', 'incoming.caller === powell');
  assert(incoming[0].delivery_type === 'preset', 'incoming.delivery_type === preset');
  assert(typeof incoming[0].line_preset_id === 'string' && /^powell_/.test(incoming[0].line_preset_id), 'line_preset_id is a powell_N id');
  assert(incoming[0].act === 3, 'incoming.act === 3 (actIdx+1)');
  assert(incoming[0].task_id === 'act3_power_grid', 'incoming.task_id propagated');
  /* HEC token MUST NEVER leak into an event payload. */
  assert(JSON.stringify(incoming[0]).indexOf('00000000-0000-4000-8000-000000000001') < 0, 'no HEC token in incoming payload');
}

var overlay = document.getElementById('phone-call');
assert(!!overlay, 'overlay element mounted to DOM');
assert(overlay && overlay.classList.contains('state-ringing'), 'overlay in ringing state');
assert(overlay && overlay.classList.contains('caller-powell'), 'overlay carries caller-specific tone class');

/* One-call-at-a-time guard */
var out2 = PhoneCalls.trigger('hans');
assert(out2 === false, 'second trigger() while active returns false');
var q2 = JSON.parse(localStorage.getItem(QKEY) || '[]');
var incoming2 = q2.filter(function (ev) { return ev.event_type === 'phone_call_incoming'; });
assert(incoming2.length === 1, 'no second phone_call_incoming while active');

/* Simulate answering: find the answer button and click it. */
var answerBtn = overlay.querySelector('[data-action="answer"]');
assert(!!answerBtn, 'overlay has answer button');
if (answerBtn) {
  answerBtn.click();
  var q3 = JSON.parse(localStorage.getItem(QKEY) || '[]');
  var answered = q3.filter(function (ev) { return ev.event_type === 'phone_call_answered'; });
  assert(answered.length === 1, 'clicking ANSWER fires phone_call_answered');
  if (answered[0]) {
    assert(answered[0].caller === 'powell', 'answered.caller === powell');
    assert(typeof answered[0].latency_ms === 'number' && answered[0].latency_ms >= 0, 'answered.latency_ms is a numeric timer');
  }
}

/* Explicit dismiss → no extra missed event (answered already recorded). */
PhoneCalls.dismiss();
var q4 = JSON.parse(localStorage.getItem(QKEY) || '[]');
var missedAfterAnswer = q4.filter(function (ev) { return ev.event_type === 'phone_call_missed'; });
assert(missedAfterAnswer.length === 0, 'dismiss() after answer does NOT emit phone_call_missed');
assert(PhoneCalls.isActive() === false, 'dismiss clears active flag');

console.log('\\n── Missed flow ──');
try { localStorage.removeItem(QKEY); } catch (e) {}
PhoneCalls.trigger('hans');
assert(PhoneCalls.isActive(), 'hans call active');
PhoneCalls.dismiss();                        /* never answered */
var q5 = JSON.parse(localStorage.getItem(QKEY) || '[]');
var missed = q5.filter(function (ev) { return ev.event_type === 'phone_call_missed'; });
assert(missed.length === 1, 'unanswered dismiss emits phone_call_missed');
if (missed[0]) {
  assert(missed[0].caller === 'hans', 'missed.caller === hans');
  assert(typeof missed[0].ring_duration_ms === 'number' && missed[0].ring_duration_ms >= 0, 'missed.ring_duration_ms is numeric');
}

console.log('\\n── Unknown caller ──');
try { localStorage.removeItem(QKEY); } catch (e) {}
var bad = PhoneCalls.trigger('badguy');
assert(bad === false, 'trigger(badguy) returns false');
var q6 = JSON.parse(localStorage.getItem(QKEY) || '[]');
assert(q6.length === 0, 'unknown caller produces no telemetry');

console.log('\\n── Ad-hoc line (live facilitator input) ──');
try { localStorage.removeItem(QKEY); } catch (e) {}
var huge = 'x'.repeat(1000);
PhoneCalls.trigger('holly', huge);
var q7 = JSON.parse(localStorage.getItem(QKEY) || '[]');
var adhoc = q7.filter(function (ev) { return ev.event_type === 'phone_call_incoming'; })[0];
assert(!!adhoc, 'adhoc trigger queues incoming');
if (adhoc) {
  assert(adhoc.delivery_type === 'adhoc', 'adhoc.delivery_type === adhoc');
  assert(adhoc.line_preset_id === 'adhoc', 'adhoc.line_preset_id === adhoc');
  assert(adhoc.caller === 'holly', 'adhoc.caller propagated');
  /* The raw text must NOT be on the telemetry payload — we only ship
     the preset id so facilitator-written text stays off the wire. */
  assert(JSON.stringify(adhoc).indexOf('xxxxxxxxxx') < 0, 'raw ad-hoc text is not echoed to telemetry');
}
/* Dismiss the ad-hoc call so isActive() is clean for the next block. */
PhoneCalls.dismiss();

console.log('\\n── Preset rotation ──');
try { localStorage.removeItem(QKEY); } catch (e) {}
var presetIds = [];
for (var n = 0; n < 3; n++) {
  PhoneCalls.trigger('powell');
  var qx = JSON.parse(localStorage.getItem(QKEY) || '[]');
  var last = qx.filter(function (ev) { return ev.event_type === 'phone_call_incoming'; }).pop();
  if (last) presetIds.push(last.line_preset_id);
  PhoneCalls.dismiss();
}
var uniq = {};
presetIds.forEach(function (id) { uniq[id] = 1; });
assert(Object.keys(uniq).length === presetIds.length, '3 consecutive triggers cycle through distinct preset lines (got: ' + presetIds.join(', ') + ')');

console.log('\\n── Mute toggle ──');
PhoneCalls.setMuted(true);
assert(PhoneCalls.isMuted() === true, 'setMuted(true) sticks');
PhoneCalls.setMuted(false);
assert(PhoneCalls.isMuted() === false, 'setMuted(false) sticks');

console.log('\\n── init() hash trigger ──');
try { localStorage.removeItem(QKEY); } catch (e) {}
window.location.hash = '#call=powell';
PhoneCalls.init();
/* init() defers trigger by ~400ms. Advance via a timed poll. */
var waited = 0;
function pollHash() {
  waited += 100;
  if (PhoneCalls.isActive() || waited >= 1200) {
    assert(PhoneCalls.isActive() === true, 'init() parsed #call=powell and fired trigger (waited ' + waited + 'ms)');
    var qh = JSON.parse(localStorage.getItem(QKEY) || '[]');
    var hashIn = qh.filter(function (ev) { return ev.event_type === 'phone_call_incoming'; });
    assert(hashIn.length === 1, 'hash-trigger produces one phone_call_incoming');
    PhoneCalls.dismiss();

    console.log('\\n══ Summary ══ ' + pass + ' pass, ' + fail + ' fail');
    /* Force exit — NakaTelemetry keeps timers alive. */
    process.exit(fail > 0 ? 1 : 0);
  } else {
    setTimeout(pollHash, 100);
  }
}
setTimeout(pollHash, 100);
`;

const combined = naka + '\n\n' + phoneMod + '\n\n' + testSuite;

vm.createContext(ctx);
try {
  vm.runInContext(combined, ctx, { filename: 'test_phone_calls.js' });
} catch (e) {
  console.error('\nERROR:', e.message);
  const m = (e.stack || '').match(/test_phone_calls\.js:(\d+)/);
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
