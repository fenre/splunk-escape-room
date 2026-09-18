# Nakatomi Plaza: Vault Heist

**A Splunk-powered inverse escape room**
*"Now I have a SPL. Ho-ho-ho."*

---

## What Is This?

An **inverse escape room** where players take the role of Hans Gruber's tech crew during the Nakatomi Plaza heist (Die Hard, 1988). Instead of escaping a room, players must **break into the vault** by solving challenges in **Splunk** — running searches, building dashboards, and finding codes hidden in synthetic log data — then entering those codes on a **physical model of Nakatomi Plaza** with seven seals.

The first six seals open with codes discovered through SPL. The **seventh seal** is a meta solution in the spirit of the film — think outside the system.

The game supports **dual mode**: play with the physical vault model, or go fully digital with `game.html` — an on-screen keypad, clue card reveals, and a hidden power element for Seal 7.

**Current version: 2.17.1** — See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full changelog.

## How It Works

1. **Act 1: The Christmas Party** — Infiltrate the building; count employees, find Takagi, map security gaps.
2. **Act 2: The Takeover** — Cut communications, lock down elevators, track guard rotations.
3. **Act 3: The Vault** — Crack the seven vault seals using SPL skills, ciphers, and lookup cross-references. The seventh seal is a meta solution — no code in Splunk.
4. **Act 4: McClane's Counterattack** — Track the cowboy, intercept police radio, monitor C4 charges.
5. **Act 5: The Escape** — Verify the bonds, find the exit route, extract before the deadline.

**5 acts. 26 tasks. 5 difficulty levels. ~47,000 events.** Multiple fail conditions keep the pressure on: police breach, McClane, roof charges, trap codes, and the clock.

## Features

### Gameplay
- **Seven difficulty modes** — Rookie (120 min, forgiving), Operative (90 min, standard), Mastermind (60 min, brutal), **Iron Man** *(2.6 — 50 min, 3 errors, zero hints, 3× score)*, **Quickfire** *(new in 2.13 — 5 min / 2 tasks / 0.25× score)*, **Booth Heist** *(new in 2.13 — 10 min / 3 tasks / 0.5× score)*, and Quick Demo (15 min, 3 tasks).
- **Quickfire / Booth Heist booth tiers** *(new in 2.13)* — pre-filled SPL, no trap codes, fast 3-second boot, golden-path fixture cache for wifi-loss resilience. Curated task subsets (1.1 + 3.7 / 1.1 + 3.3 + 3.7) keep five-minute visitors finishing on the iconic "pull the power" beat.
- **Quick Demo mode** *(2.4)* — 15-minute, 3-task booth-friendly cut; perfect for conference visitors. Launch directly with `?demo=1`.
- **Scoring system** — Base points + speed bonuses, with hint and error penalties, difficulty multiplier
- **Tiered hints** — Free first hint, escalating penalties, optional answer reveal at 0 points
- **Trap codes** — Specific wrong answers trigger extra penalties or instant game over

### Hint-token economy *(new in 2.6)*
- **Finite token pool** — Replaces "unlimited hints, just take the score penalty" with a per-scenario budget: `rookie: 5`, `operative: 3`, `mastermind: 1`, `iron_man: 0`, `demo: 5`. Spend wisely.
- **HUD chip** — `TOK: 2/3` next to the hints counter; flashes on every spend, goes red when depleted, distinct boxed-red style for Iron Man's permanent `0/0`.
- **Pacifist Run achievement** *(🕊️)* — Complete the campaign without spending a single token.
- **Iron Man achievement** *(🧍)* — Survive the no-hints, 50-min, 3-error gauntlet. Yippee-ki-yay also fires on Iron Man clears.
- **Telemetry** — `hint_token_spent` per spend + `pacifist_run_completed` on victory; `session_end` includes the token roll-up so the facilitator board can plot spending velocity.
- **Multi-cipher toolkit** — ROT13, Hex, Base64, Binary, Number-to-Letter decoders
- **Text and numeric codes** — Some tasks use alphanumeric answers, others use 4-digit codes
- **Multi-step puzzles** — Composite tasks with sub-objectives
- **Decision points** — Narrative choices between acts
- **Bonus objectives** — Post-victory challenges

### Booth / multi-team / facilitator *(new in 2.4, expanded 2.13)*
- **Live session telemetry** — Opt-in HEC posting with offline event queue (capped, oldest-first eviction); KV Store progress writes
- **Facilitator dashboard** — Live 1920×3600 Dashboard Studio view: active teams, leaderboard, per-act funnel, trap log, hint distribution, booth filter, a v2.9 discovery-analytics row (top side stories, top easter eggs, top curiosity teams), a v2.10 Adaptive Hans row, a v2.10 Phone Calls row, a v2.10 Investigation Board row, a v2.11 Floor-30 Hub row, a v2.12 Ending Branches row, a **v2.13 Booth Kiosk Operations row** *(new in 2.17)* (idle reset reasons, recent watchdog reloads, distinct kiosk teams today), a **v2.13 Post-Session Feedback + Abandonment row** *(new in 2.17)* (avg rating, 5-star distribution + skipped, abandonment funnel by exit act), and a **v2.14 Operator Activity row** *(new in 2.17)* (facilitator action verb mix, audio-setting tweak distribution)
- **Team codes + QR handoff** — 4-character unambiguous team codes, shareable URL + auto-generated QR (inline encoder, zero supply-chain surface), print-friendly handouts
- **`?kiosk=1` hardening** *(new in 2.13)* — full-screen request, right-click + dev-tools shortcut guard, 90-second auto-return on victory/game-over, hourly watchdog reload (drops back-button history), localStorage hygiene (leaderboard cap raised 10→50). Configurable via `?kiosk_idle=<sec>` and `?kiosk_watchdog=<sec>`, both clamped to safe ranges.
- **`?queue=1` secondary display** *(new in 2.13)* — minimalist "PLAYER IN SESSION — TEAM \<code\>" / "BOOTH OPEN — TAP TO PLAY" panel for an iPad next to the booth TV.
- **`?facilitator=1` in-game tab** *(new in 2.13)* — bypasses the PIN with a live header showing team code, elapsed time, and progress; per-task quick-finish buttons; renamed "End Session" / "Reset for Next Visitor" controls; every click emits `facilitator_action` telemetry.
- **Splunk linkout from victory screen** *(new in 2.13)* — "View in Splunk →" anchor, HTTPS-only, configured via `NakatomiConfig.splunkLinkUrl` (never URL params). Opens the Mission Brief dashboard inside Splunk so booth visitors see the live equivalent of the query they just solved.
- **1-question post-session feedback widget** *(new in 2.13)* — five-star rating + 120-char optional comment on the victory screen, sanitized of CR/LF/control chars and `<` / `>` before telemetry emission. Submitted as `session_feedback`.
- **Abandonment tracking** *(new in 2.13)* — `session_abandoned` beacon fires `timer + 5 min` after start if neither victory nor game-over resolves, so the facilitator board can spot booth drop-out points.
- **Attract loop** — Idle-aware kiosk overlay cycles teasers and the leaderboard after 60 s of inactivity
- **Spectator second screen** — `?spectator=1` opens a giant-text read-only mirror of the player's tab on the same machine, perfect for a public-facing booth monitor
- **Live narrative alerts** — Three saved searches now fire on schedule for in-game intercepts and HVAC anomalies

### Accessibility *(new in 2.4)*
- **Responsive** — Phone (≤480 px), tablet (≤768 px), and touch-device layouts; ≥48 px touch targets per WCAG 2.2 AA
- **Reduced motion** — Honors `prefers-reduced-motion`; static fallbacks for scanlines, VHS tracking, screen shake
- **High-contrast color-blind theme** — White-phosphor CRT alongside green/amber/blue; pattern + color (not color alone) status
- **Screen-reader announcements** — `aria-live` regions for traps, correct codes, task completion, hints, victory, game over, and timer milestones
- **Keyboard-first navigation** — Visible focus ring (`:focus-visible`); custom controls (theme dots, mode cards, difficulty selector) wired as proper `radio` / `button` widgets
- **Orientation prompt** — Small landscape-on-phone players get a portrait nudge

### Scenario packs + i18n *(new in 2.16)*
- **Three scenario packs** in `scenarios/` — `default` (canonical Christmas-noir 1988), `roof` (rooftop edition with helicopter wind ambient), `afterparty` (forensic debrief, you're McClane the morning after). Activate via `?scenario=<name>` URL flag or the inline `<script id="nakatomi-scenario" type="application/json">` block (booth-friendly deploy pattern, file://-safe).
- **i18n scaffold** — `?lang=en|es|de|ja` URL flag + `i18n/<lang>.json` packs. English + Spanish ship; German and Japanese are reserved. The `I18n.t(key, fallback)` helper exposes ~30 most-visible UI strings; bulk strings stay inline until a future v3.0 capstone refactor.
- **Schema v2** with allow-listed names, length-capped values, prototype-pollution defenses, and per-string control-char strip. See [`docs/SCENARIO_PACKS.md`](docs/SCENARIO_PACKS.md) for the full reference.

### Visual + audio polish
- **CRT theme picker** — Green, amber, blue, or high-contrast white phosphor (4 themes)
- **Pause system** — Freeze the timer mid-game (P key)
- **Local leaderboard** — Top 50 in storage / top 10 on screen with arcade-style initials
- **Achievements** — 6 badges for special accomplishments
- **Typewriter story beats** — Character-attributed dialogue with typewriter animation
- **Victory confetti and screen shake** — Visual polish throughout
- **Adaptive 3-layer audio engine** *(new in 2.14)* — Three GainNode buses (ambient / music / SFX) with crossfade; per-act 5-note motifs; **Beethoven's Ode to Joy** synthesised on vault-open for the default ending; in-pause audio mix panel with master/music/SFX/ambient sliders + mono / reduced-intensity / captions toggles; audio captions HUD for Deaf/HoH players. All audio synthesised in code (no asset files); single-file distribution preserved.
- **Web Audio synthesis** — Synthesized beeps, drones, heartbeats, victory fanfare; no audio assets shipped

### Antagonist, cinematics, and investigation *(new in 2.10)*
- **Adaptive Hans** — 36 hand-authored reactive antagonist lines fire on six telemetry triggers (idle teams, lazy broad queries, keypad spam, fast solves, side-story discoveries, Konami code) with tonal bias by act (light/taunting in acts 1–2, sinister/intimate by act 5). Every reaction lands twice: as a raw intercept in `nakatomi_comms` (indistinguishable from generator-authored transcripts) and as a compact metadata event in `nakatomi_sessions` for booth-wide analytics. Throttled to one line per five minutes per team
- **Facilitator phone-call cinematic** — Three preset callers (Sgt. Al Powell / Hans Gruber / Holly Gennero) triggered via hotkeys (`Ctrl+Shift+1/2/3`) or URL hash (`#call=powell|hans|holly`). Ringing overlay with answer/decline buttons, voiced via `SpeechSynthesis` (per-caller voice profile), ambient-bed ducking to 30 %, and full lifecycle telemetry (incoming → answered | missed). Ad-hoc facilitator text is supported but deliberately **never emitted** to telemetry
- **Investigation board** — Full-screen corkboard overlay (`B` hotkey) where teams pin six clue types (task / side-story / intercept / easter-egg / lore / suspect), draw red-string connection threads, and add freehand notes. Auto-pinned from six game events (task completion, side-story discovery, easter-egg discovery, answered phone call, trap-code lore, manual drag). Persists in `localStorage` (capped at 200 pins / 300 threads / 50 notes with oldest-first eviction), exports to a 1080p watermarked PNG souvenir at session end, and reports `pin_type_mix` + `detective_score` leaderboards on the facilitator dashboard. Booth mode ships a simplified pin-only variant

### Free-roam Floor-30 hub *(new in 2.11)*
- **Blueprint-style hub overlay** — `M` hotkey (or the new `FLOOR-30 MAP` pause-menu button) opens a full-screen Floor-30 map with seven clickable stations — Security Terminal, Vault Keypad, Leads Ledger, Briefing Wall, Blueprint, Comms Intercepts, Investigation Board. Each station routes to the right existing UI (dossier Comms/Leads tabs, act-intro cinematic replay, blueprint viewer, board overlay) without leaving the current session
- **Per-act availability** — Stations are `available` / `locked` / `hidden` based on game state: `keypad` is locked until Act ≥ 3, `blueprint` unlocks with the first discovery, `board` is hidden entirely in `?booth=1` mode, and the rest are available from the start. Locked stations show a tooltip explaining the unlock condition
- **Live status panel** — The hub's right-hand panel refreshes on every open with current act / current task / elapsed time / hint tokens / side stories / easter eggs / trap codes / board pin-thread-note counts, sourced from `state.*` and `InvestigationBoard.stats()` (no duplicate state, no drift risk)
- **Full telemetry** — `hub_opened` / `hub_closed` / `hub_station_clicked` lifecycle events with `trigger`, `elapsed_ms`, `interactions`, `station_id`, and `availability` fields feed a new facilitator row: Hub Sessions KPI, Station Click Mix (split by availability so facilitators can see teams hammering locked stations), and Hub Dwell Time stats by close trigger
- **Four regression harnesses total** — `scripts/tests/test_hub_overlay.js` (NEW, 68 assertions) joins Hans (69), Phone (84), and Investigation Board (69) in a sandboxed `vm` context with stubbed DOM + globals. Combined suite now asserts **290 behaviours** across module surface, telemetry allow-lists, throttle/dedupe logic, sanitization, persistence, station-availability gating, pause-handoff, and HEC-token hygiene (the token NEVER appears in any queued payload)

### Ending-only branches *(new in 2.12)*
- **Four tonal Act-5 outcomes** — Every successful heist now resolves into one of four branches decided from cumulative performance: **Analyst** (clean + curious, `wrong_count ≤ 1 ∧ hint_tokens_spent ≤ 1 ∧ side_stories_discovered ≥ 3`), **Cowboy** (messy but wins, `wrong_count ≥ 4`), **Speedrunner** (faster than a helicopter, `elapsed_seconds < 0.5 × TIMER_SECONDS`), or **Default** ("welcome to the party, pal"). Priority: speedrunner > analyst > cowboy > default — only one branch ever assigned
- **Per-ending narrative, colour theme, audio sting, and achievement** — The victory overlay gets a themed block (amber / red / ice-blue / green) with a hand-authored title + subtitle + paragraph; `playVictoryAnalyst()` / `playVictoryCowboy()` / `playVictorySpeedrunner()` replace the default arpeggio with a tonally-matched sting; four new achievement badges (`ending_analyst` / `ending_cowboy` / `ending_speedrunner` / `ending_default`) fire alongside every other victory badge the team earned that run
- **Dedicated `ending_classified` telemetry event** — Emitted before `session_end` with `ending_id`, `elapsed_seconds`, `wrong_count`, `hint_tokens_spent`, `side_stories_discovered`, `difficulty`, `mode`, `act`. Facilitator dashboards can count distribution in O(1) without filtering a 30-field `session_end` row. No PII, no raw SPL text, no DOM content
- **Facilitator Ending Branches row** — `Endings Today` KPI, `Ending Distribution` stacked column (by difficulty), `Recent Endings` table with per-team signals — lets facilitators ground-truth the classifier at a glance. Canvas extended `1920×2620 → 1920×2860`
- **Five regression harnesses total** — `scripts/tests/test_endings.js` (NEW, 120 assertions) joins Hans / Phone / Investigation Board / Hub to assert **410 behaviours** across registry shape, classification priority, threshold edges, XSS hygiene (module-local `_esc`), overlay application, audio dispatch, and headless null-safety

### Data realism *(new in 2.9)*
- **60 named NPCs** — Day-shift office workers, late-stay engineers, cleaning crew, security guards, and vendors create a realistic corporate rhythm across a full week of pre-heist baseline traffic (~46k events)
- **47 Christmas-party guests** — Dedicated guest roster makes floor 30 unambiguously the busiest floor during the party window
- **8 optional side mysteries** — Hand-authored trails (The Affair, Petty Cash Skim, Ghost Account, Y2K Test, Disgruntled Sysadmin, Pineapple Incident, Theo's Homework, The Blind Spot) reachable via the `9xxx` keypad namespace without penalty, each with its own achievement
- **Red herrings that teach** — 8 debounce "ghost-read" events on `RDR-30-NORTH` teach `| dedup _time badge_id reader`, 13 cross-index echoes in `nakatomi_building` teach scoping queries to `index=nakatomi_access`, and four topical trap codes (`1990`, `0911`, `1666`, `1988`) now fire narrative lore toasts on miss instead of silent penalties
- **15 hidden easter eggs** — 14 SPL-discoverable anchor events scattered across `nakatomi_building`, `nakatomi_access`, and the new `nakatomi_comms` index (Holly's diary, Hans's "ho ho ho", McClane's yippee, Argyle's limo radio, Morse "DAD", HAL 9000 user-agent, a Roy Rogers guest badge, a `FAC-30-v7` archive door, and more). Claim any found moment on the keypad's `6xxx` namespace — no penalty, new Secret Keeper / Egg Hunter / Ultimate Completionist achievements, plus a Konami-code cinematic credits roll that lives entirely in the UI
- **Lore codex + 7 intranet announcements** — Full world-building canon ([`docs/NAKATOMI_LORE.md`](docs/NAKATOMI_LORE.md)) covers the Plaza's 1974–1988 history, two prior incidents (the 1985 elevator fire and the 1987 Room 30-B hostage situation), floor-by-floor tenancy, and ~20 character bios. Seven intranet bulletins (`index=nakatomi_building sourcetype=intranet:announcements`) seed the lore in-world: Takagi's holiday message, HR's party RSVP, Facilities' HVAC window, the 13-year anniversary note, and more. Pure texture — zero collision with any seal, trap, side-story, or easter-egg code (enforced at generation time)
- **Booth mode** — `python3 generate.py --booth-mode` produces a lean ~1,172-event dataset for 5-minute conference demos; all puzzles, side mysteries, easter eggs, and lore bulletins still resolve correctly

### Splunk integration
- **Full Splunk integration** — 10 dashboards (incl. new facilitator board), 5 indexes (incl. new `nakatomi_sessions`), 7 lookups, guided investigation, progress tracking, alert-based clues

## Project Status

### Complete

- Full design document with game mechanics, puzzles, and architecture
- Story and narrative with complete puzzle catalogue (26 tasks across 5 acts)
- Timeline, fail conditions, and flow diagrams (with rendered Mermaid views)
- Physical model electronics design (ESP32, locks, wiring, BOM)
- **Data schemas** — 7 sourcetypes, 4 indexes, 7 lookup tables, all field definitions
- **Data generator** — Python script producing ~47,000 deterministic Splunk-ingestible events (~830 critical-path + ~46k NPC baseline; `--booth-mode` for lean conference datasets)
- **Player experience** design — dashboard wireframes, phase progression, hint delivery
- **Splunk app** — `nakatomi_heist/` with indexes, props, transforms, lookups, 9 dashboards, KV Store, saved searches
- **Game UI v2.12** — Standalone HTML/CSS/JS with scoring, difficulty, hints, achievements (now including 4 ending badges), leaderboard, CRT themes, pause, opt-in live telemetry, multi-team codes, QR handoff, attract loop, spectator URL, Adaptive Hans (36 reactive lines) + facilitator phone cinematic + investigation board + free-roam Floor-30 hub + ending-only branches (Analyst / Cowboy / Speedrunner / default), and full WCAG 2.2 AA accessibility pass

### In Progress

- Physical Nakatomi Plaza tower model (3D printed / hand-built)

### Planned

- ESP32 firmware
- Integration between game UI and ESP32 (seal status polling)

## Visual Project Overview

Open **[index.html](index.html)** in a browser for a full visual overview of the project — game phases, architecture diagrams, seven seals, player roles, fail conditions, flow charts, easter eggs, and roadmap, all on one page.

## Quick Start — Install and Play

### 1. Install the complete static Splunk app

The release `.spl` contains the app and complete pre-generated puzzle dataset.
It requires no HEC token, Python, or shell access on the Splunk host.

1. In Splunk Web, open **Apps → Manage Apps → Install app from file**.
2. Upload `nakatomi_heist-2.17.1.spl`.
3. Restart from **Settings → Server controls**.
4. Open **Nakatomi Heist** and set the time picker to **All time** because the
   game events are dated December 1988.

See [`nakatomi_heist/README/INSTALL.md`](nakatomi_heist/README/INSTALL.md) for
the complete Web-only installation and verification procedure.

To build the release artifact from source on a development machine:

```bash
python3 -m pip install -r generator/requirements.txt
bash scripts/build-static-package.sh
```

The build writes the `.spl`, `SHA256SUMS`, and full seed-data manifest to
`dist/`.

### 2. Play

Open **Nakatomi Heist** in Splunk. The Mission Brief dashboard is your starting point. Open `game.html` in a browser for the vault keypad (digital mode) or connect the physical vault model.

#### Booth / multi-team deployment *(Event Mode)*

For a live race on one laptop/NUC (game + Splunk + public scoreboard):

- Operator manual: [`event-mode/ADMIN.md`](event-mode/ADMIN.md)
- Stack: [`event-mode/README.md`](event-mode/README.md) (`./scripts/boot.sh`)
- Security model / HEC: [`docs/DEPLOY.md`](docs/DEPLOY.md)

**GitHub Pages** (if enabled) hosts `game.html` for **offline / solo** play only. It cannot host Splunk or the live scoreboard.

For conference booths without Docker, see [`docs/DEPLOY.md`](docs/DEPLOY.md) for the reverse-proxy pattern.

### Verify data loaded correctly

```spl
index=nakatomi_access OR index=nakatomi_vault OR index=nakatomi_building
| stats count by index, sourcetype
```

## Repository Structure

```
splunk-escape-room/
├── README.md
├── RELEASE_NOTES.md                # Full version history
├── index.html                      # Visual project overview (open in browser)
├── index.svg                       # Nakatomi Plaza tower illustration
├── event-mode/                     # Docker Event Mode (Splunk + game proxy + public scoreboard)
│   └── ADMIN.md                    # Operator manual
├── game.html                       # Game UI — dual-mode (physical / digital), telemetry, multi-team, accessibility
├── nakatomi-plaza.jpg              # Nakatomi Plaza photo (mode select background)
├── docs/
│   ├── DESIGN.md                   # Game mechanics, architecture, puzzles
│   ├── STORY_AND_MYSTERIES.md      # Narrative, easter eggs, full puzzle catalogue, planned branch tree
│   ├── TIMELINE_AND_FLOWS.md       # Phase timeline, fail conditions, flow diagrams
│   ├── PHYSICAL_MODEL.md           # Electronics, locks, wiring, BOM, build guide
│   ├── DATA_SCHEMAS.md             # Sourcetypes, indexes, field definitions, sample events
│   ├── PLAYER_EXPERIENCE.md        # Dashboard wireframes, progression, hint delivery, digital + booth modes
│   ├── DEPLOY.md                   # Booth / multi-team deployment, HEC security, reverse-proxy pattern (v2.4)
│   ├── physical_model_diagram.svg  # Wiring and component placement diagram
│   └── flow.html                   # Rendered Mermaid flow diagrams
├── nakatomi_heist/                 # Splunk app v2.4.0
│   ├── default/
│   │   ├── app.conf                # App identity and metadata
│   │   ├── indexes.conf            # 4 indexes (access, vault, building, comms)
│   │   ├── props.conf              # 7 sourcetype definitions
│   │   ├── transforms.conf         # Lookup + KV Store definitions
│   │   ├── collections.conf        # KV Store collections (vault_progress)
│   │   ├── savedsearches.conf      # Alert-based puzzle clues
│   │   └── data/ui/
│   │       ├── nav/default.xml     # App navigation (9 views)
│   │       └── views/             # Dashboard Studio + Simple XML views
│   │           ├── terminal.xml             # React terminal (default)
│   │           ├── mission_brief.xml        # Mission briefing
│   │           ├── guided_investigation.xml # Act-by-act guided investigation
│   │           ├── search_terminal.xml      # General search
│   │           ├── access_terminal.xml      # Badge/access data
│   │           ├── vault_terminal.xml       # Vault system data
│   │           ├── building_systems.xml     # HVAC/elevator/power
│   │           ├── comms_terminal.xml       # Radio/phone intercepts
│   │           ├── progress_tracker.xml     # Session progress (KV Store)
│   │           └── facilitator_board.xml    # Live multi-team booth dashboard (1920×3600, v2.17)
│   ├── lookups/                    # 7 pre-loaded CSV lookup tables
│   └── metadata/default.meta      # App permissions
├── nakatomi_heist.spl              # Packaged app (install via Splunk Web)
├── generator/
│   ├── generate.py                 # Data generator (Python)
│   ├── scenario.yaml               # Task codes, timeline, characters, tuning
│   └── requirements.txt            # Python dependencies
├── scripts/
│   └── load_data.sh                # Load generated data via HEC
```

## Design Documents

| Document | Description |
|----------|-------------|
| [Visual Overview](index.html) | Full project overview with diagrams, timelines, and architecture (open in browser) |
| [Design Document](docs/DESIGN.md) | Vision, game mechanics, puzzle design, technical architecture, and project roadmap |
| [Story & Mysteries](docs/STORY_AND_MYSTERIES.md) | Introduction narrative, easter eggs, complete seal-by-seal puzzle catalogue, and the planned branching-storyline tree (v2.10+) |
| [Timeline & Flows](docs/TIMELINE_AND_FLOWS.md) | Phase timeline, threat escalation, fail conditions, McClane hint schedule, and Mermaid flow diagrams |
| [Physical Model](docs/PHYSICAL_MODEL.md) | Electronics design, lock mechanisms, wiring, BOM, Seal 7 circuit, Splunk integration, and build guide |
| [Data Schemas](docs/DATA_SCHEMAS.md) | All sourcetype definitions, `_raw` formats, field extractions, lookup table schemas, and Splunk config |
| [Player Experience](docs/PLAYER_EXPERIENCE.md) | Dashboard wireframes, phase progression, hint delivery, fail/win states, digital + booth modes |
| [Deployment Guide](docs/DEPLOY.md) | Booth / multi-team deployment, HEC token security model, recommended same-origin reverse-proxy (nginx example), data retention |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Search & Analytics | Splunk Enterprise or Cloud |
| Data Generation | Python ([generator/](generator/)) |
| Game UI | Standalone HTML/CSS/JS ([game.html](game.html)) — dual-mode, scoring, leaderboard, CRT themes |
| Splunk App | `nakatomi_heist/` — 9 dashboards, 4 indexes, 7 lookups, KV Store, saved searches |
| Physical Model | ESP32 + servo/solenoid/magnetic locks ([design doc](docs/PHYSICAL_MODEL.md)) |

## SPL Skills Covered

Players will use a range of Splunk skills during the game:

- `search`, `stats`, `eval`, `rex`, `lookup`, `transaction`
- Time modifiers and time-range searches
- Dashboard building, panels, inputs, and drilldown
- Alerts and trigger conditions

## Contributing

This project is in early design. If you'd like to contribute — whether it's puzzle ideas, data generation scripts, physical build designs, or Splunk app development — open an issue or submit a pull request.

### Running the regression suite *(new in 2.15)*

```bash
bash scripts/test.sh                # 840 assertions across 10 modules
bash scripts/test.sh --json --quiet # CI-friendly output
```

The test runner is dependency-free pure Node — no `npm install` step. Every push to `main` / `develop` and every PR triggers the [GitHub Actions CI](.github/workflows/ci.yml), which also runs HTML / `.conf`-file syntax checks, the scenario-consistency regression, and a secret-scan gate. Tag pushes (`v*.*.*`) additionally build the `.spl` artifact and attach it to a draft GitHub Release.

### Data subject access requests *(new in 2.15)*

Two helper scripts ship with the app for GDPR-style export and right-to-erasure against `nakatomi_sessions` + `vault_progress`:

```bash
SPLUNK_HOST=https://... SPLUNK_TOKEN=... \
  bash scripts/export_sessions.sh --team-code NAKA --output naka.json

SPLUNK_HOST=https://... SPLUNK_TOKEN=... \
  bash scripts/purge_sessions.sh --team-code NAKA --confirm yes-i-mean-it
```

See [`docs/DEPLOY.md` §7.2](docs/DEPLOY.md) for the dedicated `nakatomi_dsar` role's required capabilities.

## License

This project is for educational and community use. Die Hard references are used for fan/parody purposes only; all trademarks belong to their respective owners.
