# AI Project Briefing — Nakatomi Plaza: Vault Heist

> **Purpose of this file.** This is the complete onboarding brief for any AI
> coding agent that joins this repository. Read it end-to-end before
> editing anything. Everything an agent needs to reason about the project —
> concept, architecture, repo layout, conventions, invariants, common
> tasks — is captured here so you do not have to reverse-engineer it from
> 19,000 lines of source.

---

## 0. TL;DR

**Nakatomi Plaza: Vault Heist** is a **Splunk-powered "inverse escape
room"** themed on *Die Hard* (1988). Players take the role of Hans
Gruber's tech crew on Christmas Eve. Instead of escaping a room, they
**break into a 7-seal vault** by analyzing ~47,000 deterministic
synthetic events in **Splunk** — running SPL searches, pivoting through
lookups, decoding ciphers, building dashboards — to find the codes.
Codes are entered on either a **physical Nakatomi tower model** (with
ESP32-driven locks; firmware not yet written) or a **digital on-screen
keypad** in `game.html`. **Six** seals are SPL-driven; the **seventh**
is a meta puzzle in the spirit of the film ("the seventh lock is not in
the system").

**Current version: `2.12.0`.** The Splunk app, data generator, and game
UI are shipped and tested. The physical model is design-only.

---

## 1. Concept

### 1.1 What "inverse escape room" means

| Classic escape room | This game |
|---|---|
| Find clues → solve puzzles → get **out** | Use Splunk → find codes in synthetic logs → get **in** to the vault |
| The room is physical | The "room" is a Splunk environment |
| The lock is mechanical | The "lock" is the vault's logical security represented in data |

Players never escape; they investigate. The Die Hard theme is wrapped
around a Splunk SPL teaching tool that happens to also be a real game
with a timer, a scoring system, fail conditions, achievements, and a
multi-team facilitator board.

### 1.2 Tone

Tense, cinematic, mildly campy. CRT terminal aesthetic. Hans Gruber on
the radio is impatient and slightly amused. McClane is atmospheric flavor
("Yippee-ki-yay", "Now I have a machine gun"). The data feels like a
real corporate environment that someone happens to be robbing tonight.

### 1.3 Five acts, 26 tasks

| Act | Theme | Approx tasks |
|---|---|---|
| 1 | The Christmas Party — infiltrate, count employees, find Takagi, map security gaps | ~5 |
| 2 | The Takeover — cut comms, lock down elevators, track guard rotations | ~5 |
| 3 | The Vault — crack the seven seals (this is the act with the seal codes) | ~7 |
| 4 | McClane's Counterattack — track the cowboy, intercept police radio, monitor C4 | ~5 |
| 5 | The Escape — verify the bonds, find the exit route, extract before the deadline | ~4 |

The seven seals (the historic "Vault Heist" core) live inside Act 3 but
are the most iconic and storied part of the game.

---

## 2. The Seven Seals (canonical puzzle catalogue)

The six SPL seal codes are the spine of the game. Their authoritative
home is `generator/scenario.yaml` → `seals:` and
`docs/STORY_AND_MYSTERIES.md`. **Codes are deterministic by seed**;
changing `seed:` in `scenario.yaml` produces a fresh dataset with
different codes.

Default codes (seed `19881215`):

| # | Film Beat | SPL Skill | Index | Code |
|---|---|---|---|---|
| 1 | Lobby takeover | `search`, `where`, `table` | `nakatomi_access` | **2512** |
| 2 | Securing the building | `stats`, `count`, `sort` | `nakatomi_access` | **7439** |
| 3 | Takagi's refusal | `transaction`, `duration` | `nakatomi_vault` | **4291** |
| 4 | C4 on the roof | `eval`, calculated fields, ROT13 cipher wheel | `nakatomi_building` | **8086** |
| 5 | FBI cuts the power | `rex`, field extraction | `nakatomi_building` | **5765** |
| 6 | The bearer bonds | `lookup`, `inputlookup` | `nakatomi_vault` + lookups | **3940** |
| 7 | Shoot the glass | **No SPL** — meta solution (unplug power / hidden UI element) | — | none |

Each seal has, in addition to the code:

- a **film moment** (narrative hook),
- a **physical clue** from the previous seal that bridges digital ↔ physical,
- a **search path** (the intended SPL),
- explicit **red herrings** (close-but-wrong matches that teach precision),
- a **compartment reward** that becomes the next clue,
- a **facilitator hint** delivered after N minutes stuck.

**Seal 7 is sacred.** No data event spells it out beyond a single oblique
hint event in `nakatomi_vault sourcetype=nakatomi:vault:system` that
mentions the electromagnetic failsafe. The team must realize the last
lock is physical/meta. Do not add explicit Seal 7 code paths to data.

---

## 3. Architecture (four moving parts)

```
generator/        Python data generator → ~47k deterministic JSON events
                  + 7 CSV lookup tables. Seeded; codes change per seed.
                          │
                          ▼ (HTTP Event Collector / scripts/load_data.sh)
nakatomi_heist/   Splunk app: 5 indexes, 7 sourcetypes, 7 lookups, KV Store,
                  10 dashboards, saved searches/alerts, custom React viz.
                          │
                          ▼ (player runs SPL, finds codes, enters them in…)
game.html         Single-file HTML/CSS/JS game UI (~590 KB).
                  CRT terminal aesthetic, vault keypad, scoring, hints,
                  achievements, leaderboard, opt-in HEC telemetry,
                  multi-team codes + QR, attract loop, accessibility.
                          │
                          ▼ (optional, future)
Physical model    ESP32 + servo / solenoid / magnetic locks on a 3D-printed
                  Nakatomi tower. Polls Splunk KV Store for seal status.
                  Currently design-only; firmware not yet written.
```

### 3.1 Data flow at runtime (booth deployment)

```
┌──────────────────┐   1) HTTP fetch         ┌──────────────────┐
│  Player browser  │ ───────────────────────►│  reverse proxy   │
│  (game.html)     │                         │  (nginx, etc.)   │
│                  │   2) /proxy/hec/...     │                  │
│  no HEC token    │ ◄───────────────────────│  injects token   │
└────────┬─────────┘                         └─────────┬────────┘
         │ player runs SPL                             │ POST events
         ▼                                             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                          Splunk                              │
   │ • 5 indexes (nakatomi_access, _vault, _building, _comms,     │
   │   _sessions)                                                 │
   │ • 7 sourcetypes                                              │
   │ • KV Store (vault_progress)                                  │
   │ • 10 dashboards (Mission Brief, Facilitator Board, …)        │
   │ • Saved searches / alerts (narrative clues on schedule)      │
   └──────────────────────────────────────────────────────────────┘
```

The HEC token **never reaches the browser**. The same-origin reverse
proxy pattern (full nginx example in `docs/DEPLOY.md`) is the
recommended booth topology.

---

## 4. Repository Tour

```
splunk-escape-room/
├── README.md                    # User-facing readme; current version line
├── RELEASE_NOTES.md             # Full version history (v2.12 at top)
├── AI_BRIEFING.md               # ← you are here
├── index.html                   # Visual overview page (open in browser)
├── index.svg                    # Nakatomi Plaza tower illustration
├── game.html                    # The entire game UI in one self-contained file (~13.1k lines)
├── nakatomi-plaza.jpg           # Mode-select background
├── nakatomi_heist.spl           # Packaged Splunk app (drop into Splunk Web)
│
├── docs/
│   ├── DESIGN.md                # Vision, mechanics, architecture, roadmap
│   ├── STORY_AND_MYSTERIES.md   # Narrative + complete seal-by-seal puzzle catalogue
│   ├── TIMELINE_AND_FLOWS.md    # Phase timeline, fail conditions, McClane hints, Mermaid diagrams
│   ├── PHYSICAL_MODEL.md        # Electronics, locks, wiring, BOM, build guide
│   ├── DATA_SCHEMAS.md          # Sourcetypes, indexes, _raw formats, lookups, props.conf
│   ├── PLAYER_EXPERIENCE.md     # Dashboard wireframes, phase progression, hint delivery
│   ├── DEPLOY.md                # Booth/multi-team deployment, HEC security, nginx example
│   ├── NAKATOMI_LORE.md         # Authoritative in-world lore bible (1974–1988 history)
│   ├── physical_model_diagram.svg # Front panel, back electronics, wiring schematic
│   └── flow.html                # Mermaid flow diagrams rendered in browser
│
├── generator/
│   ├── generate.py              # Main data generator (~1,867 lines)
│   ├── scenario.yaml            # Seeds, codes, characters, NPCs, side stories, easter eggs, lore
│   ├── requirements.txt         # Python deps
│   ├── output/                  # Generated artifacts (3 JSON files + 3 CSV lookups)
│   └── templates/               # Jinja-style templates for narrative text
│
├── nakatomi_heist/              # Splunk app v2.12.0 (build 32)
│   ├── default/
│   │   ├── app.conf             # version, build, label, description
│   │   ├── indexes.conf         # 5 indexes
│   │   ├── inputs.conf          # input modes (mostly placeholders)
│   │   ├── props.conf           # 7 sourcetype definitions + EXTRACT- rules
│   │   ├── transforms.conf      # Lookup + KV Store definitions
│   │   ├── collections.conf     # KV Store collection vault_progress (29 fields)
│   │   ├── savedsearches.conf   # 3 scheduled "Vault Alert" narrative clues
│   │   ├── visualizations.conf  # Custom React visualization registration
│   │   └── data/ui/
│   │       ├── nav/default.xml  # App navigation (10 views)
│   │       └── views/
│   │           ├── terminal.xml             # Default React terminal
│   │           ├── mission_brief.xml        # Mission briefing (player's home)
│   │           ├── guided_investigation.xml # Act-by-act guided investigation
│   │           ├── search_terminal.xml      # General search
│   │           ├── access_terminal.xml      # Badge/access data
│   │           ├── vault_terminal.xml       # Vault system data
│   │           ├── building_systems.xml     # HVAC/elevator/power
│   │           ├── comms_terminal.xml       # Radio/phone intercepts
│   │           ├── progress_tracker.xml     # KV Store session progress
│   │           └── facilitator_board.xml    # Live multi-team board (1920×2860)
│   ├── lookups/                 # 7 pre-loaded CSV lookup tables
│   ├── appserver/               # Static assets for the app
│   ├── bin/                     # Custom command scaffolding
│   ├── data/                    # Static CSV fixtures
│   ├── metadata/default.meta    # App permissions
│   ├── src/                     # React custom-viz source
│   ├── package.json             # React build config
│   ├── package-lock.json
│   ├── webpack.config.js
│   └── node_modules/            # Local React build deps (not committed in normal flow)
│
├── scripts/
│   ├── load_data.sh             # Push generator output to Splunk via HEC
│   ├── build-viz.sh             # Build the custom React visualization
│   └── tests/                   # Node.js regression harnesses
│       ├── test_endings.js              # 120 assertions (v2.12)
│       ├── test_hub_overlay.js          # 68 assertions  (v2.11)
│       ├── test_investigation_board.js  # 69 assertions  (v2.10)
│       ├── test_phone_calls.js          # 84 assertions  (v2.10)
│       └── test_hans_antagonist.js      # 69 assertions  (v2.10)
│                                  # Combined: 410 assertions, 0 failures
│
├── versions/                    # Historical snapshots (rarely touched)
└── .cursor/rules/               # Cursor agent rules (security, conventions)
```

---

## 5. Game Design Rulebook

### 5.1 Difficulty modes

| Mode | Time | Token budget | Wrong-codes allowed | Notes |
|---|---|---|---|---|
| Rookie | 120 min | 5 hint tokens | forgiving | tutorial-friendly |
| Operative | 90 min | 3 hint tokens | standard | "default" experience |
| Mastermind | 60 min | 1 hint token | brutal | original target time |
| **Iron Man** | **50 min** | **0 hint tokens** | **3 errors** | 3× score multiplier |
| Quick Demo | 15 min | 5 hint tokens | 3 tasks only | URL `?demo=1`; conference cut |

Selected via the mode-select screen at game start, or via URL.

### 5.2 Scoring

- Base points per seal/task + speed bonuses.
- Penalties: hint tokens spent, wrong-code attempts, trap codes hit.
- Difficulty multiplier on final score (Iron Man = ×3).
- Local leaderboard with arcade-style 3-letter initials, top 10.

### 5.3 Hint-token economy (v2.6)

Replaces the old "unlimited hints, just take a score penalty" model.
Each scenario has a finite token pool. Spending a token reveals the next
escalation tier of the active hint. Out of tokens → no more hints.

- HUD chip `TOK: 2/3` next to the hints counter.
- Telemetry: `hint_token_spent` per spend, `pacifist_run_completed` if the
  team beats the campaign without spending any.
- **Pacifist Run achievement** (🕊️) — zero spends across the run.
- **Iron Man achievement** (🧍) — survive the no-hints, 50-min, 3-error
  gauntlet.

### 5.4 Trap codes (v2.9)

Hitting one of these on the keypad fires a one-sentence narrative lore
toast (~3.5 s) and increments the wrong-codes counter:

| Code | Lore |
|---|---|
| `1990` | "The year Takagi finalised the Nakatomi charter." |
| `0911` | "Emergency dispatch. McClane might approve. Hans never would." |
| `1666` | "The Great Fire of London. Hans admires the architecture — not the arson." |
| `1988` | "The current year, sir. Hans would never choose something so obvious." |

### 5.5 Side mysteries (v2.9 — `9xxx` namespace, no penalty)

Eight optional, hand-authored side trails that any curious analyst can
discover by SPL. Each has a 4-digit `discovery_code` ≥ 9000:

| Code | ID | Title | Achievement |
|---|---|---|---|
| `9012` | affair | The Affair (Ellis ↔ Holly, late-night floor 30) | side_affair |
| `9050` | petty_cash | Petty Cash Skim ($4,892 over six months) | side_petty_cash |
| `9099` | ghost_account | Ghost Account (terminated badge still warm) | side_ghost |
| `9200` | y2k | Y2K Test (forty-second 1900-01-01 rollover) | side_y2k |
| `9315` | disgruntled_it | Disgruntled Sysadmin (Robert Chen on a PIP) | side_disgruntled |
| `9086` | pizza | Pineapple Incident (37-message intranet thread) | side_pizza |
| `9552` | theo_browser | Theo's Homework (147 vault/SEC proxy hits) | side_theo |
| `9425` | bypassed_camera | The Blind Spot (CAM-25-NORTH offline at 21:42) | side_camera |

### 5.6 Easter eggs (v2.9 — `6xxx` namespace, no penalty)

15 hidden moments. 14 are SPL-discoverable anchor events; 1 (Konami code
↑↑↓↓←→←→BA) lives entirely in `game.html`. Examples: Holly's diary
`6024`, "ho ho ho" `6252`, Argyle in the limo `6401`, Morse "DAD"
`6411`, HAL 9000 user-agent `6911`, yippee-ki-yay `6199`. Achievements:
Secret Keeper, Egg Hunter, Ultimate Completionist.

### 5.7 Lore announcements (v2.9, no penalty, no codes)

Seven intranet bulletins seeded into
`index=nakatomi_building sourcetype=intranet:announcements`. Pure
texture (Takagi's holiday message, HR's RSVP final call, HVAC service
window, the 13-year anniversary note, the Y2K pilot, etc.). Their
4-digit numbers are checked at generation time to ensure **zero
collision** with seal, trap, side-story, or easter-egg codes.

### 5.8 Endings (v2.12 — Phase 7 Tier 1)

Every successful heist now resolves into one of four tonally distinct
branches, classified once at victory from cumulative performance.

**Priority ladder (one and only one branch fires):**

1. `speedrunner` — `elapsed_seconds < 0.5 × TIMER_SECONDS`
2. `analyst` — `wrong_count ≤ 1` ∧ `hint_tokens_spent ≤ 1` ∧ `side_stories_discovered ≥ 3`
3. `cowboy` — `wrong_count ≥ 4`
4. `default` — fallback

Each ending ships a themed narrative block (amber / red / ice-blue /
green), a dedicated audio sting (`playVictoryAnalyst`,
`playVictoryCowboy`, `playVictorySpeedrunner`, fallback `playVictory`),
and an achievement (`ending_analyst`, `ending_cowboy`, etc.).

A dedicated `ending_classified` telemetry event fires *before*
`session_end` so the facilitator board's `Endings Today` and `Ending
Distribution` panels can count branches in O(1) without parsing 30-field
session_end rows.

### 5.9 Free-roam Floor-30 hub (v2.11 — Phase 8a)

`M` hotkey opens a blueprint-style overlay with **seven clickable
stations** — each routed to existing UI surfaces:

| Station | Routes to | Default availability |
|---|---|---|
| Security Terminal | scenario briefing intro | available |
| Vault Keypad | keypad focus | locked until Act ≥ 3 |
| Leads Ledger | dossier (Leads tab) | available |
| Briefing Wall | act-intro cinematic replay | available |
| Blueprint | floor-30 SVG plan | available after first discovery |
| Comms Intercepts | dossier (Comms tab) | available |
| Investigation Board | corkboard overlay | hidden in `?booth=1` |

Telemetry: `hub_opened`, `hub_closed`, `hub_station_clicked`. Locked
stations still emit a click event (with `availability=locked`) so
facilitators can see when teams are mashing on stations they haven't
unlocked yet.

### 5.10 Adaptive Hans (v2.10 — Phase 5i)

A reactive antagonist layer with **36 hand-authored lines** across six
triggers and two tones (light, sinister), with tonal bias by act
(light/taunting in acts 1–2, sinister/intimate by act 5).

**Triggers:** `idle` (≥2 min quiet), `lazy_queries` (broad unfiltered
SPL), `keypad_spam` (6 wrongs in 60 s), `fast_solves`,
`side_story_discoveries`, `konami_code`.

**Throttle:** one line per five minutes per team, with a three-line
recent-window suppression so the same ID doesn't repeat.

Each reaction lands on **two indexes at once**:

1. As a raw KV intercept in `nakatomi_comms sourcetype=intercept:hans`
   (indistinguishable from generator-authored transcripts when grepped).
2. As a compact metadata-only `hans_reaction` event in `nakatomi_sessions`
   for booth-wide analytics (no transcript, no player input).

### 5.11 Phone-call cinematic (v2.10)

Three preset callers with hand-authored voices via `SpeechSynthesis`:

| Hotkey | URL hash | Caller |
|---|---|---|
| `Ctrl+Shift+1` | `#call=powell` | Sgt. Al Powell |
| `Ctrl+Shift+2` | `#call=hans` | Hans Gruber |
| `Ctrl+Shift+3` | `#call=holly` | Holly Gennero |

Behaviour: ringing overlay top-right, `Answer` / `Decline`, ambient bed
ducks to 30 % during the call, full lifecycle telemetry (`incoming` →
`answered | missed`). Ad-hoc facilitator text is supported but
**deliberately never emitted** to telemetry.

### 5.12 Investigation Board (v2.10)

Full-screen corkboard overlay (`B` hotkey) where teams pin six clue
types (task / side-story / intercept / easter-egg / lore / suspect),
draw red-string connection threads, and add freehand notes.
Auto-pinned from six game events; persists in `localStorage` (capped at
200 pins / 300 threads / 50 notes with oldest-first eviction); exports
to a 1080p watermarked PNG souvenir at session end.

### 5.13 Booth / multi-team / facilitator (v2.4)

- **Live session telemetry** — opt-in HEC posting with offline event
  queue (capped at 500 events, oldest-first eviction); KV Store
  progress writes.
- **Facilitator dashboard** — `1920×2860` Dashboard Studio canvas:
  active teams, leaderboard, per-act funnel, trap log, hint
  distribution, booth filter, plus the Hans / Phone Calls /
  Investigation Board / Hub Sessions / Ending Branches rows added in
  v2.10–v2.12.
- **Team codes + QR handoff** — 4-character unambiguous team codes,
  shareable URL + auto-generated QR (inline encoder, zero supply-chain
  surface), print-friendly handouts.
- **Attract loop** — idle-aware kiosk overlay cycles teasers and
  the leaderboard after 60 s of inactivity.
- **Spectator second screen** — `?spectator=1` mirrors the player's tab
  in giant-text read-only form for a public-facing booth monitor.

### 5.14 Fail conditions

All failure branches lead to the same game-over ending (Hans's fate,
dropped from the building):

| Branch | Trigger |
|---|---|
| Police breach | Player action that maps to "alerting the outside world" (specific search, trap code, or milestone) |
| McClane | 3 wrong seal codes (configurable) |
| Roof early | Player enters a defined trap code or follows a decoy procedure during Act 3 |
| Roof late | Timer hits the cap before all 7 seals are open |

### 5.15 Accessibility (WCAG 2.2 AA target)

- Responsive: phone (≤480 px), tablet (≤768 px), and touch layouts;
  ≥48 px touch targets.
- `prefers-reduced-motion` honored — static fallbacks for scanlines,
  VHS tracking, screen shake.
- High-contrast color-blind theme (white phosphor) alongside
  green / amber / blue.
- Pattern + color (not color alone) for status.
- `aria-live` regions for traps, correct codes, task completion, hints,
  victory, game over, timer milestones.
- Visible focus ring (`:focus-visible`); custom controls wired as
  proper `radio` / `button` widgets.
- Orientation prompt for small landscape phones.

### 5.16 Visual + audio polish

- Four CRT themes (green / amber / blue / white phosphor).
- Pause system (`P` key) freezes the timer.
- Local leaderboard, top 10, arcade initials.
- 46 achievements as of v2.12 (4 ending badges added in 2.12).
- Typewriter story beats with character-attributed dialogue.
- Victory confetti, screen shake, Web Audio synthesis (no audio assets
  shipped).

---

## 6. Splunk Specifics

### 6.1 Indexes (5)

| Index | Purpose | Notes |
|---|---|---|
| `nakatomi_access` | Badge swipes, door events | ~600 critical-path events + most NPC baseline |
| `nakatomi_vault` | Vault terminal sessions, system events | ~150 events; sparse, classified feel |
| `nakatomi_building` | HVAC, elevator, power, security radio, intranet | ~500 events incl. announcements |
| `nakatomi_comms` | Phone/radio intercepts (v2.9) | Hans, McClane, Argyle, Morse — also gets Adaptive Hans intercepts |
| `nakatomi_sessions` | Live game telemetry (v2.4) | 90-day retention; hard cap 5120 MB |

### 6.2 Sourcetypes (7 + telemetry types)

- `nakatomi:access:badge` — badge swipes (key=value, KV_MODE=auto)
- `nakatomi:access:door` — door state changes
- `nakatomi:vault:attempt` — vault session events
- `nakatomi:vault:system` — vault infrastructure (incl. Seal 7 hint event)
- `nakatomi:building:hvac` — temperature/pressure/elevator/power
- `nakatomi:building:security` — alarms, camera alerts, radio intercepts
- `nakatomi_vault_physical` — ESP32 HEC events from physical model
- Plus auxiliary types in `nakatomi_building` for lore: `intranet:announcements`, `intranet:diary`, `intranet:it`, `intranet:hr`, `intranet:finance`, `intranet:facilities`, `intranet:culture`, `intranet:chat`, `intranet:security`, `building:sensors`, `proxy:http`.
- Plus intercept types in `nakatomi_comms`: `intercept:hans`, `intercept:mcclane`, `intercept:holly`, `intercept:argyle`, `intercept:morse`.
- Plus telemetry: `nakatomi:session:event` in `nakatomi_sessions`.

All `_raw` formats are key=value pairs handled by `KV_MODE=auto`. The
authoritative schemas live in `docs/DATA_SCHEMAS.md`. Explicit
`EXTRACT-` rules are added in `props.conf` only where event-type-specific
fields need predictable parsing (e.g. `[nakatomi:session:event]`).

### 6.3 Lookup tables (7 CSVs)

| Lookup | Rows | Used for |
|---|---|---|
| `floor_directory.csv` | 14 | Map floor → name, tenant, restriction |
| `employee_directory.csv` | ~50 | Cross-reference badge ID → name, clearance |
| `system_codes.csv` | 6 | Map clearance level → vault auth code (Seal 6) |
| (4 additional lookups for v2.9 NPC / lore enrichment) | | |

### 6.4 KV Store

Single collection `vault_progress` (29 fields). Schema is in
`collections.conf`. Tracks per-session player progress; writes from
`game.html` over the same-origin reverse proxy. Earlier v2.3 fields are
preserved for backwards compatibility with the original progress
dashboard.

### 6.5 Saved searches / alerts

Three scheduled "Vault Alert" searches (`*/5 * * * *`, 1-hour
suppression, 24-hour rolling earliest_time) seed narrative clues onto
the player's Triggered Alerts page during live booth play. They are
intentionally "evergreen" (broad earliest_time) so demos that haven't
generated fresh data still see them fire.

### 6.6 Dashboards (10 views in `data/ui/views/`)

`mission_brief.xml` is the player's home (the only dashboard the player
is ever pointed at directly). The other nine are facilitator / dossier /
diagnostic surfaces. The biggest is `facilitator_board.xml`, a
1920×2860 Dashboard Studio canvas with rows for active teams,
leaderboard, per-act funnel, traps, hints, side stories, easter eggs,
Hans, phone calls, investigation board, hub sessions, and endings.

### 6.7 Custom React visualization

`nakatomi_heist/src/` + `webpack.config.js` + `package.json` build a
custom React visualization (registered in `visualizations.conf`).
`scripts/build-viz.sh` is the build script. The default `terminal.xml`
view embeds it.

---

## 7. Game UI (`game.html`) Internals

`game.html` is **a single self-contained HTML/CSS/JS file
(~13,117 lines, ~590 KB)**. This is intentional — it must run from a
booth USB key without internet, and it ships fonts/icons/audio
inline. **Do not split it into multiple files** without explicit user
authorization.

### 7.1 Module layout

The file is organized as a series of self-contained IIFE modules, each
with a small public API. Major modules (verifiable by grepping for
`(function(){ ... })()` or `IIFE` markers):

| Module | Purpose |
|---|---|
| `NakaTelemetry` | Opt-in HEC emit, allow-listed event types, queue, sanitization, sendBeacon fallback |
| `Endings` | v2.12 — pure classifier, registry, overlay painter, audio dispatcher |
| `HubOverlay` | v2.11 — Floor-30 hub with 7 stations, availability engine, hub telemetry |
| `InvestigationBoard` | v2.10 — corkboard, drag-drop pins, red-string threads, freehand notes, PNG export |
| `HansAntagonist` | v2.10 — reactive antagonist, throttling, idle polling, dual-destination emit |
| `PhoneCall` (or similar) | v2.10 — Powell/Hans/Holly cinematic, ringing overlay, lifecycle telemetry |
| Scoring / Hints / Tokens | v2.6 — hint-token economy, achievements, Pacifist Run / Iron Man |
| Multi-team / QR / Spectator | v2.4 — team codes, QR encoder, attract loop, spectator mode |

Each module:

- Owns its own state (no globals beyond a small shared `state` object).
- Exposes a small typed API with explicit verb names (`open`, `close`,
  `classify`, `emit`).
- HTML-escapes all rendered content via a module-local `_esc()` helper.
- Has a corresponding regression test in `scripts/tests/`.

### 7.2 Telemetry pipeline (`NakaTelemetry`)

- **Off by default.** Activates only when `window.NakatomiConfig` (or a
  `#nakatomi-config` JSON block) supplies a `hecUrl`.
- **Allow-list of event types** (`EVENT_TYPES`). Any non-allow-listed
  emit is silently dropped. Roughly 27 types as of v2.12 (e.g.
  `task_completed`, `wrong_code`, `hint_token_spent`,
  `pacifist_run_completed`, `hub_opened`, `hub_closed`,
  `hub_station_clicked`, `hans_reaction`, `phone_incoming`,
  `phone_answered`, `phone_missed`, `ending_classified`, `session_start`,
  `session_end`, …).
- **Allow-list of intercept targets** (`INTERCEPT_TARGETS`). v2.10
  permits only `intercept:hans`. Others silently dropped.
- **Sanitization.** All payload string fields go through `safeId()`
  (allowlist `[A-Za-z0-9 _-.:]`, length-capped). Free-form `feedback` /
  `note` fields go through `safeText()` which strips control chars / CR
  / LF (defeats log injection).
- **HEC URL parser** rejects `javascript:`, `data:`, `vbscript:`,
  `file:` schemes outright.
- **URL params named `hecToken` or `token` are rejected with a console
  warning and never honored** (otherwise the token would leak via
  history / Referer / screenshares).
- **`debugInfo()` returns booleans** (`hasHecToken: true/false`) — never
  the token itself.
- **Queue** capped at 500 events with oldest-first eviction; max 16 KB
  per HTTP request; exponential backoff on POST failures; `sendBeacon`
  fallback only when no token is needed.

### 7.3 URL surface

| URL | Effect |
|---|---|
| `game.html` | Standalone single-player |
| `game.html?demo=1` | Quick Demo mode, 15 min, 3 tasks |
| `game.html?booth=1` | Simplified booth mode (Investigation Board hidden, etc.) |
| `game.html?team=ABCD` | Join team `ABCD` |
| `game.html?spectator=1` | Read-only giant-text mirror for a public monitor |
| `game.html#call=powell\|hans\|holly` | Trigger phone-call cinematic |

### 7.4 Hotkeys

| Key | Effect |
|---|---|
| `P` | Pause / resume timer |
| `M` | Open / close Floor-30 hub |
| `B` | Open / close Investigation Board |
| `?` | Show shortcuts help overlay |
| `Ctrl+Shift+1/2/3` | Phone call (Powell / Hans / Holly) |
| `↑↑↓↓←→←→BA` | Konami credits roll |

---

## 8. Generator (`generator/generate.py` + `scenario.yaml`)

### 8.1 What it does

Reads `scenario.yaml` (seeds, codes, characters, NPCs, side stories,
easter eggs, lore announcements, red herrings, volume tuning, output
config) and produces:

- **3 JSON event files** in `generator/output/`:
  `nakatomi_access.json`, `nakatomi_vault.json`,
  `nakatomi_building.json` (and historically `nakatomi_comms.json` for
  the v2.9 intercept trail). Each file is one event per line in the
  HEC-friendly `{"event": {...}, "sourcetype": "...", "index": "..."}`
  shape.
- **3 CSV lookup files** also in `generator/output/`:
  `floor_directory.csv`, `employee_directory.csv`, `system_codes.csv`.

`scripts/load_data.sh --token YOUR_HEC_TOKEN` POSTs every output file
to `${SPLUNK_HEC_URL}/services/collector` (default
`https://localhost:8088`).

### 8.2 Determinism

Same `seed:` → byte-identical output. Same `seed:` → same codes. This
is **load-bearing**: dashboards, regression tests, walkthroughs,
facilitator answer sheets, and the v2.4 multi-team scoring all rely on
it. Never introduce a non-deterministic generation path that isn't
exposed through the seed.

### 8.3 Booth mode

`python3 generate.py --booth-mode` produces a lean ~1,172-event dataset
for 5-minute conference demos. **All puzzles, side mysteries, easter
eggs, and lore bulletins still resolve correctly** in booth mode —
booth mode skips only the NPC baseline (~46 k events).

### 8.4 Code-collision invariant

Generation fails loud (`raise`) if any of the following 4-digit
namespaces collide:

- Seal codes (current default: 2512 / 7439 / 4291 / 8086 / 5765 / 3940)
- Trap codes (1990 / 0911 / 1666 / 1988 / 1215)
- Side-story codes (`9xxx`)
- Easter-egg codes (`6xxx`)
- Lore announcement numbers (any 4-digit value in announcement bodies
  is checked against all of the above)

This protects against a future contributor accidentally giving an
announcement the same number as a seal.

### 8.5 NPC baseline (v2.9)

`scenario.yaml` → `npcs:` defines 60 named NPCs across 5 patterns
(day_shift, late_engineers, cleaning_crew, security_rotation, vendors).
The generator emits ~50,000 events of pre-heist baseline traffic over a
168-hour window (Dec 17 18:00 → Dec 24 18:00) so SPL queries see real
corporate rhythm instead of an empty stage.

### 8.6 Party guests (v2.9)

`scenario.yaml` → `volume.party_guest_count: 47` ensures Floor 30 is
unambiguously the busiest floor by `dc(badge_id)` during the
20:00–22:00 window — required for Seal 2's "Hostage Floor" puzzle. The
number 47 also matches Hans's "47 employees on-site" narrative beat.

---

## 9. Physical Model (status: design only)

`docs/PHYSICAL_MODEL.md` (~896 lines) is the build guide. Architecture:

- ESP32 DevKit V1 microcontroller (WiFi, dual-core, 30+ GPIO).
- 12V DC barrel-jack input, fused; 5V regulator branch for ESP32 / servos / NeoPixels / LCD; 12V bus for solenoid + magnetic locks.
- 4×4 keypad for code entry; 20×4 I²C LCD for feedback; piezo buzzer; NeoPixel strip for seal status.
- Servo locks for Seals 1–2 (PWM); solenoid bolts for Seals 3–5 (MOSFETs); magnetic lock for Seal 6 (relay); **NC relay for Seal 7** that releases on power loss.
- Each seal has a 150×70 mm hinged compartment door on the tower facade. Behind each door: the physical clue that bridges to the next puzzle (blueprint fragment, log printout, cipher wheel, RF card, badge, note + DC cable).
- Supercapacitor (2.7 V 10 F) keeps the ESP32 alive ~10 s after main power cut so the victory sequence can play after Seal 7's "unplug" moment.
- Splunk integration via WiFi: ESP32 polls the `vault_progress` KV Store (or receives webhooks) and posts `nakatomi_vault_physical` HEC events on each seal_open / wrong_code / game_over / power_loss.

Status: **firmware is not yet written** and the full physical build is in
progress. The digital `game.html` simulates everything in software for now.

---

## 10. Test Harnesses

Five Node.js regression suites in `scripts/tests/`. Each:

- Loads `game.html`, slices out the IIFE module of interest with a
  string-based extractor.
- Runs the module in a sandboxed `vm` context with stubbed DOM + window
  + localStorage + Audio.
- Asserts module surface, allow-lists, idempotency, telemetry hygiene
  (especially: **HEC token never appears in any queued payload, ever**),
  HTML-escape coverage, and headless null-safety.

| Test | Assertions | Module |
|---|---:|---|
| `test_hans_antagonist.js` | 69 | HansAntagonist |
| `test_phone_calls.js` | 84 | PhoneCall |
| `test_investigation_board.js` | 69 | InvestigationBoard |
| `test_hub_overlay.js` | 68 | HubOverlay |
| `test_endings.js` | 120 | Endings |
| **Total** | **410** | — |

Run all five:

```bash
node scripts/tests/test_hans_antagonist.js && \
node scripts/tests/test_phone_calls.js && \
node scripts/tests/test_investigation_board.js && \
node scripts/tests/test_hub_overlay.js && \
node scripts/tests/test_endings.js
```

Exit code 0 = pass.

---

## 11. Versioning Policy

Semantic versioning **MAJOR.MINOR.PATCH** as documented at the top of
`RELEASE_NOTES.md`:

- **MAJOR** — fundamental redesign or breaking changes to game
  mechanics, data schemas, or physical model interface.
- **MINOR** — new features, documents, or generator capabilities that
  don't break existing setups.
- **PATCH** — bug fixes, typo corrections, tuning adjustments.

**Major-version bumps require explicit user authorization.** Minor
bumps are routine for shipping new features.

When bumping, update **all four** version surfaces:

1. `README.md` "Current version" line
2. `RELEASE_NOTES.md` (new section at the top)
3. `nakatomi_heist/default/app.conf` (`version` and `build`)
4. `game.html` user-visible version string (typically rendered in the
   mode-select footer)

---

## 12. Conventions and Invariants

These are non-negotiable. Violations break the game or leak secrets.

### 12.1 Determinism

- Same `seed:` → same dataset, same codes, same red herrings, same
  timestamps for noise events. Don't introduce randomness that isn't
  exposed via the seed.

### 12.2 Code-namespace separation

- Seal codes (default ladder), trap codes (`1990 / 0911 / 1666 / 1988 / 1215`),
  side-story codes (`9xxx`), and easter-egg codes (`6xxx`) **must not
  collide**. The generator enforces this at build time.

### 12.3 Lore consistency

- `docs/NAKATOMI_LORE.md` is canonical. New events, side stories,
  characters, or announcements must not contradict it. Two prior
  incidents (the 1985 elevator fire and the 1987 Room 30-B hostage
  situation) are referenced everywhere — keep them straight.

### 12.4 Single-file `game.html`

- Ships as one self-contained file by design (booth / airgapped use).
  Avoid adding external runtime dependencies, CDN includes, or build
  steps that fragment it. Keep modules as IIFEs inside the file.

### 12.5 Telemetry payload hygiene

- **No PII**, **no HEC token**, **no raw SPL text**, **no DOM content**
  ever appears in a telemetry payload. Free-form `feedback` and `note`
  fields go through `safeText()`; everything else through `safeId()`.
- The regression harnesses assert this by string-searching the entire
  queue. Don't break it.

### 12.6 HEC token stays server-side

- The recommended booth deployment is a **same-origin reverse proxy**
  (full nginx example in `docs/DEPLOY.md`). The browser never sees the
  HEC token. A token in a URL param is rejected with a console warning.

### 12.7 Accessibility (WCAG 2.2 AA)

- Keyboard-first, `prefers-reduced-motion`, ≥48 px touch targets,
  `aria-live` announcements, high-contrast theme, focus rings, status
  encoded in pattern + color (not color alone). Do not regress these.

### 12.8 Test coverage parity

- Every recent feature has a corresponding `scripts/tests/test_*.js`
  suite. If you touch one of those modules, extend the suite.

### 12.9 Documentation parity

- Updates to features require a paired update to `RELEASE_NOTES.md`
  (top of file) and the relevant `docs/*.md`. Docs are part of the
  deliverable, not optional.

---

## 13. How to Run / Verify

### 13.1 Generate the dataset

```bash
cd generator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 generate.py
# or:    python3 generate.py --booth-mode
```

Output lands in `generator/output/`.

### 13.2 Install the Splunk app

**Option A — via Splunk Web:** Apps → Install app from file → select
`nakatomi_heist.spl`.

**Option B — copy directly:**

```bash
cp -r nakatomi_heist/ $SPLUNK_HOME/etc/apps/nakatomi_heist/
$SPLUNK_HOME/bin/splunk restart
```

### 13.3 Load the data

Enable HEC in Splunk; create a token with access to the `nakatomi_*`
indexes; then:

```bash
scripts/load_data.sh --token YOUR_HEC_TOKEN
```

Verify:

```spl
index=nakatomi_access OR index=nakatomi_vault OR index=nakatomi_building OR index=nakatomi_comms
| stats count by index, sourcetype
```

### 13.4 Play

Open the **Nakatomi Heist** app in Splunk → Mission Brief is the
player's starting point. Open `game.html` in a browser for the vault
keypad (digital mode). Booth deployments use the reverse-proxy pattern
in `docs/DEPLOY.md`.

### 13.5 Run the regression suite

```bash
for t in scripts/tests/test_*.js; do node "$t" || break; done
```

---

## 14. Common Task Playbooks

### 14.1 "Add a new SPL puzzle / seal variant"

1. Decide the SPL skill it teaches. Avoid duplicating the existing
   ladder (`search → stats → transaction → eval → rex → lookup`).
2. Add the code + embed location to `generator/scenario.yaml` →
   `seals:` (or a new section if it's a side mystery).
3. Update `generator/generate.py` to emit the embed event(s) and any
   red herrings.
4. Document the puzzle in `docs/STORY_AND_MYSTERIES.md` (film moment,
   narrative hook, search path, red herrings, compartment reward,
   facilitator hint).
5. Verify deterministic output — re-run with the same seed, diff the
   output file.
6. Update `RELEASE_NOTES.md` (top) with a minor bump.

### 14.2 "Add a dashboard or tweak the facilitator board"

1. Choose Simple XML or Dashboard Studio JSON-in-XML based on the
   nearest existing view.
2. Add the file to `nakatomi_heist/default/data/ui/views/` and register
   it in `nakatomi_heist/default/data/ui/nav/default.xml` if it should
   appear in nav.
3. If the dashboard uses a new field, ensure `props.conf` extracts it
   (or that `KV_MODE=auto` will catch it).
4. For the facilitator board, extend `facilitator_board.xml` and update
   the canvas height (currently `1920×2860`). Update the corresponding
   row count in `RELEASE_NOTES.md`.

### 14.3 "Extend a `game.html` module"

1. Locate the IIFE (`HubOverlay`, `Endings`, `InvestigationBoard`,
   `HansAntagonist`, `NakaTelemetry`, etc.).
2. Add the new field / method following the existing pattern; keep
   state local; expose through the module's small public API.
3. Use the module-local `_esc()` helper for any rendered content.
4. If you add a telemetry event type, allow-list it in
   `NakaTelemetry.EVENT_TYPES`; emit-time guard stays.
5. Extend the corresponding `scripts/tests/test_*.js` suite to assert
   the new behaviour, including telemetry hygiene.
6. Update `RELEASE_NOTES.md` and (if user-visible)
   `docs/PLAYER_EXPERIENCE.md`.

### 14.4 "Add a side mystery / easter egg / lore bulletin"

1. Decide the namespace (`9xxx` for side mysteries, `6xxx` for easter
   eggs, no code for lore announcements). Don't collide.
2. For side mysteries: extend `scenario.yaml` → `side_stories:` with a
   new entry (id, title, category, discovery_code, achievement,
   spl_hint, teaser, payoff). Add the achievement to `game.html`.
3. For easter eggs: extend `scenario.yaml` → `easter_eggs:` and the
   `EASTER_EGGS` registry in `game.html` (id and code must match).
4. For lore announcements: extend `scenario.yaml` → `announcements:`.
   Re-run the generator to confirm no code collision.
5. Document in `docs/STORY_AND_MYSTERIES.md` and (for lore)
   `docs/NAKATOMI_LORE.md`.

### 14.5 "Fix a bug"

1. Reproduce. Most bugs are visible in one of the regression suites or
   in a 5-minute booth-mode play-through (`?demo=1`).
2. Write the failing assertion first (where applicable) in the
   relevant `test_*.js` suite.
3. Make the surgical fix. Do not refactor surrounding code unless the
   fix requires it.
4. Re-run the full regression suite (all 410 assertions). Exit 0.
5. Update `RELEASE_NOTES.md` (patch bump).

---

## 15. Things NOT to Do

- ❌ **Don't put the HEC token in `game.html`, in a URL param, in a
  query string, or in a committed config file.** The same-origin
  reverse proxy is the only supported booth model. URL params named
  `hecToken` or `token` are explicitly rejected.
- ❌ **Don't split `game.html` into multiple files** without explicit
  user authorization. It must run from a USB key without internet.
- ❌ **Don't add free-text fields to telemetry payloads.** Everything is
  allow-listed. Free-form fields must go through `safeText()`.
- ❌ **Don't introduce non-determinism in the generator.** Same seed,
  same output.
- ❌ **Don't change a seal code value** without re-checking the
  cross-namespace collision invariant. The generator will fail loud,
  but make sure the new code is also memorable / thematic.
- ❌ **Don't add a Seal 7 SPL hint event** beyond the existing single
  oblique vault-protocol-7 documentation event. The "lateral thinking"
  payoff depends on the data being silent.
- ❌ **Don't bump MAJOR** without explicit user authorization. Minor and
  patch bumps are routine.
- ❌ **Don't assume the physical model exists yet.** ESP32 firmware is
  not written; the digital `game.html` simulates everything.
- ❌ **Don't add external runtime dependencies to `game.html`** (CDN
  scripts, fonts, audio assets, third-party libraries).
- ❌ **Don't reference real Die Hard characters in NPC roster.** The
  `npcs:` block uses clearly fictional Nakatomi staff. Reusing
  Hans/Holly/McClane there breaks the narrative integrity.
- ❌ **Don't skip the regression suite before claiming work is done.**
  All 410 assertions must pass.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Seal | One of the 7 vault locks. 6 are SPL-driven; Seal 7 is meta. |
| Act | One of 5 narrative blocks (Christmas Party → Takeover → Vault → Counterattack → Escape). |
| Trap code | A wrong keypad code that triggers a narrative lore toast in addition to the wrong-codes counter. |
| Side mystery | An optional discovery trail in the `9xxx` keypad namespace; no penalty. |
| Easter egg | A hidden moment in the `6xxx` keypad namespace; no penalty. |
| Token | A hint token in the v2.6 hint-token economy. |
| Pacifist Run | Achievement for completing a campaign without spending a single hint token. |
| Iron Man | 50-min, no-hints, 3-error gauntlet difficulty mode (3× score). |
| Adaptive Hans | The reactive antagonist layer with 36 lines and 6 triggers. |
| Investigation Board | The drag-drop corkboard overlay with red-string threads. |
| Hub | The free-roam Floor-30 blueprint overlay with 7 stations. |
| Booth mode | `?booth=1` or `--booth-mode` — simplified UI / lean dataset for conference demos. |
| Spectator mode | `?spectator=1` — read-only giant-text mirror for a public-facing booth monitor. |
| HEC | Splunk's HTTP Event Collector — how all events get into Splunk in this project. |
| KV Store | Splunk's per-app key-value store; used by `vault_progress` collection. |
| Same-origin reverse proxy | The recommended booth deployment topology that keeps the HEC token server-side. |

---

## 17. Where to Look First

If your task is about… | Read this first |
|---|---|
A specific seal puzzle | `docs/STORY_AND_MYSTERIES.md` |
A specific data field | `docs/DATA_SCHEMAS.md` |
The narrative timeline / fail conditions | `docs/TIMELINE_AND_FLOWS.md` |
What the player actually sees | `docs/PLAYER_EXPERIENCE.md` |
Booth deployment / HEC security | `docs/DEPLOY.md` |
Building lore / character bios | `docs/NAKATOMI_LORE.md` |
Physical model / ESP32 | `docs/PHYSICAL_MODEL.md` |
A recent feature's design rationale | `RELEASE_NOTES.md` (top of file) |
Game UI module surface | The IIFE in `game.html` + `scripts/tests/test_<module>.js` |
Splunk app structure | `nakatomi_heist/default/*.conf` |
Generator behaviour | `generator/scenario.yaml` (config) + `generator/generate.py` (code) |

---

## 18. Final Checklist Before You Claim "Done"

- [ ] All 410 regression assertions pass
  (`for t in scripts/tests/test_*.js; do node "$t"; done`).
- [ ] If you touched a generator output: re-ran with the default seed
  and diffed the output to confirm intentional changes only.
- [ ] If you touched a sourcetype or field: `props.conf` and
  `docs/DATA_SCHEMAS.md` are in sync.
- [ ] If you added a feature: `RELEASE_NOTES.md` has a new section at
  the top; version bumped in `README.md`,
  `nakatomi_heist/default/app.conf`, and `game.html`.
- [ ] If you added a telemetry event: it's allow-listed in
  `NakaTelemetry.EVENT_TYPES`; the regression suite asserts no
  HEC-token leak.
- [ ] If you touched lore: `docs/NAKATOMI_LORE.md` continuity is
  preserved (1985 fire / 1987 hostage incident / 1988 holiday).
- [ ] No code collisions between seal / trap / side-story / easter-egg
  codes.
- [ ] No external runtime dependencies added to `game.html`.
- [ ] Accessibility: no regression in keyboard nav, focus rings,
  reduced-motion, aria-live, or color-blind theme.
- [ ] Documentation: at least one `docs/*.md` updated alongside the
  change.

That's the whole project. Now do the task.
