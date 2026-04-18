# Nakatomi Plaza: Vault Heist

**A Splunk-powered inverse escape room**
*"Now I have a SPL. Ho-ho-ho."*

---

## What Is This?

An **inverse escape room** where players take the role of Hans Gruber's tech crew during the Nakatomi Plaza heist (Die Hard, 1988). Instead of escaping a room, players must **break into the vault** by solving challenges in **Splunk** — running searches, building dashboards, and finding codes hidden in synthetic log data — then entering those codes on a **physical model of Nakatomi Plaza** with seven seals.

The first six seals open with codes discovered through SPL. The **seventh seal** is a meta solution in the spirit of the film — think outside the system.

The game supports **dual mode**: play with the physical vault model, or go fully digital with `game.html` — an on-screen keypad, clue card reveals, and a hidden power element for Seal 7.

**Current version: 2.9.0** — See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full changelog.

## How It Works

1. **Act 1: The Christmas Party** — Infiltrate the building; count employees, find Takagi, map security gaps.
2. **Act 2: The Takeover** — Cut communications, lock down elevators, track guard rotations.
3. **Act 3: The Vault** — Crack the seven vault seals using SPL skills, ciphers, and lookup cross-references. The seventh seal is a meta solution — no code in Splunk.
4. **Act 4: McClane's Counterattack** — Track the cowboy, intercept police radio, monitor C4 charges.
5. **Act 5: The Escape** — Verify the bonds, find the exit route, extract before the deadline.

**5 acts. 26 tasks. 5 difficulty levels. ~47,000 events.** Multiple fail conditions keep the pressure on: police breach, McClane, roof charges, trap codes, and the clock.

## Features

### Gameplay
- **Five difficulty modes** — Rookie (120 min, forgiving), Operative (90 min, standard), Mastermind (60 min, brutal), **Iron Man** *(new in 2.6 — 50 min, 3 errors, zero hints, 3× score)*, plus Quick Demo (15 min, 3 tasks)
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

### Booth / multi-team / facilitator *(new in 2.4)*
- **Live session telemetry** — Opt-in HEC posting with offline event queue (capped, oldest-first eviction); KV Store progress writes
- **Facilitator dashboard** — Live 1920×1080 Dashboard Studio view: active teams, leaderboard, per-act funnel, trap log, hint distribution, booth filter
- **Team codes + QR handoff** — 4-character unambiguous team codes, shareable URL + auto-generated QR (inline encoder, zero supply-chain surface), print-friendly handouts
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

### Visual + audio polish
- **CRT theme picker** — Green, amber, blue, or high-contrast white phosphor (4 themes)
- **Pause system** — Freeze the timer mid-game (P key)
- **Local leaderboard** — Top 10 with arcade-style initials
- **Achievements** — 6 badges for special accomplishments
- **Typewriter story beats** — Character-attributed dialogue with typewriter animation
- **Victory confetti and screen shake** — Visual polish throughout
- **Web Audio synthesis** — Synthesized beeps, drones, heartbeats, victory fanfare; no audio assets shipped

### Data realism *(new in 2.9)*
- **60 named NPCs** — Day-shift office workers, late-stay engineers, cleaning crew, security guards, and vendors create a realistic corporate rhythm across a full week of pre-heist baseline traffic (~46k events)
- **47 Christmas-party guests** — Dedicated guest roster makes floor 30 unambiguously the busiest floor during the party window
- **Booth mode** — `python3 generate.py --booth-mode` produces a lean ~750-event dataset for 5-minute conference demos; all puzzles still resolve correctly

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
- **Game UI v2.4** — Standalone HTML/CSS/JS with scoring, difficulty, hints, achievements, leaderboard, CRT themes, pause, opt-in live telemetry, multi-team codes, QR handoff, attract loop, spectator URL, and full WCAG 2.2 AA accessibility pass

### In Progress

- Physical Nakatomi Plaza tower model (3D printed / hand-built)

### Planned

- ESP32 firmware
- Integration between game UI and ESP32 (seal status polling)

## Visual Project Overview

Open **[index.html](index.html)** in a browser for a full visual overview of the project — game phases, architecture diagrams, seven seals, player roles, fail conditions, flow charts, easter eggs, and roadmap, all on one page.

## Quick Start — Install and Play

### 1. Generate the dataset

```bash
cd generator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 generate.py
```

Output lands in `generator/output/` — three JSON event files and three CSV lookup tables (~47k events including NPC baseline). Change the `seed` in `scenario.yaml` to produce a fresh dataset with different codes for each game session.

For conference demos with minimal data, use booth mode:

```bash
python3 generate.py --booth-mode
```

This produces ~750 critical-path events only (no NPC baseline) for fast 5-minute sessions.

### 2. Install the Splunk app

**Option A** — Upload via Splunk Web:

Apps > Install app from file > select `nakatomi_heist.spl`

**Option B** — Copy directly:

```bash
cp -r nakatomi_heist/ $SPLUNK_HOME/etc/apps/nakatomi_heist/
$SPLUNK_HOME/bin/splunk restart
```

This creates the three indexes (`nakatomi_access`, `nakatomi_vault`, `nakatomi_building`), configures all sourcetypes, installs lookup tables, and deploys the Mission Brief dashboard.

### 3. Load the data

Enable HTTP Event Collector (HEC) in Splunk, create a token with access to the `nakatomi_*` indexes, then run the loader:

```bash
scripts/load_data.sh --token YOUR_HEC_TOKEN
```

Or manually with curl:

```bash
TOKEN="your-hec-token"
for f in generator/output/nakatomi_*.json; do
    curl -k "https://localhost:8088/services/collector" \
        -H "Authorization: Splunk $TOKEN" \
        -d @"$f"
done
```

### 4. Play

Open **Nakatomi Heist** in Splunk. The Mission Brief dashboard is your starting point. Open `game.html` in a browser for the vault keypad (digital mode) or connect the physical vault model.

#### Booth / multi-team deployment *(new in 2.4)*

For conference booths or facilitated multi-team sessions, see [`docs/DEPLOY.md`](docs/DEPLOY.md). It covers:

- The recommended same-origin reverse-proxy pattern (with a working nginx example) so HEC tokens stay secret.
- Configuring opt-in telemetry to feed the live facilitator board (`Facilitator Board` in the Splunk app nav).
- Per-team handoff URLs and QR codes from the mode-select screen.
- A 15-minute Quick Demo mode (`?demo=1`) for short booth sessions.
- An attract loop for unattended kiosks (idle ≥60 s on the mode-select screen).
- A spectator second-screen view (`?spectator=1`) for a public-facing monitor next to the player.

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
├── game.html                       # Game UI v2.4 — dual-mode (physical / digital), telemetry, multi-team, accessibility
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
│   │           └── facilitator_board.xml    # Live multi-team booth dashboard (1920×1080)
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

## License

This project is for educational and community use. Die Hard references are used for fan/parody purposes only; all trademarks belong to their respective owners.
