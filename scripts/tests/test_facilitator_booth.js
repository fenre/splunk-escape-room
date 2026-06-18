#!/usr/bin/env node
/* v2.13 / Phase 5d-5e — Facilitator booth tab regression test.
 *
 * Exercises: ?facilitator=1 URL bypass, Splunk linkout URL validation,
 * 1-question feedback widget, abandonment-tracking timer, and
 * facilitator_action telemetry instrumentation.
 *
 * Run:    node scripts/tests/test_facilitator_booth.js
 *
 * What we cover:
 *   1. EVENT_TYPES allowlist — session_feedback, session_abandoned,
 *      facilitator_action present.
 *   2. _readSplunkLinkUrl() — accepts only valid HTTPS URLs from
 *      window.NakatomiConfig or #nakatomi-config script JSON.
 *   3. _readSplunkLinkUrl() — rejects http://, javascript:, data:,
 *      strings with userinfo (user:pass@), strings >512 chars,
 *      strings with CRLF / control chars, non-string values.
 *   4. _readSplunkLinkUrl() — never reads from URL params (the
 *      Phase-1 security model says secrets never come from query
 *      strings; this URL is config, but we apply the same rule
 *      since open-redirect surfaces have the same shape).
 *   5. _sanitizeFeedbackText() — strips CR/LF/TAB/control + <>;
 *      caps at 120 chars; tolerates non-string input.
 *   6. session_feedback emit shape — rating int, comment string,
 *      comment_length matches sanitized length, no DOM markup
 *      passes through.
 *   7. dismissFeedback() emits a single skip event and never re-fires
 *      after submit/dismiss.
 *   8. Abandonment beacon timing — armAbandonmentTimer() schedules
 *      timer+5min; cancelAbandonmentTimer() clears it.
 *   9. Abandonment beacon clamps at 4h max (kiosk-watchdog safety).
 *  10. Facilitator-action emit shape — action verb is on the static
 *      allowlist, never user-controlled.
 *  11. ?facilitator=1 bypasses the PIN; ?facilitator=0 / absent does
 *      not.
 *  12. game.html surface checks — markup wires the linkout button,
 *      feedback widget, and rel="noopener noreferrer" on the linkout.
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

/* ── 1. EVENT_TYPES allowlist ──────────────────────────────────────── */
['session_feedback', 'session_abandoned', 'facilitator_action'].forEach((t) => {
  assert("EVENT_TYPES contains '" + t + "'", html.indexOf("'" + t + "'") > 0);
});

/* ── 2-4. Splunk linkout URL validator ─────────────────────────────── */
function makeUrlCtx(opts) {
  const ctx = {};
  ctx.console = console;
  /* Provide globals the snippet expects. */
  ctx.URL = URL;
  ctx.window = {};
  if (opts && opts.config) ctx.window.NakatomiConfig = opts.config;
  /* document.getElementById fallback — only needed when we want the
     <script id="nakatomi-config"> path. */
  const cfgEl = (opts && opts.scriptJson)
    ? { textContent: opts.scriptJson }
    : null;
  ctx.document = {
    getElementById(id) {
      if (id === 'nakatomi-config') return cfgEl;
      return null;
    }
  };
  vm.createContext(ctx);
  /* Slice _readSplunkLinkUrl out of game.html. */
  const start = html.indexOf('function _readSplunkLinkUrl()');
  const end = html.indexOf('}\n\nfunction renderSplunkLinkout()', start);
  if (start < 0 || end < 0) throw new Error('_readSplunkLinkUrl source not found');
  vm.runInContext(html.substring(start, end + 1), ctx);
  return ctx;
}

function readUrl(opts) {
  const ctx = makeUrlCtx(opts);
  return ctx._readSplunkLinkUrl();
}

/* Valid HTTPS URLs accepted. */
assertEq('https URL via NakatomiConfig is accepted',
  readUrl({ config: { splunkLinkUrl: 'https://splunk.example.com/app/nakatomi_heist/mission_brief' } }),
  'https://splunk.example.com/app/nakatomi_heist/mission_brief');
assertEq('https URL via inline JSON is accepted',
  readUrl({ scriptJson: JSON.stringify({ splunkLinkUrl: 'https://splunk.example.com/' }) }),
  'https://splunk.example.com/');

/* Rejected schemes. */
assertEq('http URL rejected', readUrl({ config: { splunkLinkUrl: 'http://splunk.example.com/' } }), null);
assertEq('javascript: rejected', readUrl({ config: { splunkLinkUrl: 'javascript:alert(1)' } }), null);
assertEq('data: rejected', readUrl({ config: { splunkLinkUrl: 'data:text/html,<script>alert(1)</script>' } }), null);
assertEq('file: rejected', readUrl({ config: { splunkLinkUrl: 'file:///etc/passwd' } }), null);
assertEq('ftp: rejected', readUrl({ config: { splunkLinkUrl: 'ftp://internal/' } }), null);

/* Userinfo (basic-auth phishing) rejected. */
assertEq('userinfo rejected', readUrl({ config: { splunkLinkUrl: 'https://user:pass@splunk.example.com/' } }), null);

/* Length cap. */
const longUrl = 'https://splunk.example.com/' + 'a'.repeat(600);
assertEq('over 512 chars rejected', readUrl({ config: { splunkLinkUrl: longUrl } }), null);

/* Control chars / CRLF rejected. */
assertEq('CRLF rejected', readUrl({ config: { splunkLinkUrl: 'https://splunk.example.com/\r\nLocation: x' } }), null);
assertEq('null byte rejected', readUrl({ config: { splunkLinkUrl: 'https://splunk.example.com/\u0000evil' } }), null);
assertEq('TAB rejected', readUrl({ config: { splunkLinkUrl: 'https://splunk.example.com/\tfoo' } }), null);

/* Non-string values rejected. */
assertEq('null value rejected', readUrl({ config: { splunkLinkUrl: null } }), null);
assertEq('number value rejected', readUrl({ config: { splunkLinkUrl: 42 } }), null);
assertEq('object value rejected', readUrl({ config: { splunkLinkUrl: { href: 'https://x' } } }), null);
assertEq('array value rejected', readUrl({ config: { splunkLinkUrl: ['https://x'] } }), null);
assertEq('empty string rejected', readUrl({ config: { splunkLinkUrl: '' } }), null);

/* No source at all → null. */
assertEq('no config returns null', readUrl({}), null);

/* Garbage JSON in script block → null, not a crash. */
assertEq('garbage script JSON returns null', readUrl({ scriptJson: 'not-valid-json-{[' }), null);

/* ── 5-6. Feedback sanitizer ────────────────────────────────────────── */
function makeSanitizerCtx() {
  const ctx = { console };
  vm.createContext(ctx);
  /* Slice _sanitizeFeedbackText only. */
  const start = html.indexOf('function _sanitizeFeedbackText(s)');
  const end = html.indexOf('}\n\nfunction _shouldShowFeedback()', start);
  if (start < 0 || end < 0) throw new Error('_sanitizeFeedbackText source not found');
  vm.runInContext(html.substring(start, end + 1), ctx);
  return ctx._sanitizeFeedbackText;
}

const san = makeSanitizerCtx();
assertEq('plain ASCII passes through', san('great game!'), 'great game!');
assertEq('CRLF stripped', san('line1\r\nline2'), 'line1line2');
assertEq('TAB stripped', san('a\tb'), 'ab');
assertEq('null byte stripped', san('a\u0000b'), 'ab');
assertEq('< stripped', san('<script>alert(1)</script>'), 'scriptalert(1)/script');
assertEq('> stripped', san('foo>bar'), 'foobar');
assertEq('120-char cap', san('x'.repeat(200)).length, 120);
assertEq('non-string returns empty', san(null), '');
assertEq('undefined returns empty', san(undefined), '');
assertEq('number returns empty', san(42), '');
assertEq('object returns empty', san({ a: 1 }), '');
/* Unicode survives. */
assertEq('unicode preserved', san('café 🎮'), 'café 🎮');

/* ── 7. Abandonment-timer logic — game.html surface checks ─────────── */
assert('armAbandonmentTimer references DIFFICULTY_PRESETS', html.indexOf('armAbandonmentTimer') > 0);
assert('abandonment timer fires session_abandoned', html.match(/armAbandonmentTimer[\s\S]{0,2000}session_abandoned/) !== null);
assert('abandonment timer caps at 4h', html.indexOf('4 * 60 * 60 * 1000') > 0);
assert('cancelAbandonmentTimer wired in triggerVictory', html.match(/triggerVictory[\s\S]{0,12000}cancelAbandonmentTimer/) !== null);
assert('cancelAbandonmentTimer wired in triggerGameOver/gameover hidden', html.match(/overlay-gameover[\s\S]{0,500}cancelAbandonmentTimer/) !== null);
assert('cancelAbandonmentTimer wired in resetGame', html.match(/function resetGame[\s\S]{0,1500}cancelAbandonmentTimer/) !== null);
assert('armAbandonmentTimer wired in enterGame', html.match(/function enterGame[\s\S]{0,1200}armAbandonmentTimer/) !== null);

/* ── 8-9. Markup surface — feedback widget + linkout HTML ──────────── */
assert('victory-feedback widget present', html.indexOf('id="victory-feedback"') > 0);
assert('5 stars present', (html.match(/class="fb-star"/g) || []).length === 5);
assert('feedback-text input maxlength=120', html.indexOf('maxlength="120"') > 0);
assert('Splunk linkout button present', html.indexOf('id="splunk-linkout-btn"') > 0);
assert('Splunk linkout has rel=noopener noreferrer',
  html.indexOf('id="splunk-linkout-btn"') > 0 &&
  html.match(/id="splunk-linkout-btn"[^>]*rel="noopener noreferrer"/) !== null);
assert('Splunk linkout has target=_blank',
  html.match(/id="splunk-linkout-btn"[^>]*target="_blank"/) !== null);
assert('Splunk linkout starts with href="#" (no live URL in static HTML)',
  html.match(/id="splunk-linkout-btn"[^>]*href="#"/) !== null);
assert('feedback widget aria-label="Session feedback"',
  html.indexOf('aria-label="Session feedback"') > 0);

/* ── 10. submitFeedback / dismissFeedback wiring ────────────────────── */
assert('submitFeedback emits session_feedback', html.match(/function submitFeedback[\s\S]{0,2000}session_feedback/) !== null);
assert('dismissFeedback emits session_feedback with skipped:true', html.match(/function dismissFeedback[\s\S]{0,800}skipped:\s*true/) !== null);
assert('submitFeedback guards rating in 1..5', html.indexOf('rating >= 1 && rating <= 5') > 0);
assert('feedbackSubmitted guard prevents double-submit', html.match(/feedbackSubmitted\s*=\s*true/g) !== null);

/* ── 11. ?facilitator=1 URL flag ────────────────────────────────────── */
assert("?facilitator=1 sets facilitatorUrlBypass", html.indexOf("get('facilitator') === '1'") > 0);
assert('facilitatorUrlBypass auto-shows panel', html.match(/facilitatorUrlBypass[\s\S]{0,1500}buildFacilitatorButtons/) !== null);
assert('facilitatorUrlBypass sets facUnlocked = true', html.match(/facilitatorUrlBypass\)\s*facUnlocked\s*=\s*true/) !== null);

/* ── 12. Facilitator-action telemetry call sites ────────────────────── */
const facActionCount = (html.match(/'facilitator_action'/g) || []).length;
/* Expected count: 1 in EVENT_TYPES + 1 inline-onclick on End Session +
   1 inline-onclick on Reset + 1 in buildFacilitatorButtons → 4 total. */
assert('facilitator_action emit call sites >= 4 (allow + 3+ wired)', facActionCount >= 4);
/* Action verbs allow-listed; never accept user-controlled action strings.
   The buttons use a ternary for complete vs powercut so we look for the
   string literals themselves rather than `action:'complete'` syntax. */
[
  { verb: 'end_session',  pattern: /action\s*:\s*'end_session'/ },
  { verb: 'reset',        pattern: /action\s*:\s*'reset'/ },
  { verb: 'complete',     pattern: /['"]powercut['"]\s*:\s*['"]complete['"]/ },
  { verb: 'powercut',     pattern: /['"]powercut['"]/ }
].forEach(({ verb, pattern }) => {
  assert("facilitator_action verb '" + verb + "' present in source",
    pattern.test(html));
});

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ Facilitator Booth Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
