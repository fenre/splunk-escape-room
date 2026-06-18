#!/usr/bin/env node
/* v2.14 / Phase 5h — AudioMix module regression test.
 *
 * Extracts the AudioMix IIFE + the audio-bus helpers (tone, noise,
 * ensureAudio, the bus globals) from game.html and exercises them
 * under a vm context with stubbed AudioContext + localStorage.
 *
 * Run:    node scripts/tests/test_audio_mix.js
 *
 * What we cover:
 *   1. Module surface — getSettings / setSetting / applyToContext /
 *      crossfade / captionFor / playOdeToJoy / playActComplete /
 *      _internals.
 *   2. EVENT_TYPES allowlist — audio_setting_changed present.
 *   3. DEFAULTS — match the plan: master 1.0, music 0.7, sfx 1.0,
 *      ambient 0.35; mono / reducedIntensity / captions all false.
 *   4. clamp01() — defaults, NaN, Infinity, negative, > 1 all
 *      mapped to a sane value in [0, 1].
 *   5. setSetting() — accepts only allow-listed keys (rejects a
 *      `__proto__` / `constructor` / unknown key drive-by).
 *   6. setSetting() — boolean fields coerce to bool, numeric
 *      fields clamp to [0, 1].
 *   7. setSetting() — persists to localStorage and emits
 *      audio_setting_changed telemetry.
 *   8. localStorage corrupt JSON → settings reset to defaults; the
 *      key is wiped rather than left poisoned.
 *   9. captionFor() — only renders when captions:true and cueId is
 *      in the static dictionary; never renders user-supplied keys.
 *  10. captionFor() — uses textContent (never innerHTML) — defends
 *      against a future caption containing a `<`.
 *  11. CAPTIONS dictionary — every cue id used in game.html (boot,
 *      codeCorrect, codeWrong, sealOpen, etc.) has a static label.
 *  12. ACT_MOTIFS — exactly 5 acts × 5 notes; every note positive
 *      (no NaN / negatives leaking through).
 *  13. Ode to Joy → uses the music bus.
 *  14. game.html surface — bus topology declared; ensureAudio()
 *      builds it; tone() / noise() take an optional `bus` arg.
 *  15. Mix panel HTML present — sliders, checkboxes, captions HUD.
 *  16. playOdeToJoy() wired into triggerVictory() default branch.
 *  17. playActComplete() wired into act-advance flow.
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

const audioMix = sliceIIFE(html, 'var AudioMix = (function()');

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

/* ── stub: localStorage + minimal DOM + audio context + telemetry ──── */
function makeContext(opts) {
  const localStore = { _m: Object.assign({}, (opts && opts.preLoaded) || {}) };
  const localStorageStub = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(localStore._m, k) ? localStore._m[k] : null; },
    setItem(k, v) { localStore._m[k] = String(v); },
    removeItem(k) { delete localStore._m[k]; }
  };

  /* Bare-bones DOM: only the audio-caption-hud the captions test cares
     about. textContent/classList are tracked so the test can read them. */
  const captionHud = {
    id: 'audio-caption-hud',
    textContent: '',
    _classes: new Set(),
    classList: {
      add(...xs) { xs.forEach(x => captionHud._classes.add(x)); },
      remove(...xs) { xs.forEach(x => captionHud._classes.delete(x)); },
      contains(x) { return captionHud._classes.has(x); }
    }
  };

  /* AudioContext + GainNode stubs. Track applied gain values so we can
     assert applyToContext() actually wrote them. */
  const buses = {
    master:  { gain: { value: 1, cancelScheduledValues(){}, setValueAtTime(){}, linearRampToValueAtTime(){} } },
    ambient: { gain: { value: 0.35, cancelScheduledValues(){}, setValueAtTime(){}, linearRampToValueAtTime(){} } },
    music:   { gain: { value: 0.7, cancelScheduledValues(){}, setValueAtTime(){}, linearRampToValueAtTime(){} } },
    sfx:     { gain: { value: 1.0, cancelScheduledValues(){}, setValueAtTime(){}, linearRampToValueAtTime(){} } }
  };

  const telemetryEmits = [];
  const NakaTelemetry = {
    emit(type, payload) { telemetryEmits.push({ type, payload }); }
  };

  const ctx = {
    console,
    localStorage: localStorageStub,
    document: {
      getElementById(id) {
        if (id === 'audio-caption-hud') return captionHud;
        return null;
      }
    },
    audioCtx: { currentTime: 0 },
    audioMuted: false,
    NakaTelemetry: NakaTelemetry,
    /* Exposed bus map — the AudioMix module looks at __audioBuses. */
    __audioBuses: buses,
    /* tone()/noise() are required by playOdeToJoy / playActComplete. */
    tone: function() { /* no-op stub for tests */ },
    noise: function() {},
    /* Timer stubs — captionFor() schedules a 2s hide via setTimeout;
       we don't need the actual delay for assertions, just the call. */
    setTimeout: function(fn) { return 1; },
    clearTimeout: function() {}
  };
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(audioMix, ctx);
  return { ctx, captionHud, buses, telemetryEmits, localStore };
}

/* ── 1. Module surface ─────────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const m = ctx.AudioMix;
  assert('AudioMix module exposed', !!m);
  ['getSettings','setSetting','applyToContext','crossfade','captionFor','playOdeToJoy','playActComplete','_internals'].forEach((k) => {
    assert('AudioMix.' + k + ' is fn', typeof m[k] === 'function' || (k === '_internals' && typeof m[k] === 'object'));
  });
}

/* ── 2. EVENT_TYPES allowlist ──────────────────────────────────────── */
assert("EVENT_TYPES contains 'audio_setting_changed'",
  html.indexOf("'audio_setting_changed'") > 0);

/* ── 3. DEFAULTS ──────────────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const d = ctx.AudioMix._internals.DEFAULTS;
  assertEq('DEFAULTS.master = 1.0', d.master, 1.0);
  assertEq('DEFAULTS.music = 0.7', d.music, 0.7);
  assertEq('DEFAULTS.sfx = 1.0', d.sfx, 1.0);
  assertEq('DEFAULTS.ambient = 0.35', d.ambient, 0.35);
  assertEq('DEFAULTS.mono = false', d.mono, false);
  assertEq('DEFAULTS.reducedIntensity = false', d.reducedIntensity, false);
  assertEq('DEFAULTS.captions = false', d.captions, false);
}

/* ── 4. clamp01 ────────────────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const c = ctx.AudioMix._internals.clamp01;
  assertEq('clamp01(0.5) = 0.5', c(0.5), 0.5);
  assertEq('clamp01(-1) = 0', c(-1), 0);
  assertEq('clamp01(2) = 1', c(2), 1);
  assertEq('clamp01(NaN) = 0', c(NaN), 0);
  assertEq('clamp01(Infinity) = 0', c(Infinity), 0);
  assertEq('clamp01(-Infinity) = 0', c(-Infinity), 0);
  assertEq('clamp01("0.7") = 0', c('0.7'), 0);
  assertEq('clamp01(null) = 0', c(null), 0);
  assertEq('clamp01(undefined) = 0', c(undefined), 0);
  assertEq('clamp01(0) = 0', c(0), 0);
  assertEq('clamp01(1) = 1', c(1), 1);
}

/* ── 5. setSetting only accepts allow-listed keys ──────────────────── */
{
  const { ctx, telemetryEmits } = makeContext();
  ctx.AudioMix.setSetting('__proto__', 0.5);
  ctx.AudioMix.setSetting('constructor', 1);
  ctx.AudioMix.setSetting('toString', 0.99);
  ctx.AudioMix.setSetting('totally_made_up', 0.4);
  /* No allow-list bypass leaked through to telemetry. */
  const events = telemetryEmits.filter(e => e.type === 'audio_setting_changed');
  assertEq('drive-by keys never emit telemetry', events.length, 0);
  /* Settings unchanged from defaults. */
  const s = ctx.AudioMix.getSettings();
  assertEq('drive-by setSetting did not mutate master', s.master, 1.0);
  /* getSettings() returns only the allow-listed keys. The `__proto__`
     comparison via `in` is unsafe (always true via Object.prototype),
     so we instead enumerate own property names and confirm none of the
     drive-by keys leaked through. */
  const ownKeys = Object.getOwnPropertyNames(s);
  ['__proto__', 'constructor', 'toString', 'totally_made_up'].forEach((k) => {
    assert("no '" + k + "' own-key on getSettings()", ownKeys.indexOf(k) < 0);
  });
}

/* ── 6. setSetting type/range coercion ─────────────────────────────── */
{
  const { ctx } = makeContext();
  ctx.AudioMix.setSetting('master', 0.5);
  assertEq('master set to 0.5', ctx.AudioMix.getSettings().master, 0.5);
  ctx.AudioMix.setSetting('master', -0.7);
  assertEq('master clamped from -0.7 to 0', ctx.AudioMix.getSettings().master, 0);
  ctx.AudioMix.setSetting('master', 1.5);
  assertEq('master clamped from 1.5 to 1', ctx.AudioMix.getSettings().master, 1);
  ctx.AudioMix.setSetting('master', NaN);
  assertEq('master from NaN → 0', ctx.AudioMix.getSettings().master, 0);
  ctx.AudioMix.setSetting('mono', 1);
  assertEq('mono coerced from 1 to true', ctx.AudioMix.getSettings().mono, true);
  ctx.AudioMix.setSetting('captions', '');
  assertEq('captions coerced from "" to false', ctx.AudioMix.getSettings().captions, false);
}

/* ── 7. Persistence + telemetry ────────────────────────────────────── */
{
  const { ctx, telemetryEmits, localStore } = makeContext();
  ctx.AudioMix.setSetting('music', 0.4);
  const persisted = localStore._m['nakatomi_audio_settings'];
  assert('settings persisted to localStorage', typeof persisted === 'string' && persisted.length > 0);
  const parsed = JSON.parse(persisted);
  assertEq('persisted music = 0.4', parsed.music, 0.4);
  /* Telemetry emit fired exactly once with the right shape. */
  const evs = telemetryEmits.filter(e => e.type === 'audio_setting_changed');
  assertEq('exactly 1 audio_setting_changed emitted', evs.length, 1);
  assertEq('emitted setting', evs[0].payload.setting, 'music');
  assertEq('emitted value', evs[0].payload.value, 0.4);
}

/* ── 8. Corrupt JSON in localStorage → defaults + wipe ─────────────── */
{
  const { ctx, localStore } = makeContext({ preLoaded: { 'nakatomi_audio_settings': 'not-json-{[' } });
  const s = ctx.AudioMix.getSettings();
  assertEq('corrupt JSON → master defaults to 1.0', s.master, 1.0);
  assertEq('corrupt JSON → music defaults to 0.7', s.music, 0.7);
  assert('corrupt key was wiped from storage', !('nakatomi_audio_settings' in localStore._m));
}

/* ── 9-10. captionFor() ───────────────────────────────────────────── */
{
  const { ctx, captionHud } = makeContext();
  /* Captions OFF → never renders. */
  ctx.AudioMix.captionFor('codeCorrect');
  assertEq('captions off → no text rendered', captionHud.textContent, '');
  assert('captions off → not visible', !captionHud._classes.has('visible'));

  /* Turn captions on. */
  ctx.AudioMix.setSetting('captions', true);
  ctx.AudioMix.captionFor('codeCorrect');
  assert('captions on + known cue → text rendered', captionHud.textContent.length > 0);
  assert('captions on + known cue → visible class added', captionHud._classes.has('visible'));

  /* Unknown cue id → no render (no rogue keys). */
  captionHud.textContent = ''; captionHud._classes.clear();
  ctx.AudioMix.captionFor('attacker_supplied_<script>');
  assertEq('unknown cue id → no text', captionHud.textContent, '');
  assert('unknown cue id → no visible class', !captionHud._classes.has('visible'));

  /* null / undefined cue id. */
  ctx.AudioMix.captionFor(null);
  ctx.AudioMix.captionFor(undefined);
  ctx.AudioMix.captionFor('');
  assertEq('null/undefined/empty cue id → no text', captionHud.textContent, '');
}

/* ── 11. CAPTIONS dictionary covers every used cue id ──────────────── */
{
  const { ctx } = makeContext();
  const dict = ctx.AudioMix._internals.CAPTIONS;
  ['boot','codeCorrect','codeWrong','sealOpen','trapTriggered','actComplete','heartbeat','vaultOpen','victory','gameOver','hintRevealed','intercept','powerDown','ambient'].forEach((id) => {
    assert("CAPTIONS['" + id + "'] present", typeof dict[id] === 'string' && dict[id].length > 0);
  });
}

/* ── 12. ACT_MOTIFS shape ──────────────────────────────────────────── */
{
  const { ctx } = makeContext();
  const motifs = ctx.AudioMix._internals.ACT_MOTIFS;
  assertEq('ACT_MOTIFS has 5 acts', motifs.length, 5);
  motifs.forEach((m, i) => {
    assertEq('Act ' + (i+1) + ' motif length 5', m.length, 5);
    m.forEach((f, j) => {
      assert('Act ' + (i+1) + ' note[' + j + '] is positive number', typeof f === 'number' && isFinite(f) && f > 0);
    });
  });
}

/* ── 13. Ode to Joy uses music bus ─────────────────────────────────── */
{
  /* Track the bus arg passed to tone() during playOdeToJoy. */
  let busesUsed = [];
  const { ctx } = makeContext();
  ctx.tone = function(f, dur, type, vol, bus) { busesUsed.push(bus); };
  /* Re-run AudioMix in the new ctx so playOdeToJoy resolves to the
     replaced tone(). */
  vm.runInContext(audioMix, ctx);
  /* Trigger via a synchronous call; the function uses setTimeout for
     scheduling so we need to advance virtual time. The simplest hack
     is to override setTimeout to invoke the callback inline. */
  ctx.setTimeout = function(fn) { fn(); return 1; };
  vm.runInContext(audioMix, ctx);
  ctx.AudioMix.playOdeToJoy();
  assert('every Ode to Joy tone used the music bus',
    busesUsed.length > 0 && busesUsed.every(b => b === 'music'));
}

/* ── 14. Bus topology declared in game.html ────────────────────────── */
assert('_audioMasterBus declared', html.indexOf('_audioMasterBus') > 0);
assert('_audioAmbientBus declared', html.indexOf('_audioAmbientBus') > 0);
assert('_audioMusicBus declared', html.indexOf('_audioMusicBus') > 0);
assert('_audioSfxBus declared', html.indexOf('_audioSfxBus') > 0);
assert('ensureAudio() builds bus topology', html.indexOf('_audioAmbientBus.connect(_audioMasterBus)') > 0);
assert('tone() takes optional bus arg', html.match(/function tone\([^)]*bus\s*\)/) !== null);
assert('noise() takes optional bus arg', html.match(/function noise\([^)]*bus\s*\)/) !== null);

/* ── 15. Mix panel HTML present ────────────────────────────────────── */
assert('audio-mix-panel id present', html.indexOf('id="audio-mix-panel"') > 0);
assert('mix-master slider present', html.indexOf('id="mix-master"') > 0);
assert('mix-music slider present', html.indexOf('id="mix-music"') > 0);
assert('mix-sfx slider present', html.indexOf('id="mix-sfx"') > 0);
assert('mix-ambient slider present', html.indexOf('id="mix-ambient"') > 0);
assert('mix-mono checkbox present', html.indexOf('id="mix-mono"') > 0);
assert('mix-reduced checkbox present', html.indexOf('id="mix-reduced"') > 0);
assert('mix-captions checkbox present', html.indexOf('id="mix-captions"') > 0);
assert('audio-caption-hud div present', html.indexOf('id="audio-caption-hud"') > 0);
assert('toggleAudioMixPanel function defined', html.indexOf('function toggleAudioMixPanel()') > 0);
assert('updateAudioMix function defined', html.indexOf('function updateAudioMix(') > 0);
assert('hydrateAudioMixPanel function defined', html.indexOf('function hydrateAudioMixPanel()') > 0);

/* ── 16-17. Lifecycle wiring ───────────────────────────────────────── */
assert('AudioMix.playOdeToJoy wired into triggerVictory default branch',
  html.match(/state\.endingId\s*===\s*'default'[\s\S]{0,300}AudioMix\.playOdeToJoy/) !== null);
assert('AudioMix.playActComplete wired into act-advance flow',
  html.match(/AudioMix\.playActComplete/) !== null);

/* ── summary ────────────────────────────────────────────────────────── */
console.log('\n══ AudioMix Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
