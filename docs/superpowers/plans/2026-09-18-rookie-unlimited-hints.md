# Rookie Unlimited Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rookie players unlimited access to each task's available hints while retaining point deductions.

**Architecture:** Use `hintTokens: -1` as an explicit unlimited sentinel in the existing difficulty and game-state model. Branch only token-cap presentation and accounting; preserve the existing hint-level cap, confirmation, score penalty, telemetry count, and all finite-mode behaviour.

**Tech Stack:** Static HTML/ES5 JavaScript, Node.js regression harnesses, GitHub Pages Actions.

## Global Constraints

- Rookie keeps four hint levels per task and all existing difficulty settings.
- Every revealed Rookie hint retains its existing point deduction.
- Zero tokens continues to mean no hints; undefined tokens never means unlimited.
- No credentials, tokens, certificates, or Splunk license acceptance are added.
- GitHub Pages remains the credential-free static game host.

---

### Task 1: Unlimited Rookie token model

**Files:**
- Modify: `scripts/tests/test_booth_difficulties.js`
- Modify: `game.html`

**Interfaces:**
- Consumes: `DIFFICULTY_PRESETS`, `applyDifficulty()`, `requestHint()`, `render()`
- Produces: `hintTokens: -1` unlimited sentinel with finite-mode compatibility

- [ ] **Step 1: Write failing regression assertions**

Add assertions that Rookie declares `hintTokens: -1`, its selector says
“unlimited hint tokens”, repeated hint reveals do not exhaust the pool, every
reveal increments `hintTokensSpent`, and finite modes still stop at zero.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node scripts/tests/test_booth_difficulties.js
```

Expected: FAIL because Rookie still declares five tokens.

- [ ] **Step 3: Implement the sentinel**

Update the preset, difficulty initialization, hint availability/decrement
logic, announcements, mode copy, and HUD rendering so `-1` means unlimited.
Continue applying `hintPenaltyFor(level)` and incrementing
`state.hintTokensSpent` for every reveal.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node scripts/tests/test_booth_difficulties.js
bash scripts/test.sh
```

Expected: both commands exit 0 with zero failures.

### Task 2: Documentation and Pages release

**Files:**
- Modify: `README.md`
- Modify: `docs/PLAYER_EXPERIENCE.md`
- Modify: `RELEASE_NOTES.md`
- Add: `.github/workflows/pages.yml` if it is not already tracked

**Interfaces:**
- Consumes: tested static `game.html`
- Produces: documented behaviour and deployed GitHub Pages artifact

- [ ] **Step 1: Replace finite-Rookie documentation**

Document Rookie as unlimited while retaining the finite counts for all other
difficulties.

- [ ] **Step 2: Verify static site and repository tests**

Run:

```bash
bash scripts/test.sh
git diff --check
```

Expected: zero test failures and no whitespace errors.

- [ ] **Step 3: Commit and push**

Commit only the Rookie feature, its tests/docs, and the existing Pages workflow
needed for deployment. Do not include unrelated Event Mode or `.gitignore`
worktree changes.

- [ ] **Step 4: Deploy and verify GitHub Pages**

Push the release branch, run the GitHub Pages workflow against the committed
revision (merging/cherry-picking to `main` only if required by the repository's
Pages policy), wait for success, and verify the deployed `game.html` contains
the unlimited Rookie preset.
