#!/usr/bin/env node
/* v2.10 / Phase 5i — HansAntagonist regression test.
 *
 * Extracts the NakaTelemetry + HANS_REACTIONS + HansAntagonist modules
 * from game.html and exercises them under a minimal DOM / browser stub.
 *
 * Run:    node scripts/tests/test_hans_antagonist.js
 *
 * What we cover (security-relevant bits):
 *   1. HANS_REACTIONS registry integrity (≥30 reactions, valid tones,
 *      unique IDs, every (trigger, tone) bucket has ≥3 lines so the
 *      recent-window suppression never starves).
 *   2. NakaTelemetry.emitIntercept() public surface.
 *   3. HansAntagonist surface: trigger, noteActivity, noteKeypadWrong,
 *      pollIdle, reset.
 *   4. Behavior: happy path, global 5-min throttle, reset() clearing
 *      throttle, keypad-spam threshold, activity resets idle clock,
 *      tone bias (act 1 light / act 5 sinister), recent-window
 *      suppression producing distinct IDs within a tone bucket.
 *
 * The test runs the modules in a vm context with stubbed browser APIs.
 * It does NOT exercise the actual HEC wire format (that's handled by
 * the HEC load script and the CI integration suite) — it only verifies
 * that the Hans reaction pipeline routes the right shape of payload to
 * emitIntercept, which in the real game then posts to
 * index=nakatomi_comms sourcetype=intercept:hans.
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
function extractRange(anchor, terminator, includeTerminator) {
  const startIdx = html.indexOf(anchor);
  if (startIdx < 0) throw new Error('not found in game.html: ' + anchor);
  const endIdx = html.indexOf(terminator, startIdx);
  if (endIdx < 0) throw new Error('not found after anchor "' + anchor + '": ' + terminator);
  return includeTerminator
    ? html.substring(startIdx, endIdx + terminator.length)
    : html.substring(startIdx, endIdx);
}

const naka = extractRange('var NakaTelemetry = (function()', '\n})();', true);

const hansRegStart = html.indexOf('var HANS_REACTIONS = [');
if (hansRegStart < 0) throw new Error('HANS_REACTIONS not found in game.html');
const hansAntagStart = html.indexOf('var HansAntagonist = (function()');
if (hansAntagStart < 0) throw new Error('HansAntagonist not found in game.html');
const hansReg = html.substring(hansRegStart, hansAntagStart);

const achievementsStart = html.indexOf('var ACHIEVEMENTS', hansAntagStart);
if (achievementsStart < 0) throw new Error('ACHIEVEMENTS marker not found after HansAntagonist');
const hansMod = html.substring(hansAntagStart, achievementsStart);

/* ── minimal browser stubs for vm context ──────────────────────────── */
function stubEl() {
  return {
    tagName: 'DIV', id: '',
    setAttribute: () => {}, getAttribute: () => null,
    addEventListener: () => {}, removeEventListener: () => {},
    appendChild: () => {}, removeChild: () => {}, contains: () => false,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: { setProperty: () => {} },
    parentNode: null, innerHTML: '', textContent: '',
    querySelector: () => null, querySelectorAll: () => [],
    focus: () => {}, click: () => {}
  };
}

const localStorageStub = {
  _m: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; }
};

/* The Hans HEC wire-format test needs telemetry enabled, so we plant
   a valid config block that readConfigBlock() will pick up during
   NakaTelemetry's init(). All other getElementById lookups return null. */
const NAKATOMI_CONFIG_JSON = JSON.stringify({
  hecUrl: 'https://hec.example.com/services/collector',
  hecToken: '00000000-0000-4000-8000-000000000001',
  teamName: 'test-team'
});
const CONFIG_ELEMENT = Object.assign(stubEl(), {
  id: 'nakatomi-config',
  textContent: NAKATOMI_CONFIG_JSON
});

const documentStub = {
  body: stubEl(),
  documentElement: stubEl(),
  head: stubEl(),
  readyState: 'complete',
  getElementById: (id) => (id === 'nakatomi-config' ? CONFIG_ELEMENT : null),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => stubEl()
};

const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  location: { hash: '', href: 'http://localhost/', origin: 'http://localhost', search: '', protocol: 'http:', pathname: '/' },
  history: { replaceState: () => {}, pushState: () => {} },
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  /* fetch() never resolves, so the async HEC flush started at init()
     stays pending and events accumulate in the queue for inspection. */
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
  a11yAnnounce: () => {},
  escHTML: function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  state: { gameState: 'playing', paused: false, actIdx: 0 }
};

/* ── test suite ─────────────────────────────────────────────────────── */
const testSuite = `
var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK   ' + msg); }
  else      { fail++; console.log('  FAIL ' + msg); }
}

console.log('\\n── HANS_REACTIONS registry ──');
assert(Array.isArray(HANS_REACTIONS), 'HANS_REACTIONS is array');
assert(HANS_REACTIONS.length >= 30, 'registry has ≥30 reactions (got ' + HANS_REACTIONS.length + ')');

var byTrigger = {};
HANS_REACTIONS.forEach(function (r) { byTrigger[r.trigger] = (byTrigger[r.trigger]||0) + 1; });
['idle','lazy_queries','keypad_spam','fast_solves','side_story_discoveries','konami_code'].forEach(function (t) {
  assert(byTrigger[t] >= 1, 'has trigger: ' + t);
});
HANS_REACTIONS.forEach(function (r) {
  if (['light','sinister'].indexOf(r.tone) < 0)
    assert(false, 'reaction ' + r.id + ' has invalid tone: ' + r.tone);
  if (typeof r.line !== 'string' || r.line.length === 0)
    assert(false, 'reaction ' + r.id + ' has empty line');
});

['idle','lazy_queries','keypad_spam','fast_solves','side_story_discoveries','konami_code'].forEach(function (t) {
  ['light','sinister'].forEach(function (tn) {
    var key = t + '|' + tn;
    var list = HANS_REACTIONS_BY_KEY[key] || [];
    assert(list.length >= 3, key + ' has ≥3 lines (got ' + list.length + ')');
  });
});

var seen = {}, dup = 0;
HANS_REACTIONS.forEach(function (r) { if (seen[r.id]) dup++; else seen[r.id] = 1; });
assert(dup === 0, 'all reaction IDs unique');
assert(HANS_REACTIONS.every(function (r) { return HANS_REACTION_BY_ID[r.id] === r; }), 'HANS_REACTION_BY_ID resolves every id');

console.log('\\n── NakaTelemetry surface ──');
assert(typeof NakaTelemetry.emit === 'function', 'emit() exposed');
assert(typeof NakaTelemetry.emitIntercept === 'function', 'emitIntercept() exposed');

var QKEY = 'nakatomi_telemetry_queue_v1';
var before = (localStorage.getItem(QKEY) || '[]');
NakaTelemetry.emitIntercept('intercept:hans', {
  reaction_id: 'idle_l_1', trigger: 'idle', tone: 'light',
  transcript: 'Take your time, Mr. Cowboy.', act: 1
});
var after = (localStorage.getItem(QKEY) || '[]');
/* Queue grows only if telemetry is enabled — the first call runs with
   config loaded, so it should actually enqueue. The purpose of this
   block is to verify emitIntercept doesn't throw when called before
   the wire-format test overrides the queue state. */
assert(typeof after === 'string', 'emitIntercept does not throw under normal config');

var threw = false;
try {
  NakaTelemetry.emitIntercept('intercept:mcclane', {
    reaction_id: 'x', trigger: 'x', tone: 'light', transcript: 'x'
  });
} catch (e) { threw = true; }
assert(!threw, 'invalid target is tolerated (no throw)');

console.log('\\n── HansAntagonist surface ──');
['trigger','noteActivity','noteKeypadWrong','pollIdle','reset'].forEach(function (name) {
  assert(typeof HansAntagonist[name] === 'function', 'HansAntagonist.' + name + '() exposed');
});

console.log('\\n── HansAntagonist behavior ──');
window.NakaTelemetry = NakaTelemetry; // the module dereferences via window

var interceptCalls = [];
var origEmitIntercept = NakaTelemetry.emitIntercept;
NakaTelemetry.emitIntercept = function (target, fields) { interceptCalls.push({ target: target, fields: fields }); };

HansAntagonist.reset();
interceptCalls.length = 0;
state.actIdx = 0;
HansAntagonist.trigger('idle', { task_id: 'act2_seal_bio' });
assert(interceptCalls.length === 1, 'trigger() emits exactly once');
assert(interceptCalls[0].target === 'intercept:hans', 'target is intercept:hans');
assert(interceptCalls[0].fields.trigger === 'idle', 'fields.trigger == idle');
assert(['light','sinister'].indexOf(interceptCalls[0].fields.tone) >= 0, 'fields.tone valid');
assert(typeof interceptCalls[0].fields.transcript === 'string' && interceptCalls[0].fields.transcript.length > 0, 'transcript non-empty');
assert(typeof interceptCalls[0].fields.reaction_id === 'string', 'reaction_id present');

HansAntagonist.trigger('fast_solves', {});
assert(interceptCalls.length === 1, 'global throttle blocks second trigger within 5 min');

HansAntagonist.reset();
interceptCalls.length = 0;
HansAntagonist.trigger('keypad_spam', {});
assert(interceptCalls.length === 1, 'reset() clears throttle');

HansAntagonist.reset();
interceptCalls.length = 0;
var realNow = Date.now;
var frozen = 1000000;
Date.now = function () { return frozen; };
for (var i = 0; i < 5; i++) HansAntagonist.noteKeypadWrong();
assert(interceptCalls.length === 0, '5 wrongs do NOT trigger spam');
HansAntagonist.noteKeypadWrong();
assert(interceptCalls.length === 1, '6 wrongs trigger keypad_spam');
assert(interceptCalls[0] && interceptCalls[0].fields.trigger === 'keypad_spam', 'trigger is keypad_spam');
Date.now = realNow;

HansAntagonist.reset();
interceptCalls.length = 0;
HansAntagonist.noteActivity();
HansAntagonist.pollIdle();
assert(interceptCalls.length === 0, 'pollIdle no-op when recent activity');

function distribution(actIdx, samples) {
  state.actIdx = actIdx;
  var s = 0, l = 0;
  for (var n = 0; n < samples; n++) {
    HansAntagonist.reset();
    interceptCalls.length = 0;
    HansAntagonist.trigger('idle', {});
    var tone = interceptCalls[0] && interceptCalls[0].fields && interceptCalls[0].fields.tone;
    if (tone === 'sinister') s++;
    else if (tone === 'light') l++;
  }
  return { s: s, l: l };
}
var a5 = distribution(4, 300);
console.log('    act 5 distribution: sinister=' + a5.s + ' light=' + a5.l);
assert(a5.s > a5.l * 2, 'act 5 produces ≥2× sinister over light');

var a1 = distribution(0, 300);
console.log('    act 1 distribution: sinister=' + a1.s + ' light=' + a1.l);
assert(a1.l > a1.s * 1.5, 'act 1 produces ≥1.5× light over sinister');

var realNow2 = Date.now;
var tNow = 2000000;
Date.now = function () { return tNow; };
HansAntagonist.reset();
interceptCalls.length = 0;
state.actIdx = 0;
var ids = [];
for (var k = 0; k < 3; k++) {
  HansAntagonist.trigger('idle', {});
  if (interceptCalls[interceptCalls.length - 1]) {
    ids.push(interceptCalls[interceptCalls.length - 1].fields.reaction_id);
  }
  tNow += 6 * 60 * 1000;
}
Date.now = realNow2;
var uniq = {};
ids.forEach(function (id) { uniq[id] = 1; });
assert(Object.keys(uniq).length === ids.length, '3 consecutive idle triggers within a tone bucket produce distinct reaction IDs (got: ' + ids.join(', ') + ')');

NakaTelemetry.emitIntercept = origEmitIntercept;

console.log('\\n── emitIntercept queue shape (wire format) ──');
/* NakaTelemetry picked up the inline config during init() because we
   planted a valid nakatomi-config JSON block in the DOM stub. Verify
   by checking the debug snapshot. */
var dbg = NakaTelemetry.debugInfo();
assert(dbg.hasHecUrl === true, 'NakaTelemetry picked up hecUrl from inline config');
assert(dbg.hasHecToken === true, 'NakaTelemetry picked up hecToken from inline config');
assert(dbg.enabled === true, 'telemetry enabled after config load');

/* Clear any stale queue and emit a clean Hans intercept. */
try { localStorage.removeItem(QKEY); } catch (e) {}
NakaTelemetry.emitIntercept('intercept:hans', {
  reaction_id: 'idle_s_1',
  trigger: 'idle',
  tone: 'sinister',
  channel: 'vault_primary',
  speaker: 'Hans',
  transcript: 'Your hesitation is a gift.',
  act: 3
});

/* Inspect the queued events directly — there should be at least two:
     1) the raw intercept:hans event (has _target + _raw)
     2) the hans_reaction metadata event
   (session_start, act_start etc. from init may also be present — we only
   assert on the two emitIntercept-produced entries.) */
var queue = JSON.parse(localStorage.getItem(QKEY) || '[]');
assert(queue.length >= 2, 'emitIntercept produces ≥2 queue entries (got ' + queue.length + ')');

var rawEv = queue.filter(function (ev) { return ev._target === 'intercept:hans'; })[0];
assert(!!rawEv, 'queue has a raw intercept:hans entry with _target set');
if (rawEv) {
  assert(typeof rawEv._raw === 'string' && rawEv._raw.length > 0, 'intercept entry carries _raw key=value string');
  assert(rawEv._raw.indexOf('reaction_id=idle_s_1') >= 0, '_raw contains reaction_id=idle_s_1');
  assert(rawEv._raw.indexOf('trigger=idle') >= 0, '_raw contains trigger=idle');
  assert(rawEv._raw.indexOf('tone=sinister') >= 0, '_raw contains tone=sinister');
  assert(rawEv._raw.indexOf('speaker=Hans') >= 0, '_raw contains speaker=Hans');
  assert(rawEv._raw.indexOf('transcript=') >= 0, '_raw contains transcript=');
  assert(rawEv._raw.indexOf('act=3') >= 0, '_raw contains act=3');
  assert(rawEv._raw.indexOf('00000000-0000-4000-8000-000000000001') < 0,
    '_raw does not contain the HEC token');
  var jsonPayload = JSON.stringify(rawEv);
  assert(jsonPayload.indexOf('00000000-0000-4000-8000-000000000001') < 0,
    'queue entry JSON does not contain the HEC token');
}

var metaEv = queue.filter(function (ev) { return ev.event_type === 'hans_reaction'; })[0];
assert(!!metaEv, 'queue has a hans_reaction metadata entry');
if (metaEv) {
  assert(metaEv.reaction_id === 'idle_s_1', 'metadata.reaction_id matches');
  assert(metaEv.trigger === 'idle', 'metadata.trigger matches');
  assert(metaEv.tone === 'sinister', 'metadata.tone matches');
  assert(metaEv.speaker === 'Hans', 'metadata.speaker matches');
  assert(metaEv.channel === 'vault_primary', 'metadata.channel matches');
  /* The metadata event intentionally does NOT duplicate the full
     transcript (that lives on the intercept:hans raw line). */
  assert(metaEv.transcript === undefined, 'metadata does not duplicate transcript (by design)');
  assert(metaEv.act === '3', 'metadata.act matches (stringified)');
}

/* Reject targets not in the intercept allow-list — v2.10 only permits
   'intercept:hans'. Attempting 'intercept:mcclane' should not queue. */
var qBefore = JSON.parse(localStorage.getItem(QKEY) || '[]').length;
NakaTelemetry.emitIntercept('intercept:mcclane', {
  reaction_id: 'x', trigger: 'x', tone: 'light', transcript: 'x'
});
var qAfter = JSON.parse(localStorage.getItem(QKEY) || '[]').length;
assert(qAfter === qBefore, 'emitIntercept rejects non-allow-listed target (no queue growth)');

console.log('\\n══ Summary ══ ' + pass + ' pass, ' + fail + ' fail');
/* Force exit — NakaTelemetry.finishInit() sets up drainTimer and
   heartbeatTimer via setInterval, which otherwise keep the node event
   loop alive past the test body. */
process.exit(fail > 0 ? 1 : 0);
`;

const combined = naka + '\n\n' + hansReg + '\n\n' + hansMod + '\n\n' + testSuite;

vm.createContext(ctx);
try {
  vm.runInContext(combined, ctx, { filename: 'test_hans_antagonist.js' });
} catch (e) {
  console.error('\nERROR:', e.message);
  const m = (e.stack || '').match(/test_hans_antagonist\.js:(\d+)/);
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
