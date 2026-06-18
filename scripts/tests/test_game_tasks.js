#!/usr/bin/env node
/* v2.17 — Game task contract regression test.
 *
 * Validates ACTS task definitions in game.html: SPL/hint alignment,
 * text-code trap reachability, and splStarter behaviour.
 *
 * Run: node scripts/tests/test_game_tasks.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GAME_HTML = path.join(REPO_ROOT, 'game.html');

let passed = 0;
let failed = 0;
const fails = [];

function assert(label, cond) {
  if (cond) passed++;
  else { failed++; fails.push(label); }
}

const html = fs.readFileSync(GAME_HTML, 'utf8');

/* Extract ACTS array — bounded brace match after `var ACTS = [` */
const actsStart = html.indexOf('var ACTS = [');
if (actsStart < 0) {
  console.error('ERROR: could not find ACTS in game.html');
  process.exit(2);
}
let depth = 0;
let actsEnd = -1;
for (let i = actsStart + 'var ACTS = '.length; i < html.length; i++) {
  const ch = html[i];
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) { actsEnd = i + 1; break; }
  }
}
const actsSrc = html.slice(actsStart + 'var ACTS = '.length, actsEnd);
let ACTS;
try {
  ACTS = vm.runInNewContext('(' + actsSrc + ')', {});
} catch (e) {
  console.error('ERROR: failed to parse ACTS:', e.message);
  process.exit(2);
}

const tasks = [];
for (const act of ACTS) {
  for (const t of act.tasks || []) tasks.push(t);
}

assert('found 26 tasks', tasks.length === 26);

/* splStarter — copy from game.html */
const splStarterMatch = html.match(/function splStarter\(spl\) \{[\s\S]*?\n\}/);
if (!splStarterMatch) {
  console.error('ERROR: splStarter not found');
  process.exit(2);
}
const splStarter = vm.runInNewContext(splStarterMatch[0] + '; splStarter', {});

for (const task of tasks) {
  const tag = task.id + ' ' + task.name;

  if (!task.spl && task.type !== 'power') {
    /* multi/power may omit spl */
    if (task.type === 'code' || task.type === 'multi') {
      assert(tag + ' has spl', !!task.spl);
    }
  }

  /* Hint Try: lines should not be shorter than task.spl for lookup/index tasks
     where we aligned them — at minimum starter must be prefix of full spl */
  if (task.spl && task.hints) {
    const tryHint = task.hints.find(h => /^Try:/i.test(h));
    if (tryHint) {
      const trySpl = tryHint.replace(/^Try:\s*/i, '').trim();
      /* full hint SPL should contain the meaningful base of task.spl */
      const base = task.spl.split('|')[0].trim();
      assert(tag + ' hint Try contains task SPL base',
        trySpl.indexOf(base) >= 0 || base.indexOf(trySpl.split('|')[0].trim()) >= 0 ||
        trySpl.replace(/\s+/g, ' ') === task.spl.replace(/\s+/g, ' '));
    }
  }

  /* splStarter must not equal full SPL (except empty/power) */
  if (task.spl) {
    const starter = splStarter(task.spl);
    assert(tag + ' splStarter truncates full SPL', starter !== task.spl);
    assert(tag + ' splStarter ends with ellipsis', /\u2026|\.\.\./.test(starter));
  }

  /* text codes: trap codes must be enterable from answer+trap letters only */
  if (task.codeType === 'text' && task.trapCodes) {
    const letters = new Set();
    const addLetters = (s) => {
      for (const ch of String(s || '').toUpperCase()) {
        if (ch >= 'A' && ch <= 'Z') letters.add(ch);
      }
    };
    addLetters(task.code);
    for (const trap of task.trapCodes) addLetters(trap);
    for (const trap of task.trapCodes) {
      const need = [...String(trap).toUpperCase()].filter(ch => ch >= 'A' && ch <= 'Z');
      const ok = need.every(ch => letters.has(ch));
      assert(tag + ' trap "' + trap + '" letters reachable on pad', ok);
    }
  }
}

/* Known aligned tasks — regression anchors */
const t15 = tasks.find(t => t.id === '1.5');
assert('1.5 spl filters LEVEL-5', t15 && t15.spl.indexOf('clearance_level="LEVEL-5"') >= 0);

const t22 = tasks.find(t => t.id === '2.2');
assert('2.2 spl uses override_code', t22 && t22.spl.indexOf('override_code=') >= 0);

const t53 = tasks.find(t => t.id === '5.3');
assert('5.3 spl filters swat_coverage', t53 && t53.spl.indexOf('swat_coverage!="yes"') >= 0);
assert('5.3 spl scopes FBI power-cut window', t53 && t53.spl.indexOf('23:20:00') >= 0);

const t21 = tasks.find(t => t.id === '2.1');
assert('2.1 no TRUNK trap', t21 && !t21.trapCodes.includes('TRUNK'));

const t23 = tasks.find(t => t.id === '2.3');
assert('2.3 answer matches 8-minute patrol gap', t23 && t23.code === '0008');
assert('2.3 traps include guard-badge red herring 0012', t23 && t23.trapCodes.includes('0012'));

/* guard_patrol seed data — floor-30 patrols are 480s (8 min) apart */
const cameraSeedPath = path.join(REPO_ROOT, 'generator', 'infrastructure', 'nakatomi_security_camera.json');
const cameraLines = fs.readFileSync(cameraSeedPath, 'utf8').trim().split('\n');
const patrolTimes = [];
for (const line of cameraLines) {
  const rec = JSON.parse(line);
  if (rec.event && rec.event.indexOf('event_type=guard_patrol') >= 0 && rec.event.indexOf('floor=30') >= 0) {
    patrolTimes.push(rec.time);
  }
}
patrolTimes.sort((a, b) => a - b);
let patrolGapsOk = patrolTimes.length >= 2;
for (let gi = 1; gi < patrolTimes.length; gi++) {
  if (Math.abs(patrolTimes[gi] - patrolTimes[gi - 1] - 480) > 0.001) patrolGapsOk = false;
}
assert('floor-30 guard_patrol events are 480s apart', patrolGapsOk);

/* renderCodeDisplay — numeric path must reset 7 text cells (no ghost "700") */
const renderMatch = html.match(/function renderCodeDisplay\(\) \{[\s\S]*?\n\}/);
assert('renderCodeDisplay found', !!renderMatch);
if (renderMatch) {
  const mockSd = {
    _spans: ['E', 'X', 'T', '7', '7', '0', '0'].map(function(ch) {
      return { className: 'seg-digit filled', textContent: ch, classList: { toggle() {} } };
    }),
    get innerHTML() { return ''; },
    set innerHTML(_v) { this._spans = []; },
    querySelectorAll(sel) {
      return sel === '.seg-digit' ? this._spans : [];
    },
    appendChild(el) { this._spans.push(el); }
  };
  const ctx = {
    document: {
      getElementById: function(id) { return id === 'seg-digits' ? mockSd : null; },
      createElement: function() {
        return { className: '', textContent: '', classList: { toggle() {} } };
      }
    },
    currentTask: function() { return { codeType: 'numeric', code: '1015' }; },
    state: { codeInput: '' }
  };
  vm.runInNewContext(renderMatch[0] + '; renderCodeDisplay();', ctx);
  assert('numeric display rebuilds to 4 cells', mockSd._spans.length === 4);
  assert('numeric display clears ghost digits', mockSd._spans.every(function(d) { return d.textContent === '8'; }));
}

console.log('\n══ Game Tasks Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
