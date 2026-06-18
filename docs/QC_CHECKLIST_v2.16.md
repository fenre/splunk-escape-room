# QC Checklist — v2.13.0 → v2.16.0

A structured manual + automated test plan covering everything that shipped during the v2.13–v2.16 release train. Designed to be run end-to-end before tagging v3.0.0, but each section is independent so you can spot-check a single feature in isolation.

**Time budget:** ~15 min for the automated baseline + smoke tests, ~60–90 min for the full manual gameplay walkthrough across difficulties and modes.

---

## Section 0 — Automated baseline (5 min)

Run these first. If any fail, stop and triage before manual testing.

```bash
# 1. Full regression suite — should report 923 / 0 across 11 files.
bash scripts/test.sh

# 2. Per-suite breakdown if anything failed.
for t in scripts/tests/test_*.js; do echo -n "$(basename $t): "; node "$t" 2>&1 | tail -3 | head -1; done

# 3. Lint check on the main artifacts.
node -e "require('fs').readFileSync('game.html','utf8'); console.log('OK', require('fs').statSync('game.html').size, 'bytes')"

# 4. Confirm versions match across surfaces.
grep -E '^version|^build' nakatomi_heist/default/app.conf
grep 'Current version' README.md
grep -E 'v2\.16\.0|build 36' RELEASE_NOTES.md | head -3
```

**Expected:**
- `923 pass, 0 fail across 11 test files`
- `app.conf` shows `version = 2.16.0` and `build = 36`
- README shows `Current version: 2.16.0`
- RELEASE_NOTES top entry is `2.16.0`

---

## Section 1 — v2.13.0 booth bundle (Phase 5a/5b/5c/5d/5e)

### 1.1 Quickfire difficulty (5 min / 2 tasks / 0.25× score)

1. Open `game.html` (or `?difficulty=quickfire` to deep-link).
2. Click `QUICKFIRE · 5 MIN` button — **gold border + glow** should activate.
3. Confirm `diff-info` reads:
   - `5 min · 3 errors · all hints · no hints · 0.25x score · 2-task booth heist`
   - (The "no hints" red text is correct — Quickfire ships with `hintTokens: 0`.)
4. Click `Digital Mode` → boot sequence should be the **fast 2-second variant** (4 lines max, "BOOT FAST PATH"), not the 10-second BIOS scroll.
5. Mission briefing reads "Quick Heist" / "5 minutes" / "Make it count." quote.
6. **Task 1 = Guest List (1.1)** with pre-filled SPL `| stats dc(badge_id) AS unique_guests` shown under the objective.
7. Below the SPL, expand the `<details>` "SAMPLE RESULT — offline fixture" — you should see a 1-row table with `unique_guests: 30` and the dedup teaching note.
8. Solve 1.1 (enter `0047`). Game advances directly to **Task 2 = Shoot the Glass (3.7)** — no Act 2 detour.
9. Click the **power LED** (red dot lower-right of the CRT chrome) → victory.

**Pass criteria:** Total play time ≤ 60s with the fixture pre-shown. Victory overlay fires; if telemetry isn't configured, the feedback widget should still render because Quickfire is a `isBooth` tier.

### 1.2 Booth Heist difficulty (10 min / 3 tasks / 0.5× score)

1. Reset → mode-select.
2. Click `BOOTH HEIST · 10 MIN`.
3. `diff-info` reads `10 min · 5 errors · all hints · 1 hint token total · 0.5x score · 3-task booth heist`.
4. Solve in order:
   - **Task 1.1 Guest List** → `0047`
   - **Task 3.3 Takagi's Refusal** → `4291` (fixture preview shows session VS-0042 events from `nakatomi_vault`)
   - **Task 3.7 Shoot the Glass** → click the power LED
5. Spend the one hint token mid-Task 3.3 — token counter goes red; victory still fires.

**Pass criteria:** Pacing feels right (~5–7 min realistic), fixture previews surface only on the three booth tasks (not on the demo's tasks if you switch).

### 1.3 Kiosk hardening (`?kiosk=1`)

URL: `game.html?kiosk=1`

1. Right-click anywhere on the page → **context menu must NOT appear**.
2. Press F12 → **dev tools must NOT open** (browser blocks it; some browsers may still allow if F12 is bound to other things — that's OK as long as Ctrl+Shift+I is also blocked).
3. Press Ctrl+S → **save dialog must NOT appear**.
4. Press `?` → **shortcuts overlay should still open** (intentional exception).
5. Press `P` → **pause overlay should still open** (gameplay keys remain live).
6. Win or lose a round → wait 90 seconds with no input → **mode-select should auto-restore**, with `kiosk_idle_reset` event queued.
7. Open DevTools (need to detach kiosk first by removing `?kiosk=1`) and run:
   ```js
   Kiosk.isActive(); // should be true under ?kiosk=1
   Kiosk._internals.DEFAULT_IDLE_MS; // 90000
   Kiosk._internals.DEFAULT_WATCHDOG_MS; // 3600000
   ```
8. Override timers: `?kiosk=1&kiosk_idle=120` should set 120s idle (clamped to 30–600s); try `?kiosk_idle=99999` and confirm it's clamped to 600s (10 min cap).

### 1.4 Queue display (`?queue=1`)

URL: `game.html?queue=1`

1. Page should immediately replace the entire UI with a black screen.
2. Center text: `BOOTH OPEN — TAP TO PLAY · 5–10 MIN` (when no telemetry/team configured).
3. `■ LIVE` indicator blinks at the bottom.
4. Confirm the kiosk shortcut guard is **NOT** bound (right-click should work, F12 should open dev tools — queue mode is a passive read-only display, not a locked-down terminal).
5. With telemetry configured + a live team in another tab, status should update to `PLAYER IN SESSION — TEAM <code> · PLEASE WAIT FOR NEXT ROUND` within 5 seconds.

### 1.5 Facilitator tab (`?facilitator=1`)

URL: `game.html?facilitator=1`

1. Page loads normally to mode-select.
2. Click into a game (any difficulty). The `#facilitator` panel should be **already visible** without a PIN prompt.
3. Panel header shows live `TEAM <code>` / `ELAPSED <m:ss>` / `PROGRESS <done>/<total>` — refreshes every 1 second.
4. Click "Reset for Next Visitor" — `facilitator_action` event with `action: "reset"` should be queued; game returns to mode-select.
5. Confirm the PIN prompt **DOES** appear when accessing the facilitator panel WITHOUT `?facilitator=1` (e.g. via the keyboard shortcut on a regular run). PIN is `241288`.

### 1.6 Splunk linkout

In a same-origin proxy deployment, set `window.NakatomiConfig.splunkLinkUrl = 'https://your-splunk.example.com/app/nakatomi_heist/mission_brief'` before loading game.html. Then:

1. Win a round.
2. The "View in Splunk →" button should appear **only** if a valid HTTPS URL is configured.
3. Inspect the anchor: `target="_blank" rel="noopener noreferrer"` must be present.
4. **Negative tests** — these should leave the button hidden:
   - `splunkLinkUrl: 'http://insecure.example.com/'` (HTTP rejected)
   - `splunkLinkUrl: 'javascript:alert(1)'` (scheme rejected)
   - `splunkLinkUrl: 'https://user:pass@host/'` (userinfo rejected)
   - `splunkLinkUrl: 'data:text/html,<script>'` (data URL rejected)
   - `splunkLinkUrl: 'https://...' + 'a'.repeat(600)` (>512 chars rejected)
   - `splunkLinkUrl` containing `\r\n` (CRLF rejected)

### 1.7 1-question feedback widget

1. Win any round (Quickfire is fastest for this test).
2. Below the leaderboard buttons, the feedback panel should appear with `HOW WAS IT?` heading + 5 stars.
3. Click 4 stars → comment input row appears.
4. Type a 200-char comment (it should hard-cap at 120 by `maxlength`).
5. Try typing `<script>alert(1)</script>` — when you submit, the comment should be stored stripped of `<` / `>` / control chars.
6. Click **Submit** → "Thanks — logged." appears, actions hide.
7. Click "Play Again" → win again → confirm widget resets and reopens.
8. Open DevTools and run `NakaTelemetry.debugInfo()` — the queue should contain a `session_feedback` event with the right rating + sanitized comment.

### 1.8 Abandonment tracking

This one's hard to verify live (timer is `timer + 5min`). Easiest check:

1. Open DevTools.
2. Start a Quickfire (5 min) round.
3. Run `console.log(abandonTimer)` → should be a non-null timer ID.
4. Win or lose — confirm `abandonTimer` is `null` after.
5. Start another round and let it sit. After 10 minutes (5 + 5 buffer), `session_abandoned` event should be queued with `exit_act` / `exit_task` / `last_seen_seconds`.

---

## Section 2 — v2.14.0 adaptive audio (Phase 5h)

### 2.1 Bus topology

1. In a fresh DevTools console: `ensureAudio(); console.log(__audioBuses)`.
2. Should see `{ master, ambient, music, sfx }` GainNodes, each with a `.gain.value` in [0, 1].
3. `__audioBuses.master` connected to `audioCtx.destination`; the three layer buses connected to master.

### 2.2 Mix panel

1. Start any round → press **P** → click **AUDIO MIX & CAPTIONS**.
2. Panel slides open with 4 sliders (Master / Music / SFX / Ambient) + 3 checkboxes.
3. Each slider's right-side label updates live as you drag.
4. Toggle SFX to 0 → press a digit on the keypad → no click sound.
5. Toggle Ambient to 0 → low drone hum stops.
6. Toggle Music to 0 → win a round → no Ode to Joy / no victory arpeggio.
7. Re-enable all → close + reopen pause → settings persist (read from `localStorage['nakatomi_audio_settings']`).
8. DevTools: `localStorage.getItem('nakatomi_audio_settings')` returns the JSON. Manually corrupt it to `'not-json'` and reload — defaults restore cleanly, no console errors.

### 2.3 Audio captions

1. Open mix panel → enable **Audio captions**.
2. Trigger any cue (correct code, wrong code, hint reveal, trap, etc.).
3. A small gold band appears top-center with the cue label (`♫ Correct — reward chord` etc.) and fades after ~2 seconds.
4. Confirm the band is also `aria-live="polite"` (DevTools → inspect `#audio-caption-hud`).
5. Try every cue at least once — `boot`, `codeCorrect`, `codeWrong`, `sealOpen`, `trapTriggered`, `actComplete`, `heartbeat`, `vaultOpen`, `victory`, `gameOver`, `hintRevealed`, `intercept`, `powerDown`, `ambient`. (The full list is in `AudioMix._internals.CAPTIONS`.)

### 2.4 Per-act motifs

Play a Booth Heist (3 tasks) but slowly enough to hear each act transition:

1. After Task 1.1 → no act change (single-act booth scenario), so motif might not fire — that's fine.
2. **Better test:** play **Operative** difficulty for ~10 min until you advance from Act 1 → Act 2. The 5-note arpeggio should fire alongside the visual `showActTransition()` overlay.
3. Each act has a distinct motif (Act 1 C major rising / Act 2 C minor / Act 3 A minor / Act 4 G dim / Act 5 C major resolution). They should sound clearly different.

### 2.5 Ode to Joy on default ending

1. Play any difficulty to victory.
2. Force the **default** ending classification by NOT meeting the analyst / cowboy / speedrunner thresholds (i.e. take a moderate amount of time, hit 2-3 wrong codes, find no side stories).
3. Beethoven's "Ode to Joy" (E E F G G F E D C C D E E D D) plays on the music bus, with a sustained C3+G3 fifth underneath.
4. **Negative test:** trigger the `speedrunner` ending (finish in <50% of the timer). Ode to Joy should **NOT** play — only the speedrunner sting.

---

## Section 3 — v2.15.0 quality gate (Q1/Q2/Q5)

### 3.1 Test runner

```bash
bash scripts/test.sh                # human-readable
bash scripts/test.sh --quiet        # only summary line
bash scripts/test.sh --json         # machine-readable
bash scripts/test.sh --json --quiet | jq .   # parsed JSON if you have jq
```

All four modes should work; JSON should be parseable.

### 3.2 GitHub Actions CI

Push a no-op branch, open a PR, and confirm:

- `test` job runs and uploads `test_results.json` artifact.
- `static-checks` job passes the HTML / conf-file syntax checks + scenario regression + secret-scan.
- `package` job is **skipped** (only runs on tags).

Then push a tag `vX.Y.Z` (use a test/throwaway tag) and confirm:

- `package` job runs.
- `dist/nakatomi_heist-vX.Y.Z.spl` artifact uploads.
- `SHA256SUMS` is computed.
- A draft GitHub Release is created with both files attached.

### 3.3 Secret-scan gate

Locally simulate the workflow's secret-scan by adding a fake AWS key to a file and running:

```bash
git grep -E 'AKIA[0-9A-Z]{16}'
```

Should match. Now revert. (The CI step does the same scan with a slightly broader regex set.)

### 3.4 GDPR / DSAR scripts

These need a live Splunk to test end-to-end. For a smoke test without Splunk:

```bash
# Should reject without env vars.
bash scripts/export_sessions.sh --team-code NAKA --output /tmp/x.json
# ERROR: SPLUNK_HOST and SPLUNK_TOKEN env vars must be set

# Should reject filter with disallowed chars.
SPLUNK_HOST=https://x.example.com SPLUNK_TOKEN=fake \
  bash scripts/export_sessions.sh --team-code 'NAKA;rm -rf /' --output /tmp/x.json
# ERROR: filter value contains disallowed characters

# Should reject without --confirm.
SPLUNK_HOST=https://x.example.com SPLUNK_TOKEN=fake \
  bash scripts/purge_sessions.sh --team-code NAKA
# ERROR: pass --confirm yes-i-mean-it

# Should reject with both filters.
SPLUNK_HOST=https://x.example.com SPLUNK_TOKEN=fake \
  bash scripts/purge_sessions.sh --team-code NAKA --session-id S-1 --confirm yes-i-mean-it
# ERROR: pass exactly one of --team-code OR --session-id
```

For the real test, point at a sandbox Splunk with a `nakatomi_dsar` role per `docs/DEPLOY.md` §7.2 and run the export against a known team code.

---

## Section 4 — v2.16.0 scenario packs + i18n (Phase 5f / Q3 / Q4)

### 4.1 Scenario packs — URL flag

| URL | What changes |
| --- | --- |
| `game.html` | Default Christmas-noir (canonical inline) |
| `game.html?scenario=default` | Identical to above (default pack is a no-op overlay) |
| `game.html?scenario=roof` | Helicopter wind ambient hint, rooftop story beats |
| `game.html?scenario=afterparty` | Forensic-debrief reskin |
| `game.html?scenario=evil` | Falls back to default silently — **no** console error, **no** network 404, **no** UI glitch |

For each non-default pack:

1. DevTools → Network: confirm exactly one fetch to `scenarios/<name>.json` (no path traversal, no extra requests).
2. DevTools console: `ScenarioPacks.getActiveId()` returns the pack name; `ScenarioPacks.getStoryBeat('act_1_open')` returns the override string.
3. Confirm screen reader announcement fires (turn on macOS VoiceOver / NVDA: "Scenario loaded: <ambient label>").

### 4.2 Scenario packs — inline injection

```html
<!-- Place ABOVE the <script> tag that defines NakaTelemetry. -->
<script id="nakatomi-scenario" type="application/json">
{
  "$schema_version": 2,
  "$id": "roof",
  "ambient": { "label": "Test inline roof" },
  "story_beats": { "act_1_open": "INLINE OVERRIDE" }
}
</script>
```

With this in the page (and `?scenario=roof` in the URL), the runtime should pick up the inline pack on the **first tick** with no network fetch. Confirm via DevTools Network panel.

### 4.3 Scenario packs — security boundary

Try each of these in the inline block. None should poison the runtime:

```json
// Wrong schema version
{ "$schema_version": 1, "$id": "roof" }
// Unknown $id
{ "$schema_version": 2, "$id": "drop_table_users" }
// Prototype pollution attempts
{ "$schema_version": 2, "$id": "roof",
  "story_beats": { "__proto__": "gotcha", "constructor": "no" } }
// Over-length string
{ "$schema_version": 2, "$id": "roof",
  "story_beats": { "act_1_open": "X (5000 chars)" } }
// Hyphenated / space keys (rejected)
{ "$schema_version": 2, "$id": "roof",
  "story_beats": { "has-dash": "no", "has space": "no" } }
```

For each:
- `ScenarioPacks.getActiveId()` returns `'default'` (validation rejected the pack)
- `ScenarioPacks.getStoryBeat('__proto__')` returns `null` (own-key only)
- DevTools → no console errors

### 4.4 i18n locale switching

| URL | UI language |
| --- | --- |
| `game.html` | English (default DEFAULTS table) |
| `game.html?lang=en` | English (en.json fetched + applied) |
| `game.html?lang=es` | Spanish (es.json fetched + applied) |
| `game.html?lang=de` | English (no de.json shipped → fallback) |
| `game.html?lang=ja` | English (no ja.json shipped → fallback) |
| `game.html?lang=qz` | English (qz not in allow-list → fallback, no fetch) |

For `?lang=es`, currently only the strings inside the DEFAULTS table are translated. Bulk inline strings (mission briefing, story beats, hint text, etc.) remain English — that's the documented v2.16 scope. Confirm:

1. Mode-select title / difficulty buttons / theme picker / "SELECT YOUR MODE" all in Spanish.
2. Pause menu buttons in Spanish.
3. Victory overlay heading + buttons in Spanish.
4. Game-over "Continue?" button in Spanish.
5. **Negative**: in-game story beats stay in English (correct — bulk strings are inline, not yet keyed).

### 4.5 i18n security boundary

```js
// In DevTools, after game loads:
I18n.t('totally.unknown.key')        // returns 'totally.unknown.key' (key itself)
I18n.t('totally.unknown.key', 'fb')  // returns 'fb'
I18n.t('mode_select.title')          // returns the active locale's title
I18n.t('foo bar')                    // rejected key shape → returns 'foo bar' (the key, not a value)
I18n.t('foo<script>')                // rejected key shape → returns the raw string
I18n.t('x'.repeat(200))              // rejected (>80 chars) → returns the raw string
```

---

## Section 5 — Splunk-side verification

### 5.1 Index + retention

```spl
| dbinspect index=nakatomi_sessions
| stats count, max(_time) as latest, min(_time) as earliest
```

Confirm:
- Index exists.
- `frozenTimePeriodInSecs = 7776000` (90 days) is enforced — events older than 90 days should be missing or auto-frozen.

### 5.2 Field extractions for v2.13–v2.16 events

Live a few sessions through the booth bundle, then run:

```spl
index=nakatomi_sessions sourcetype=nakatomi:session:event
| stats count by event_type
```

Confirm new event_types appear with non-zero counts as you exercise them:

| Event type | How to trigger |
| --- | --- |
| `kiosk_activated` | `?kiosk=1` (also `?queue=1` with `mode: queue`) |
| `kiosk_idle_reset` | Wait 90s on victory screen under `?kiosk=1` |
| `kiosk_watchdog_reload` | Wait 1 hour under `?kiosk=1`, OR override with `?kiosk_watchdog=300` and wait 5 min |
| `splunk_fallback` | (reserved — not yet emitted in v2.16) |
| `session_feedback` | Win → submit feedback widget |
| `session_abandoned` | Start a Quickfire → walk away ≥10 min |
| `facilitator_action` | Click any facilitator-tab button |
| `audio_setting_changed` | Open mix panel → drag any slider |

For each, confirm the new `props.conf` `EXTRACT-` rules are pulling the right fields (run `| stats values(*)` per event_type and verify the new fields appear).

### 5.3 Facilitator dashboard *(updated for v2.17)*

Open `nakatomi_heist/default/data/ui/views/facilitator_board.xml` (Dashboard Studio). Confirm:

- Canvas height is `3600` (grew from `2860` in v2.17 to add three v2.13/v2.14 telemetry rows).
- All existing rows still render unchanged: active teams, leaderboard, act funnel, traps, hints, outcome, setup, discoveries (v2.9), Adaptive Hans (v2.10), phone calls (v2.10), investigation board (v2.10), Floor-30 hub (v2.11), ending branches (v2.12).
- **New in v2.17 — Booth Kiosk Operations row** (cyan accent, ~y=2860): Distinct kiosk teams today KPI + Idle reset reasons column chart + Recent kiosk resets/watchdog reloads table.
  - To populate it during QC: open `game.html?kiosk=1`, win/lose a round, wait 90 s for `kiosk_idle_reset` to fire. Override `?kiosk_watchdog=300` (5 min cap floor) to test the watchdog reload path.
- **New in v2.17 — Post-Session Feedback + Abandonment row** (warm yellow, ~y=3110): Avg rating today KPI + 5-star distribution + Abandonment by exit act.
  - To populate: win 3-5 rounds and submit different feedback ratings. Start a Quickfire and walk away ≥10 min for the abandonment beacon.
- **New in v2.17 — Operator Activity row** (purple, ~y=3360): Facilitator clicks today KPI + Facilitator action verb mix + Audio mix tweaks by setting.
  - To populate: click each facilitator-tab button (`Complete <task>` / `End Session` / `Reset for Next Visitor` / power-cut button on Seal 7) and drag each audio-mix slider while in pause.

The v2.17 regression test (`scripts/tests/test_facilitator_dashboard.js`, 61 assertions) catches dropped viz definitions, canvas-height clipping, missing event-type queries, and lost booth-token guards. Run alongside the rest of the suite via `bash scripts/test.sh`.

### 5.4 KV-Store retention recipe

Schedule the saved-search from `docs/DEPLOY.md` §7.1:

```spl
| inputlookup vault_progress
| where _time < relative_time(now(), "-30d@d")
| outputlookup vault_progress
```

Run **without** `outputlookup` first to confirm the row count it would prune. Then schedule it `dispatch.earliest_time = -1d` for nightly pruning.

---

## Section 6 — Cross-cutting safety checks

### 6.1 No secrets in repo

```bash
# Comprehensive scan — should find zero matches.
git grep -nE 'AKIA[0-9A-Z]{16}'
git grep -nE 'sk_live_[0-9a-zA-Z]{24,}'
git grep -nE 'ghp_[0-9a-zA-Z]{36,}'
git grep -nE 'BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY'
```

### 6.2 No URL-param token paths

```bash
# Confirm no code path reads a token from URL query params.
grep -rE "params\.get\('(token|hec|hecToken|secret|api_key|apikey)'\)" game.html nakatomi_heist/
# Should return zero matches.
```

### 6.3 CSP intact

Open `game.html`, search for the meta CSP tag. Confirm:

```html
<meta http-equiv="Content-Security-Policy" content="...">
```

Is present and includes:
- `default-src 'self'`
- `connect-src` allowing telemetry HEC + scenario/i18n fetches
- `script-src 'self' 'nonce-...'` (or equivalent strict policy)
- No `unsafe-inline` for scripts (CSS may have it for dynamic styles — that's documented)

### 6.4 Offline single-file integrity

1. Copy `game.html` to a flash drive (no network, no other files).
2. Open it on an air-gapped machine.
3. Play a full Operative round.
4. Confirm:
   - No console errors about failed fetches.
   - Scenario / i18n / Splunk linkout all gracefully no-op (URL params would still parse but the file:// fetch path short-circuits).
   - Audio works (no asset files needed — synthesis is in-code).
   - Investigation board exports a PNG souvenir.

### 6.5 Reduced motion / accessibility

1. macOS: System Settings → Accessibility → Display → Reduce Motion = on.
2. Reload `game.html`.
3. Confirm:
   - Scanlines disabled.
   - Confetti suppressed on victory.
   - Captions HUD has no fade transition (CSS overrides via `@media (prefers-reduced-motion: reduce)`).
   - Attract loop doesn't auto-cycle (still shows initial panel only).

### 6.6 Color-blind theme

Mode-select → CRT phosphor → click the mono dot. Confirm:

- All status colors gain a non-color signal (icon, pattern, or weight).
- Wrong-code feedback still readable on a white-on-black background.
- Trap codes flash a pattern, not just a color.

### 6.7 Keyboard-only walkthrough

Disconnect mouse. Tab through the whole game from mode-select to victory:

- Every focusable element has a visible focus ring.
- Difficulty radios respond to arrow keys.
- Mode cards activate on Enter/Space.
- Keypad digits respond to number keys.
- Pause/help/leaderboard hotkeys all work.
- Investigation board (B) opens; Tab cycles its inputs.
- Hub overlay (M) opens; arrow keys cycle stations.

---

## Section 7 — Negative tests (things that should NOT work)

| Action | Expected result |
| --- | --- |
| `?difficulty=__proto__` | Falls back to operative; no proto pollution |
| `?scenario=../../../etc/passwd` | Allow-list rejects; falls back to default; no fetch |
| `?lang=' OR 1=1` | Falls back to en; no fetch; key validator blocks |
| `?kiosk_idle=-100` | Clamped to 30s minimum (regex bars sign) |
| `?kiosk_watchdog=99999999` | Clamped to 8h max |
| HEC token in URL: `?token=...` or `?hecToken=...` | Token rejected; warning logged; telemetry stays off |
| Inline scenario block with `<script>` tag inside a story_beat string | Renders escaped (no XSS) |
| Inline i18n block with markup in a value | Renders as text (textContent path) |
| Audio mix slider dragged below 0 / above 100 | Clamped to [0, 1] |
| Feedback comment with 200 chars | Hard-capped at 120 by maxlength + JS slice |
| Feedback comment with `<script>alert(1)</script>` | Stripped of `<` / `>` / control chars before emit |
| Splunk linkout configured as `https://user:pass@host/` | Button stays hidden (userinfo rejected) |

---

## Section 8 — Sign-off

Before tagging a release (whether v2.17.0 or v3.0.0), the following should all be ✓:

- [ ] Section 0 automated baseline: 923 / 0
- [ ] Section 1.1 Quickfire: full 5-min round playable
- [ ] Section 1.2 Booth Heist: full 10-min round playable
- [ ] Section 1.3 Kiosk: shortcuts blocked, idle reset fires
- [ ] Section 1.4 Queue: status flips on team session
- [ ] Section 1.5 Facilitator tab: live header refreshes
- [ ] Section 1.6 Splunk linkout: 6 negative URL types rejected
- [ ] Section 1.7 Feedback: comment sanitized, single-shot guarded
- [ ] Section 1.8 Abandonment: timer arms + cancels correctly
- [ ] Section 2.1 Audio buses: topology correct
- [ ] Section 2.2 Mix panel: 4 sliders + 3 toggles persist
- [ ] Section 2.3 Captions: 14 cues all label correctly
- [ ] Section 2.4 Per-act motifs: 5 distinct arpeggios
- [ ] Section 2.5 Ode to Joy: fires on default ending only
- [ ] Section 3.1 Test runner: all 4 modes work
- [ ] Section 3.2 GitHub CI: 3 jobs run, package on tag only
- [ ] Section 3.3 Secret scan: 0 matches in tree
- [ ] Section 3.4 DSAR scripts: 4 negative paths reject correctly
- [ ] Section 4.1 Scenario URL: 5 paths behave correctly
- [ ] Section 4.2 Inline scenario: zero-fetch path works
- [ ] Section 4.3 Scenario security: 5 attack vectors rejected
- [ ] Section 4.4 i18n switching: en + es load, de/ja fall back
- [ ] Section 4.5 i18n security: malformed keys rejected
- [ ] Section 5.1 Splunk index + retention
- [ ] Section 5.2 New event_types extracted
- [ ] Section 5.4 KV retention recipe scheduled
- [ ] Section 6.1 No secrets in tree
- [ ] Section 6.2 No URL-param token paths
- [ ] Section 6.3 CSP intact
- [ ] Section 6.4 Offline single-file works
- [ ] Section 6.5 Reduced motion respected
- [ ] Section 6.7 Keyboard-only walkthrough
- [ ] Section 7 negative tests: 12 paths all reject as expected

When all boxes are ticked AND you give explicit go-ahead, the v3.0.0 capstone work can begin (rewritten README, consolidated `RELEASE_NOTES.md` "v3.0 highlights", `docs/UPGRADING_TO_3.md` migration notes, curated `scenario_v3_showcase.json` demo, optional trailer/screenshot tour, final AppInspect pass). Until then, the project is fully tested at v2.16.0.
