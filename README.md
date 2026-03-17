# Nakatomi Plaza: Vault Heist

**A Splunk-powered inverse escape room**
*"Now I have a SPL. Ho-ho-ho."*

---

## What Is This?

An **inverse escape room** where players take the role of Hans Gruber's tech crew during the Nakatomi Plaza heist (Die Hard, 1988). Instead of escaping a room, players must **break into the vault** by solving challenges in **Splunk** — running searches, building dashboards, and finding codes hidden in synthetic log data — then entering those codes on a **physical model of Nakatomi Plaza** with seven seals.

The first six seals open with codes discovered through SPL. The **seventh seal** is a meta solution in the spirit of the film — think outside the system.

## How It Works

1. **Infiltration** — Access the building's systems; prove you're in.
2. **Reconnaissance** — Map the tower (floors, cameras, guards) via logs and dashboards.
3. **Access Control** — Find a bypass code or badge ID from the data.
4. **Vault (Seals 1–6)** — Crack each seal's code using SPL skills (`rex`, `transaction`, lookups, time ranges).
5. **Seal 7** — The meta solution. No code in Splunk. Figure it out.

Total game time: **45–60 minutes**. Multiple fail conditions keep the pressure on: police breach, McClane, roof charges, and the clock.

## Project Status

This project is currently in the **design and planning** phase. The design documents are complete; implementation (Splunk app, data generators, physical model, game UI) is next.

### Current

- Full design document with game mechanics, puzzles, and architecture
- Story and narrative (introduction, easter eggs, mystery catalogue)
- Timeline, fail conditions, and flow diagrams (with rendered Mermaid views)

### Planned

- Synthetic log data generator (Python)
- Splunk app with indexes (`nakatomi_access`, `nakatomi_vault`, `nakatomi_building`)
- Game orchestration UI (answer submission and phase progression)
- Physical Nakatomi Plaza model with 7 seal inputs (Arduino / Raspberry Pi Pico)

## Visual Project Overview

Open **[index.html](index.html)** in a browser for a full visual overview of the project — game phases, architecture diagrams, seven seals, player roles, fail conditions, flow charts, easter eggs, and roadmap, all on one page.

## Repository Structure

```
splunk-escape-room/
├── README.md
├── index.html                   # Visual project overview (open in browser)
├── index.svg                    # Nakatomi Plaza tower illustration
├── docs/
│   ├── DESIGN.md                # Full design document (mechanics, architecture, puzzles)
│   ├── STORY_AND_MYSTERIES.md   # Narrative, easter eggs, mystery catalogue
│   ├── TIMELINE_AND_FLOWS.md    # Phase timeline, fail conditions, flow diagrams
│   ├── PHYSICAL_MODEL.md        # Electronics, locks, wiring, BOM, and build guide
│   ├── physical_model_diagram.svg  # Visual wiring and component placement diagram
│   └── flow.html                # Rendered Mermaid flow diagrams
```

## Design Documents

| Document | Description |
|----------|-------------|
| [Visual Overview](index.html) | Full project overview with diagrams, timelines, and architecture (open in browser) |
| [Design Document](docs/DESIGN.md) | Vision, game mechanics, puzzle design, technical architecture, and project roadmap |
| [Story & Mysteries](docs/STORY_AND_MYSTERIES.md) | Introduction narrative, Die Hard easter eggs, and the mystery/task catalogue |
| [Timeline & Flows](docs/TIMELINE_AND_FLOWS.md) | Phase timeline, threat escalation, fail conditions, McClane hint schedule, and Mermaid flow diagrams |
| [Physical Model](docs/PHYSICAL_MODEL.md) | Electronics design, lock mechanisms, wiring, BOM, Seal 7 circuit, Splunk integration, and build guide |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Search & Analytics | Splunk Enterprise or Cloud |
| Data Generation | Python (planned) |
| Game UI | HTML/JS or Splunk app (planned) |
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
