# Release Notes — Nakatomi Plaza: Vault Heist

Versioning follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**.

- **MAJOR** — fundamental redesign or breaking changes to game mechanics, data schemas, or physical model interface.
- **MINOR** — new features, documents, or generator capabilities that don't break existing setups.
- **PATCH** — bug fixes, typo corrections, tuning adjustments.

---

---

## 2.17.2 — 2026-09-18

**Theme: Rookie players can learn without exhausting their hints.**

- Rookie now has unlimited hint tokens while retaining all existing
  level-specific point deductions and its four-hints-per-task limit.
- The difficulty selector, HUD, accessibility announcement, facilitator hub,
  and post-game breakdown display the unlimited pool explicitly.
- Hint usage telemetry and ending/achievement classification continue to count
  every reveal. Operative, Mastermind, Iron Man, Demo, Quickfire, and Booth
  Heist retain their existing finite or zero-token behaviour.

### Tests

- Added a regression harness covering unlimited repeated reveals, point
  deductions, usage telemetry, selector copy, and finite-pool exhaustion.

---

## 2.17.1 — 2026-06-17

**Theme: Playability patch — keypad display and guard-patrol puzzle parity.**

### Fixed

- **Keypad ghost digits** — switching from a text-code task (e.g. `EXT7700`) to a 4-digit numeric task no longer leaves trailing characters (`700`) in the segment display; `renderCodeDisplay()` rebuilds exactly four cells for numeric codes.
- **Task 2.3 Guard Rotation** — camera `guard_patrol` timestamps on floor 30 are consistently **8 minutes** (480 s) apart; answer corrected from `0012` to `0008`. Trap `0012` (guard badge SE-0012) replaces the old correct code; hints note that Splunk `delta _time` returns seconds.
- **Infrastructure seed** — patrol timestamps after 21:04 corrected so every floor-30 gap is 480 s; `nakatomi_security_camera.log` regenerated.

### Tests

- Regression suite: **1073 assertions** across 13 modules (adds patrol-interval and display-rebuild checks in `test_game_tasks.js`).

---

## 2.17.0 — 2026-04-26

**Theme: Facilitator dashboard catches up — three new rows surface every v2.13/v2.14 telemetry event that was queuing into Splunk with no panel showing it.** Pure dashboard work, no `game.html` changes, no new event types. Closes the visualisation gap flagged in the v2.16 QC checklist (Section 5.3) so QC observers can actually watch booth kiosk operations / post-session feedback / facilitator activity light up live during testing.

This is a focused QC-support release authored alongside manual quality control on the v2.13–v2.16 train. Per project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Three new dashboard rows (v2.17 facilitator board, 1920×3600)

The canvas grew `1920×2860 → 1920×3600` (+740 px) to accommodate three new rows below the existing v2.12 ending-distribution row. Each row follows the same header-strip + KPI + two-panel pattern as the v2.11 hub and v2.12 ending rows, with a distinct accent colour scheme so booth operators can spot-pivot between them.

#### Row 1 — Booth Kiosk Operations (cyan accent)
- **Distinct kiosk teams today** KPI — count of unique `team_code`s that emitted `kiosk_activated` since `@d`.
- **Idle reset reasons** column chart — distribution of `kiosk_idle_reset` events by `kiosk_reason` (`timeout` / `idle` / future reasons), 24 h window.
- **Recent kiosk resets + watchdog reloads** table — last 20 `kiosk_idle_reset` and `kiosk_watchdog_reload` events with timestamp, team, event type, formatted uptime, and reason.

#### Row 2 — Post-Session Feedback + Abandonment (warm yellow accent)
- **Avg rating today** KPI — `avg(rating)` over `session_feedback` events with `rating > 0` since `@d`. Excludes skip events.
- **Feedback distribution** column chart — counts of 1-star / 2-stars / 3-stars / 4-stars / 5-stars / Skipped buckets, 24 h window.
- **Abandonment by exit act** column chart — `session_abandoned` events grouped by the `exit_act` field (Act 1 → Act 5), exposing where booth visitors drop out.

#### Row 3 — Operator Activity (purple accent)
- **Facilitator clicks today** KPI — count of `facilitator_action` events since `@d`. Useful for spotting an operator getting stuck or a booth running on autopilot.
- **Facilitator action verb mix** column chart — counts of `complete | powercut | end_session | reset` per the v2.13 allow-list. Catches "operator never resets between visitors" as well as "operator force-completes everything" patterns.
- **Audio mix tweaks by setting** column chart — distribution of `audio_setting_changed` events grouped by `audio_setting` name (`master | music | sfx | ambient | mono | reducedIntensity | captions`). Answers the v2.14 plan question "did anyone find the controls?".

### Implementation details

- **Nine new data sources** — `ds_kpi_kiosk_today`, `ds_kiosk_reset_mix`, `ds_kiosk_recent`, `ds_kpi_feedback_avg`, `ds_feedback_distribution`, `ds_abandon_by_act`, `ds_kpi_operator_today`, `ds_facilitator_action_mix`, `ds_audio_setting_mix`. Every query carries the existing booth-token guard `where ("$booth_token$"="" OR booth_id="$booth_token$")` so the panels respect the dashboard's per-booth filter input.
- **Eighteen new visualisations** (3 markdown headers + 3 single-value KPIs + 6 markdown labels + 6 charts/tables). Reuses the existing colour-coded backgrounds + `splunk.markdown` / `splunk.singlevalue` / `splunk.column` / `splunk.table` types; no new dashboard primitives.
- **Layout** — three full-width rows of 240 px each (header 80 + 10 px gap + 30 px label + 110 px panel + 10 px gap), zero overlaps, 10 px buffer at the canvas bottom.
- **No `game.html` changes.** The same compiled inline JS keeps shipping; the dashboard adds rear-view visibility for events already being emitted.
- **No new `props.conf` extractions.** All fields used by the new queries (`kiosk_mode`, `kiosk_reason`, `uptime_ms`, `rating`, `skipped`, `exit_act`, `fac_action`, `audio_setting`, `event_type`, `team_code`) were already extracted by the v2.13/v2.14 `EXTRACT-` rules.

### Verification

- **New `scripts/tests/test_facilitator_dashboard.js`** — 61 assertions covering: CDATA + JSON parse, count consistency between `dataSources` / `visualizations` / `layout.structure`, zero layout-item / viz / data-source orphans, canvas-height ≥ max bottom + ≥ 5 px buffer, zero overlapping layout items, every v2.13/v2.14 event type has at least one panel querying it, every new row has its standard 6 artifacts (header + KPI + 2 labels + 2 panels), description mentions every v2.x row by version, description dimensions match canvas dimensions, every new data source carries the booth-token guard.
- **Combined regression suite now 984 assertions across 12 modules** (Audio 122 + Booth 94 + Endings 120 + Facilitator-Booth 61 + Facilitator-Dashboard 61 + Hans 69 + Hub 68 + Investigation Board 69 + Kiosk 89 + Phone Calls 84 + Scenario Consistency 64 + Scenario Packs 83), zero failures.
- **`app.conf`** bumped to v2.17.0, build 37; no new indexes, sourcetypes, KV Store collections, event types, or `props.conf` extractions — wholly additive minor bump.
- **`docs/QC_CHECKLIST_v2.16.md` Section 5.3** updated: the previous note "the new event types from v2.13–v2.16 are not yet visualised — non-blocking, can be authored as a v2.17.0 follow-up if useful" is now resolved with a per-row test recipe.

### Migration notes

- **No data migrations.** Existing v2.16 deployments that reload the app pick up the new rows automatically the first time the dashboard is opened.
- **Booth-display TV layouts** — the dashboard's auto-scale + new height (3600) means a 1920×1080 TV will render with vertical scrolling, same as v2.12 onward. Operators who want a single-screen view should drilldown into the per-booth filter to compress; the layout stays usable at any zoom level.

### Fixed — Playability, data pipeline, and dashboard parity

- **Infrastructure seed merged into canonical HEC outputs** — phone, radio, camera, elevator, and power-grid puzzle events now ship inside `nakatomi_building.json` / `nakatomi_comms.json` via `generator/infrastructure/`. `load_data.sh` and batch `.log` exports no longer miss Act 2–5 comms/infrastructure data.
- **`json_to_logs.py` + `load_data.sh`** — read only the four canonical JSON files; legacy per-sourcetype shards are purged on regenerate.
- **`game.html`** — booth fixture for task 3.3 aligned with vault `code_attempt` trail; task 5.3 SPL scoped to FBI power-cut window; demo mode uses numeric task 2.3 instead of text-code 2.1; `?seed=` no longer randomizes keypad codes unless `&randomize=1` is also set.
- **Dashboard SPL sync** — `search_terminal.xml` starter queries and `guided_investigation.xml` Act 4/5 suggested searches now match `game.html` task SPL.
- **Regression suite** — `scripts/test.sh` now runs **1067 assertions** across 13 modules (adds `test_game_tasks.js`).

### Plan reference

- **No roadmap todos closed by this release.** v2.17 is a QC-support docs/dashboard release authored on the v2.16 baseline. The remaining gated items (`p7-branching-tier2` waiting on telemetry + `v3-capstone` waiting on explicit user instruction) stay pending unchanged.

---

## 2.16.0 — 2026-04-26

**Theme: Scenario packs (Phase 5f) + i18n scaffold (Q4) + pragmatic Q3 schema-v2 overlay loader.** v2.16 introduces two parallel JSON-overlay loaders that let the same `game.html` re-skin its narrative + UI strings without changing the underlying tasks, codes, or data. Three scenario packs ship out of the box (`default` / `roof` / `afterparty`) plus two locale packs (`en` / `es`), with a fixed allow-list, file://-safe fetch, prototype-pollution defenses, and 64 KB / 32 KB size caps. Bulk inline content stays inline; the modules are pure overlays so a no-config boot is byte-identical to v2.15.

This release implements **Phase 5f (scenario skins)** and a **pragmatic-scope Q3 (scenario-pack v2 schema runtime + override loader)** and **Q4 (i18n helper + en/es locale packs)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). The plan's full Q3 scope (extract every ACT / task to JSON + extract CSS to game.css + extract JS to src/ + esbuild build pipeline) remains deferred to a future v2.x bump or the v3.0 capstone — the plan flagged it as the largest single architectural lift and explicitly noted it must NOT block downstream Phase 5f work, which this release delivers via the lighter overlay model. Per project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — `ScenarioPacks` IIFE module

- **`?scenario=<name>` URL flag** — allow-listed names: `default | roof | afterparty`. Anything else silently falls back to `default` with no fetch attempt (URL params can never trigger an off-allow-list resource load).
- **Three scenario packs in `scenarios/`** — `default.json` (no-op overlay, round-trip safety), `roof.json` (rooftop edition, helicopter wind ambient, Karl/Theo rooftop chatter), `afterparty.json` (forensic debrief, McClane reconstructing the heist from morning-after logs). Bulk text + 80s-radio ambient + intercept replacement, ≤ 1 KB each.
- **Schema v2** — `$schema_version: 2` + `$id` (allow-listed) + optional `metadata` / `ambient` / `story_beats` / `intercepts` / `endings` sections. Story-beat keys match `/^[a-zA-Z0-9_]{1,40}$/`; ending keys match `/^[a-zA-Z_]{1,32}$/`. Unknown keys are silently dropped at validation time.
- **Inline `<script id="nakatomi-scenario" type="application/json">` block** — same pattern as `NakatomiConfig` and `nakatomi-i18n`. Lets a same-origin proxy bake the pack into the page with zero extra round-trips, works under kiosk-locked CSP, and is file://-safe.
- **Public API**: `ScenarioPacks.init()` / `getActiveId()` / `getStoryBeat(key)` / `getIntercept(key)` / `getAmbientLabel()` / `getEndingOverride(endingId)`. All getters return `null` when no override applies, so consumers stay one-line wrappers.

### Added — `I18n` IIFE module

- **`?lang=<code>` URL flag** — allow-listed: `en | es | de | ja` (only `en` and `es` ship with packs in v2.16; `de` / `ja` are reserved). Anything else silently falls back to `en`.
- **DEFAULTS table** of ~30 most-visible UI strings (mode-select titles + difficulty labels, HUD field labels, pause-menu buttons, victory overlay copy, game-over). Bulk inline strings remain inline.
- **`I18n.t(key, fallback)`** — resolution chain: inline-loaded translations → DEFAULTS table → fallback arg → key itself. Validates the key against `/^[a-zA-Z0-9_.]{1,80}$/` so a future caller passing user input can't traverse outside the allow-list.
- **Two locale packs in `i18n/`** — `en.json` (canonical English, mirrors DEFAULTS for hot-replace round-trip) and `es.json` (Spanish proof-of-concept). Both are validated by the regression suite to cover every key in DEFAULTS.

### Security model (both modules)

- **Allow-list bounds.** Pack `$id` and lang code MUST match the in-code allow-list. The fetch URL is fixed-shape (`scenarios/<allowlisted>.json` / `i18n/<allowlisted>.json`) — no path traversal, no scheme override, no query-string smuggling. Fetch sets `credentials: 'omit'` so cookies and auth headers never leak across origins.
- **Size caps.** Body rejected if > 64 KB (scenario) / 32 KB (i18n). Each string field capped at 2048 / 1024 bytes at parse time. `content-length` is checked pre-`text()` read so a hostile proxy can't stream gigabytes into the parser.
- **Prototype-pollution defense.** Keys named `__proto__`, `constructor`, or `prototype` are silently dropped during validation, in addition to the regex-based key allow-list.
- **No DOM injection.** Every override is rendered through `escHTML()` (or `_esc()` inside Endings) at the consuming call site. Pack content is treated as untrusted input even from your own packs.
- **file:// fallback.** When `game.html` is opened directly (no web server), the runtime detects `location.protocol === 'file:'` and skips the fetch entirely. Use the inline `<script>` block when shipping a pack alongside an offline copy.

### Added — docs

- **`docs/SCENARIO_PACKS.md`** — schema v2 reference, both load mechanisms (URL flag + inline block), security model documentation, and a 5-step "How to author a new pack" recipe.
- **README + index.html** — version tags + roadmap cards updated; release-notes modal entry added.

### Verification

- **New `scripts/tests/test_scenario_packs.js`** — 83 assertions covering: module surfaces, allow-lists, `_validate()` shape (well-formed / wrong schema_version / unknown $id / prototype-polluted keys / over-length values / control-char strip / hyphenated-key drop), URL allow-list (no path traversal), unknown-pack fallback (no fetch), `default`-pack short-circuit (no fetch), `file://` short-circuit (no fetch), inline pack application, on-disk pack files validate against the schema, on-disk i18n packs cover every DEFAULTS key.
- **Combined regression suite now 923 assertions across 11 modules** (Audio 122 + Booth 94 + Endings 120 + Facilitator 61 + Hans 69 + Hub 68 + Investigation Board 69 + Kiosk 89 + Phone Calls 84 + Scenario Consistency 64 + Scenario Packs 83), zero failures.
- **`game.html`** — wholly additive; existing solo / enablement / booth flows unchanged. `?scenario=` and `?lang=` are pure opt-ins.
- **`app.conf`** bumped to v2.16.0, build 36; no new indexes, sourcetypes, or KV Store collections.
- **No new runtime JS dependencies.** The repo stays single-file-distributable.
- **Linters** — no errors on any modified file.

### Migration notes

- **No data migrations.** Both modules apply pure JSON overlays on top of canonical inline content. A no-config boot is byte-identical to v2.15.
- **Add a new scenario pack** — add the name to `ALLOWED` in the `ScenarioPacks` IIFE, write `scenarios/<name>.json`, update `docs/SCENARIO_PACKS.md`. Run `bash scripts/test.sh` to confirm the pack passes `_validate()`.
- **Add a new locale pack** — add the lang code to `ALLOWED_LANGS` in the `I18n` IIFE, write `i18n/<lang>.json` covering every DEFAULTS key. The regression suite enforces full coverage so a partial translation can't ship by accident.

### Plan reference

- **Roadmap todos completed:** `q3-refactor` (pragmatic scope: scenario-pack v2 schema runtime + override loader, NOT the full ACTS extraction + esbuild build pipeline which stays deferred), `q4-i18n` (i18n helper + en/es locale packs), `p5-scenario-skins` (three scenario packs shipped using the v2 schema). The deferred Q3 architectural rewrite is now the only remaining quality-track item; both Phase 7 Tier 2 and the v3.0 capstone remain external-trigger gated.

---

## 2.15.0 — 2026-04-26

**Theme: Cross-cutting quality gate — unified test runner, GitHub Actions CI, scenario consistency regression, GDPR/DSAR governance scripts (Phase Q1 / Q2 / Q5).** No gameplay changes; v2.15 is the engineering-hygiene release the project has been deferring since v2.4. Every previous minor bump shipped a feature; this one ships the safety net underneath them. Three pillars: a master test runner with a single source of truth for the regression suite (840 assertions across 10 modules), a GitHub Actions workflow gating every push and tag-build, and a complete data-subject-access-request bundle (export + purge scripts + KV retention recipe + DEPLOY.md governance section).

This release implements **Phase Q1 (testing strategy), Q2 (CI/CD pipeline), and Q5 (data retention / governance)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Unified test runner (Phase Q1)

- **`scripts/test.sh`** — single entry point that walks every `scripts/tests/test_*.js`, aggregates pass/fail counts, and reports a combined tally. Supports `--json` (CI consumers) and `--quiet` (status-bar embedded summary). Exit 0 on full pass, 1 on any failure.
- **`scripts/tests/test_scenario_consistency.js`** — new 64-assertion regression that validates the contract between `generator/scenario.yaml` and the game's canonical answer key:
  - Every seal (1..7) has the right shape — direct `embed_value` (1, 2, 5), `embed_sequence` (3 — Takagi's failed input run), `embed_value_rot13` (4 — HVAC encoded message), `embed_location` (6 — CSV lookup reference), or `isMeta: true` (7 — power-button puzzle, no code).
  - Every seal code is exactly 4 digits (matches the keypad spec).
  - Every code appears verbatim in the matching embed (catches generator drift where a code mutation forgets to update the embedded payload).
  - No two seals share a code (avoids ambiguous puzzle states).
  - Every referenced index exists in `nakatomi_heist/default/indexes.conf`.
  - Sourcetypes follow the `nakatomi:*` convention.
  - The 90-day retention guard on `nakatomi_sessions` (`frozenTimePeriodInSecs = 7776000`) is still in place.
- **Combined regression suite now totals 840 assertions across 10 test files** (Audio 122 + Booth 94 + Endings 120 + Facilitator 61 + Hans 69 + Hub 68 + Investigation Board 69 + Kiosk 89 + Phone Calls 84 + Scenario Consistency 64), zero failures.

### Added — GitHub Actions CI (Phase Q2)

- **`.github/workflows/ci.yml`** runs on every push to `main` / `develop`, every pull request, and every tag matching `v*.*.*`.
  - **`test` job** — sets up Node 20 (no `npm ci` step; the regression suite is dependency-free pure-Node), runs `bash scripts/test.sh`, uploads `test_results.json` as an artifact for downstream consumers.
  - **`static-checks` job** — runs HTML structural sanity check on `game.html` (script + div tag balance), Splunk `.conf` file syntax check (parses every `nakatomi_heist/default/**/*.conf` for unterminated section headers + key=value-without-section + UTF-8 validity), the new scenario consistency test, and a secret-scan gate that fails the build on AWS keys / Stripe live secrets / GitHub PATs / inline private-key blocks (per [`codeguard-1-hardcoded-credentials`](.cursor/rules/codeguard-1-hardcoded-credentials)).
  - **`package` job** (tags only) — builds `dist/nakatomi_heist-vX.Y.Z.spl` (gzipped tarball of the app), computes `SHA256SUMS`, uploads as workflow artifact, and attaches to a draft GitHub Release.
- **Hardening per [`codeguard-0-devops-ci-cd-containers`](.cursor/rules/codeguard-0-devops-ci-cd-containers):**
  - `permissions: contents: read` default; only the `package` job escalates to `contents: write` for release attachment.
  - `concurrency` group cancels in-flight runs on the same ref so a rapid-fire push series doesn't stack workflows.
  - `actions/checkout@v4` and `actions/setup-node@v4` are major-version-pinned (Dependabot keeps them current).
  - All shell commands use `set -euo pipefail`.
- **`.github/dependabot.yml`** — weekly GitHub-actions updates (every Monday). The project intentionally has no runtime JS dependencies, so the npm ecosystem is not configured; will be added when the Q3 refactor introduces a `package.json`.
- **AppInspect** — explicitly NOT wired into CI in this release. It requires a registered Splunkbase account to authenticate, which we don't want in a public repo's environment. Operators wanting AppInspect locally can run `splunk-appinspect inspect dist/*.spl` against the artifact built by the `package` job.

### Added — GDPR / DSAR governance (Phase Q5)

- **`scripts/export_sessions.sh`** — exports every `nakatomi_sessions` event AND `vault_progress` KV-Store record matching a given `--team-code` or `--session-id` to a single JSON file. Used to satisfy data subject access requests.
- **`scripts/purge_sessions.sh`** — right-to-erasure counterpart. Marks index events as deleted via Splunk's `| delete` search (requires `can_delete` capability on the role) and physically removes matching KV records. Refuses to run without `--confirm yes-i-mean-it`.
- **Both scripts harden per project rules:**
  - Filter values restricted to `[A-Za-z0-9._-]` — defends against SPL injection per [`codeguard-0-input-validation-injection`](.cursor/rules/codeguard-0-input-validation-injection).
  - Auth via `Authorization: Bearer` headers, never URL params per [`codeguard-0-authentication-mfa`](.cursor/rules/codeguard-0-authentication-mfa).
  - Export output written with `umask 077`.
  - Purge writes an audit-log entry with a SHA-256 hash of the filter (not the raw team_code) so audit retains the action without storing the original identifier.
  - Curl uses `--fail-with-body` so HTTP 4xx/5xx returns non-zero exit instead of silently writing partial output.
- **`docs/DEPLOY.md` Section 7** extended with:
  - 7.1 — KV-Store 30-day retention recipe (saved-search `outputlookup` pattern that prunes vault_progress nightly).
  - 7.2 — Token-capability matrix for the dedicated `nakatomi_dsar` role (search + read on `nakatomi_sessions`, read/write on `vault_progress`, `can_delete` for the purge path only). Explicit warning not to reuse the booth-display token.

### Verification

- **Master regression** — `bash scripts/test.sh` passes 840/840 assertions across 10 test files in ~1.3 s on a baseline runner.
- **CI dry-run** — every shell branch in `.github/workflows/ci.yml` was hand-traced through a local equivalent (`set -euo pipefail` everywhere, no shell-interpolation inside Python heredocs that would break on a tag containing `'`, every action pinned to a major version Dependabot will keep current).
- **`game.html`** — wholly unchanged in this release; existing 9-module audio + booth + endings + hub + investigation-board + facilitator + kiosk + Hans + phone-call regression suites still pass.
- **`app.conf`** bumped to v2.15.0, build 35; no new indexes, sourcetypes, or KV Store collections — wholly additive minor bump.
- **No new runtime JS dependencies.** The repo stays single-file-distributable.

### Migration notes

- **No data migrations.** The `nakatomi_sessions` index already has the 90-day retention from v2.4; the KV-Store 30-day prune is opt-in via a saved search you schedule yourself (the recipe is in DEPLOY.md §7.1).
- **CI activation** — first run will show the `test` and `static-checks` jobs only. The `package` job runs only on tag pushes (`v*.*.*`).
- **DSAR scripts** — provision a `nakatomi_dsar` Splunk role with the capabilities listed in DEPLOY.md §7.2 before running. The booth-display read-only token is intentionally insufficient.

### Plan reference

- **Roadmap todos completed:** `q1-tests` (unit-test infrastructure + scenario consistency regression), `q2-cicd` (GitHub Actions workflow + Dependabot scaffolding), `q5-governance` (DSAR scripts + KV retention recipe + DEPLOY.md governance section). The remaining quality items — `q3-refactor` (scenario externalization + esbuild build pipeline) and `q4-i18n` (string externalization to i18n/en.json) — are next on the queue and unblock `p5-scenario-skins`.

---

## 2.14.0 — 2026-04-26

**Theme: Adaptive 3-layer audio engine + Ode to Joy + mix settings panel + audio captions (Phase 5h).** Audio is the single biggest perceived-polish jump in the entire roadmap — until now `game.html` shipped functional but thin Web Audio beeps routed straight to `audioCtx.destination` with no mix control and no path for accessibility. v2.14 rebuilds the audio core around three parallel `GainNode` buses (`ambient` / `music` / `sfx`), introduces a public-domain **Beethoven's Ode to Joy** motif on vault-open for the default ending (signature Die Hard reference, zero licensing surface — synthesised in code, not sampled), gives every act its own 5-note arpeggio so players unconsciously learn each act's signature, and ships an in-pause **Audio Mix** panel with sliders, mono / reduced-intensity / captions toggles, and persistent settings under `localStorage['nakatomi_audio_settings']`. The new captions HUD renders a 2-second text label for every cue when the player toggles them on — required for Deaf/HoH accessibility per the Phase 4 a11y rules.

This release implements **Phase 5h (adaptive audio + mix settings panel + Ode to Joy + audio captions)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Adaptive 3-layer audio engine

- **Bus topology** — `ensureAudio()` builds four `GainNode`s on first call: `_audioMasterBus` (1.0 default) → `audioCtx.destination`, with `_audioAmbientBus` (0.35) / `_audioMusicBus` (0.7) / `_audioSfxBus` (1.0) feeding into master. Idempotent — re-applying settings is cheap so a Safari resume-after-suspend cycle doesn't lose the player's mix prefs. Bus references named with `_audio*Bus` to avoid colliding with the legacy `ambientGain` per-oscillator gain in `startAmbient()`.
- **`tone()` / `noise()` accept an optional fifth/third `bus` argument** routing to the named GainNode (default `'sfx'` so the existing 30+ cue functions still work unchanged). Unknown bus names fall through to `sfx` so a typo never silently drops the cue.
- **`AudioMix.crossfade(layer, target, durMs)`** animates the named layer's gain via `cancelScheduledValues()` + `setValueAtTime()` + `linearRampToValueAtTime()` — replaces v2.13's hard on/off behaviour with smooth tonal shifts. Default duration 800 ms; clamps target to `[0, 1]`.

### Added — New audio cues + Ode to Joy

- **`AudioMix.playOdeToJoy()`** — Beethoven's 9th, 4th movement, first 8 bars (E E F G G F E D C C D E E D D — Schiller's "An die Freude"). Public domain in every jurisdiction (Beethoven died in 1827); synthesised in code so there's no recording-licensing surface. Routes through the music bus so the mix slider works. Plays with a sustained C3+G3 fifth underneath for the orchestra-entrance feel + an octave-up sparkle on the long final note.
- **Per-act arpeggios** (`AudioMix.playActComplete(actIdx)`) — 5-note motifs unique per act, fired alongside the existing `showActTransition()` visual:
  - **Act 1** — C major rising (262 / 330 / 392 / 523 / 659): establishing
  - **Act 2** — C minor (262 / 311 / 392 / 466 / 523): tension introduced
  - **Act 3** — A minor → B half-dim (220 / 262 / 330 / 415 / 494): the vault sequence
  - **Act 4** — G dim → climbing (196 / 247 / 311 / 392 / 494): chaos
  - **Act 5** — C major → D (262 / 330 / 415 / 494 / 587): resolution
- **Ode to Joy fires only on the DEFAULT ending** — the analyst / cowboy / speedrunner branches already have bespoke per-ending stings; layering Ode on top would muddy them. The default ending is the canonical "Welcome to the party, pal." resolution and the iconic Die Hard moment, so the Beethoven motif lands hardest there.

### Added — Audio Mix panel (Phase 5h)

- **In-pause expandable panel** under the existing pause-menu buttons (toggled by a new "AUDIO MIX & CAPTIONS" button with `aria-expanded`). Hidden by default so the pause UI stays clean for players who don't care about the mix.
- **Four sliders** — Master / Music / SFX / Ambient, each 0-100 with a visible "75%" readout to the right of the label. Sliders use the platform-native `accent-color: #33ff33`.
- **Three checkboxes** — Mono / single-ear (HoH accessibility), Reduced audio intensity (halves the master bus), Audio captions (text label per cue).
- **Persistent settings** under `localStorage['nakatomi_audio_settings']` (separate key from `nakatomi_crt_theme` so future migrations can fork the two without conflict). Every slider/checkbox tweak emits an `audio_setting_changed` telemetry event so the booth dashboard can answer "did anyone find the controls?".

### Added — Captions HUD (Phase 4 a11y completion)

- **`#audio-caption-hud`** fixed-position band at top-center (z-index 99000), `aria-live="polite" role="status"`. Renders a static text label for ~2 seconds whenever a cue fires AND `settings.captions === true`. Supports the standard cue dictionary: `boot`, `codeCorrect`, `codeWrong`, `sealOpen`, `trapTriggered`, `actComplete`, `heartbeat`, `vaultOpen`, `victory`, `gameOver`, `hintRevealed`, `intercept`, `powerDown`, `ambient`. Honors `prefers-reduced-motion` (transition disabled).
- **Cue-key allow-list** — captions are keyed by static cueId from a closure-scoped dictionary; `captionFor()` silently no-ops on any unknown id (defends against a future caller passing user-supplied keys). `textContent` (never `innerHTML`) is the only write surface, so a future caption inadvertently containing a `<` is rendered as text.
- **Eleven existing cue functions** (`playCorrect` / `playWrong` / `playSealOpen` / `playHintReveal` / `playTrapCode` / `playRadioIntercept` / `playHeartbeat` / `playVictory` / `playGameOver` / `playPowerDown` / `playOdeToJoy` / `playActComplete`) all wired with `try { AudioMix.captionFor('cueId'); } catch(e) {}` so the captions never crash the audio path.

### Added — Telemetry + props.conf

- **`audio_setting_changed`** event type added to `NakaTelemetry.EVENT_TYPES`. Payload: `{ setting, value }` where `setting` is on the static allow-list and `value` is a number in [0, 1] or a boolean.
- **Two new `props.conf` extractions** — `audio_setting` (matches `[a-zA-Z]{1,24}` so user-supplied keys can never make it through to the dashboard) and `audio_value` (matches `true|false|0|1|0?\.\d{1,4}`). The latter is a separate field name (not the generic `value` other events use) so dashboards can correlate by setting name without false matches.

### Verification

- **New `scripts/tests/test_audio_mix.js`** — 122 assertions covering: module surface, defaults, `clamp01()` edge cases (NaN / Infinity / negative / over-1), `setSetting()` allow-list (rejects `__proto__` / `constructor` / `toString` / unknown keys), persistence + telemetry round-trip, corrupt-JSON-→-defaults recovery, captions on/off/unknown-key, CAPTIONS dictionary completeness, ACT_MOTIFS shape (5×5), Ode to Joy → music bus, bus topology declared in `game.html`, mix panel HTML, lifecycle wiring (`triggerVictory` default branch + `advanceTask` act-advance flow).
- **Combined regression suite now 776 assertions across 9 modules** (Audio 122 + Booth 94 + Endings 120 + Facilitator 61 + Hans 69 + Hub 68 + Investigation Board 69 + Kiosk 89 + Phone Calls 84), zero failures.
- **`app.conf` bumped to v2.14.0, build 34.** No new indexes, sourcetypes, or KV Store collections — wholly additive minor bump per the project version policy.
- **Linters** — no errors on any modified file.

### Migration notes

- **No data migrations.** Existing audio settings (which didn't persist before v2.14) are simply un-set on first load; defaults match the old behaviour (master 1.0 / sfx 1.0). Existing solo runs are aurally identical to v2.13 unless the player opens the new mix panel.
- **No new HEC indexes.** `audio_setting_changed` lands on the existing `nakatomi_sessions` index sourcetype `nakatomi:session:event`; the two new field extractions are pure props.conf adds.
- **Ode to Joy is opt-out, not opt-in.** Players who want the original generic victory arpeggio can mute the music bus or unlock a non-default ending (analyst / cowboy / speedrunner) — the per-ending stings already replace the default behaviour.

### Plan reference

- **Roadmap todo completed:** `p5h-audio` (Phase 5h adaptive audio + mix panel + Ode to Joy + audio captions). The remaining Phase 5 item — scenario skins (`p5-scenario-skins`) — is gated on the Q3 refactor (scenario externalization to JSON), which is next on the queue. The Q1/Q2/Q4/Q5 cross-cutting quality track follows.

---

## 2.13.0 — 2026-04-26

**Theme: Conference-booth ready — Quickfire + Booth Heist short-form difficulties, kiosk hardening, facilitator booth tab, Splunk linkout, post-session feedback (Phase 5a / 5b / 5c / 5d / 5e bundled).** Until now booth deployments worked, but they relied on either the 15-minute "Quick Demo" mode (too long for high-traffic conferences) or the operator's discretion (no auto-reset between visitors, no in-game facilitator controls). v2.13 closes every booth-mode gap on the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md): two new short-form tiers (5 / 10 min), a `?kiosk=1` lockdown mode with full-screen + shortcut guard + auto-return + hourly watchdog reload, a `?facilitator=1` URL-bypassed control panel with live elapsed/team/progress header, a Splunk linkout from the victory screen, an in-overlay 1-question feedback survey, and abandonment-tracking telemetry. Five new event types (`session_feedback`, `session_abandoned`, `facilitator_action`, `kiosk_activated`, `kiosk_idle_reset`, `kiosk_watchdog_reload`, `splunk_fallback`) and eight new `props.conf` extractions feed three new facilitator-board panels.

This release implements **Phase 5a + 5b + 5c (booth difficulties + golden-path fixture cache + kiosk hardening)** and **Phase 5d + 5e (facilitator booth tab + Splunk linkout + 1-question feedback + abandonment tracking)** of the roadmap. Per project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Quickfire + Booth Heist difficulties (Phase 5a/5b)

- **Quickfire** (5 min / 2 tasks / 0.25× score) and **Booth Heist** (10 min / 3 tasks / 0.5× score) are new conference-booth difficulty tiers, sitting between the main 3-tier row (Rookie / Operative / Mastermind) and the existing 15-min Quick Demo + 50-min Iron Man row. Both use `splHelp: 'always'` (pre-filled SPL — no typing under booth time pressure), `trapCodes: false` (no surprise game-overs in a 5-minute slot), and curated `taskAllowlist` arrays:
  - **Quickfire** → Task 1.1 Guest List + Task 3.7 Shoot the Glass — finish on the iconic "pull the power" beat.
  - **Booth Heist** → Task 1.1 Guest List + Task 3.3 Takagi's Refusal + Task 3.7 Shoot the Glass.
- **`applyBoothMode()`** generalises the existing `applyDemoMode()` pattern: it walks the active preset's `taskAllowlist` in *author* order (not act/index order, so booth operators can stage easy-then-cinematic pacing regardless of the canonical campaign layout) and synthesises a single fake act with the picked tasks. Falls back to demo's 3-task layout if every allowlisted ID was renamed in a future scenario edit.
- **Fast-boot path** for booth tiers — collapses the 10-second BIOS sequence to ~2 seconds (5 lines, 120 ms each). Quick Demo intentionally keeps the FULL boot because that's the 15-minute first-impression mode; only Quickfire / Booth Heist opt in.
- **Mode-select UI** — new `.ms-booth-row` (gold accent, between cyan main-tier and pink demo) with two buttons. `setDifficulty()` querySelector covers all four button classes so ARIA + visual selection state stays in sync.
- **`BOOTH_FIXTURES` golden-path cache** (~1 KB) — pre-baked SPL result rows for tasks 1.1 / 3.3 / 3.7. Rendered alongside the pre-filled SPL as a `<details>` "SAMPLE RESULT — offline fixture" preview so booth visitors who can't reach a live Splunk install (wifi outage, phone-only access) still see the result *shape* and learn to read it. Fixtures pass through `escHTML()` at render time and contain no executable JS / HTML.
- **`splunk_fallback` telemetry event** — reserved for a future Q3-refactor era when the game actually round-trips queries to Splunk; currently the offline fixture is the result, so the event is allow-listed but not yet emitted.

### Added — Kiosk hardening (Phase 5c)

- **`Kiosk` IIFE module** activates on `?kiosk=1`. Idempotent and silent if the URL flag is absent, so existing solo / enablement deployments are unaffected.
- **Full-screen request** on first user gesture (browsers only allow it from a user-initiated event, never from page-load script). Vendor-prefixed fallback chain covers Safari / Firefox / Edge.
- **Shortcut guard** — `contextmenu` (right-click) is preventDefault'd; `Ctrl+S` / `Ctrl+P` / `Ctrl+U` / `Ctrl+Shift+I` / `Ctrl+Shift+J` / `Ctrl+Shift+C` / `F12` are all blocked. `F11` (browser-native fullscreen toggle) and the existing gameplay keys (digits, Enter, `?`, hotkey letters) stay live.
- **Auto-return-to-mode-select** after 90 s idle on victory or game-over screens. `?kiosk_idle=<seconds>` lets booth operators tune the timeout, clamped to `[30 s, 10 min]` against typos. Fires `resetGame()` after emitting `kiosk_idle_reset`. Polls overlay visibility every 5 s — cheap and simpler than mutation observers.
- **Hourly watchdog reload** clears any memory leak that's accumulated during an 8-hour conference shift. `location.replace()` drops back-button history so visitors can't navigate "back" to a stranger's victory screen. `?kiosk_watchdog=<seconds>` overrides, clamped to `[5 min, 8 h]`.
- **localStorage hygiene** — leaderboard storage cap raised 10 → 50 (the UI render still slices the top 10), with the Kiosk module's `trimLocalStorageHygiene()` converging back to 50 on init/wakeup. JSON corruption wipes the key rather than poisoning subsequent reads.
- **`?queue=1` secondary-display mode** — minimalist "PLAYER IN SESSION — TEAM \<code\>" / "BOOTH OPEN — TAP TO PLAY" panel suitable for a side iPad next to the booth TV. Reads team-code state from `NakaTelemetry.debugInfo()`; refreshes every 5 s. Does **not** bind shortcut guard or idle reset (a queue display must never reset a player's session).
- **Three new telemetry event types** — `kiosk_activated` (mode + idle_ms + watchdog_ms), `kiosk_idle_reset` (reason + uptime_ms), `kiosk_watchdog_reload` (uptime_ms). All payloads are non-PII and bounded; `props.conf` adds five new `EXTRACT-` rules.

### Added — Facilitator booth tab (Phase 5d)

- **`?facilitator=1` URL bypass** auto-unlocks the existing `#facilitator` panel without the typed PIN prompt. The bypass is UX, not security — the PIN stays on every other route. `?facilitator=0` is parsed as an explicit opt-out.
- **Live session header** in the facilitator panel — `TEAM <code>` + `ELAPSED <m:ss>` + `PROGRESS <done>/<total>` rebuilt every 1 s by a lightweight `setInterval` that's a no-op when the panel is hidden. All interpolated values pass through `escHTML()`.
- **Renamed buttons** for booth clarity: "Game Over" → "End Session", "Reset" → "Reset for Next Visitor".
- **`facilitator_action` telemetry event** — every facilitator click (per-task complete, power-cut, end-session, reset) emits a non-PII event so the booth dashboard can surface live operator activity. Action verb is allow-listed (`complete | powercut | end_session | reset`); `props.conf` extracts it.

### Added — Splunk linkout button (Phase 5d)

- **"View in Splunk →"** anchor on the victory screen. Opens the live Splunk dashboard configured at deploy time via `NakatomiConfig.splunkLinkUrl` or the inline `<script id="nakatomi-config" type="application/json">` block. Never accepts the URL from query strings — the same security model the HEC token already uses (URL params land in browser history + Referer + access logs).
- **URL validation** — type check (string), length cap (≤ 512 chars), control-char rejection (CR / LF / TAB / null bytes), `new URL()` parse, protocol must be `https:` (HSTS sites only), userinfo (`https://user:pass@…`) rejected to block basic-auth phishing patterns. Static markup defaults to `href="#"`; the validated URL is only assigned at click-render time.
- `target="_blank"` + `rel="noopener noreferrer"` per `codeguard-0-client-side-web-security`. Default-hidden — the button only appears once a valid config is detected.

### Added — 1-question session feedback widget (Phase 5e)

- **Five-star rating + optional 120-char comment**, rendered into the victory overlay below the leaderboard buttons. Only shown when telemetry is enabled OR the active difficulty is a booth tier (the booth operator wants the data either way). The widget never fires more than once per session.
- **`_sanitizeFeedbackText()`** strips CR / LF / TAB / control chars and `<` / `>`, then caps at 120 chars. The sanitized string is only sent to telemetry — never echoed back to the DOM, so no cross-session XSS surface even if the dashboard later renders comments.
- **`session_feedback` telemetry event** carries `rating ∈ [1, 5]`, `comment_length`, the sanitized `comment`, `elapsed_seconds`, and `difficulty`. Submission is one-shot — `feedbackSubmitted` flag plus DOM-state guards prevent double-fire. "Skip" / dismiss path emits the same event with `rating: 0, skipped: true, reason: "skip"` so dashboards can compute genuine response rates.

### Added — Abandonment tracking (Phase 5e)

- **`armAbandonmentTimer()`** schedules a `session_abandoned` beacon `timer + 5 min` after `enterGame()`, capped at 4 h max for kiosk-watchdog safety. Cancelled by `triggerVictory()`, `triggerGameOver()`, and `resetGame()` — so a clean win or loss never fires the beacon.
- Payload — `exit_act`, `exit_task`, `last_seen_seconds`, `difficulty`. No PII; lets the facilitator board show a "Where do players drop out?" panel by funnel act.

### Added — Facilitator dashboard plumbing (props.conf)

- **Eight new `EXTRACT-` rules** in `nakatomi_heist/default/props.conf` for the v2.13 events: `kiosk_mode`, `idle_ms`, `watchdog_ms`, `uptime_ms`, `kiosk_reason`, `rating`, `comment_length`, `feedback_comment` (capped at 200 Splunk-side as a defence-in-depth against a future client-bypass), `skipped`, `exit_act`, `exit_task`, `last_seen_seconds`, `fac_action`. The existing `task_id` extractor already covers the new `splunk_fallback` payload field.

### Verification

- **Two new unit-test harnesses** — `scripts/tests/test_booth_difficulties.js` (94 assertions) and `scripts/tests/test_kiosk.js` (89 assertions) and `scripts/tests/test_facilitator_booth.js` (61 assertions). The full regression suite now totals **654 assertions across 8 modules** (Booth 94 + Endings 120 + Facilitator 61 + Hans 69 + Hub 68 + Investigation Board 69 + Kiosk 89 + Phone Calls 84), zero failures.
- **`game.html` parse check** — main script block (`script[1]`) parses cleanly; the legacy `script[0]` false-positive (HTML-comment-escaped `</script>` snippet) is unchanged from v2.12.
- **Linters** — no errors on any modified file (`game.html`, `nakatomi_heist/default/app.conf`, `nakatomi_heist/default/props.conf`, three new test scripts).
- **Backwards-compatibility** — every change is additive. Existing solo / enablement runs (no URL params) are unaffected. `?kiosk=1` / `?facilitator=1` / `?queue=1` are pure opt-ins; the same `game.html` ships with all of them.

### Migration notes

- **No data migrations.** `nakatomi_sessions` index, `vault_progress` KV-Store schema, and existing `props.conf` extractions are unchanged. Only new fields were added.
- **Booth operator workflow update** — see [`docs/PLAYER_EXPERIENCE.md`](docs/PLAYER_EXPERIENCE.md) for the new `?kiosk=1` and `?facilitator=1` flows + the recommended URL templates for conference deployments.
- **Splunk linkout deploy** — to enable the "View in Splunk →" button, set `splunkLinkUrl` in `NakatomiConfig` (HTTPS only). The button stays hidden if no valid URL is configured.

### Plan reference

- **Roadmap todos completed:** `p5-booth-difficulties` (Phase 5a + 5b), `p5-kiosk-hardening` (Phase 5c), `p5-facilitator-booth` (Phase 5d + 5e). The remaining Phase 5 items — adaptive 3-layer audio (`p5h-audio`) and scenario skins (`p5-scenario-skins`) — are next on the queue.

---

## 2.12.0 — 2026-04-18

**Theme: Ending-only branches — four tonal Act-5 outcomes decided on victory from cumulative performance (Phase 7 Tier 1).** Linear storyline. Four different denouements. Until v2.11 every successful heist ended in the same "Yippee-ki-yay" + $640M-bearer-bonds outro, regardless of whether the team cruised through in 12 minutes without a wrong answer or flailed their way to the vault in the last 90 seconds with eight trap codes. v2.12 introduces a pure classifier that runs exactly once per victory and routes the Act-5 payoff into one of four tonally distinct branches — **Analyst**, **Cowboy**, **Speedrunner**, or **Default** — each with its own narrative paragraph, audio sting, and achievement badge. This ships the **scaffolding and content for Tier 1**: the classification priority system, the `ending_classified` telemetry event, the facilitator distribution panel, and the `Endings` module are all designed to be reused by the future **Tier 2 mid-game fork** (Takagi's Refusal → Call FBI vs. Handle It Yourself), which remains gated on live-session demand signals from v2.11 telemetry.

This release implements **Phase 7 Tier 1 (ending-only branches driven by cumulative performance)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Four endings, priority-classified at victory (Phase 7 Tier 1)

- **`Endings` module** in `game.html` — a self-contained IIFE that owns the per-ending registry, priority-based classifier, DOM painter, and audio-sting dispatcher. Pure function `classify(inputs)` has zero side effects (no DOM, no audio, no telemetry), which is what lets the 120-assertion unit test exercise every threshold in a headless Node `vm` context.
- **Classification priority** (only one ending is ever assigned per session, tested in this exact order):
  1. **`speedrunner`** — `elapsed_seconds < 0.5 × TIMER_SECONDS`. Any time-cap beats every other ending: "They never even heard the countdown."
  2. **`analyst`** — `wrong_count ≤ 1` AND `hint_tokens_spent ≤ 1` AND `side_stories_discovered ≥ 3`. Clean, curious, deliberate: "The FBI finally showed up. Whoever ran point tonight — tell 'em the Bureau is hiring."
  3. **`cowboy`** — `wrong_count ≥ 4`. Messy but wins anyway: "A cop does not open seven wrong vault codes before finding the right one."
  4. **`default`** — fallback for everyone else: the classic "Welcome to the party, pal."
- **Per-ending narrative block** — injected into the victory overlay between the "Yippee-ki-yay" tagline and the elapsed-time row. Each ending supplies its own `title`, `subtitle`, and `narrative` paragraph, rendered through the module-local `_esc()` HTML-escape helper so the content is safe even if the registry is later populated from a user-supplied scenario pack.
- **Per-ending colour theme** — Analyst amber, Cowboy red-orange, Speedrunner ice-blue, Default soft green. Themed via a single CSS class on `#victory-ending` (no inline styles, no runtime-built stylesheets).
- **Per-ending audio sting** replaces the generic `playVictory()` arpeggio:
  - **`playVictoryAnalyst()`** — a reflective low-pad chord, unhurried.
  - **`playVictoryCowboy()`** — brassy cowboy-cavalry motif, slightly off-kilter.
  - **`playVictorySpeedrunner()`** — compressed staccato pulse, ends before the confetti does.
  - The `default` ending falls through to the original `playVictory()` so teams whose runs don't qualify for a tonal branch still get the canonical arpeggio.
- **Four new achievements** — `ending_analyst`, `ending_cowboy`, `ending_speedrunner`, `ending_default` — each tests `state.endingId` and fires inside the same `renderAchievements()` stack frame as every other victory badge. Teams who earned Pacifist Run, Iron Man, and an ending together see all three light up in the achievement reel.

### Added — `ending_classified` telemetry event

- **Dedicated event type** on `nakatomi_sessions` sourcetype `nakatomi:session:event`, emitted *before* `session_end` so both share the victory timestamp. Dashboards can count ending distribution in O(1) searches without filtering a 30-field `session_end` row.
- **Payload** (non-PII, mirrors the classifier inputs so the decision is auditable post-hoc):
  - `ending_id` ∈ `{analyst, cowboy, speedrunner, default}`
  - `elapsed_seconds`, `wrong_count`, `hint_tokens_spent`, `side_stories_discovered`
  - `difficulty`, `mode`, `act`
- **No raw SPL text, no DOM content, no `localStorage` contents** ever appear in the payload. Only numeric signals + the allow-listed enum.
- `NakaTelemetry.EVENT_TYPES` extended to allow-list `ending_classified`; any non-allow-listed emit is silently dropped, so a compromised caller cannot spray arbitrary analytics.
- `props.conf [nakatomi:session:event]` adds a single new extraction, `ending_id`. Every other field (`elapsed_seconds`, `wrong_count`, `hint_tokens_spent`, `side_stories_discovered`, `difficulty`, `mode`, `act`) was already covered by v2.4 / v2.6 / v2.9 `EXTRACT-` rules.

### Added — Facilitator board (Ending Branches panel)

- **`Ending Branches` row** appended to `facilitator_board.xml`, canvas extended from `1920×2620` → `1920×2860`:
  - `Endings Today` single-value KPI — distinct `ending_classified` events in the current day (per booth via the existing `booth_token` input).
  - `Ending Distribution` stacked column chart — 24h count of each `ending_id`, split by `difficulty`. A booth stuffed with Cowboy endings on `iron-man` difficulty tells a different story than the same count on `demo` difficulty.
  - `Recent Endings` table — 20 most recent classifications with `ts`, `team_code`, `ending_id`, `elapsed`, `wrong_count`, `hint_tokens_spent`, `side_stories_discovered`, `difficulty`. Lets facilitators ground-truth the classifier visually: every Speedrunner row should have an `elapsed` below half the timer, every Analyst row should have `wrong_count ≤ 1` *and* `side_stories_discovered ≥ 3`, etc.
- All ending panels honour the per-booth `booth_token` input.

### Added — Ending regression tests

- **`scripts/tests/test_endings.js`** — a self-contained Node test runner modelled on the Hans, Phone-call, Investigation-Board, and Hub-Overlay harnesses. Extracts the `Endings` IIFE, `NakaTelemetry` allow-list, and victory-overlay painter out of `game.html` and runs them in a sandboxed `vm` context with DOM stubs plus fakes for the `playVictory*` audio functions. Run: `node scripts/tests/test_endings.js`. **120 assertions** covering:
  - **Registry shape** — all four endings have a `title`, `subtitle`, `narrative`, `achievementId`, and `stingFn` (or a documented `null` fallback for `default`).
  - **Classification priority** — `speedrunner` beats `analyst`, which beats `cowboy`, which beats `default`, across every combination of boundary inputs.
  - **Threshold edges** — `wrong_count = 1` and `= 4`, `hint_tokens_spent = 1`, `side_stories_discovered = 3`, and the `elapsed_seconds < 0.5 × TIMER_SECONDS` strict-inequality cap.
  - **`_esc` HTML escape** — every ending's `title`, `subtitle`, and `narrative` are HTML-escaped before being painted; angle brackets and quotes round-trip correctly.
  - **Overlay application** — `applyToOverlay()` hides `#victory-yippee`, shows `#victory-ending`, and applies exactly one ending-theme CSS class; repeated calls don't stack classes.
  - **Audio dispatch** — `playSting(endingId)` routes to the correct `playVictory*` function; `playSting('default')` falls through to `playVictory()`; unknown endings are null-safe.
  - **Headless safety** — classify, apply-to-overlay, and play-sting all survive a stubbed-out `document` / `window` / `Audio` without throwing (for CI coverage on Splunk Cloud search-head stripped contexts).
- All five test runners (Hans, Phone, Investigation Board, Hub, Endings) now pass collectively: **410 assertions, zero failures**. CI job `node scripts/tests/test_hans_antagonist.js && node scripts/tests/test_phone_calls.js && node scripts/tests/test_investigation_board.js && node scripts/tests/test_hub_overlay.js && node scripts/tests/test_endings.js` exits 0.

### Security / sandboxing notes (Phase 7 Tier 1)

- **Pure classifier, no side effects.** `Endings.classify()` is a pure function — no DOM reads, no `localStorage`, no audio, no telemetry. That's deliberate: the function can be audited in isolation, the unit-test harness exercises every branch without stubbing a browser, and the `state.endingId` result is the single source of truth for every downstream effect (achievement, overlay, sting, telemetry).
- **All ending content is HTML-escaped before rendering.** The module-local `_esc()` helper is applied to `title`, `subtitle`, and `narrative` on every paint. This matters because the v2 scenario JSON schema (documented in the module header) will eventually let scenario packs override the default endings — at that point the content is untrusted input, and the escape is already wired.
- **Telemetry is allow-list enforced.** `ending_classified` is added to `NakaTelemetry.EVENT_TYPES`; any other emit with that event type is dropped at the allow-list boundary. The payload schema contains no free-text fields.
- **No persistent player-authored data.** The ending system has no `localStorage` / IndexedDB writes. `state.endingId` lives in the same `state` object that's already cleared on `resetGame()`, and the overlay explicitly hides `#victory-ending` and resets `#victory-yippee` when a new game starts.

### Release summary

| Metric                            | v2.11.0 | v2.12.0 | Δ     |
| --------------------------------- | ------: | ------: | ----: |
| Unit-test assertions              |     290 |     410 |  +120 |
| Test runners                      |       4 |       5 |    +1 |
| Game UI modules (self-contained)  |       7 |       8 |    +1 |
| Telemetry event types             |      ~26 |     ~27 |    +1 |
| Achievements                      |      42 |      46 |    +4 |
| Facilitator board rows            |       9 |      10 |    +1 |
| Facilitator board canvas height   |    2620 |    2860 |  +240 |
| `props.conf` extractions          |      ~45 |     ~46 |    +1 |
| `app.conf` build                  |      31 |      32 |    +1 |

**Upgrade impact:** zero. No new indexes, no new sourcetypes, no new KV Store collections, no new knowledge objects, no new alerts. Existing in-flight sessions keep working; teams mid-game when the app is upgraded simply don't trigger the `ending_classified` event until they win (at which point the fresh classifier runs against whatever signals they accumulated).

---

## 2.11.0 — 2026-04-18

**Theme: Free-roam Floor-30 hub — a clickable blueprint-style map that turns linear acts into an explorable crime scene (Phase 8a).** The original Nakatomi Heist was a strictly linear 26-task march from Act 1 → Act 5. v2.11 introduces a **visual hub overlay** that lets teams see the entire Floor-30 layout at a glance and jump between seven interactive stations — Security Terminal, Vault Keypad, Leads Ledger, Briefing Wall, Blueprint, Comms Intercepts, and Investigation Board — while still honouring every scenario's gating rules. This release is the **foundation layer** for Phase 8: the UI, telemetry, and facilitator analytics ship now as a shippable v2.11.0 minor bump; the deeper scenario-schema-v2 changes (dynamic `available_when` / `completes_when` / branching leads) land in a later v2.x release without breaking anything built on top of 2.11.

This release implements **Phase 8a (free-roam hub UI layer)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Floor-30 hub overlay (Phase 8a)

- **`HubOverlay` module** in `game.html` — a full-screen blueprint-style overlay (`#overlay-hub`, `z-index:9450`) that sits between the Investigation Board (9500) and the pause menu (9800), so a hub click can open a sub-experience without the hub itself staying visually in the way. Public API: `init()`, `open(trigger)`, `close(trigger)`, `toggle(trigger)`, `isOpen()`, `station(id)`, `refresh()`, `setAvailability(overrides)`.
- **Seven interactive stations** — each is a registered entry in `STATION_IDS` with its own label, icon, default-availability rule, and routing target:
  1. **`terminal`** — Security Terminal (Splunk search console). Opens the scenario briefing intro and surfaces the current task's SPL assist.
  2. **`keypad`** — Vault Keypad (4-digit entry). Focuses the keypad field even if the hub was opened from the pause menu.
  3. **`leads`** — Leads Ledger (discovered side stories, trap-code lore, intercept echoes). Opens the in-game dossier with the Leads tab pre-selected.
  4. **`briefing`** — Briefing Wall (act intro cinematics on re-demand). Re-plays the current act's scripted briefing beat.
  5. **`blueprint`** — Floor-30 Blueprint (SVG floor plan with room labels). Opens the blueprint viewer overlay.
  6. **`comms`** — Comms Intercepts (Hans + Powell + Holly transcripts). Opens the dossier with the Comms tab pre-selected.
  7. **`board`** — Investigation Board (the Phase 6g corkboard). Closes the hub and defers to `InvestigationBoard.open('hub')`, so the two overlays never fight for focus.
- **Availability engine** — each station's default-availability rule is evaluated on every `refresh()`. States are `available` (clickable, lit), `locked` (visible but disabled, tooltip explains the unlock condition), or `hidden` (completely absent from the DOM — used for stations that don't apply to booth mode). Examples:
  - `keypad` is `locked` until Act ≥ 3 (the vault sequence doesn't exist narratively yet).
  - `blueprint` is `available` once the player has unlocked at least one act-specific discovery.
  - `board` is `hidden` in `?booth=1` simplified pin-only mode, so a 5-minute queue visitor never has to understand the corkboard.
- **Keyboard navigation** — arrow keys cycle focus across available stations; `Enter` / `Space` activates the focused station; `Escape` closes the overlay and restores focus to whichever element had focus before the hub opened. Every station is a real `<button>` with an `aria-label`, so screen-reader walkthroughs are coherent.
- **Reduced-motion honouring** — the ambient vault-pulse glow and the station hover scale-up are suppressed when `prefers-reduced-motion: reduce` is set. The hub still _functions_ identically; only the embellishments are dropped.
- **Three entry points**:
  1. **`M` hotkey** — `M` for "Map" toggles the hub from anywhere (except text inputs / textareas, and except while a phone-call overlay is active). Listed in the `?` shortcuts help overlay.
  2. **Pause menu** — a new `FLOOR-30 MAP [M]` button joins `RESUME`, `SETTINGS`, `INVESTIGATION BOARD`, and `MAIN MENU`. Clicking it dismisses the pause overlay and opens the hub.
  3. **Programmatic** — `HubOverlay.open('autoload')` for future scenario-driven entry (Phase 8b will wire this to `scenario.auto_open_hub_at_act`).
- **Live status panel** — the hub's right-hand side panel reflects real-time game state every time it's opened or refreshed: current act, current task, elapsed session time, hint tokens remaining, side stories / easter eggs / trap codes discovered, and (when the Investigation Board has content) board pin / thread / note counts. Values are sourced from `state.*` and `InvestigationBoard.stats()` — no duplicate state, no drift risk.

### Added — Hub telemetry (three new event types)

- **`hub_opened`** — emitted on every open. Fields: `trigger` ∈ `{hotkey, pause_menu, autoload}`, `act`, `task_id`, `available_station_count`, `locked_station_count`, `hidden_station_count`. Useful for understanding whether teams organically adopt the hub or only touch it when a facilitator cues them.
- **`hub_closed`** — emitted on every close. Fields: `trigger` ∈ `{hotkey, station_click, esc, backdrop_click, game_over, reset}`, `elapsed_ms` (session-local dwell time in the hub for the current open), `interactions` (count of station clicks during this open). `elapsed_ms` is measured inside the module — it does NOT fall back to wall-clock subtraction if the browser clock skews.
- **`hub_station_clicked`** — emitted on every station activation. Fields: `station_id` (from the `STATION_IDS` allow-list — unknown IDs are dropped at emit time), `availability` ∈ `{available, locked, hidden}` (lets facilitators see when teams are mashing on locked stations trying to skip ahead), `act`, `task_id`.
- All three events added to the `NakaTelemetry.EVENT_TYPES` allow-list. Any non-allow-listed emit is silently dropped.
- `props.conf [nakatomi:session:event]` adds explicit extractions for `trigger`, `station_id`, `availability`, `elapsed_ms`, `interactions`, `available_station_count`, `locked_station_count`, `hidden_station_count` so facilitator queries don't need JSON `spath`.

### Added — Facilitator board (Hub panels)

- **`Floor-30 Hub` row** appended to `facilitator_board.xml`, canvas extended from `1920×2360` → `1920×2620`:
  - `Hub Sessions Today` single-value KPI — distinct teams that opened the hub at least once (per booth via the existing `booth_token` input).
  - `Station Click Mix` stacked column chart — 24h `hub_station_clicked` events by `station_id`, split by `availability`. Facilitators can see at a glance which stations are being hit, and — critically — whether teams are repeatedly clicking locked stations (a strong signal they don't understand the current gating and need a nudge).
  - `Hub Dwell Time (median / max, by close trigger)` stats table — median and max `elapsed_ms` grouped by `trigger`. A high median dwell on `esc` suggests teams are using the hub as a strategic overview; high dwell on `station_click` suggests they're using it as a launchpad; high dwell on `backdrop_click` may indicate they're misunderstanding that click-outside dismisses the overlay.
- All hub panels honour the per-booth `booth_token` input.

### Added — Hub regression tests

- **`scripts/tests/test_hub_overlay.js`** — a self-contained Node test runner modelled on the Hans, Phone-call, and Investigation-Board harnesses. Extracts `NakaTelemetry` + `HubOverlay` out of `game.html` and runs them in a sandboxed `vm` context with custom DOM stubs plus fakes for the global helpers the module depends on (`toggleDossier`, `showActIntro`, `togglePause`, `a11yAnnounce`, `toast`). Run: `node scripts/tests/test_hub_overlay.js`. 68 assertions covering:
  - **Module surface** — all 8 public methods (`init`, `open`, `close`, `toggle`, `isOpen`, `station`, `refresh`, `setAvailability`) are exposed.
  - **Event allow-list** — `hub_opened`, `hub_closed`, and `hub_station_clicked` are all allow-listed; unknown event types are silently rejected.
  - **`STATION_IDS` registry** — all seven stations are registered and discoverable via `station(id)`; each has a non-empty label, icon, and default-availability rule.
  - **Default availability rules** — `terminal`, `leads`, `briefing`, `comms`, `board` are all `available` by default; `keypad` is `locked` at Act 1 and `available` at Act ≥ 3; `board` is `hidden` when `?booth=1`.
  - **Open / close idempotency** — two consecutive `open()` calls queue exactly ONE `hub_opened` event (no duplicate-ring bug); two consecutive `close()` calls queue exactly ONE `hub_closed` event.
  - **Toggle correctness** — `toggle()` on a closed hub opens and emits `hub_opened`; `toggle()` on an open hub closes and emits `hub_closed` with `elapsed_ms > 0`.
  - **Unknown-station safety** — `station('notarealstation')` returns `null`; emitting a click on an unknown station id is a no-op (nothing queued, no throw).
  - **Locked-station telemetry** — clicking a locked station emits `hub_station_clicked` with `availability=locked` but does NOT fire the station's route handler.
  - **Open-station telemetry** — clicking an available station emits `hub_station_clicked` with `availability=available` AND fires the station's route handler exactly once.
  - **`setAvailability()` overrides** — custom overrides beat the default rules; passing an override for an unknown station is a no-op.
  - **Telemetry sanitization** — HEC token never appears in any queued hub event payload (asserted by full-queue JSON stringify + substring search).
  - **Pause-handoff** — opening the hub while the pause overlay is visible auto-dismisses the pause overlay (both become compatible siblings, not stacking peers).
- All four test runners (Hans, Phone, Investigation Board, Hub Overlay) now pass collectively: **290 assertions, zero failures**. CI job `node scripts/tests/test_hans_antagonist.js && node scripts/tests/test_phone_calls.js && node scripts/tests/test_investigation_board.js && node scripts/tests/test_hub_overlay.js` exits 0.

### Security / sandboxing notes (Phase 8a)

- **No evaluation, no injection paths.** The hub routes station clicks through a hard-coded switch on the `STATION_IDS` allow-list — there is no `eval`, no `new Function`, no `innerHTML`-from-user-input anywhere in the module. Station labels and icons are emitted via the module's local `esc()` helper (identical to the pattern introduced in the Investigation Board).
- **Telemetry allow-lists are enforced at emit time.** `hub_station_clicked` with a `station_id` not in `STATION_IDS` is silently dropped; the same guard covers the parent event-type allow-list. A compromised caller cannot spray the hub telemetry at arbitrary analytics indexes.
- **No persistent player-authored data.** Unlike the Investigation Board, the hub has no `localStorage` writes — it is a pure presentational overlay over existing game state. There's nothing a future XSS could poison to re-trigger on next load.
- **`?booth=1` explicitly narrows the attack surface.** Queue-visitor mode hides the `board` station entirely (no module load), and the hub itself is a zero-input UI — no text fields, no drag surfaces, no file uploads.

### Release summary

- **Files touched** — `game.html` (hub CSS + HTML + `HubOverlay` IIFE + `M` hotkey + pause-menu button + lifecycle hooks), `nakatomi_heist/default/data/ui/views/facilitator_board.xml` (3 new data sources + 6 new viz panels + canvas height 2360→2620), `nakatomi_heist/default/app.conf` (version 2.10.0 → 2.11.0, build 30 → 31), `scripts/tests/test_hub_overlay.js` (NEW, 68 assertions), `RELEASE_NOTES.md`, `README.md`, `docs/PLAYER_EXPERIENCE.md`.
- **Scenario JSON contract** — unchanged. A v2.10 scenario pack loads on v2.11 with no migration. (Phase 8b will add optional `hub_layout` / `available_when` / `completes_when` keys; until then, the default availability rules apply.)
- **Regression coverage** — 290 assertions across four unit-test harnesses (Hans 69 + Phone 84 + Investigation Board 69 + Hub Overlay 68).

---

## 2.10.0 — 2026-04-18

**Theme: Adaptive Hans + facilitator phone-call cinematic + investigation board — a reactive antagonist, on-demand in-character calls, and a corkboard that turns the booth into a live-directed detective table (Phase 5i + 6g).** Hans Gruber is no longer a scripted set of pre-baked intercepts; v2.10 adds a reactive layer that listens to six in-game signals (idle teams, lazy broad queries, keypad spam, fast solves, side-story discoveries, Konami code) and fires one of 36 hand-authored reaction lines with a tonal bias driven by act number — light/taunting in acts 1-2, sinister/intimate by act 5. Alongside it, facilitators now have a **one-shortcut phone cinematic** (`Ctrl+Shift+1/2/3` or `#call=powell|hans|holly`) that rings a top-right overlay voiced via `SpeechSynthesis`, ducks the ambient bed to 30%, and tracks `incoming → answered | missed` lifecycle events on telemetry. Every Hans reaction lands on **two indexes at once**: the raw KV line flows into `nakatomi_comms sourcetype=intercept:hans` alongside the hand-authored transcripts (so it shows up in-world when players grep the comms index), and a compact metadata copy on `nakatomi_sessions event_type=hans_reaction` lets the facilitator board count antagonist activity without cross-index queries. Throttled to one line per five minutes per team with a three-line recent-window suppression, so the effect is atmospheric rather than nagging.

This release implements **Phase 5i (adaptive Hans + phone-call cinematic)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

### Added — Adaptive Hans reaction engine (Phase 5i)

- **`HANS_REACTIONS` registry** in `game.html` — 36 hand-authored lines spread across six triggers and two tones:
  - `idle` (6) — fires when a team has been quiet for ≥2 minutes
  - `lazy_queries` (6) — fires when a player runs a broad unfiltered search
  - `keypad_spam` (6) — fires after 6 wrong codes within 60 seconds
  - `fast_solves` (6) — fires when a task is completed well under expected time
  - `side_story_discoveries` (6) — fires when a `9xxx` side-story code resolves
  - `konami_code` (6) — fires when the vault keypad detects ↑↑↓↓←→←→BA
- Each trigger bucket ships **3 light + 3 sinister** lines, so the recent-window suppression (avoid repeating any of the last 3 IDs) never starves.
- **`HansAntagonist` module** — public API `trigger(event, ctx)`, `noteActivity()`, `noteKeypadWrong()`, `pollIdle()`, `reset()`. Internal state: global throttle (5 min / team), idle threshold (2 min), keypad-spam window (60 s / 6 wrongs), tone bias by `actIdx`, last-3-reactions suppression per tone bucket.
- **Dual-destination telemetry** via new `NakaTelemetry.emitIntercept()`:
  1. Raw `channel=... speaker=Hans reaction_id=... trigger=... tone=... transcript=...` KV line to `index=nakatomi_comms sourcetype=intercept:hans` — matches the format of the generator's hand-authored intercepts so players can't tell them apart with an SPL query.
  2. JSON `hans_reaction` event (no transcript — intentionally pruned) to `index=nakatomi_sessions sourcetype=nakatomi:session:event` for booth-wide analytics.
- **Hans speech-bubble UI overlay** — `.hans-reaction` CSS class, auto-dismissing after 6 s, with tonal colour variants (warm/amber for light, cold/red for sinister). Screen-reader announced via the existing `a11yAnnounce()` live region so the effect is not visual-only.

### Added — Splunk integration

- **`props.conf [intercept:hans]`** — new explicit stanza with extractions for `channel`, `speaker`, `reaction_id`, `trigger`, `tone`, `act` so adaptive lines and hand-authored lines parse identically. `KV_MODE = auto` preserves existing field discovery for ad-hoc narrative content.
- **`props.conf [nakatomi:session:event]`** — adds extractions for the `hans_reaction` metadata event (`reaction_id`, `tone`, `channel`, `speaker`) so facilitator queries don't need JSON spath.
- **`INTERCEPT_TARGETS` allow-list** in `NakaTelemetry` — v2.10 permits only `intercept:hans`. Any caller-supplied target not in the allow-list is silently dropped with a console warning; no event is queued. This prevents a bug in a caller from spraying events at arbitrary indexes.

### Added — Facilitator board (Adaptive Hans panels)

- **`Adaptive Hans` row** at the bottom of `facilitator_board.xml`, canvas extended from `1920×1450` → `1920×1790`:
  - `Hans Reactions Today` single-value KPI (per booth via the existing `booth_token` input)
  - `Recent Hans Reactions` table — last 25 lines with `ts / team_code / act / trigger_label / tone / reaction_id` (human-readable trigger labels like "Idle (2m quiet)", "Keypad spam")
  - `Hans Trigger + Tone Mix` stacked column chart — 24 h reactions by `trigger`, split by `tone` so facilitators can confirm the act-5 sinister bias is actually firing
- All Hans panels honour the existing per-booth `booth_token` input, so a multi-booth conference can filter to one booth.

### Added — Telemetry wire format

- **Event type allow-list** — `hans_reaction` added to `NakaTelemetry.EVENT_TYPES`. Any event type not in the allow-list is rejected at emit time.
- **`buildHecBatch()` routing** — events can now carry `_target` and `_raw` metadata so a single queue can feed multiple sourcetypes/indexes from one HEC token. Internal-only keys (`_target`, `_raw`) are stripped before serialization so they never leak into the event body.
- **Token hygiene (regression-tested)** — the HEC token NEVER appears in the queued event payload. The unit test (`scripts/tests/test_hans_antagonist.js`) asserts the raw KV string and the JSON metadata envelope are both token-free even when telemetry is fully configured.

### Added — Regression test harness

- **`scripts/tests/test_hans_antagonist.js`** — a self-contained Node test runner that extracts the `NakaTelemetry`, `HANS_REACTIONS`, and `HansAntagonist` modules out of `game.html` and executes them inside a sandboxed `vm` context with minimal DOM / browser stubs. Run: `node scripts/tests/test_hans_antagonist.js`. 69 assertions covering:
  - **Registry integrity** — ≥30 reactions, all tones valid, all IDs unique, every `(trigger, tone)` bucket has ≥3 lines, lookup tables resolve every ID.
  - **Public API surface** — `emit`, `emitIntercept`, and all five `HansAntagonist` methods exposed.
  - **Core behavior** — happy-path trigger, global 5-min throttle blocks second fire, `reset()` clears throttle, keypad spam fires at 6 wrongs (not 5), `noteActivity()` resets idle clock.
  - **Tone bias** — at act 1, light outnumbers sinister ≥1.5×; at act 5, sinister outnumbers light ≥2×.
  - **Recent-window suppression** — 3 consecutive triggers in the same tone bucket yield 3 distinct reaction IDs.
  - **Wire format** — `emitIntercept` enqueues exactly two events (raw `intercept:hans` and metadata `hans_reaction`), the raw event carries a `_target` + `_raw` key=value string matching the generator's KV schema, the metadata event intentionally does **not** duplicate the transcript, and the HEC token does not leak into either payload.
  - **Target validation** — calls with a target not in the `INTERCEPT_TARGETS` allow-list are dropped without queueing.

### Added — Facilitator phone-call cinematic (Phase 5i)

- **`PhoneCalls` module** in `game.html` — manages a single active call at a time, with three preset callers: **Sgt. Al Powell** (tactical/support hint), **Hans Gruber** (antagonist threat), **Holly Gennero** (emotional beat). Each caller exposes a rotating pool of in-character lines so repeated triggers at the same booth don't replay the exact same audio.
- **Ring overlay UI** — top-right `.phone-call` fixed panel, `z-index:9700` so it visually takes precedence over a concurrent Hans taunt (9600). Caller-specific tonal colors match the Hans speech-bubble convention (amber/warm for Powell, red/sinister for Hans, teal/warm for Holly). Ringing state shows accept + decline buttons; speaking state shows a transcript + hang-up button. Honors `prefers-reduced-motion` (no pulse animation on the ringing badge).
- **Three trigger paths**:
  1. **Facilitator hotkeys** — `Ctrl+Shift+1/2/3` (or `⌘⇧1/2/3` on macOS) summon Powell / Hans / Holly. Gated on `e.code` so the shortcut survives non-US keyboard layouts where Shift+1 produces a different glyph. Ignored when a text input is focused (facilitator pin entry, team code) but active during pause so a facilitator can cue a cinematic while the game is paused for a talk.
  2. **URL hash** — `#call=powell` fires a preset rotation line on load; `#call=hans:Listen+carefully` fires an ad-hoc facilitator-authored line via live TTS. Hash is cleared after trigger so browser-back doesn't re-ring. Useful for pre-scripted demo URLs.
  3. **Programmatic** — `PhoneCalls.trigger(caller, customLine?)` for future KV-Store poll integration from the facilitator dashboard.
- **`speechSynthesis`-backed voice output** — each caller has its own voice profile (rate/pitch/locale preference), so Powell sounds different from Hans. Browsers without `SpeechSynthesis` still render the transcript as text so no dialogue is silently lost.
- **Audio ducking** — the ambient synth bed is smooth-ducked to 30% via `setTargetAtTime` while the phone is ringing or speaking; the original gain is restored on dismiss. Fully compatible with the existing Phase 5h adaptive mix.
- **Pause interaction** — `togglePause()` calls `speechSynthesis.pause()` / `.resume()` so a facilitator talk can cleanly interrupt in-game voice output without dismissing the overlay.
- **Mute respect** — `toggleMute()` now calls `speechSynthesis.cancel()` immediately, so muting is a real kill switch, not just an ambient-bed switch. `PhoneCalls.setMuted(true)` exposes a per-session phone-only mute for facilitators who want ambient audio but no TTS.
- **Session-end safety** — `triggerGameOver()` and `triggerVictory()` both dismiss any active call so the death screen / confetti reel isn't narrated over by TTS or ringing.

### Added — Phone-call telemetry (three new event types)

- **`phone_call_incoming`** — emitted when a call is queued. Fields: `caller` ∈ `{powell, hans, holly}`, `delivery_type` ∈ `{preset, adhoc}`, `line_preset_id` (e.g. `powell_3` for preset lines; the literal `adhoc` for facilitator-authored text), `act`, `task_id`. **Raw ad-hoc text is intentionally NOT emitted** — only the preset ID is captured — so live facilitator improvisation stays off the wire.
- **`phone_call_answered`** — emitted when the player clicks **Answer**. Adds `latency_ms` (ring-start → accept) so facilitators can measure player attention.
- **`phone_call_missed`** — emitted when the player clicks **Decline**, hits `ESC`, or lets the call auto-expire after 30 s. Adds `ring_duration_ms`. Cleanly distinguishes ignored cinematics from answered ones for scripting replay.
- All three events added to the `NakaTelemetry.EVENT_TYPES` allow-list; any non-allow-listed emit is silently dropped.
- `props.conf [nakatomi:session:event]` ships explicit extractions for `caller`, `delivery_type`, `line_preset_id`, `latency_ms`, `ring_duration_ms` so facilitator queries don't need JSON `spath`.

### Added — Facilitator board (Phone-call panels)

- **`Facilitator Phone Calls` row** appended to `facilitator_board.xml`, canvas extended `1920×1790 → 1920×2120`:
  - `Phone Calls Today` single-value KPI (per booth via the existing `booth_token` input)
  - `Recent Phone Calls` table — last 25 lifecycle events with `ts / team_code / state (INCOMING|ANSWERED|MISSED) / caller / delivery_type / line_preset_id`
  - `Phone Mix` stacked column chart — 24 h incoming calls by `caller`, split by `delivery_type` so facilitators can see which characters they're cueing the most and how much of their phone traffic is live-authored vs preset
- All phone panels honour the per-booth `booth_token` input.

### Added — Phone-call regression tests

- **`scripts/tests/test_phone_calls.js`** — a self-contained Node test runner modelled on the Hans harness. Extracts `NakaTelemetry` + `PhoneCalls` out of `game.html` and runs them in a sandboxed `vm` context with custom DOM/`fetch`/`speechSynthesis` stubs. Run: `node scripts/tests/test_phone_calls.js`. 84 assertions covering:
  - **Registry integrity** — three callers, each with ≥3 preset lines, each line non-empty; TTS voice descriptor on every caller; public API surface exposed.
  - **Event-type allow-list** — `phone_call_incoming`, `phone_call_answered`, `phone_call_missed` all admitted.
  - **Happy path** — `trigger()` returns `true`, flips `isActive()`, queues exactly one incoming event with correct caller/delivery/preset id/act/task fields, renders an overlay with caller-specific tone class and answer/decline buttons, no HEC token leaks into the payload.
  - **Single-call invariant** — a second `trigger()` while a call is active returns `false` and does not queue a second incoming event.
  - **Answer flow** — clicking the answer button fires exactly one `phone_call_answered` with `latency_ms`; subsequent `dismiss()` counts as hang-up (no `phone_call_missed`).
  - **Miss flow** — `dismiss()` on a never-answered call emits `phone_call_missed` with `ring_duration_ms`.
  - **Unknown caller safety** — `trigger('badguy')` returns `false`, queues nothing, does not throw.
  - **Ad-hoc delivery** — `trigger(caller, customText)` queues an incoming with `delivery_type=adhoc` and `line_preset_id=adhoc`, and the **raw facilitator text is never written to telemetry** — asserted by inspecting the full queue payload.
  - **Preset rotation** — three consecutive `trigger('powell')` calls cycle through distinct preset IDs.
  - **Mute state** — `setMuted(true)` and `setMuted(false)` both stick across queries.
  - **Hash trigger** — `init()` on a `#call=powell` URL fires `trigger()` asynchronously after a short debounce; exactly one incoming event is emitted.

### Added — Investigation board (Phase 6g)

- **`InvestigationBoard` module** in `game.html` — a full-screen corkboard overlay (`#overlay-board`, `z-index:9500`) where teams connect evidence. Public API: `init()`, `open(source)`, `close()`, `toggle(source)`, `isOpen()`, `autoPin(clue)`, `exportPNG(trigger)`, `clear()`, `stats()`.
- **Six pin categories** — `task` (completed objectives), `story` (side mysteries), `intercept` (answered phone calls), `egg` (easter eggs), `lore` (decoy codes with lore payoff), `suspect` (manually flagged). Each category has its own colour, label, and telemetry facet. The registry (`_PIN_TYPES`) is the single source of truth — unknown types fall back to `lore` with a console warning, so a future generator change can't crash the board.
- **Clue tray → corkboard flow** — clues appear in a draggable left-hand tray as they are discovered in-game. Players drag them onto the corkboard to pin; the pin becomes the anchor for red-string threads. Coordinates are stored as **percentages** (not absolute pixels) so the board reflows correctly on orientation change, window resize, and the 1080p PNG export.
- **Red-string connection threads** — click a pin then click a second pin to draw a thread between them. Threads render in an SVG overlay beneath the pins so they never obscure clue titles. Delete a pin and its threads are automatically pruned.
- **Freehand notes & suspect flags** — double-click the board canvas to add a sticky note (length-capped at 300 characters). Right-click a pin (or long-press on touch) to toggle the `suspect` flag, which upgrades the pin to the suspect colour and emits a secondary telemetry event.
- **Six auto-pin hooks** — `autoPin(clue)` is invoked from six game-lifecycle events so teams never have to manually transcribe what they've found:
  1. **Task completion** — `completeCurrentTask()` pins the task's storyBeat as a `task` clue.
  2. **Side-story discovery** — `handleSideStoryDiscovery()` pins the story teaser as a `story` clue on first discovery only (dedup via `sourceId='story_<id>'`).
  3. **Easter-egg discovery** — `handleEasterEggDiscovery()` pins the egg teaser as an `egg` clue on first discovery only.
  4. **Phone-call answered** — `PhoneCalls.onAnswer()` pins the caller + snippet as an `intercept` clue with a weak fingerprint so replaying the same preset doesn't duplicate the pin.
  5. **Trap-code lore** — `handleTrapCode()` pins a `lore` clue when a decoy keypad code has a lore payoff (e.g. `1990`, `0911`, `1666`, `1988`), preserving the discoverable fiction for the investigation timeline.
  6. **Manual pin** — players can always manually drag a tray clue onto the board.
- **Dedup by `sourceId`** — every auto-pin carries a stable `sourceId` (`task_<id>`, `story_<id>`, `egg_<id>`, `call_<caller>_<fingerprint>`, `trap_<code>`). A second auto-pin with the same sourceId is a no-op — the board state stays clean even if a task is re-completed or a phone call is replayed.
- **Cap-with-eviction** — persistent state is capped at **200 pins / 300 threads / 50 notes**. On overflow, the oldest pin is evicted (and its threads pruned) so long marathon sessions don't blow the `localStorage` quota. The cap is enforced at queue time, not at save time, so telemetry is never silently dropped.
- **PNG export (1080p, 1920×1080)** — `exportPNG(trigger)` renders the corkboard to a `<canvas>` (not via DOM serialization — that would be injection-risky and wouldn't capture SVG threads correctly), watermarks it with the team code + timestamp, and triggers a browser download. Exposed from the pause menu AND appended as a `DOWNLOAD PNG` button on the victory breakdown — but only if the board has at least one pin or note, so pristine solo-speedrun boards don't render empty.
- **Booth-mode simplification** — `?booth=1` mounts the board in `pin-only` mode: tray + pins, no threads, no notes. Reduces cognitive load for 5-minute queue visitors while keeping the "see what you've found" value.
- **Persisted in `localStorage`** under key `nakatomi_investigation_board_v1` with a schema-version guard. `resetGame()` both closes and clears the board; `triggerGameOver()` closes the overlay but preserves state so teams can still export a death-screen souvenir.
- **Hotkey & pause-menu integration** — `B` toggles the board from anywhere (except text inputs); `Escape` closes it; a "📌 INVESTIGATION BOARD" button is added to the pause overlay. The `?` shortcuts help overlay lists `B — Investigation board`.

### Added — Investigation-board telemetry (four new event types)

- **`clue_pinned`** — emitted on every successful pin (auto or manual). Fields: `pin_id`, `pin_type`, `source` (e.g. `task_complete`, `side_story`, `phone_call`, `trap_code`, `drag_drop`), `pin_count` (running total), `thread_count`, `note_count`, `board_open` (whether the board was open when the pin landed).
- **`thread_drawn`** — emitted when a connection thread is drawn between two pins. Fields: `thread_id`, `from_pin_type`, `to_pin_type`, `thread_count`, `same_type` (boolean). Useful facilitator signal: high same-type ratios suggest teams are clustering rather than connecting.
- **`note_added`** — emitted when a freehand note is added or edited. Fields: `note_id`, `note_length`, `note_count`. The note body itself is **not emitted** — treated like the phone-call ad-hoc text (player-authored free text stays off the wire).
- **`board_exported`** — emitted on PNG export. Fields: `trigger` ∈ `{pause_menu, victory, manual}`, `pin_count`, `thread_count`, `note_count`, `elapsed_seconds`. The exported PNG itself is NOT uploaded — only the metadata.
- All four events are in the `NakaTelemetry.EVENT_TYPES` allow-list; emit-time validation rejects events with an unknown type.

### Added — Investigation-board regression tests

- **`scripts/tests/test_investigation_board.js`** — a self-contained Node test runner modelled on the Hans and Phone-call harnesses. Extracts `NakaTelemetry` + `InvestigationBoard` out of `game.html` and runs them in a sandboxed `vm` context with custom DOM stubs (including an `HTMLCanvasElement.getContext('2d')` stub with no-op drawing methods and sensible `measureText` / `toDataURL` fakes so `exportPNG` can run end-to-end without a real browser). Run: `node scripts/tests/test_investigation_board.js`. 69 assertions covering:
  - **Module surface** — all 9 public methods (`init`, `open`, `close`, `toggle`, `isOpen`, `autoPin`, `exportPNG`, `clear`, `stats`) plus the `_PIN_TYPES` registry and internal `_state.pins` test-access are exposed.
  - **Pin-type registry integrity** — all six categories present, each with a non-empty label and telemetry facet.
  - **Event allow-list** — `clue_pinned`, `thread_drawn`, `note_added`, and `board_exported` are all allow-listed.
  - **Happy-path auto-pin** — a single `autoPin()` produces a clue object, bumps `stats().pinCount`, and queues exactly one `clue_pinned` event with correct fields.
  - **Deduplication** — a second auto-pin with the same `sourceId` is a no-op — neither the pin count nor the telemetry queue grows.
  - **Sanitization & type fallback** — unknown pin types fall back to `lore`; pin bodies are clipped to ≤200 chars; junk content can't crash the render path.
  - **Pin-cap eviction** — 250 distinct auto-pins in a row settle at exactly 200 pins (oldest-first eviction).
  - **XSS resistance** — raw titles containing `<script>` tags are stored unchanged in state (escaping happens at render time via the module's local `esc()`), so future reads can round-trip without data loss.
  - **Persistence** — after auto-pinning, `localStorage[nakatomi_investigation_board_v1]` contains valid JSON with a `pins` array of the expected length.
  - **`clear()` semantics** — zeroes pin/thread/note counts AND removes the `localStorage` blob (not just the in-memory copy).
  - **`exportPNG()`** — fires `board_exported` with `trigger`, `pin_count`, `thread_count`, `note_count` all correctly populated; doesn't crash with the minimal canvas stub.
  - **`isOpen()` / `toggle()`** — round-trip correctly.
- The test runner currently produces **222 passing assertions across all three modules** (Hans 69, Phone 84, Board 69) with zero failures.

### Added — Facilitator board (Investigation-board panels)

- The facilitator dashboard (`facilitator_board.xml`) canvas extended from `2120 → 2360` to host a new **Investigation Board** row:
  - `Board Pins Today` single-value KPI (per-booth via the existing `booth_token` input).
  - `Pin Type Mix` stacked column chart — 24h `clue_pinned` events by `pin_type`, giving facilitators a fast read on what teams are actually pinning (did anyone find the easter eggs? Did the lore intercepts resonate?).
  - `Top Investigating Teams` table — top 10 teams by (`pin_count + thread_count × 2 + note_count`), so facilitators can recognise teams who invested in the meta-puzzle during the post-session debrief.
- All three panels honour the existing `booth_token` input so a multi-booth conference can still filter.

### Changed

- **`app.conf`** — version bumped `2.9.0 → 2.10.0`, description extended with "v2.10 Adaptive Hans reactive antagonist + facilitator phone-call cinematic + investigation board".
- **`README.md`** — facilitator-dashboard section describes the new Adaptive Hans, Phone-call, and Investigation-board rows, canvas height updated to `2360`.
- **`docs/PLAYER_EXPERIENCE.md`** — section `9.8` documents Adaptive Hans; section `9.9` documents the facilitator phone-call cinematic; new section `9.10` documents the investigation board, including the six auto-pin hooks, PNG export, hotkey, booth-mode simplification, and accessibility guarantees.
- **`game.html` shortcuts help** — `?` overlay now lists the three facilitator phone shortcuts (`Ctrl+Shift+1/2/3`) AND `B — Investigation board`.
- **`game.html` pause menu** — adds `📌 INVESTIGATION BOARD` button between the existing menu actions.

### Security notes

- Every reaction line passes through the existing `safeId()` / `safeText()` sanitizers before being written to the queue, matching how player-authored fields are handled.
- The `INTERCEPT_TARGETS` allow-list is an **explicit deny-by-default** routing table — new intercept destinations require an explicit code change, not a runtime config.
- `_target` and `_raw` keys are internal-only: they are stripped by `buildHecBatch()` before the JSON envelope is built, so they cannot escape via the default session stream.
- **Ad-hoc phone-call text is never emitted to telemetry.** This is a deliberate design decision: booth facilitators occasionally improvise lines tied to a specific audience (e.g. "Hey Ada's team — Hans knows you're about to skip the VPN check") and that content is inappropriate for a retained session log. The `test_phone_calls.js` harness asserts the raw text does not appear in the queue, so a future refactor cannot regress this property silently.
- All phone-call overlay DOM insertion goes through `escHTML()` — no caller id, transcript, or caller-supplied string is ever assigned to `innerHTML` without escaping.
- The unit tests explicitly assert the HEC token does not appear in the queued payload (it's attached to the HTTP `Authorization` header at drain time, not the event body).
- **Investigation-board module isolation.** The `InvestigationBoard` IIFE declares its own local `safeId()`, `safeText()`, and `esc()` helpers rather than calling the globals from `NakaTelemetry` / `escHTML()`. This keeps the module unit-testable in a `vm` context (where the globals may be absent) AND defends against a future refactor accidentally removing a global sanitizer. Both copies are kept in lock-step — the unit test's XSS-probe assertion would fail if the module reverted to `.innerHTML` without escaping.
- **Freehand-note text is never emitted to telemetry** — mirroring the phone-call ad-hoc rule. Notes live in `localStorage` only; `note_added` carries the length but not the body.
- **PNG export uses `<canvas>` rendering, not DOM serialization** — a `document.body.innerHTML`-to-canvas approach would have been easier but would have inherited any XSS primitive from a pin title. The canvas path explicitly reads each pin's text through the local `esc()` helper before rasterizing, so a malicious clue can only affect the attacker's own exported PNG.
- **Cap-with-eviction is enforced at mutation time**, not at save time. A caller that calls `autoPin()` 10,000 times in a loop can't amplify to a `localStorage` DoS — each call either evicts-and-inserts or no-ops (via dedup).

---

## 2.9.0 — 2026-04-18

**Theme: Populated world — NPCs, side mysteries, red herrings, easter eggs, in-world lore, and booth-wide discovery analytics (Phase 6).** The data generator now produces ~47k events (up from ~830), turning the previously hand-curated dataset into a realistic corporate environment with 60 named NPCs, 8 optional side mysteries, 8 debounce "ghost-read" events that teach deduplication, 13 cross-index echoes that teach query scoping, four topical trap codes (`1990`, `0911`, `1666`, `1988`) that now deliver narrative lore on miss instead of silent penalties, 15 hidden easter eggs — 14 discoverable via SPL on a new `nakatomi_comms` index plus one Konami-code cinematic — and 7 hand-authored intranet announcements that seed the tower's history into the dataset. A new `docs/NAKATOMI_LORE.md` codex canonicalises the Plaza's 1974-1988 timeline, two prior incidents, floor-by-floor tenancy, and ~20 character bios. The facilitator dashboard gains a **Discovery Analytics** row that answers the post-conference question "which extras did players actually find?" across a full booth day. Players investigate haystacks — with intentional distractors and hidden moments of joy — not hand-picked needles.

This release implements **Phase 6a (population)**, **Phase 6b (side mysteries)**, **Phase 6c (red herrings)**, **Phase 6d (easter eggs)**, **Phase 6e (lore codex + intranet announcements)**, and **Phase 6f (discovery analytics panel)** of the [game-polish roadmap](.cursor/plans/game_polish_roadmap_4400135f.plan.md). Per the project versioning policy, this ships as a **minor bump within the v2.x line**; major-version bumps require explicit user authorization.

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

### Added — Side mysteries (Phase 6b)

- **Eight hand-authored side stories** hidden in the dataset, each solvable without progressing the main heist:
  - **The Affair** (code `9012`) — Holly's love-letter coincidences
  - **Petty Cash Skim** (`9050`) — a finance clerk's rounding errors
  - **The Ghost Account** (`9099`) — an active badge for a terminated employee (`XG-9999` / Evan Rutherford)
  - **The Y2K Test** (`9200`) — engineers testing the millennium rollover 12 years early
  - **The Disgruntled Sysadmin** (`9315`) — brewing insider-threat signals
  - **The Pineapple Incident** (`9086`) — the infamous Christmas pizza order
  - **Theo's Homework** (`9552`) — proxy logs showing Theo rehearsed the vault breach
  - **The Blind Spot** (`9425`) — a bypassed camera on the maintenance floor
- **Dedicated `9xxx` keypad namespace** — entering a 4-digit code starting with `9` checks side-stories first and never triggers the main-puzzle wrong-answer penalty.
- **`side_story_discovered` telemetry event** with `story_id`, `story_title`, `discovered_count`, and `total_stories` fields; corresponding `side_stories_ids` roll-up appears on `session_end`.
- **Discoveries panel** in the pause menu tracks how many stories each session has found, with redacted placeholders for undiscovered entries.
- **11 new achievements** — one per side story plus three meta-achievements (`Curious` ≥1, `Investigator` ≥4, `Completionist` all 8).
- **Side-story events run in both booth and full modes** (~40 events total); even a 15-minute booth run can stumble on one by accident, and facilitators can demo them on reruns.

### Added — Red herrings (Phase 6c)

- **Debounce ghost reads** — Badge reader `RDR-30-NORTH` (Vault Access Corridor, floor 30) has a documented hardware-debounce bug: every swipe by Joseph Takagi (`JT-0001`) during the party window emits a duplicate event 0.4–0.8s later tagged `ghost_read=true`. Teaches players that raw `| stats count by badge_id` overcounts on glitchy readers; correct techniques are `| dedup _time badge_id reader` or `| bin _time span=2s | stats …`. 8 primary swipes + 8 ghost pairs = 16 events, scoped to `sourcetype=nakatomi:access:badge`.
- **Cross-index echoes** — 13 events in `index=nakatomi_building` that reference puzzle-critical badge IDs in their message text (`ref_badge=JT-0001`, `HT-0001`, `HE-3301`, `TH-0099`) across `intranet:it`, `intranet:hr`, and `proxy:http` sourcetypes. Teaches proper scoping: `index=nakatomi_access` for badge swipes, not `index=*`. Echoes never leak into `nakatomi:access:*` sourcetypes, so correctly scoped queries see zero false positives.
- **Trap-code lore toasts** — Four existing trap codes now fire a contextual lore card after the penalty lands:
  - `1990` on task 1.2 (Find Takagi) — "The year Takagi finalised the Nakatomi charter."
  - `0911` on task 2.5 (Intercept the Call) — "Emergency dispatch. McClane might approve. Hans never would."
  - `1666` on task 3.4 (The Roof Trap) — "The Great Fire of London. Hans admires the architecture — not the arson."
  - `1988` on task 5.4 (Final Extraction) — "The current year, sir. Hans would never choose something so obvious."
  Penalty still applies (`wrong_count` bumps, audio sting plays); the lore toast appears ~0.9s later for 4.5s with a red/alert palette distinct from the amber side-story toast. `trap_hit` telemetry gains a `has_lore` field so facilitator dashboards can correlate lore-delivered decoys with subsequent player behaviour.
- **Puzzle integrity verified** — Seal 1.2 (Takagi's latest floor) and Seal 2 (busiest party floor) both continue to resolve to floor 30 with the added noise, across both booth and full modes.

### Added — Easter eggs (Phase 6d)

- **Fifteen hidden moments** — fourteen keypad-triggered eggs in the new `6xxx` namespace plus one pure-UI Konami-code cinematic. Each keypad egg also embeds a **hint event** somewhere in the generated dataset so curious analysts can find the 4-digit code organically via SPL instead of brute-forcing the namespace. Full registry authored in `generator/scenario.yaml` (`easter_eggs:`) and mirrored in `game.html` (`EASTER_EGGS`), enforced by a sync-check in the generator.
  - **`6024` Holly's Diary, Dec 24** — a personal entry in `index=nakatomi_building sourcetype=intranet:diary`.
  - **`6030` Floor 30 Elevator (Fixed Again)** — maintenance ticket `NAK-88-2204` complaining about guests stopping Car #4 on floor 30.
  - **`6042` The Coffee Murder** — espresso machine `EM-30-2` logs `status=out_of_beans` at 19:42 PST.
  - **`6089` The Pineapple War, Round 2** — a chat message refusing pineapple the day after the infamous side-story incident.
  - **`6093` Ode to Joy** — a culture-committee bulletin with Schiller's opening lines as ASCII sheet music.
  - **`6147` Theo's 147** — a proxy-summary entry confirming the exact hit count on Theo's vault research (cross-referenced with side story `9552`).
  - **`6199` Yippee-Ki-Yay** — an `intercept:mcclane` broadcast on `security_primary` at 23:59 PST.
  - **`6220` No More Table** — Hans's "adult… professional" monologue on `intercept:hans`.
  - **`6252` Ho. Ho. Ho.** — Hans's follow-up with a `santa_suit_base64.txt` attachment.
  - **`6401` Argyle on the Carphone** — the limo-driver intercept missing the whole heist.
  - **`6404` The Archive Door** — schematic `FAC-30-v7` revealing an owner-only door labelled `RESERVED ARCHIVE — L. TAKAGI PERSONAL`.
  - **`6411` D-A-D in Morse** — a `-.. / .- / -..` pattern repeating every 14 s on `security_primary`.
  - **`6777` Roy Rogers Checks In** — a guest badge `GUEST-ROY-ROGERS`, sponsor `J.McClane`, access level `Roof`.
  - **`6911` HAL 9000 User Agent** — a proxy entry with UA string `Mozilla/5.0 (compatible; HAL9000/1.0; DiscoveryOne) Likes/music/Daisy`.
  - **Konami code** (↑ ↑ ↓ ↓ ← → ← → B A anywhere on the keyboard) — triggers a 30-second BIOS-era credits roll, respects `prefers-reduced-motion`, and emits `easter_egg_found{trigger=konami}` for the facilitator dashboard.
- **New `nakatomi_comms` index** on the data side — exists already for `intercept:*` sourcetypes, and v2.9 is the first release that actually seeds it with events (5 comms eggs). `load_data.sh` now prompts facilitators to allowlist `nakatomi_comms` on the HEC token; without it, the `nakatomi_comms.json` push fails and the five comms-tier eggs are not SPL-discoverable (keypad entry still works).
- **Dedicated `6xxx` keypad namespace** — hijacked before the main wrong-answer penalty so entering any egg code never bumps `wrong_count` or plays the error sting; instead a soft chord and a purple/gold toast reveal the payoff text.
- **`easter_egg_found` telemetry** with `egg_id`, `egg_title`, `trigger` (`keypad` or `konami`), and `total_eggs`; roll-up fields `easter_eggs_found`, `easter_eggs_total`, and `easter_eggs_ids` appear on `session_end` alongside the existing `side_stories_*` roll-ups so facilitators can rank teams on both discovery axes.
- **Three new meta-achievements**:
  - **Secret Keeper** — find 5 easter eggs.
  - **Egg Hunter** — find 10 easter eggs.
  - **Ultimate Completionist** — find every side story AND every easter egg in a single run.
- **Discoveries panel** gains a second section (**EASTER EGGS FOUND**) next to the existing side-story list, with a count-only redaction for undiscovered entries so the mystery stays intact.
- **Generator invariants** — new `generate_easter_egg_events()` fails loud if any code collides with a seal, trap, or side-story code; if any code leaves the `6xxx` namespace; or if an index routes to an unknown bucket. Sync-checked against `game.html` by `scripts/` tooling.
- **Booth mode compatible** — 14 egg events total, always emitted in both full and booth modes (cheap). Booth dataset is now ~1,172 events (up from ~1,150).

### Added — Lore codex + intranet announcements (Phase 6e)

- **New [`docs/NAKATOMI_LORE.md`](docs/NAKATOMI_LORE.md)** — the authoritative world-building bible (~5,800 words). Covers:
  - **§1 Brief history** — 1974 construction start, 1977 topping-out, 1981 full occupancy, 1985 elevator-Car-#2 fire, 1986 clearance-tier rollout, 1987 Room 30-B incident, 1988 status quo, 1999 Y2K side-story setup.
  - **§2 Prior incidents** — two canonical precedent-setting cases, each with case reference, location, outcome, and lessons learned. Now referenced in-world via HR memos and the easter-egg dataset (Eduardo Vasquez's 1985 promotion, Sergeant Al Powell's 1987 liaison role, Takagi's 1987 promotion to CEO).
  - **§3 Departments and tenancy** — floor-by-floor table mapping every floor 1-39 to its tenant/function and head of floor, so side-story and red-herring queries resolve into a coherent building rather than an abstract event bag.
  - **§4 Character bios** — ~20 characters across Executives, Building Security, Facilities & Janitorial, Engineering/IT/R&D, Admin & Finance, Catering & Vendors, External Parties, and Antagonists. Every bio includes badge ID, department, role, and a short narrative beat that explains why they appear in the logs.
  - **§5 How this lore appears in Splunk** — direct SPL pointers into the 7 announcements, the HR archive memos, Holly's diary, the schematic archive, the comms intercepts, and the sensor telemetry so facilitators can show the connections live.
  - **§6 Authoring rules** — checklist for future contributors: no new codes, no collisions with the seal/trap/side-story/easter-egg namespaces, tone and era constraints.
- **7 intranet announcements** seeded into `index=nakatomi_building sourcetype=intranet:announcements`. Each bulletin is pure texture — no seal codes, no trap codes, no side-story codes, no easter-egg codes — but each one references real people, floors, and prior incidents from the lore doc so the dataset feels like a living building:
  - `ANN-88-CEO-HOLIDAY` — Takagi's Dec 20 holiday message (references the Room 30-B incident without naming the year).
  - `ANN-88-HR-RSVP` — Olivia Park-Hammond's RSVP reminder for the Dec 24 Christmas party (dress code + pre-registration policy).
  - `ANN-88-FAC-HVAC` — Eduardo Vasquez's roof-chiller service notice for HVAC Zone 4 (Tri-Air Mechanical visit, Dec 22).
  - `ANN-88-SEC-PARKING` — James Marsh's holiday parking advisory (B2 reduced capacity for catering staging; B1 vault corridor off-limits).
  - `ANN-88-IT-MAINT` — Mads Sorensen's maintenance-window notice referencing Junko Hanada's Y2K pilot (cross-link to side story `9200`).
  - `ANN-88-FAC-ANNIVERSARY` — Eduardo Vasquez's anniversary note marking the Plaza's upcoming 13th year (references the 1985 elevator fire and 1986 retrofit).
  - `ANN-88-SEC-DRILL` — James Marsh's Q4 fire-safety drill recap (7:42 evacuation time; nods to "lessons from 1985 and 1987").
- **`generate_intranet_announcements()`** in `generate.py` — emits the 7 bulletins into the existing `nakatomi_building.json` output stream. A **reserved-code scanner** runs at generation time, compiling the full set of seal codes, trap codes, side-story codes, and easter-egg codes and scanning every announcement's `subject` and `message` for any standalone 4-digit number that matches. If a contributor ever accidentally leaks a puzzle code into an announcement (e.g., writes "1988" into Takagi's CEO note), the generator fails loud with a clear error pointing at the offending bulletin.
- **Booth mode compatible** — announcements are cheap (7 events, ~1 KB) and always emit in both full and booth modes. The booth dataset grows from ~1,165 → **~1,172 events**; the full dataset stays at ~47k.
- **No telemetry changes** — announcements don't have a dedicated event type; they're world-building texture surfaced via existing SPL skills. Facilitators who want to show "here's a lore bulletin that matches the Takagi story" can just run `index=nakatomi_building sourcetype=intranet:announcements | table _time, author_name, subject`.

### Added — Discovery analytics on the facilitator board (Phase 6f)

- **New "Discovery Analytics" row** in `nakatomi_heist/default/data/ui/views/facilitator_board.xml`. The dashboard canvas grows from `1920x1080` to `1920x1450` to make room for three new tables stacked below the existing active-teams / leaderboard / act-funnel / trap-log block. A dedicated header and "SCROLL FOR DISCOVERY ANALYTICS" hint at the top make the new row obvious to facilitators loading the dashboard for the first time.
- **`ds_side_story_discovery`** — Ranks the booth's **top 10 most-found side stories** over the last 24h. SPL pipeline: `eventstats dc(team_code) as total_teams` over `session_start` events scopes the denominator to sessions from this booth, then `stats dc(team_code) as teams_found by story_id, story_title` over `side_story_discovered` events counts unique teams per story. Result: **Side Story · Teams · Booth Share** (`12 · 63%`). Facilitators instantly see that `9086 The Pineapple Incident` is the crowd favourite and `9099 The Ghost Account` is the sleeper.
- **`ds_egg_discovery`** — Same shape as side stories but for the **top 10 most-found easter eggs**, split by discovery trigger. A `case()` on the telemetry `trigger` field renders `konami` → `Konami code`, `keypad` → `keypad (6xxx)`, leaving SPL-only eggs labelled by their raw egg id. Lets facilitators show "here's why the Konami code is always trending" without writing custom SPL on stage.
- **`ds_discovery_top_teams`** — Ranks the **top 10 booths/teams by total curiosity**, computed as `dc(story_id) + dc(egg_id)` per `team_code`. A `streamstats count as rank` field gives a clean `1 · TEAM-ALPHA · 5 stories · 3 eggs · 8 total` table for conference scoreboards. Curiosity becomes a first-class metric alongside speed and accuracy.
- **Booth-token filter respected** — All three new data sources honour `$booth_token$` the same way the existing panels do (`where ("$booth_token$"="" OR booth_id="$booth_token$")`), so a single shared dashboard URL cleanly partitions per-booth views when multiple booths run simultaneously.
- **Field extractions already in place** — `nakatomi_heist/default/props.conf` already extracts `story_id`, `story_title`, `egg_id`, `egg_title`, `trigger`, `team_code`, `booth_id`, and `event_type` from `nakatomi:session:event` via `KV_MODE=json` plus explicit `EXTRACT-*` rules (added in Phase 6b/6d). No props/transforms changes required for this release.
- **No new telemetry events** — Phase 6f is a pure **read-side** feature. All discovery analytics use the existing `session_start`, `side_story_discovered`, and `easter_egg_found` events. This keeps the event-type allow-list stable, avoids AppInspect churn, and means existing recorded sessions benefit retroactively.
- **Layout update** — Three new `block` entries in `layout.structure` position the label+table pairs at `y=1170/1200` (side stories top-left, easter eggs top-right, top teams bottom-full-width). The new markdown header sits at `y=1085/1120` with an amber fontColor so it visually separates from the ops-monitoring content above.
- **Documentation** — README dashboard section, `docs/PLAYER_EXPERIENCE.md` §9.6, and the dashboard `description` all updated to reflect `v2.9.0` and the new height.

### Changed — Puzzle queries

- **Discovery 1.1 (Guest List)** — SPL updated from `action=swipe | stats dc(badge_id)` to `action=swipe detail="*party*" | stats dc(badge_id)` so the party-guest headcount (47) is accurate against the larger NPC-populated dataset. Hints updated accordingly.
- **Seal 2 red herring** — "Christmas party catering delivery confirmed" renamed to "catering delivery confirmed for Conference Room A" so it doesn't match the `detail="*party*"` filter.

### Fixed

- **Discovery 1.2 (Find Takagi)** — Joseph Takagi (`JT-0001`) was being randomly selected in the 18:00–22:00 badge-event pool and the post-takeover sweep, giving him extraneous swipes that broke `| sort -_time | head 1`. Takagi is now excluded from both random pools so his last event is the canonical floor-30 conference-room swipe.
- **Post-FBI security noise** — Replaced random `alarm_trigger` events in post-FBI background noise with `intrusion_alert` / `motion_anomaly` to avoid interfering with puzzle 4.1's `| sort -_time | head 1`.

### Verification

- **13/13 generator-dependent puzzles pass** across seeds 19881215, 42, 1337, 999 in both full and booth modes.
- **12 static-data puzzles** (comms logs, camera coverage, vehicle registry, bearer bonds) verified present in bundled `.log`/`.csv` files.
- **14/14 easter eggs generate** with zero code collisions against the 6 seals + 4 traps + 8 side stories across every seed.
- **7/7 announcements generate** with zero reserved-code leaks in `subject` or `message` across every seed (the generator fails loud otherwise).
- **Lore codex cross-references verified** — every badge ID, floor number, and department named in `docs/NAKATOMI_LORE.md` §3 and §4 either exists in `employee_directory.csv` / `floor_directory.csv` or is explicitly called out as narrative-only (e.g., McClane's LAPD badge).
- **Facilitator board JSON validates** — `facilitator_board.xml` CDATA parses as JSON; all 14 data-source references resolve; all 32 visualisations referenced in `layout.structure` exist in `visualizations`; canvas height matches the largest layout `y+h` (`1450`). Validated with a dedicated Python smoke-check run every CI pass.

### Security notes

- No new HEC token paths. NPC data, easter-egg events, and intranet announcements all follow the same sourcetype/index schema.
- Badge IDs use well-defined prefixes (`NP-`, `ENG-`, `CLN-`, `SE-`, `VND-`, `GUEST-`) for easy isolation from heist principals.
- Announcements use a dedicated sourcetype (`intranet:announcements`) so facilitators can drop them from dashboards with a single `NOT sourcetype=intranet:announcements` if they want a pure-puzzle view.
- Discovery analytics are read-only. No new event types, no new indexes, no new HEC paths, no new PII. The booth-token filter is **string-compared via the existing `$booth_token$` pattern** with the same `where "$booth_token$"="" OR booth_id="$booth_token$"` gate used by existing panels — the token is never concatenated into SPL, never written to logs, and the `|` subsearch edge is handled by the token pattern's built-in escaping.

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
