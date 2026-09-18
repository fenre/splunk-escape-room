#!/usr/bin/env node
/* Regression coverage for Rookie's unlimited hint pool. */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game.html'), 'utf8');

function extract(marker, ending) {
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('marker not found: ' + marker);
  const end = html.indexOf(ending, start);
  if (end < 0) throw new Error('ending not found: ' + ending);
  return html.substring(start, end) + ending;
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) passed++;
  else {
    failed++;
    failures.push(label);
  }
}

function assertEq(label, actual, expected) {
  assert(label + ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected),
    actual === expected);
}

const task = { id: '1.1', hints: ['first', 'second', 'third', 'answer'] };
const telemetry = [];
const announcements = [];
const ctx = {
  console,
  HINTS_ENABLED: true,
  SCORING_ENABLED: true,
  MAX_HINT_LEVELS: 4,
  state: {
    gameState: 'playing',
    actIdx: 0,
    hintsUsed: {},
    hintTokensInitial: -1,
    hintTokensRemaining: -1,
    hintTokensSpent: 0,
    hintConfirmPending: false,
    score: 1000
  },
  currentTask: () => task,
  hintPenaltyFor: (level) => [0, 50, 150, 400][level] || 0,
  showHintConfirm: () => { throw new Error('confirmation should be pre-approved by test'); },
  showScoreDelta: () => {},
  NakaTelemetry: { emit: (name, payload) => telemetry.push({ name, payload }) },
  HansAntagonist: { noteActivity: () => {}, trigger: () => {} },
  ensureAudio: () => {},
  playHintReveal: () => {},
  a11yAnnounce: (message) => announcements.push(message),
  flashHintTokenChip: () => {},
  renderHints: () => {},
  render: () => {}
};
vm.createContext(ctx);
vm.runInContext(extract('function requestHint() {', '\n}'), ctx);

for (let i = 0; i < 4; i++) {
  ctx.state.hintConfirmPending = true;
  ctx.requestHint();
}

assertEq('all four Rookie hints can be revealed', ctx.state.hintsUsed['1.1'], 4);
assertEq('unlimited pool remains sentinel after spending', ctx.state.hintTokensRemaining, -1);
assertEq('usage count increments for every reveal', ctx.state.hintTokensSpent, 4);
assertEq('existing point deductions still apply', ctx.state.score, 400);
assert('announcement describes unlimited availability',
  announcements.some((message) => message.indexOf('Unlimited hint tokens') >= 0));
assertEq('token-spend telemetry still emits per reveal',
  telemetry.filter((event) => event.name === 'hint_token_spent').length, 4);

ctx.state.hintsUsed = {};
ctx.state.hintTokensInitial = 1;
ctx.state.hintTokensRemaining = 1;
ctx.state.hintTokensSpent = 0;
ctx.state.score = 1000;
ctx.state.hintConfirmPending = true;
ctx.requestHint();
ctx.state.hintConfirmPending = true;
ctx.requestHint();

assertEq('finite pool still allows its first hint', ctx.state.hintsUsed['1.1'], 1);
assertEq('finite pool still exhausts at zero', ctx.state.hintTokensRemaining, 0);
assertEq('blocked finite reveal does not increment usage', ctx.state.hintTokensSpent, 1);

const diffInfo = { innerHTML: '' };
const selectorCtx = {
  selectedDifficulty: 'operative',
  document: {
    querySelectorAll: () => [],
    getElementById: (id) => id === 'diff-info' ? diffInfo : null
  }
};
vm.createContext(selectorCtx);
vm.runInContext(
  extract('var DIFFICULTY_PRESETS = {', '\n};') + '\n' +
  extract('function setDifficulty(diff) {', '\n}'),
  selectorCtx
);
selectorCtx.setDifficulty('rookie');
assert('Rookie selector says unlimited hint tokens',
  diffInfo.innerHTML.indexOf('unlimited hint tokens') >= 0);

console.log('\n══ Rookie Unlimited Hints Test Summary ══');
console.log(`${passed} pass, ${failed} fail`);
if (failed) {
  failures.forEach((failure) => console.log('  ✗ ' + failure));
  process.exit(1);
}
