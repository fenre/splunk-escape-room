# Release Notes — Nakatomi Plaza: Vault Heist

Versioning follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**.

- **MAJOR** — fundamental redesign or breaking changes to game mechanics, data schemas, or physical model interface.
- **MINOR** — new features, documents, or generator capabilities that don't break existing setups.
- **PATCH** — bug fixes, typo corrections, tuning adjustments.

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
