# Nakatomi Plaza: Vault Heist

**A Splunk-powered inverse escape room**
*"Now I have a SPL. Ho-ho-ho."*

---

## What Is This?

An **inverse escape room** where players take the role of Hans Gruber's tech crew during the Nakatomi Plaza heist (Die Hard, 1988). Instead of escaping a room, players must **break into the vault** by solving challenges in **Splunk** — running searches, building dashboards, and finding codes hidden in synthetic log data — then entering those codes on a **physical model of Nakatomi Plaza** with seven seals.

The first six seals open with codes discovered through SPL. The **seventh seal** is a meta solution in the spirit of the film — think outside the system.

The game supports **dual mode**: play with the physical vault model, or go fully digital with `game.html` — an on-screen keypad, clue card reveals, and a hidden power element for Seal 7.

## How It Works

1. **Infiltration** — Access the building's systems; prove you're in.
2. **Reconnaissance** — Map the tower (floors, cameras, guards) via logs and dashboards.
3. **Access Control** — Find a bypass code or badge ID from the data.
4. **Vault (Seals 1–6)** — Crack each seal's code using SPL skills (`rex`, `transaction`, lookups, time ranges).
5. **Seal 7** — The meta solution. No code in Splunk. Figure it out.

Total game time: **45–60 minutes**. Multiple fail conditions keep the pressure on: police breach, McClane, roof charges, and the clock.

## Project Status

### Complete

- Full design document with game mechanics, puzzles, and architecture
- Story and narrative with complete puzzle catalogue (all 7 seals specified)
- Timeline, fail conditions, and flow diagrams (with rendered Mermaid views)
- Physical model electronics design (ESP32, locks, wiring, BOM)
- **Data schemas** — 6 sourcetypes, 3 indexes, 3 lookup tables, all field definitions
- **Data generator** — Python script producing ~830 deterministic Splunk-ingestible events
- **Player experience** design — dashboard wireframes, phase progression, hint delivery

### In Progress

- Physical Nakatomi Plaza tower model (3D printed / hand-built)

### Planned

- Splunk app packaging (`nakatomi_heist/`)
- ESP32 firmware
- Integration between game UI and ESP32 (seal status polling)

## Visual Project Overview

Open **[index.html](index.html)** in a browser for a full visual overview of the project — game phases, architecture diagrams, seven seals, player roles, fail conditions, flow charts, easter eggs, and roadmap, all on one page.

## Quick Start — Generate the Dataset

```bash
cd generator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 generate.py
```

Output lands in `generator/output/` — three JSON event files and three CSV lookup tables, ready for Splunk `oneshot` ingest. Change the `seed` in `scenario.yaml` to produce a fresh dataset with different codes for each game session.

## Repository Structure

```
splunk-escape-room/
├── README.md
├── index.html                      # Visual project overview (open in browser)
├── index.svg                       # Nakatomi Plaza tower illustration
├── game.html                       # Game UI — dual-mode (physical / digital)
├── docs/
│   ├── DESIGN.md                   # Game mechanics, architecture, puzzles
│   ├── STORY_AND_MYSTERIES.md      # Narrative, easter eggs, full puzzle catalogue
│   ├── TIMELINE_AND_FLOWS.md       # Phase timeline, fail conditions, flow diagrams
│   ├── PHYSICAL_MODEL.md           # Electronics, locks, wiring, BOM, build guide
│   ├── DATA_SCHEMAS.md             # Sourcetypes, indexes, field definitions, sample events
│   ├── PLAYER_EXPERIENCE.md        # Dashboard wireframes, progression, hint delivery, digital mode
│   ├── physical_model_diagram.svg  # Wiring and component placement diagram
│   └── flow.html                   # Rendered Mermaid flow diagrams
├── generator/
│   ├── generate.py                 # Data generator (Python)
│   ├── scenario.yaml               # Seal codes, timeline, characters, tuning
│   └── requirements.txt            # Python dependencies
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
| Game UI | Standalone HTML/CSS/JS ([game.html](game.html)) — dual-mode (physical + digital) |
| Splunk App | Splunk app with Mission Brief dashboard (planned) |
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
