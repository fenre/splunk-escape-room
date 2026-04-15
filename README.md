# Nakatomi Plaza: Vault Heist

**A Splunk-powered inverse escape room**
*"Now I have a SPL. Ho-ho-ho."*

---

## What Is This?

An **inverse escape room** where players take the role of Hans Gruber's tech crew during the Nakatomi Plaza heist (Die Hard, 1988). Instead of escaping a room, players must **break into the vault** by solving challenges in **Splunk** — running searches, building dashboards, and finding codes hidden in synthetic log data — then entering those codes on a **physical model of Nakatomi Plaza** with seven seals.

The first six seals open with codes discovered through SPL. The **seventh seal** is a meta solution in the spirit of the film — think outside the system.

The game supports **dual mode**: play with the physical vault model, or go fully digital with `game.html` — an on-screen keypad, clue card reveals, and a hidden power element for Seal 7.

**Current version: 2.3.0** — See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full changelog.

## How It Works

1. **Act 1: The Christmas Party** — Infiltrate the building; count employees, find Takagi, map security gaps.
2. **Act 2: The Takeover** — Cut communications, lock down elevators, track guard rotations.
3. **Act 3: The Vault** — Crack the seven vault seals using SPL skills, ciphers, and lookup cross-references. The seventh seal is a meta solution — no code in Splunk.
4. **Act 4: McClane's Counterattack** — Track the cowboy, intercept police radio, monitor C4 charges.
5. **Act 5: The Escape** — Verify the bonds, find the exit route, extract before the deadline.

**5 acts. 26 tasks. 3 difficulty levels.** Multiple fail conditions keep the pressure on: police breach, McClane, roof charges, trap codes, and the clock.

## Features

- **Three difficulty modes** — Rookie (120 min, forgiving), Operative (90 min, standard), Mastermind (60 min, brutal)
- **Scoring system** — Base points + speed bonuses, with hint and error penalties, difficulty multiplier
- **Tiered hints** — Free first hint, escalating penalties, optional answer reveal at 0 points
- **Trap codes** — Specific wrong answers trigger extra penalties or instant game over
- **Multi-cipher toolkit** — ROT13, Hex, Base64, Binary, Number-to-Letter decoders
- **Text and numeric codes** — Some tasks use alphanumeric answers, others use 4-digit codes
- **Multi-step puzzles** — Composite tasks with sub-objectives
- **CRT theme picker** — Green, amber, or blue phosphor themes
- **Pause system** — Freeze the timer mid-game (P key)
- **Local leaderboard** — Top 10 with arcade-style initials
- **Achievements** — 6 badges for special accomplishments
- **Bonus objectives** — Post-victory challenges
- **Typewriter story beats** — Character-attributed dialogue with typewriter animation
- **Decision points** — Narrative choices between acts
- **Victory confetti and screen shake** — Visual polish throughout
- **Full Splunk integration** — 9 dashboards, 4 indexes, 7 lookups, guided investigation, progress tracking, alert-based clues

## Project Status

### Complete

- Full design document with game mechanics, puzzles, and architecture
- Story and narrative with complete puzzle catalogue (26 tasks across 5 acts)
- Timeline, fail conditions, and flow diagrams (with rendered Mermaid views)
- Physical model electronics design (ESP32, locks, wiring, BOM)
- **Data schemas** — 7 sourcetypes, 4 indexes, 7 lookup tables, all field definitions
- **Data generator** — Python script producing ~830 deterministic Splunk-ingestible events
- **Player experience** design — dashboard wireframes, phase progression, hint delivery
- **Splunk app** — `nakatomi_heist/` with indexes, props, transforms, lookups, 9 dashboards, KV Store, saved searches
- **Game UI v2.3** — Standalone HTML/CSS/JS with scoring, difficulty, hints, achievements, leaderboard, CRT themes, pause, and more

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

Output lands in `generator/output/` — three JSON event files and three CSV lookup tables. Change the `seed` in `scenario.yaml` to produce a fresh dataset with different codes for each game session.

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
├── game.html                       # Game UI v2.3 — dual-mode (physical / digital)
├── nakatomi-plaza.jpg              # Nakatomi Plaza photo (mode select background)
├── docs/
│   ├── DESIGN.md                   # Game mechanics, architecture, puzzles
│   ├── STORY_AND_MYSTERIES.md      # Narrative, easter eggs, full puzzle catalogue
│   ├── TIMELINE_AND_FLOWS.md       # Phase timeline, fail conditions, flow diagrams
│   ├── PHYSICAL_MODEL.md           # Electronics, locks, wiring, BOM, build guide
│   ├── DATA_SCHEMAS.md             # Sourcetypes, indexes, field definitions, sample events
│   ├── PLAYER_EXPERIENCE.md        # Dashboard wireframes, progression, hint delivery, digital mode
│   ├── physical_model_diagram.svg  # Wiring and component placement diagram
│   └── flow.html                   # Rendered Mermaid flow diagrams
├── nakatomi_heist/                 # Splunk app v2.3.0
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
│   │           └── progress_tracker.xml     # Session progress (KV Store)
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
| [Story & Mysteries](docs/STORY_AND_MYSTERIES.md) | Introduction narrative, easter eggs, and the complete seal-by-seal puzzle catalogue |
| [Timeline & Flows](docs/TIMELINE_AND_FLOWS.md) | Phase timeline, threat escalation, fail conditions, McClane hint schedule, and Mermaid flow diagrams |
| [Physical Model](docs/PHYSICAL_MODEL.md) | Electronics design, lock mechanisms, wiring, BOM, Seal 7 circuit, Splunk integration, and build guide |
| [Data Schemas](docs/DATA_SCHEMAS.md) | All sourcetype definitions, `_raw` formats, field extractions, lookup table schemas, and Splunk config |
| [Player Experience](docs/PLAYER_EXPERIENCE.md) | Dashboard wireframes, phase progression, hint delivery, fail/win states, and Splunk app structure |

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
