# Nakatomi Plaza: Vault Heist — Design Document (First Draft)

**Splunk-Based Inverse Escape Room**  
*“Now I have a SPL. Ho-ho-ho.”*

---

## 1. Vision & Concept

### 1.1 What We’re Building

A **Splunk-powered inverse escape room** where players take the role of **Hans Gruber’s crew** during the Nakatomi Plaza heist. Instead of escaping, they must **break into the vault** by solving a series of challenges in **Splunk** (searches, dashboards, clues in data) and then **opening seven seals** on a **physical model of Nakatomi Plaza**. The first six seals open with codes discovered in the data; the **seventh seal** is a **meta solution** in the spirit of the movie — e.g. unplugging the power — that rewards thinking outside the system.

- **Platform**: Splunk (search, dashboards, alerts) + **physical centrepiece** (Nakatomi model with 7 seals).
- **Theme**: Die Hard (1988) — Nakatomi Plaza, Christmas Eve, vault heist; seven seals on the vault as in the film.
- **Player role**: Villains (thieves) working to crack the vault and complete the heist.

### 1.2 Why “Inverse” Escape Room?

- **Classic escape room**: Find clues → solve puzzles → get out.
- **This game**: Get “in” — use Splunk to analyze the building’s digital footprint (logs, access systems, blueprints-as-data) to discover codes, sequences, and procedures that let you “break into” the vault.

The “room” is the **Splunk environment**; the “lock” is the vault’s logical security represented in data.

---

## 2. Story & Setting

**Introduction**: The event begins with a short **introduction story** (read before play): it sets the scene (Christmas Eve, Nakatomi Plaza, you’re the tech arm of the heist crew), the goal (crack the vault’s seven seals using Splunk and the physical model), and how to start (get into the building’s data, start with the lobby). Full text: [STORY_AND_MYSTERIES.md](STORY_AND_MYSTERIES.md) Part 1.

**Easter eggs**: Quotes, character names, and moments from the film are woven into narrative, Splunk log flavor, UI, and facilitator script. See the “Easter eggs” subsection in [STORY_AND_MYSTERIES.md](STORY_AND_MYSTERIES.md) for the approved list and suggested placements.

### 2.1 Narrative Frame

- **When**: Christmas Eve, Nakatomi Plaza (Los Angeles).
- **Who**: Players are part of the heist team. Hans is in charge; players are the “tech” / intel arm (or hybrid roles).
- **Goal**: Steal the bearer bonds in the vault. To do that, the team must:
  - Understand the building’s systems (HVAC, elevators, power, security).
  - Get past access control and surveillance (represented as logs and events in Splunk).
  - Crack the vault’s electronic lock (e.g., codes, timers, sequences derived from data).

### 2.2 Tone

- **Atmosphere**: Tense, cinematic, slightly campy (in line with the movie).
- **Flavor text**: Nakatomi-specific names (e.g., “Takagi”, “Ellis”, “Holly”), vault codes, floor names, and references to the film without requiring deep IP — focus on “heist at a corporate tower” and “vault” as the objective.

### 2.3 Optional Narrative Beats (for pacing)

1. **Infiltration** — Access building systems; first Splunk data shows “you’re in.”
2. **Recon** — Map the tower (floors, cameras, guards) via logs and dashboards.
3. **Bypass** — Disable or spoof access control / surveillance using clues in data.
4. **Vault — Seven Seals** — Crack the vault’s seven locks: six codes from the data (entered on the physical Nakatomi model), then the **seventh** — the twist — not another code, but a **physical trick** (e.g. unplug the power) that the system never tells you.

---

## 3. Player Experience & Roles

### 3.1 Player Personas (suggested)

- **The SPL Specialist** — Writes searches, builds reports, finds patterns.
- **The Dashboard Builder** — Turns findings into visual “intel boards” for the team.
- **The Alert Hunter** — Uses alerts and timestamps to discover procedures and weaknesses.
- **The Storyteller / Coordinator** — Reads the narrative, directs the team to the next objective.

Roles can be combined or rotated; the design should allow both solo and small-team play (2–4 people).

### 3.2 Learning Outcomes (optional)

- SPL: `search`, `stats`, `eval`, `rex`, `lookup`, `transaction`, time modifiers.
- Dashboards: panels, inputs, drilldown.
- Alerts: trigger conditions, actions (e.g., “unlock next clue”).
- Log types: access logs, sensor/ICS-style logs, “vault” event logs.

---

## 4. Game Mechanics — How Splunk Is the “Room”

### 4.1 Core Loop

1. **Objective** — Narrative or UI states the next goal (e.g., “Find the vault code format”).
2. **Investigation** — Players use Splunk: run searches, open dashboards, react to alerts.
3. **Discovery** — Data contains the answer (e.g., a code, a sequence, a time window).
4. **Submission** — Players enter the answer somewhere (web form, Splunk input, physical prop).
5. **Validation** — Correct answer unlocks the next phase or the final “vault open” moment.

### 4.2 Where “Puzzles” Live

| Puzzle type        | Splunk mechanism              | Example |
|--------------------|--------------------------------|---------|
| Find a code        | Search logs for a pattern      | Access log shows `vault_door=7-4-2-8` |
| Sequence / order   | Transaction or ordered events  | Elevator logs show correct floor order |
| Timing             | Time-range search / alert      | “Vault opens only at 00:00” — find in logs |
| Map the building   | Dashboard + lookup/geo         | Floors, cameras, guards as data |
| Bypass “security”  | Satisfy alert condition        | Trigger an alert that “disables” a control (narrative) |

### 4.3 Win Condition

- **Explicit**: All **7 seals** on the physical vault model are opened (6 via codes from Splunk, 7th via the meta solution) → **Heist complete**.
- **Optional**: Time pressure (e.g., “before midnight” or a countdown) for difficulty.

### 4.4 Lose conditions and timeline

The game has **multiple ways to lose** (1990s-style); all lead to the same game-over ending (Hans’s fate — dropped from the building). **Police breach** is triggered by a **player action** tied to the movie (e.g. pulling a report that “alerts the outside world,” or entering a trap code that narrative-wise triggers the alarm / 911), not a generic timer. **McClane** is introduced with a **first hint** when he first matters in the film (crew realizes someone’s loose), then **follow-up hints** of his activity throughout the game in line with the movie’s sequence; the actual “McClane kills you” game over is a separate rule (e.g. too many wrong seal codes). Detailed timeline, threat triggers, McClane hint schedule, and flow map: [TIMELINE_AND_FLOWS.md](TIMELINE_AND_FLOWS.md).

---

## 5. Physical Component — Nakatomi Model & Seven Seals

The game has a **physical centrepiece**: a model of Nakatomi Plaza that doubles as the vault interface. Solving puzzles in Splunk produces codes that players **enter or trigger on the model** to open seals. The design mirrors the movie: the vault has **seven seals**; the last one is a twist that rewards thinking outside the system.

### 5.1 The Physical Model

- **What it is**: A physical representation of Nakatomi Plaza (tower + vault).
- **Purpose**: 
  - Makes the heist tangible: players don’t only type codes into a screen — they “break into” a visible vault.
  - Bridges digital (Splunk) and physical (seals, power, props) so the room feels like one experience.
- **Scope options**:
  - **Minimal**: A vault “panel” or box with 7 seal indicators (LEDs, locks, or mechanical seals) and one or more code inputs (keypad, dials, switches). The “plaza” can be suggested by a small tower silhouette or printed backdrop.
  - **Full**: A 3D model of the tower (e.g., foam, cardboard, or 3D-printed) with the vault at the base or in a dedicated section; the 7 seals are integrated into the vault door or a control panel on the model.

### 5.2 The Seven Seals (In the Spirit of the Movie)

In the film, the Nakatomi vault is secured by **seven locks** that must be opened in sequence. Our design follows that idea:

| Seal | How it opens | Source of the solution |
|------|----------------|------------------------|
| **1–6** | Enter a code or complete a step (keypad, button sequence, dial, etc.) | **Splunk**: each seal’s code or procedure is discoverable only by analysing the right logs (access, vault, building, or “Takagi’s memos” as data). |
| **7** | **Meta solution** — not another code | A **physical trick**: e.g. unplugging power, flipping a hidden switch, or cutting a cable. The “system” (Splunk + the first 6 seals) never tells you this; the 7th seal is the movie’s twist. |

- **Order**: Seals 1–6 are opened in order (optional: some can be parallel if the puzzle design allows). Seal 7 is only openable after 6, or is explicitly the “final” step.
- **Feedback**: Each seal gives clear feedback when opened (LED turns green, lock clicks, servo releases, etc.) so the team knows they’ve progressed.

### 5.3 Seal 7 — The Meta Solution

- **Spirit of the movie**: The vault’s last safeguard is counter-intuitive — e.g. “when power is cut, the final lock releases” (so people aren’t trapped in a blackout). The thieves spent the whole film on codes; the real solution is **outside** the procedure.
- **In our game**: 
  - **Option A — Unplug the power**: The vault or control panel has a visible (or discoverable) power cable. Unplugging it triggers the 7th seal (e.g. a relay closes when power is lost, or a microcontroller detects loss of main power and “releases” the last seal).
  - **Option B — Hidden switch**: A physical switch or button elsewhere in the room (e.g. on the back of the model, under the table) that must be found and used after the first 6 seals.
  - **Option C — Cut the “red wire”**: A prop cable or connector that, when disconnected or “cut,” completes the circuit that opens seal 7 (safe, low-voltage only).

- **Design principle**: The narrative and Splunk data should **never** spell out the 7th step. It’s the moment when the team realises “we’ve done everything the data said — what are we missing?” and discovers the physical, meta solution. Optional hint in the data: a single oblique log line (e.g. “failsafe: vault secondary release on power loss”) for groups that are stuck.

### 5.4 How Splunk and the Model Connect

- **Splunk → Physical**: 
  - Solving a puzzle in Splunk yields a **code** (digits, word, or sequence). Players enter it on the model (keypad, dials, or via a connected app that talks to the model’s controller).
  - Or: completing a Splunk “objective” (e.g. running the right saved search) triggers an API or local script that sends “open seal N” to the physical hardware.
- **Physical → Narrative**: 
  - Opening each seal can unlock the next narrative beat or the next “layer” of data in Splunk (e.g. “Seal 2 open — vault maintenance logs now available”).
- **Seal 7**: Purely physical; no code from Splunk. Optionally, the data can hint that “the seventh protocol is not in the system” or that “secondary release is mechanical,” so the meta solution feels consistent with the story.

### 5.5 Build Considerations (Summary)

- **Electronics**: Microcontroller (e.g. Arduino, Raspberry Pi Pico) to read keypad/inputs and drive LEDs, servos, or relays for the 7 seals; for seal 7, a circuit that detects power loss or a separate switch/cut.
- **Safety**: Low voltage only; no exposed mains; “unplug” should be a safe plug/socket or a switch that simulates power loss.
- **Replay**: Seals must be resettable (software reset or physical reset) so the game can be run again for the next team.

---

## 6. Puzzles & Challenges (First Draft)

### 6.1 Phase 1 — Infiltration

- **Goal**: Establish that the team has “access” to building data in Splunk.
- **Mechanic**: Simple search or dashboard tour; first dataset (e.g., “Nakatomi Building Access”) appears.
- **Deliverable**: One correct SPL or one dashboard opened → narrative: “We’re in the system.”

### 6.2 Phase 2 — Reconnaissance

- **Goal**: Map the building: floors, key locations, security points.
- **Mechanic**: Logs contain floor IDs, room names, camera IDs, guard patrols. Players build a simple dashboard or report that “maps” the tower.
- **Deliverable**: A dashboard or saved search that shows at least: top 5 floors by activity, 3 “restricted” areas, and the floor where the vault is (e.g., 30th floor).

### 6.3 Phase 3 — Access Control

- **Goal**: Find a way to “bypass” or spoof access (narratively).
- **Mechanic**: 
  - Badge/access logs with success/failure; players find a pattern (e.g., a recurring badge ID or time window when checks are relaxed).
  - Or: decode a “master code” from fragmented log entries (regex, `rex`, `mvcombine`).
- **Deliverable**: A code or badge ID (or time window) that players submit; correct answer unlocks Phase 4 (vault / seals).

### 6.4 Phase 4 — The Vault (Seven Seals)

- **Goal**: Open all **7 seals** on the physical Nakatomi model. Seals 1–6 are opened with codes found in Splunk; **Seal 7** is opened by the **meta solution** (e.g. unplugging power).
- **Mechanic**: 
  - **Seals 1–6**: Each seal has a code or short procedure. Codes are buried in vault logs, maintenance logs, or “Takagi” memos (as structured or free-text log events). Players use SPL (`rex`, `transaction`, lookups, time ranges) to extract them. Order can be strict (seal 1 → 2 → … → 6) or partially parallel (e.g. seals 1–3 from one data source, 4–6 from another).
  - **Seal 7**: No code in Splunk. The team must realise the last lock is physical / meta — e.g. unplug the vault power, flip a hidden switch, or “cut” a designated cable. Optional: one oblique log line (e.g. “failsafe: secondary release on power loss”) as a hint.
- **Deliverable**: 
  - Codes for seals 1–6 entered on the **physical model** (or via an app that drives the model) → each seal opens in turn.
  - Seal 7 opened by performing the **meta action** (unplug, switch, or cut) on the physical setup → **Vault open**, game complete.

### 6.5 Optional: Red Herrings & Difficulty

- Extra logs that look relevant but don’t contain the solution (e.g., Ellis’s failed attempts).
- Time-based hints: “Only logs from the last 30 minutes matter.”
- Require `eval`, `rex`, or `lookup` to decode obfuscated fields (e.g., base64 or simple substitution cipher in log messages).

---

## 7. Technical Architecture (High Level)

### 7.1 Components

- **Splunk Enterprise or Cloud**  
  - Indexes: e.g., `nakatomi_access`, `nakatomi_vault`, `nakatomi_building`.
  - Data: synthetic logs that tell the story (access, vault, elevators, “security” events).

- **Data Generation**  
  - Scripts (Python, etc.) or Splunk add-ons that generate and inject the heist storyline data (timestamps, codes, sequences) so that solving puzzles in SPL yields the right answers.

- **Game Orchestration (optional)**  
  - Lightweight app or web form: presents narrative, accepts player answers, validates codes/sequences, and unlocks phases (e.g., “Phase 2 unlocked”).
  - Could be: Simple Static HTML + JS, or a small backend (e.g., Node, Python) that checks answers against a config file.

- **Splunk UI**  
  - App: “Nakatomi Heist” — custom nav, dashboards, saved searches, alerts.
  - Dashboards can show “Mission Brief”, “Current Objective”, and link to searches.

### 7.2 Data Model (Conceptual)

- **Access logs**: `timestamp`, `floor`, `room`, `badge_id`, `outcome` (allow/deny), optional `reason`.
- **Vault logs**: `timestamp`, `action` (e.g., `code_attempt`, `door_status`), `detail` (obfuscated or encoded), `result`.
- **Building/sensor logs**: `timestamp`, `system` (e.g., elevator, power), `event`, `floor`, `value`.
- **Lookup**: e.g., `floor_names.csv` — floor_id → name (“Lobby”, “Vault Floor”, etc.).

Answers (codes, sequences) are embedded in this data so that correct SPL and analysis produce the intended solution.

---

## 8. Success Criteria & Validation

### 8.1 Design Success

- A first-time player (with basic Splunk knowledge) can complete the heist in **30–60 minutes** with the provided narrative and data.
- At least **3–4 distinct SPL skills** are used (search, stats, eval/rex, lookup or transaction).
- The story feels coherent; the **7 seals** on the physical model provide a clear progression, and **Seal 7 (meta)** delivers a satisfying “movie twist” moment.

### 8.2 Technical Success

- All puzzle answers are **deterministic** from the provided data (no ambiguity).
- Answer validation is consistent (e.g., trim spaces, case-insensitive where intended).
- Data can be replayed or re-indexed so the game is repeatable (e.g., for different groups).

---

## 9. Scope & Phases for the Project

### 9.1 MVP (First Playable)

- One Splunk index with **synthetic Nakatomi data** (access + vault).
- **2 phases**: (1) Infiltration + Recon, (2) Vault (find and enter one code).
- One **simple game UI** (HTML or Splunk dashboard): intro text, one “Enter code” field, success/fail message.
- One **design document** (this draft) and a short **runbook** for facilitators (how to load data, how to run the game).

### 9.2 V1 (Full Experience)

- All 4 phases (Infiltration, Recon, Access Control, Vault) plus **physical Nakatomi model with 7 seals**.
- **Seals 1–6**: Codes from Splunk; players enter on the model (or via app → model).
- **Seal 7**: Meta solution (unplug power / hidden switch / “cut” cable) implemented on the physical build.
- Full narrative and at least one dashboard per phase (or one master dashboard with panels per phase).
- Answer validation for each phase; optional timer.
- Facilitator guide and “answer key” (what SPL reveals for each seal + how to reset and run Seal 7).

### 9.3 Later (Optional)

- Multiple difficulty levels (e.g., more red herrings, stricter time limit).
- “Ellis” and “Holly” subplots as optional side puzzles.
- Integration with Splunk SOAR or custom inputs for “live” feeling (e.g., new events injected during the game).
- Richer physical model (full tower, multiple floors, optional elevator or lighting effects).

---

## 10. Risks & Dependencies

| Risk                         | Mitigation |
|-----------------------------|------------|
| Data too easy/hard to find  | Playtest with 2–3 personas; tune log volume and obfuscation. |
| Splunk version differences | Design for Splunk 8.x+ and document any version-specific SPL. |
| Answer validation bugs      | Maintain a single source of truth (config/file) for answers; unit test validation. |
| Narrative vs. tech balance  | Keep story on rails (brief text per phase); avoid long reading. |
| Physical build complexity   | Start with minimal vault panel (7 seal inputs + power for Seal 7); document reset procedure; use low voltage only. |

**Dependencies**: Splunk instance (Enterprise or Cloud), method to generate and index synthetic data, optional small web app or dashboard-only flow for submission and validation, **physical build** (Nakatomi model, 7 seals, electronics for inputs and Seal 7 meta).

---

## 11. Next Steps

1. **Lock the narrative** — Finalize one-page “script” (intro, phase transitions, seven seals, Seal 7 meta hint or silence).
2. **Spec the data** — Exact field names, sample events, and where each of the **6 seal codes** is hidden in Splunk.
3. **Build the data generator** — Script that outputs the right events for a 30–60 minute game.
4. **Design the physical model** — Decide minimal vs full Nakatomi build; spec 7 seal inputs (keypad/dials/switches) and Seal 7 meta (unplug vs switch vs cut); electronics (microcontroller, relays, safe low voltage).
5. **Implement MVP** — One index, two phases, one code submission; optional: minimal physical panel with 1–2 seals for proof of concept.
6. **Build and integrate the 7-seal model** — Wire seal 1–6 to code validation; implement Seal 7 (power-loss or switch); reset procedure for replay.
7. **Iterate** — Add phases, dashboards, difficulty, and physical polish based on playtests.

---

## Appendix A — Example SPL Snippets (Target Skills)

- **Find vault floor**: `index=nakatomi_building | stats count by floor | sort -count` (then identify “Vault” from lookup).
- **Extract code from logs**: `index=nakatomi_vault | rex field=message "code.(?<code>\d-\d-\d-\d)" | where isnotnull(code)`.
- **Sequence of actions**: `index=nakatomi_vault | transaction session_id startswith="action=begin" endswith="action=commit"`.

---

## Appendix B — Working Title & Tagline

- **Working title**: *Nakatomi Plaza: Vault Heist*
- **Tagline**: *“Now I have a SPL. Ho-ho-ho.”* or *“Break into the vault. Use the data.”*

---

*Document version: First draft*  
*Last updated: March 2025*
