# Release Notes — Nakatomi Plaza: Vault Heist

Versioning follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**.

- **MAJOR** — fundamental redesign or breaking changes to game mechanics, data schemas, or physical model interface.
- **MINOR** — new features, documents, or generator capabilities that don't break existing setups.
- **PATCH** — bug fixes, typo corrections, tuning adjustments.

---

## 2.9.0 — 2026-04-18

**Theme: NPC population and data realism (Phase 6a).** The data generator now produces ~47k events (up from ~830), turning the previously hand-curated dataset into a realistic corporate environment. A roster of 60 named NPCs with five distinct work patterns (day shift, late engineers, cleaning crew, security rotation, vendors) emits a full week of pre-heist badge-swipe baseline traffic. Players now investigate haystacks, not hand-picked needles.

This release implements **Phase 6a** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md) ("Background population — NPCs and realistic data volume"). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — NPC baseline population

- **60 named NPCs** in `scenario.yaml` across five work-pattern groups:
  - `day_shift` (32 people) — 9am–6pm office workers across Finance, Intl Trade, Legal, HR, Sales, Marketing, Admin
  - `late_engineers` (10 people) — R&D/IT staying late on the Y2K migration project
  - `cleaning_crew` (6 people) — 10pm–2am floor-by-floor sweeps
  - `security_rotation` (8 people) — 24/7 in 8-hour shifts
  - `vendors` (4 people) — sporadic loading-dock visits (catering, delivery, IT, HVAC)
- **`generate_npc_baseline_events()`** in `generate.py` — emits ~46k badge-swipe events across Dec 17–24, creating a realistic corporate rhythm visible in SPL queries.
- **Paired door events** — Every NPC badge swipe also emits a door-open event (`npc_emit_paired_door_event: true`) for double the access-event volume without adding new identities.
- **All NPCs registered** in `employee_directory.csv` with status `active`, proper departments, and clearance levels — `lookup employee_directory badge_id` resolves for every NPC.

### Added — Christmas-party guest crowd

- **47 dedicated party guests** (`GUEST-001` through `GUEST-047`) badge in during the 20:00–22:00 party window, ensuring floor 30 is unambiguously the busiest floor by `dc(badge_id)` for Seal 2 ("Hostage Floor"). Previously, floor 30 was only marginally busier than other floors, making the puzzle fragile.
- Guest roster is registered in `employee_directory.csv` as visitors with `LEVEL-1` clearance.
- Party-guest generation runs in **both full and booth modes** so Seal 2 is solvable everywhere.

### Added — Puzzle data (4.1, 4.2, 4.4)

- **Puzzle 4.1 (The Fire Alarm)** — Dedicated `alarm_trigger` events: 3 false-pull alarms on trap-code floors (24/26/30) during the party, plus McClane's pull on floor 25 at 23:38 as the canonical latest alarm. Random post-FBI noise no longer uses `alarm_trigger` event type.
- **Puzzle 4.2 (The C4)** — 4 distinct HVAC roof readings above 95°F (the 4 C4 charge heat signatures) plus 2 lukewarm anomalies (87°F/89°F) as red herrings, matching the objective text "6 HVAC anomalies but not all are C4."
- **Puzzle 4.4 (The Detonators)** — 5 `detonator_inventory` vault-system events tracking the count from 12 → 9 (3 stolen by McClane), with verify, spot-check, alert, reconcile, and final-audit entries.

### Added — Booth mode

- **`--booth-mode` flag** on `generate.py` — skips the entire NPC baseline, producing only ~750 critical-path events. Conference demos stay fast; all puzzles still resolve correctly.

### Changed — Puzzle queries

- **Discovery 1.1 (Guest List)** — SPL updated from `action=swipe | stats dc(badge_id)` to `action=swipe detail="*party*" | stats dc(badge_id)` so the party-guest headcount (47) is accurate against the larger NPC-populated dataset. Hints updated accordingly.
- **Seal 2 red herring** — "Christmas party catering delivery confirmed" renamed to "catering delivery confirmed for Conference Room A" so it doesn't match the `detail="*party*"` filter.

### Fixed

- **Discovery 1.2 (Find Takagi)** — Joseph Takagi (`JT-0001`) was being randomly selected in the 18:00–22:00 badge-event pool and the post-takeover sweep, giving him extraneous swipes that broke `| sort -_time | head 1`. Takagi is now excluded from both random pools so his last event is the canonical floor-30 conference-room swipe.
- **Post-FBI security noise** — Replaced random `alarm_trigger` events in post-FBI background noise with `intrusion_alert` / `motion_anomaly` to avoid interfering with puzzle 4.1's `| sort -_time | head 1`.

### Verification

- **13/13 generator-dependent puzzles pass** across seeds 19881215, 42, 1337, 999 in both full and booth modes.
- **12 static-data puzzles** (comms logs, camera coverage, vehicle registry, bearer bonds) verified present in bundled `.log`/`.csv` files.

### Security notes

- No new HEC token paths. NPC data follows the same sourcetype/index schema.
- Badge IDs use well-defined prefixes (`NP-`, `ENG-`, `CLN-`, `SE-`, `VND-`, `GUEST-`) for easy isolation from heist principals.

---

## 2.6.0 — 2026-04-18

**Theme: hint-token economy + Iron Man mode.** Replaces the previous "unlimited hints, just take the score penalty" model with a finite, scenario-wide token pool. Adds a brand-new top-tier difficulty (Iron Man — zero hints, 50 minutes, 3 errors max), a Pacifist Run achievement for completing the campaign without spending a single token, an Iron Man achievement for surviving the no-hints gauntlet, and end-to-end telemetry for both the per-spend events and the post-game roll-up.

This release implements the **Phase 4 hint-economy** task from the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Hint-token economy

- **Per-difficulty starting count** declared in `DIFFICULTY_PRESETS` so the rule stays in one place:
  - `rookie`: 5 tokens (forgiving, room to learn)
  - `operative`: 3 tokens (default — encourages thinking before asking)
  - `mastermind`: 1 token (matches the existing 1-hint-level cap; spend it well)
  - `iron_man`: **0 tokens** (no hints at all — Pacifist Run is the only outcome)
  - `demo`: 5 tokens (booth visitors should never feel locked out)
- **Token spend gate** — `requestHint()` now checks `state.hintTokensRemaining` before revealing a hint level. If depleted, the button shows **NO TOKENS LEFT**, the HUD chip flashes red, and the screen reader announces "No hint tokens remaining."
- **HUD token chip** (`#hint-tokens`) renders `TOK: 2/3` next to the existing `HINTS:` counter. Goes red when depleted, flashes on every spend, and uses a distinct boxed-red `iron-man` style when the game is configured with 0 starting tokens.
- **Confirmation copy** — Hint button now reads `HINT 2/3 (-150 pts) · 1 TOKEN (H)` so the dual cost (score penalty + token spend) is visible at the point of decision, not buried in the HUD.
- **Reduced-motion friendly flashes** — `flashHintTokenChip()` uses CSS animations with `prefers-reduced-motion` fallbacks (border colour change instead of transform).
- **Post-game breakdown** — Victory overlay surfaces `Hint tokens spent: 2 / 3 (1 unused)` (or `0 / 3 — Pacifist Run` when nothing was spent). Tokens render in neutral text since the cost is on a separate axis from the score.

### Added — Iron Man difficulty

- **New top-tier preset** `iron_man`: 50-minute timer, 3 errors max, 0 hint tokens, 0 hint levels, all trap codes armed, 3× score multiplier. Every parameter is calibrated to be the most difficult tier without becoming arbitrary.
- **Broken-out button** in the mode-select screen, in the same row as the Quick Demo button so booth visitors don't pick it by accident. Red/danger styling matches the trap-codes warning visual language.
- **Hint UI suppression** — When `MAX_HINT_LEVELS === 0` and the starting tokens are 0, the hint button is hidden entirely; the chip stays visible (showing `0/0`) so the player can tell they're in no-hints mode.
- **`Yippee-ki-yay` achievement** — Now also fires on `iron_man` (previously mastermind-only).
- **`Iron Man` achievement** (🧍) — Dedicated marker for completing the no-hints gauntlet. Surfaces alongside Pacifist Run (which iron-man players also automatically earn).

### Added — Achievements

- **`Pacifist Run`** (🕊️) — Awarded when `state.hintTokensSpent === 0` at the victory trigger. Functionally identical to "No Hints" today, but tracked separately so future content (e.g., free lore reveals in branching storylines, v2.10+) can decouple "hint shown" from "token spent" without migrating save data.
- **`Iron Man`** (🧍) — Awarded for any iron-man completion. Lets the leaderboard distinguish "they survived the no-hint, 50-min, 3-error gauntlet" from a routine mastermind clear.

### Added — Telemetry

- **`hint_token_spent`** event — Emitted on every successful hint reveal. Payload: `act`, `task_id`, `hint_level`, `tokens_remaining`, `tokens_initial`. Lets the facilitator dashboard chart spending velocity per team.
- **`pacifist_run_completed`** event — Emitted on victory when `hintTokensSpent === 0`. Distinct from `session_end` so the dashboard can simply count distinct emitters without filtering a complex predicate.
- **`session_end` token roll-up** — Now includes `hint_tokens_initial`, `hint_tokens_spent`, `hint_tokens_remaining` so the facilitator board can plot "spent / starting" alongside hints + errors without a separate query.
- **Allow-list updated** — `EVENT_TYPES` in `NakaTelemetry` now whitelists `hint_token_spent` and `pacifist_run_completed`. Per security policy, no event type is accepted unless explicitly allowed.

### Added — Field extractions (`props.conf`)

- `hint_tokens_initial`, `hint_tokens_spent`, `hint_tokens_remaining` (session_end roll-up).
- `tokens_initial`, `tokens_remaining` (per-event hint_token_spent payload).
- All anchored on the JSON key so missing values don't pollute extracted fields, matching the existing v2.4 schema discipline.

### Changed

- Hint button label format extended from `HINT 2/3 (-150 pts) (H)` → `HINT 2/3 (-150 pts) · 1 TOKEN (H)` so the dual cost is visible.
- Hint button now has three terminal states (was two): `ALL HINTS REVEALED` (per-task limit), `NO TOKENS LEFT` (global pool exhausted), and the normal active state. CSS distinguishes the two disabled states so colour-blind players can tell them apart.
- Difficulty info text on the mode-select screen now communicates **both** the per-task hint ceiling **and** the scenario-wide token pool, with grammatical singular/plural agreement (`1 hint token total` vs `5 hint tokens total`) and a red `no hints` callout for iron-man.
- `applyDifficulty()` now syncs `state.hintTokensInitial` / `state.hintTokensRemaining` / `state.hintTokensSpent` from the chosen preset whenever the game is in `select` or `briefing` state. Mid-game re-calls (e.g. dev tools) intentionally do **not** restore tokens already spent.

### Security notes

- No new HEC token paths added; existing same-origin / postMessage / inline-config model continues to govern. The new event types travel over the same authenticated channel.
- Token-economy state lives in `state.*` (in-memory) and `localStorage` for resume; never transmitted in URL parameters or logged.

### Documentation

- This `RELEASE_NOTES.md` entry consolidates the v2.6 changelog.
- `README.md` version badge bumped to 2.6.0; "Features" section gains a `Hint-token economy *(new in 2.6)*` block.
- `docs/PLAYER_EXPERIENCE.md` gains a **§8 Hint-Token Economy** section documenting the per-difficulty starting counts, the spend ritual, the Pacifist Run / Iron Man achievements, and the on-screen UI.
- `index.html` overview page bumped to 2.6.0 with a v2.6 entry in the embedded release-notes overlay.

---

## 2.4.0 — 2026-04-18

**Theme: live multi-team booth play.** Turns the previously-offline single-player demo into a facilitator-friendly conference experience. Telemetry, a live facilitator dashboard, per-team handoffs with QR codes, full responsive/accessibility passes, a 15-minute "Quick Demo" mode, an attract loop for unattended kiosks, and a same-machine spectator second-screen view all ship in this minor bump. The game stays fully playable offline — every new capability degrades gracefully.

This release implements Phases 1–5 of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Live session telemetry (Phase 1)

- **Opt-in HEC posting** — New `NakaTelemetry` module in `game.html` emits `session_start`, `act_start`, `task_complete`, `task_fail`, `hint_used`, `trap_hit`, `pause`, `resume`, `session_end`, `achievement`, `heartbeat`, `session_feedback`, `audio_setting_changed`, and `branch_chosen` events. Strictly allowlisted event types; no free-form payload acceptance.
- **Offline-first event queue** — Capped at 500 events in `localStorage` with oldest-first eviction. Drains on `online`/`focus`/`pagehide` events. Game never blocks on telemetry.
- **New index** `nakatomi_sessions` with 90-day retention (`frozenTimePeriodInSecs = 7776000`). Defined in `indexes.conf`.
- **New sourcetype** `nakatomi:session:event` with `KV_MODE=json` plus explicit `EXTRACT-` rules for every telemetry field, ensuring reliable extraction in Splunk Cloud.
- **KV Store extension** — `vault_progress` schema gains `team_code`, `booth_id`, `scenario`, `mode`, `completed_tasks`, `total_tasks`, `last_task_id`, `reason`, `started_at`, `finished_at`, and `ts` fields. Existing fields preserved for backward compatibility with `progress_tracker.xml`.
- **Same-origin / proxy security model** — HEC tokens are **never** accepted via URL params (would land in browser history, Referer headers, access logs). Tokens come from one of: an inline `<script id="nakatomi-config" type="application/json">` block injected server-side behind auth, a same-origin `GET /config` endpoint behind SSO, or `postMessage` from a trusted parent. Documented in new `docs/DEPLOY.md` with an nginx reverse-proxy example.
- **Input sanitization** — `team_name`, `team_code`, `booth_id`, and `scenario` validated against narrow allow-lists (`safeId`, `safeText`) before transmission. CR/LF stripped, length-bounded.
- **No tokens in logs** — `debugInfo()` and the telemetry status line never expose the HEC token.

### Added — Facilitator dashboard (Phase 2)

- **New view** `facilitator_board.xml` — Dashboard Studio at 1920×1080 for booth TVs. Panels: active teams, live leaderboard, per-act funnel chart, trap-hit log, hint-usage distribution, recent session-end incidents, KPIs (active / completed / failed sessions, avg win time).
- **Per-booth filtering** — Optional `booth_token` input scopes every panel to a single conference booth without requiring per-event index changes.
- **Drilldown** — Click a team → modal with per-task timeline from `vault_progress`.
- **Navigation** — `default.xml` updated with the new view.
- **Live narrative alerts** — The three existing `savedsearches.conf` alerts (Unauthorized Access Pattern, Encrypted Radio Intercept, HVAC Anomaly) are now **scheduled** (`is_scheduled = 1`, `enableSched = 1`, cron every 5 min, suppressed for 1h after firing) so booth visitors see narrative clues fire live.

### Added — Multi-team session UI (Phase 3)

- **Team-code generator** — 4-character codes from an unambiguous alphabet (excludes `O/0/I/1/L`). Persisted per tab, displayed in HUD top-corner throughout the game, regenerable from the mode-select screen.
- **Handoff URL + QR code** — New "QR" button on mode-select opens a modal with a shareable URL (`?team=NAKA&booth=…&scenario=…`) and a generated QR code for booth visitors to scan and join their session on any device. Print-friendly CSS for paper handouts.
- **Inline QR encoder** — New `NakaQR` module: a hand-authored QR Code v1–v5 byte-mode encoder with EC level L. Includes Galois Field GF(256) arithmetic, Reed-Solomon encoding, BCH format-info encoding, zigzag data placement, finder/timing/alignment patterns, and 8-mask penalty evaluation. **Self-contained** — no external dependencies, no SRI exposure, no supply-chain surface.
- **Spoiler resistance** — Per-session seed rotation so yesterday's posted spoilers don't unlock today's puzzles.

### Added — Mobile, tablet, and accessibility (Phase 4)

#### Responsive

- **Phone breakpoints** at `≤480px` (small phone) and `≤768px` (tablet); `(pointer: coarse)` media query for touch devices.
- **Touch targets** — Keypad buttons and primary controls scale to ≥48×48 px per WCAG 2.2 AA.
- **Orientation prompt** — Small landscape-on-phone overlay nudges players to portrait, dismissible per session.

#### Accessibility (WCAG 2.2 AA target)

- **`prefers-reduced-motion`** — Disables decorative scanlines, VHS tracking lines, screen shake, and animated game-over fades. Static fallbacks preserve legibility.
- **High-contrast color-blind theme** — New monochrome white-phosphor CRT theme alongside green/amber/blue. Adds pattern-plus-color (not color alone) status indication.
- **`aria-live` regions** — Two hidden regions (`#a11y-status` polite, `#a11y-alerts` assertive) wired into trap codes, correct codes, task completion, hints revealed, victory, game over, and timer milestones (10/5/1 min remaining, 30 s).
- **Visible focus ring** — Restored `:focus-visible` (2 px solid `#ffd700`, 2 px offset) across the entire UI; the CRT styling no longer hides keyboard focus.
- **Keyboard-navigable custom controls** — Theme dots converted from `<div>` to `<button role="radio" aria-checked>`; mode-select cards gain `role="button" tabindex="0"` and Enter/Space handlers; difficulty selector becomes a proper `radiogroup` with `aria-checked` synced via JS.
- **Screen-reader friendly HUD labels** — Score / hints / timer / mistakes / mute regions get `role="region" aria-label`; keypad `CLR` and `ENT` buttons get `aria-label="Clear input"` / `"Enter code"`; decorative VHS/VCR overlays get `aria-hidden="true"`.

### Added — Conference / booth / kiosk (Phase 5)

- **Quick Demo difficulty** — New 15-minute, 3-task booth mode (Tasks 1.1, 2.1, 5.4 — Guest List → Cut Communications → The Ambulance). 5 errors allowed, all 4 hint levels available. Activates from a dedicated "QUICK DEMO · 15 MIN" button on the mode-select screen, or via `?demo=1` / `?difficulty=demo` URL params for direct-link kiosk launch. Selecting demo dynamically synthesizes a single-act `ACTS` array; standard difficulties restore the full campaign.
- **Attract loop** — When the mode-select screen is idle for 60 s with telemetry configured (or `?attract=1`), an overlay cycles teasers and the local leaderboard every 6 s. Honors `prefers-reduced-motion`. Any input dismisses immediately.
- **Spectator URL** — New `?spectator=1` (alias `?spectate=1`) read-only second-screen view. Hides the entire game and shows a giant timer, current task, score, mistakes, and a progress bar — perfect for a public-facing monitor next to the player. Updates via the standard `storage` event from the player's tab on the same machine; no network required, no auth surface.
  - **Spectator handoff** — A new "SPECTATOR" button in the QR handoff modal opens a spectator tab with one click, preserving team / booth / scenario branding.
  - **Privacy by design** — Spectator snapshots include only public progress (timer, score, completed tasks, current task name) — no SPL queries, no codes, no answers.

### Added — Documentation

- **`docs/DEPLOY.md`** — New deployment guide covering the security model, recommended same-origin reverse-proxy pattern (with a working nginx example), direct-HEC fallback (and why it's not recommended outside of dev), KV Store writes, safe URL parameters, data retention, and verification steps.

### Changed

- **`game.html`** version bumped to 2.4.0 across header, boot sequence, footer, and mode-select.
- **`app.conf`** — `version = 2.4.0`, `build = 24`. Description updated to reflect live telemetry, multi-team codes, and the facilitator board.
- **`transforms.conf`** — `vault_progress_lookup` extended with the new KV Store fields.
- **`indexes.conf`** — Added `nakatomi_sessions`.
- **`props.conf`** — Added `[nakatomi:session:event]` stanza with explicit field extraction.
- **`savedsearches.conf`** — Three narrative alerts flipped to scheduled with conservative throttling.
- **`default.xml`** (nav) — Adds the facilitator board view.

### Security

- HEC tokens are confined to the same-origin trust boundary — never URL-bound, never logged.
- All player-supplied identifiers (`team_name`, `team_code`, `booth_id`, `scenario`) pass through narrow allow-list validation before storage or transmission.
- Spectator broadcast carries only public state; the storage key is dedicated and the schema is fixed.
- The vendored QR encoder is hand-authored and inline — no third-party JS supply-chain surface introduced for this release.

### Migration notes

- **No breaking changes.** The full v2.3.x feature set is preserved. Telemetry is opt-in and disabled by default; the game continues to play fully offline with no Splunk connection if HEC isn't configured.
- New `nakatomi_sessions` index must be created (or let the app installation create it automatically) before telemetry will land.
- Booth operators wanting the facilitator board should follow `docs/DEPLOY.md` to set up the recommended same-origin reverse-proxy pattern.

---

## 2.3.0 — 2026-04-15

### Added — Game (game.html)
- **Pause system** — Press P to pause; timer freezes, task content hidden, resume overlay displayed.
- **Keyboard shortcuts help** — Press ? or click [?] button in header for full keyboard shortcut reference.
- **Per-task timing** — Each task's solve time is tracked individually; feeds into post-game stats.
- **Detailed post-game statistics** — Expandable table on victory screen showing per-task time, hints used, wrong codes, and points earned. Highlights fastest/slowest tasks with color coding.
- **Screen shake** — CRT bezel shakes on wrong code and trap code entry for tactile feedback.
- **Victory confetti** — Canvas-based confetti particle animation on heist completion.
- **Typewriter effect** — Story beat text now types character by character with click/key to skip.
- **CRT phosphor theme picker** — Choose green, amber, or blue CRT colors on mode select screen. Persisted in localStorage.
- **Local leaderboard** — Top 10 scores with arcade-style 3-character initials. Accessible from mode select and victory screen. Stored in localStorage.
- **Shareable results** — "Copy Results" button generates formatted text summary to clipboard (difficulty, time, score, achievements).
- **Text code answer format** — Tasks 2.1 (Cut Communications → EXT7700) and 5.1 (The Ambulance → AMB2819) now accept alphanumeric text input. Keypad expands with letter buttons for these tasks.
- **Multi-step composite task** — Task 3.6 (The Bearer Bonds) converted to 2-step puzzle: verify clearance level first, then enter vault auth code.
- **Red herring enrichment** — Misdirection text added to 5 task descriptions (1.1, 2.3, 3.5, 4.2, 5.3) to increase difficulty.
- **Cosmetic decision points** — 4 binary narrative choices appear between acts (stored in dossier, no gameplay impact).
- **Dynamic nudge system** — Hint button glows after extended time on a task (5 min Rookie, 8 min Operative). Auto-reveals first hint for Rookie after 12 min.

### Added — Splunk App (nakatomi_heist)
- **Guided Investigation dashboard** — New Dashboard Studio view with act-by-act data sources, suggested SPL queries, and tips for each task.
- **Progress Tracker dashboard** — New Dashboard Studio view backed by KV Store collection (`vault_progress`) for session monitoring, per-act completion charts, and recent task completions.
- **Alert-based puzzle integration** — 3 saved searches in `savedsearches.conf` with embedded clues: unauthorized access patterns, encrypted radio intercepts, and HVAC anomaly analysis.
- `collections.conf` — KV Store collection definition for `vault_progress`.
- `transforms.conf` — Added `vault_progress_lookup` external lookup definition.
- `default.xml` — Navigation updated with Guided Investigation and Progress Tracker views.

### Changed
- Version bumped to 2.3.0 across game header, boot sequence, footer, and `app.conf`.

---

## 2.0.0 — 2026-03-26

### Added — Game (game.html)
- **Five-act structure** — Expanded from 7 seals to 26 tasks across 5 acts (The Christmas Party, The Takeover, The Vault, McClane's Counterattack, The Escape).
- **Difficulty presets** — Rookie (120 min, 10 errors, all hints, 0.5x), Operative (90 min, 7 errors, 3 hints, 1x), Mastermind (60 min, 4 errors, 1 hint, 2x).
- **Scoring system** — Base points + speed bonuses + hint/error penalties per task, with difficulty multiplier.
- **Trap codes** — Specific wrong codes that trigger penalties (Operative: +2 errors, Mastermind: instant game over).
- **Hint system** — Tiered hints per task with escalating score penalties; 4th hint reveals answer at 0 points.
- **Dossier** — Collected intel panel (D key) showing completed task story beats with score breakdowns.
- **Multi-cipher toolkit** — ROT13, Hex-to-ASCII, Base64, Binary, Number-to-Letter decode tools.
- **Radio intercepts** — Timed story messages during gameplay, proportionally scaled to difficulty timer.
- **McClane interference events** — Random amber-tinted warnings after Act 2.
- **Act transition cinematics** — Full-screen overlays with ASCII art, act titles, and quotes.
- **Character dialogue** — Speaker attribution (Hans, Karl, Theo) for all task story beats.
- **Seeded randomization** — URL `?seed=N` parameter randomizes codes for replayable sessions.
- **Achievements** — 6 badges awarded for specific accomplishments (No Hints, Speed Demon, Perfect Score, etc.).
- **Bonus objectives** — Post-victory challenges (Die Hard trivia, Easter egg hunt, speed run).
- **Physical mode parity** — Objective display, hints, and control buttons in physical vault mode.
- **Roof deadline** — Secondary fail condition if Act 4 isn't reached in time.
- **Boot sequence** — BIOS-style startup with progress bar, hardware detection, and game configuration display.
- **Retro CRT effects** — Scanlines, film grain, VHS tracking line, VCR HUD, monitor housing, glare.
- **Web Audio API** — Synthesized sounds for keypress, correct/wrong, seal open, hints, traps, heartbeat, victory, game over, ambient drone.
- **Facilitator PIN gate** — PIN-protected facilitator panel (F key → enter PIN to unlock).

### Added — Splunk App (nakatomi_heist)
- **8 dashboards** — Terminal (React), Mission Brief, Search Terminal, Access Terminal, Vault Terminal, Building Systems, Comms Terminal.
- **4 indexes** — `nakatomi_access`, `nakatomi_vault`, `nakatomi_building`, `nakatomi_comms`.
- **7 lookup tables** — employee_directory, floor_directory, system_codes, radio_channels, camera_coverage, bearer_bonds, vehicle_registry.
- **React terminal** — Custom terminal page built with @splunk/create and @splunk/react-ui.

### Changed
- Complete game rewrite from 7-seal linear structure to 5-act, 26-task branching narrative.

---

## 1.0.0 — 2026-03-25

### Added
- **First playable release** — Complete game loop from boot to victory/game over.
- **Standalone game** — `game.html` works entirely self-contained with no server dependencies.
- **7-seal structure** — Original linear puzzle progression through 7 vault seals.
- **Dual mode** — Physical vault display and digital keypad modes.
- **Sound effects** — Web Audio API synthesized tones for all game events.
- **60-minute timer** — Countdown with heartbeat warning in final 5 minutes.
- **3 wrong code limit** — Game over after 3 incorrect entries.
- **Power-cut Seal 7** — Lateral thinking puzzle (click power LED, not enter a code).
- **Facilitator controls** — F key to manually complete any seal.
- **Packaged Splunk app** — `nakatomi_heist.spl` for one-click install.

---

## 0.7.0 — 2026-03-25

### Added
- **Live deployment** — Nakatomi Heist app deployed to distributed Splunk environment (search head `rev` + indexer `mink`, both Splunk 10.2.0).
  - 3 indexes created on both search head and indexer.
  - 7 sourcetype definitions configured via REST API.
  - 3 lookup table definitions and CSV data populated via SPL (`outputlookup`).
  - Mission Brief dashboard deployed via REST API.
  - HEC token (`nakatomi_heist`) created; 833 events loaded and verified across all 6 sourcetypes.
- **Splunk environment rule** — `.cursor/rules/splunk-environment.mdc` documenting distributed topology, IPs, roles, authentication tokens, and operational notes for future sessions.

### Changed
- `index.html` — added "Deployed & Playable" hero badge, new "Splunk Environment" architecture box showing live distributed deployment, new "Deployment" roadmap card (complete), updated Splunk App tag from "Ready" to "Deployed" with per-index event counts.
- `secrets.env` — added `SPLUNK_MINK_TOKEN` for indexer REST API access alongside existing `SPLUNK_REST_TOKEN` for search head.

---

## 0.6.0 — 2026-03-25

### Added
- **Splunk app** — `nakatomi_heist/` ready-to-install Splunk app containing:
  - `indexes.conf` — three indexes: `nakatomi_access`, `nakatomi_vault`, `nakatomi_building`.
  - `props.conf` — 7 sourcetype definitions with `KV_MODE=auto` and proper timestamp parsing.
  - `transforms.conf` — 3 lookup table definitions (`floor_directory`, `employee_directory`, `system_codes`).
  - `lookups/` — pre-loaded CSV lookup tables generated from `scenario.yaml`.
  - **Mission Brief dashboard** — Dashboard Studio (JSON, dark theme) with mission briefing, vault status panel, available data tables, SPL quick reference, and atmospheric footer.
  - `metadata/default.meta` — app permissions with system-level export.
  - `default/data/ui/nav/default.xml` — app navigation with Mission Brief as default view.
- **Packaged app** — `nakatomi_heist.spl` for one-click install via Splunk Web.
- **Data loading script** — `scripts/load_data.sh` sends generated HEC-format events to Splunk via HTTP Event Collector.

### Changed
- `README.md` — replaced "Quick Start" section with full install-and-play instructions (generate, install app, load data, verify). Added Splunk app to repository structure and tech stack. Moved Splunk app from "Planned" to "Complete".
- `RELEASE_NOTES.md` — this entry.

---

## 0.5.0 — 2026-03-25

### Added
- **Dual-mode game UI** — `game.html`, a standalone HTML/CSS/JS game interface (no external dependencies) supporting two play modes:
  - **Physical mode**: timer and seal status display for use alongside the hardware vault. Facilitator controls (F key) to manually advance seals.
  - **Digital mode**: on-screen keypad (mouse + keyboard), code validation, animated clue card reveals, 60-minute countdown, wrong-code tracking (3 = game over), and game-over/victory overlays with Web Audio API sound effects.
- **7 styled digital clue cards** — each seal's compartment reward rendered as a themed card: aged blueprint (Seal 1), dot-matrix printout (Seal 2), interactive ROT13 decoder (Seal 3), RF frequency card (Seal 4), employee badge (Seal 5), Nakatomi letterhead note (Seal 6), bearer bonds certificate (Seal 7). Re-viewable by clicking opened seals.
- **Digital Seal 7** — a hidden power indicator ("VAULT SYSTEMS ● ONLINE") in the footer that triggers the power-cut sequence when clicked, preserving the lateral thinking puzzle from the physical game.
- **Digital mode clue card notes** added to each seal entry in `docs/STORY_AND_MYSTERIES.md`.
- **Digital Mode section** (Section 11) added to `docs/PLAYER_EXPERIENCE.md` documenting the feature mapping, clue card content, digital Seal 7 design, facilitator controls, audio, and relationship to Splunk.

### Changed
- `README.md` — added dual-mode description, `game.html` to repository structure, updated tech stack table (Game UI row), updated planned items.
- `index.html` — added Game UI roadmap card (marked complete), added Game UI to documents grid, updated architecture section (Game Orchestration → Game UI with "Ready" tag).
- `docs/PLAYER_EXPERIENCE.md` — updated design constraint 5 to acknowledge digital mode scoreboard; updated document version.

---

## 0.4.0 — 2026-03-25

### Added
- **Complete puzzle catalogue** — all 7 seals fully specified in `docs/STORY_AND_MYSTERIES.md` Part 2 (Die Hard beat, SPL skill, search path, code, red herrings, compartment reward, facilitator hints).
- **Data schemas document** — `docs/DATA_SCHEMAS.md` defining 6 sourcetypes, 3 indexes, 3 lookup tables, `_raw` formats, field definitions, and full Splunk configuration (props.conf, transforms.conf, indexes.conf).
- **Python data generator** — `generator/generate.py` produces ~830 deterministic Splunk-ingestible events across 3 JSON files and 3 CSV lookup tables. Configurable via `generator/scenario.yaml`.
- **Scenario configuration** — `generator/scenario.yaml` with seal codes, Die Hard timeline, character roster, red herrings, building layout, and volume tuning parameters.
- **Player experience document** — `docs/PLAYER_EXPERIENCE.md` covering Mission Brief dashboard wireframe, phase progression, hint delivery, fail/win states, Splunk app structure, and setup procedures.
- **This release notes document** — `RELEASE_NOTES.md`.

### Changed
- `README.md` — updated project status, added Quick Start section for generator, added new document links, updated repository structure.
- `index.html` — updated roadmap (Design + Data & Puzzles marked complete; Implementation next), added Data Schemas and Player Experience to documents section, fixed ESP32 reference (was Arduino/Pico).
- `.gitignore` — added `generator/output/` and `generator/.venv/`.

### Fixed
- Microcontroller inconsistency: `index.html` and `README.md` now reference ESP32 (matching `docs/PHYSICAL_MODEL.md`) instead of Arduino/Raspberry Pi Pico.

### Removed
- Empty `3d/` directory (leftover from abandoned 3D model effort).

---

## 0.3.0 — 2026-03-19

### Added
- **Physical model design** — `docs/PHYSICAL_MODEL.md` with full electronics spec: ESP32 controller, 7 lock mechanisms (servo, solenoid, magnetic, power-loss latch), keypad, LCD, NeoPixel LEDs, buzzer, Seal 7 meta-solution circuit, REST API, HEC integration, wiring reference, BOM (~$133–158), build procedure, and reset checklist.
- **Physical model diagram** — `docs/physical_model_diagram.svg` showing front panel layout, back electronics placement, wiring schematic, and wire color legend.
- Hinged compartment doors with clue chain (each seal reveals a physical artifact for the next puzzle).

### Changed
- `README.md` — added Physical Model to document links.
- `index.html` — added Physical Model to documents section, updated architecture diagram.

---

## 0.2.0 — 2026-03-17

### Added
- **Nakatomi Plaza SVG illustration** — `index.svg` showing cross-section of the tower with key floors, props, and Die Hard references.
- **Visual project overview** — `index.html` with 12 sections: hero, concept, game phases, seven seals, roles, architecture, data model, threats, flow diagrams (embedded Mermaid), SPL skills, easter eggs, roadmap, and document links.
- **Game flow visualization** — `docs/flow.html` for standalone Mermaid diagram rendering.

### Changed
- `README.md` — added Visual Overview link.

---

## 0.1.0 — 2026-03-17

### Added
- **Design document** — `docs/DESIGN.md` covering vision, story, player roles, game mechanics (core loop, puzzle types, win/lose conditions), physical model concept (7 seals), technical architecture, data model (conceptual), success criteria, MVP/V1 scope, risks, and example SPL snippets.
- **Story and mysteries** — `docs/STORY_AND_MYSTERIES.md` Part 1 with introduction narrative, easter egg catalogue (quotes, characters, places, moments), and placeholder for Part 2 mystery catalogue.
- **Timeline and flows** — `docs/TIMELINE_AND_FLOWS.md` with phase timeline (45–60 min), fail conditions (police breach, McClane, roof early/late), McClane hint schedule, success path, failure branches, Mermaid flow diagrams, and facilitator notes.
- **README** — project overview, game description, status, and document links.
- `.gitignore` — macOS, editors, Python, Node.js, Splunk, and secrets.

---

## 0.0.1 — 2026-03-17

### Added
- Initial repository setup.
- LICENSE file.
