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

console.log('\n══ Game Tasks Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
process.exit(0);
