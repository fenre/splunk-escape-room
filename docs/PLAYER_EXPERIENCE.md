# Nakatomi Plaza: Vault Heist — Player Experience

**What the player sees, how the game flows, and how the Splunk environment is structured for gameplay.**

---

## 1. First Impression

When the player opens the Splunk app, they see the **Mission Brief** dashboard — the only dashboard visible in the app navigation at game start. No other dashboards, saved searches, or reports are pre-built. Players must use the search bar to investigate.

The app is called **Nakatomi Heist** in the Splunk nav bar.

---

## 2. Mission Brief Dashboard

The Mission Brief is a single-page Dashboard Studio (JSON) dashboard. It serves as the game's home screen and does not change during gameplay.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  NAKATOMI PLAZA — CHRISTMAS EVE                             │
│  ══════════════════════════════════════════════════════════  │
│                                                             │
│  ┌─────────────────────────────────┐ ┌────────────────────┐ │
│  │         MISSION BRIEF           │ │    VAULT STATUS    │ │
│  │                                 │ │                    │ │
│  │  Christmas Eve. Nakatomi Plaza. │ │  Seal 1: LOCKED    │ │
│  │  You're part of the crew.       │ │  Seal 2: LOCKED    │ │
│  │  Seven locks on the vault.      │ │  Seal 3: LOCKED    │ │
│  │  Use the data to find the       │ │  Seal 4: LOCKED    │ │
│  │  codes. Enter them on the       │ │  Seal 5: LOCKED    │ │
│  │  vault. Start with the lobby.   │ │  Seal 6: LOCKED    │ │
│  │                                 │ │  Seal 7: ???       │ │
│  │  "Now I have a SPL. Ho-ho-ho."  │ │                    │ │
│  └─────────────────────────────────┘ └────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    AVAILABLE DATA                        ││
│  │                                                          ││
│  │  Index              │ What's in it                       ││
│  │  ─────────────────  │ ────────────────────────────────── ││
│  │  nakatomi_access    │ Badge swipes, door events          ││
│  │  nakatomi_vault     │ Vault terminal sessions, system    ││
│  │  nakatomi_building  │ HVAC, elevator, power, security    ││
│  │                                                          ││
│  │  Lookups: floor_directory, employee_directory,           ││
│  │           system_codes                                   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    QUICK REFERENCE                       ││
│  │                                                          ││
│  │  Search:    index=nakatomi_access                        ││
│  │  Filter:    | where floor=30                             ││
│  │  Count:     | stats count by floor                       ││
│  │  Extract:   | rex field=msg "code=(?<code>\d+)"          ││
│  │  Lookup:    | inputlookup employee_directory.csv         ││
│  │  Group:     | transaction session_id                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  The clock is running. The police are on their way.      ││
│  │  McClane is in the building. Move fast.                  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Design Notes

- **No spoilers**: The dashboard does not mention specific floors, rooms, or techniques. It gives just enough to start: "Start with the lobby" and the three index names.
- **SPL Quick Reference**: A compact cheat sheet for the six SPL skills needed. Players who know Splunk won't need it; beginners will reference it constantly. This is intentional — it teaches without hand-holding.
- **Seal 7 = ???**: The dashboard says "???" for Seal 7, not "LOCKED." This is a subtle hint that the seventh seal is different.
- **Static content**: The dashboard does not update during gameplay. The vault status panel always shows "LOCKED." Real seal status is on the physical model. This keeps the game grounded in the physical artifact, not the screen.
- **No timer on screen**: The game timer is managed by the facilitator (or a separate timer visible in the room). Keeping it off the Splunk screen prevents players from getting anxious about the clock instead of focusing on the data.

---

## 3. What Players See When They Search

Players use the standard Splunk search bar. The data is pre-loaded across three indexes. Here's what each search experience feels like:

### `index=nakatomi_access`

- ~500 events of badge swipes and door activity.
- First impression: a wall of key=value events. Names, floors, rooms, outcomes.
- Players learn to filter with `where`, `search`, and `stats count by`.
- The data feels like a real access control system — mundane and operational until you know what to look for.

### `index=nakatomi_vault`

- ~80 events of vault sessions and system status.
- Much smaller dataset — but the events are more cryptic (`session_id`, `code_attempt`, `input=4`).
- Players must use `transaction` to make sense of sessions.
- The vault data has a "classified" feel — shorter entries, technical language.

### `index=nakatomi_building`

- ~250 events of HVAC, elevator, power, and security data.
- Mixed: some are structured telemetry (temperature readings with numeric values), some are unstructured radio intercepts (messy text messages).
- Players need `eval` for the telemetry and `rex` for the radio traffic.
- The security channel messages feel like intercepted comms — FBI callsigns, tactical jargon, authorization codes buried in noise.

### Lookup tables

- Players discover lookups when they need to cross-reference (Seal 6).
- `| inputlookup employee_directory.csv` returns ~50 rows — a corporate employee list.
- `| inputlookup system_codes.csv` returns 6 rows — a short table mapping clearance levels to vault codes.
- `| inputlookup floor_directory.csv` returns 14 rows — the building directory.

---

## 4. Phase Progression

The game has four phases, but the Splunk environment itself does not change between phases. All data is available from the start. The phase progression is **narrative**, not technical — driven by the facilitator, the physical model, and the story.

### Phase 1 — Lobby (0:00–0:08)

**Facilitator says**: *"Go. Get into the building's data. Start with the lobby."*

Players open Splunk, see the Mission Brief, and start searching `index=nakatomi_access`. The first seal code (2512) is relatively easy to find — it rewards players for learning basic search and filtering.

**Physical model**: When the code is entered, Seal 1's servo whirrs, the door pops open, and a blueprint fragment is revealed.

### Phase 2 — Recon (0:08–0:18)

**Facilitator says**: *"Good. You're in. Now find the vault. Use the blueprint."*

Players use the blueprint to focus on floor 30, Conference Room B. They learn `stats count by` to identify the busiest floor, then drill down.

**Physical model**: Seal 2 opens, revealing a log excerpt that points to session VS-0042 and Takagi.

### Phase 3 — Access (0:18–0:28)

**Facilitator says**: *"Takagi's terminal. He entered codes. Find out what he typed."*

Players shift to `index=nakatomi_vault` and learn `transaction`. The physical cipher wheel from Seal 3 becomes the bridge to Seal 4.

**Physical model**: Seal 3 opens with a solenoid thunk, revealing the cipher wheel. Players hold a physical decoding tool — the game becomes tactile.

### Phase 4 — Vault (0:28–0:50)

**Facilitator says**: *"The vault sequence. You need three more codes. The building is talking — listen."*

Seals 4, 5, and 6 require progressively harder SPL. The cipher wheel (physical), RF card (physical), and badge (physical) each direct the next search. The interleaving of physical clues and digital investigation reaches its peak.

**Physical model**: Each seal opens with increasing drama — solenoid thunks for 4–5, the heavy mag lock clunk for 6. The compartment rewards get more urgent: frequency card → badge → the final note.

### Seal 7 — Meta (0:50–1:00)

**Facilitator says**: Nothing. The facilitator is silent for Seal 7. The team must figure it out themselves.

The note from Seal 6 is their only clue: *"The seventh lock is not in the system."* The loose barrel plug cable. The story they've been following — the FBI cutting power, electromagnetic locks, the failsafe.

**Physical model**: The player unplugs the barrel jack. The relay drops. The spring latch releases. The last door swings open. The bearer bonds are inside. The ESP32 (running on 9V backup) plays the victory sequence — rainbow LEDs, ascending tones.

**Facilitator says**: *"Vault open. $640 million in bearer bonds. Yippee-ki-yay."*

---

## 5. Hint Delivery

### McClane Hints (Atmosphere)

McClane hints are injected as **new events** or delivered by the **facilitator verbally**, matching the timeline in [TIMELINE_AND_FLOWS.md](TIMELINE_AND_FLOWS.md). They are atmosphere — they do not directly help solve puzzles but create urgency and immersion.

If pre-loaded (simplest approach), the McClane events are already in the dataset at their scheduled times. Players may stumble across them while searching building security logs — this adds to the feeling that something is happening in the building beyond their control.

### Facilitator Hints (If Stuck)

Each seal has a facilitator hint defined in the [puzzle catalogue](STORY_AND_MYSTERIES.md). The facilitator delivers these verbally, in character:

| Timing | Action |
|--------|--------|
| Player stuck for 3 min on Seals 1–2 | Deliver the first hint (nudge toward the right filter or command) |
| Player stuck for 5 min on Seals 3–6 | Deliver the first hint |
| Player stuck for 5+ min | Deliver a stronger second hint (more specific) |
| Player stuck for 8+ min | Facilitator may give the answer directly to keep the game moving |

Hints should feel like they come from "Hans on the radio" — terse, impatient, in character.

---

## 6. Fail States

### Police Breach

**Trigger**: Player runs a specific search or opens a specific dashboard that "alerts the outside world." (Decided by the facilitator/game designer — see [TIMELINE_AND_FLOWS.md](TIMELINE_AND_FLOWS.md) for options.)

**What happens**: Facilitator announces the breach. If a game-over dashboard exists, it can display:

```
┌─────────────────────────────────────┐
│  SWAT HAS THE BUILDING.            │
│  YOU'RE ARRESTED.                   │
│                                     │
│  "The plaza floor. Hans sends       │
│   his regards."                     │
└─────────────────────────────────────┘
```

### McClane (3 Wrong Codes)

**Trigger**: The physical vault model tracks wrong code attempts. At 3, the ESP32 triggers game over.

**What happens**: LCD displays `GAME OVER / McCLANE GOT YOU`. NeoPixels flash red. Buzzer plays the game-over descending tone. Facilitator delivers the line.

### Roof (Timer)

**Trigger**: Clock reaches 55–60 minutes.

**What happens**: Facilitator announces: *"The charges blew. You never got the vault."* Same game-over sequence on the physical model.

---

## 7. Victory

When all 7 seals are open:

1. **Physical model**: Rainbow LED chase, ascending victory tones, LCD shows `VAULT OPEN / $640 MILLION / IN BEARER BONDS / Yippee-ki-yay`.
2. **Facilitator**: Delivers the victory line and congratulates the team.
3. **Optional**: A post-game Splunk dashboard could show stats — time to complete each seal, wrong code count, total searches run. This is a "nice to have" for V2.

---

## 8. Splunk App Structure

The Nakatomi Heist Splunk app has a minimal footprint. Players should feel like they're working in a real Splunk environment, not a guided tutorial.

```
nakatomi_heist/
├── default/
│   ├── app.conf              # App metadata
│   ├── indexes.conf           # Three indexes
│   ├── props.conf             # Sourcetype definitions
│   ├── transforms.conf        # Lookup definitions
│   └── data/
│       ├── ui/
│       │   ├── nav/
│       │   │   └── default.xml    # App navigation (Mission Brief only)
│       │   └── views/
│       │       └── mission_brief.xml  # The starting dashboard
│       └── lookups/               # Ignored — see below
├── lookups/
│   ├── floor_directory.csv
│   ├── employee_directory.csv
│   └── system_codes.csv
└── metadata/
    └── default.meta           # Permissions
```

### Navigation

The app nav shows only **Mission Brief**. No other dashboards. The search bar is always available (standard Splunk nav). Players are expected to use the search bar — that's the point of the game.

```xml
<nav>
  <view name="mission_brief" default="true" />
</nav>
```

---

## 9. Setup and Data Loading

### Pre-Game Checklist

1. **Install the Splunk app** (`nakatomi_heist/`) on the Splunk instance.
2. **Run the data generator** to produce event files and lookup CSVs:
   ```bash
   cd generator
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python3 generate.py            # Full dataset (~47k events, includes NPC baseline)
   # OR for conference demos:
   python3 generate.py --booth-mode  # Lean dataset (~750 events, puzzle-only)
   ```
   The full dataset includes a week of realistic NPC badge-swipe traffic from 60 named employees across five work patterns (day shift, late engineers, cleaning crew, security, vendors). Booth mode skips the NPC baseline for fast 5-minute sessions but keeps all critical-path puzzle data intact.
3. **Load the lookup CSVs** into the app's `lookups/` directory (or upload via Splunk UI).
4. **Ingest the event data** using Splunk's `oneshot` command or the Add Data wizard:
   ```bash
   splunk add oneshot generator/output/nakatomi_access.json \
     -index nakatomi_access -sourcetype _json
   splunk add oneshot generator/output/nakatomi_vault.json \
     -index nakatomi_vault -sourcetype _json
   splunk add oneshot generator/output/nakatomi_building.json \
     -index nakatomi_building -sourcetype _json
   ```
5. **Verify**: Run `index=nakatomi_access | stats count` — should return ~47,000 events (full mode) or ~750 (booth mode).
6. **Reset the physical vault model** (all seals locked, wrong-code counter at 0).
7. **Start the timer and read the introduction.**

### Between Games

1. **Change the seed** in `scenario.yaml` to generate a new dataset with different codes.
2. **Re-run the generator** and reload data.
3. **Update the ESP32 codes** (via REST API, LittleFS upload, or re-flash).
4. **Replace compartment clue items** (the blueprint, log excerpt, cipher wheel, etc. now reference new codes/sessions — update printouts accordingly).
5. **Reset the physical model** (close all doors, reset ESP32).

---

## 10. Design Constraints

These constraints keep the player experience focused:

1. **No pre-built dashboards** beyond the Mission Brief. Players build their own understanding through search. Pre-built dashboards would give away the answer structure.
2. **No alerts or scheduled searches**. Everything is pull-based (the player searches). This avoids complexity and keeps the player in control.
3. **No role-based access**. All players see all data. Team coordination is social, not technical.
4. **No data manipulation**. Players cannot write to indexes. The data is read-only.
5. **Physical model is the scoreboard** (physical mode). Seal status lives on the physical model (LEDs, open doors), not on screen. In digital mode, the game UI (`game.html`) is the scoreboard.

---

## 11. Digital Mode

The game supports two modes, selectable when a session begins via the **Game UI** (`game.html` — a standalone HTML file, no external dependencies).

### Mode Selection

When `game.html` is opened, a landing page presents two cards:

- **Physical Vault** — the player uses the hardware vault model. The game UI serves as a timer and seal status display. Codes are entered on the physical keypad.
- **Digital Vault** — the player uses the on-screen keypad. Clue cards replace physical compartments. The entire game is playable without hardware.

### Physical vs. Digital — Feature Mapping

| Physical Function            | Physical Implementation                        | Digital Counterpart (game.html)                           |
| ---------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Mode selection               | N/A (implicit)                                 | Landing page with mode picker                             |
| Code entry                   | 4x4 membrane keypad                            | On-screen keypad (+ keyboard 0–9/Enter/Backspace)         |
| Seal status                  | 7 NeoPixel LEDs (red/amber/green)              | Sidebar seal panel with LED-style color states             |
| Feedback — correct           | LCD "CORRECT" + ascending tone + LED green      | Green flash on code display + browser audio                |
| Feedback — wrong             | LCD "ACCESS DENIED" + buzz + LED flash          | Red shake animation on code display + browser audio        |
| Wrong code counter           | Internal ESP32 counter, shown on LCD            | Visible counter in header                                  |
| Compartment clue reveals     | Physical door swings open, player takes object  | Animated clue card overlay with styled content             |
| Cipher wheel (Seal 3 reward) | Physical rotating disc decoder                  | Interactive ROT13 decoder widget (type/paste to decode)    |
| Timer                        | Facilitator-managed                             | 60-minute countdown in header (auto game-over at 0:00)     |
| Game over (McClane)          | LCD + red LED flash + buzzer                    | Full-screen red game-over overlay                          |
| Game over (timer)            | Facilitator announces                           | Auto-triggered by countdown                                |
| Seal 7 — unplug power        | Player unplugs DC barrel jack                   | Player clicks a hidden "power" element in the footer       |
| Victory                      | LCD + rainbow LEDs + tones                      | Full-screen gold victory overlay with stats                 |
| Bearer bonds reveal          | Physical prop in Seal 7 compartment             | Digital certificate card                                   |
| Reset                        | Facilitator keypad combo or REST API            | Reset button on overlay screens                            |

### Digital Clue Cards

When a seal opens in digital mode, a "compartment" card animates in, displaying the clue that would be found inside the physical vault:

| Seal | Digital Clue Card Content |
| ---- | ------------------------- |
| 1    | Blueprint fragment of floors 25–35 with Conference Room 30-B circled in red. Handwritten note: "Check Takagi's schedule." |
| 2    | Dot-matrix printout of vault access log. Session VS-0042 highlighted. Margin note: "He entered the codes himself — but did he enter the RIGHT codes?" |
| 3    | Interactive ROT13 decoder wheel with text input/output and a sticky note reading "Shift 13 — The building talks in code." |
| 4    | Laminated radio frequency card. Channel freq_14 (FBI Field Command) circled. Back reads: "Listen to what they're saying on this channel." |
| 5    | Employee badge card for Naomi Park, Vault Operations, NP-4472, Clearance LEVEL-5. Post-it: "Her clearance unlocks the final vault sequence." |
| 6    | Nakatomi letterhead note: "The seventh lock is not in the system." Below: "Think about what holds the vault shut." |
| 7    | Bearer bonds certificate: "$640,000,000 — Nakatomi Trading Corp." and "Vault open. Heist complete. Yippee-ki-yay." |

Players can re-view any opened clue card by clicking the corresponding seal in the sidebar panel. This is important because the clue chain requires referencing previous clues while working on later seals.

### Digital Seal 7

The digital Seal 7 preserves the **lateral thinking** moment from the physical game:

- The game UI footer displays a subtle power indicator: `VAULT SYSTEMS ● ONLINE`. The green dot looks decorative — part of the status chrome, not an interactive element.
- After Seal 6 is opened, the objective reads: *"The seventh lock is not in the system."* The keypad disappears. There is no code to enter.
- The Seal 6 clue card and (optionally) a vault log event in Splunk (`"electromagnetic failsafe... disengages on power loss"`) point the player toward the power concept.
- Clicking the green power LED triggers the Seal 7 sequence: the screen flickers, goes dark, then the victory overlay appears.
- The cursor does not change to a pointer on hover — the element doesn't advertise its interactivity. The discovery is the puzzle.

### Facilitator Controls

In both modes, pressing **F** toggles a hidden facilitator panel (bottom-right corner) with buttons to manually open individual seals, trigger game over, or reset. This allows a facilitator to:

- Advance seals in physical mode when codes are entered on the hardware keypad
- Skip a stuck team past a seal
- Manually trigger Seal 7 (power cut)
- Reset the game between sessions

### Relationship to Splunk

The game UI and Splunk are **separate windows**. Players use Splunk to investigate the data and find codes; they use the game UI to enter those codes and track progress. The game UI does not connect to or query Splunk — the link between the two is the player's brain.

```
Splunk (Search & Data)          Game UI (game.html)
┌─────────────────────┐         ┌─────────────────────┐
│ Mission Brief       │         │ Mode Selection      │
│ Search Bar          │         │ Timer + Seal Status  │
│ Pre-loaded Data     │ ──────> │ Code Entry (digital) │
│ (3 indexes, lookups)│ player  │ Clue Cards (digital) │
│                     │ types   │ Victory / Game Over  │
└─────────────────────┘ codes   └─────────────────────┘
```

### Audio

The game UI uses the Web Audio API to generate simple tones — no audio files required. Audio is subtle (low volume) and provides tactile feedback:

- **Key press**: short click
- **Correct code**: ascending three-note chime
- **Wrong code**: descending buzz
- **Power cut**: descending hum
- **Victory**: ascending eight-note fanfare
- **Game over**: descending three-note dirge

Audio initializes on the first user interaction (mode selection click) to comply with browser autoplay policies.

---

## 7. Booth / Multi-Team Experience (v2.4)

v2.4 turns `game.html` from a single-player demo into a facilitator-friendly multi-team experience. None of this changes solo play — it all degrades gracefully when telemetry isn't configured.

### Quick Demo mode (15 minutes, 3 tasks)

Selecting **QUICK DEMO · 15 MIN** on the mode-select screen (or appending `?demo=1` to the URL) runs a curated three-task subset:

1. **Task 1.1 — Guest List** — `| stats dc(badge_id)` (teaches stats basics).
2. **Task 2.1 — Cut Communications** — text-code task (teaches filtering + extraction).
3. **Task 5.4 — The Ambulance** — text-code task (closes on a cinematic Die Hard beat).

5 errors allowed, all 4 hint levels available, full campaign data restored when the player returns to mode-select.

### Per-team codes and QR handoff

The mode-select screen now shows a **team code** (4-character, unambiguous alphabet — no `O/0/I/1/L`). Players can:

- Type their own code (saved to localStorage and used as the telemetry team identifier).
- Generate a fresh code with **NEW CODE**.
- Open a **QR handoff modal** with a shareable URL (`?team=NAKA&booth=…&scenario=…`) and an inline-rendered QR code. Print it for paper handouts or scan from a phone to join the session on any device.

Team codes appear in the HUD top-corner throughout the game so the facilitator can match a session on the live board.

### Live facilitator dashboard

A new Splunk dashboard, **Facilitator Board** (`facilitator_board.xml`), is designed for a 1920×2860 booth TV behind the operator (grew from 1920×1080 in v2.4, to 1920×1450 in v2.9 for discovery analytics, to 1920×1790 in v2.10 for the Adaptive Hans row, to 1920×2120 for the facilitator phone-call cinematic row, to 1920×2360 for the v2.10 investigation-board analytics row, to 1920×2620 for the v2.11 Floor-30 hub analytics row, and to 1920×2860 for the v2.12 Ending Branches row). Panels:

- KPIs — active / completed / failed sessions; average win time.
- Live leaderboard — ranked by score, with elapsed and act.
- Per-act funnel — how many teams are in Act 1 vs Act 5 right now.
- Trap-hit log — who tripped which decoy and when; the `has_lore` field shows whether it was a narrative trap or a silent one.
- Hint distribution — column chart of hints used per task.
- Recent session-end incidents — pinned victory / loss / timeout outcomes.
- **Discovery Analytics (v2.9)** — three tables answering "what did my booth actually find?":
  - **Top 10 side stories** — ranked by unique teams who discovered them, with a booth-share percentage (e.g., `9086 The Pineapple Incident · 12 · 63%`).
  - **Top 10 easter eggs** — same shape but split by discovery trigger (`konami` → Konami code, `keypad` → keypad 6xxx, otherwise SPL-only).
  - **Top 10 curiosity teams** — ranked by `dc(story_id) + dc(egg_id)` per team, with a `rank · team · stories · eggs · total` row so curiosity becomes a first-class scoreboard axis alongside speed and accuracy.
- **Adaptive Hans (v2.10)** — three panels surfacing antagonist activity:
  - **Hans Reactions Today** single-value KPI — daily count of reactive lines fired across the booth.
  - **Recent Hans Reactions** table — last 25 lines with `ts / team_code / act / trigger_label / tone / reaction_id`.
  - **Hans Trigger + Tone Mix** stacked column — 24 h reactions grouped by `trigger`, stacked by `tone`, so facilitators can verify the act-5 sinister bias is actually firing.
- **Facilitator Phone Calls (v2.10)** — three panels surfacing the cinematic phone-call system:
  - **Phone Calls Today** single-value KPI — daily `phone_call_incoming` count across the booth.
  - **Recent Phone Calls** table — last 25 events with `ts / team_code / state (incoming/answered/missed) / caller_label / delivery_type / line_preset_id`.
  - **Phone Mix** stacked column — 24 h incoming calls by `caller`, split by `delivery_type` (preset vs. adhoc), so facilitators can see at a glance whether cinematics are mostly rotated presets or live improvisation.
- **Investigation Board (v2.10)** — three panels surfacing the meta-puzzle corkboard:
  - **Board Pins Today** single-value KPI — daily `clue_pinned` count across the booth.
  - **Pin Type Mix** stacked column — 24 h pins by `pin_type` (task / story / intercept / egg / lore / suspect), split by `source` (task_complete / side_story / easter_egg / phone_call / trap_code / drag_drop). Answers "what are teams actually connecting?"
  - **Top Investigating Teams** table — top 10 teams by `detective_score = pins + threads × 2 + notes + exports × 5`, so post-session debriefs can recognise teams who invested in the meta-puzzle, not just the critical path.
- **Floor-30 Hub (v2.11)** — three panels surfacing the free-roam hub overlay:
  - **Hub Sessions Today** single-value KPI — distinct teams that opened the hub at least once today.
  - **Station Click Mix** stacked column — 24 h `hub_station_clicked` events by `station_id` (terminal / keypad / leads / briefing / blueprint / comms / board), stacked by `availability` (available / locked / hidden). Facilitators can see at a glance whether teams are hitting the same few stations or exploring the full map — and, crucially, whether anyone is **repeatedly hammering locked stations**, a strong "I'm stuck, I don't understand the gating" signal that calls for a facilitator nudge.
  - **Hub Dwell Time** stats table — median and max `elapsed_ms` grouped by `close_trigger` (esc / station_click / backdrop_click / hotkey / game_over / reset). High median dwell on `esc` suggests teams use the hub as a strategic overview; high dwell on `station_click` suggests they use it as a launchpad.
- **Ending Branches (v2.12)** — three panels surfacing the tonal Act-5 classifier:
  - **Endings Today** single-value KPI — daily count of `ending_classified` events across the booth (each victory contributes exactly one).
  - **Ending Distribution** stacked column — 24 h `ending_id` counts (analyst / cowboy / speedrunner / default), stacked by `difficulty`. Answers "how did the booth actually play tonight?" and surfaces tonal drift across the evening (e.g. early teams trend Analyst, late-evening teams trend Cowboy as fatigue sets in).
  - **Recent Endings** table — 20 most-recent classifications with `ts / team_code / ending_id / elapsed / wrong_count / hint_tokens_spent / side_stories_discovered / difficulty`. Lets facilitators ground-truth the classifier at a glance: every Speedrunner row should have `elapsed < 50 %` of the timer, every Analyst row should have `wrong_count ≤ 1 ∧ side_stories_discovered ≥ 3`, etc.

Optional `booth_token` input filters every panel to a single conference booth without needing per-event index changes — the discovery, Hans, phone, investigation-board, hub, and ending panels all honour the same filter via the existing `$booth_token$` pattern.

### Spectator second screen

Append `?spectator=1` (alias `?spectate=1`) to open `game.html` in **spectator mode**: a giant-text read-only mirror of another tab on the same machine.

```
┌─────────────────────────────────────────────────────────────┐
│  SPECTATOR                              Team: NAKA          │
│                                         Difficulty: operative│
│                                                             │
│                                                             │
│                       12:34                                 │
│                                                             │
│                  ACT 3 — THE VAULT                          │
│              Takagi's Refusal                               │
│                                                             │
│       ┌─────────┬──────────┬─────────┐                      │
│       │PROGRESS │  SCORE   │MISTAKES │                      │
│       │  3 / 8  │  24,500  │  1 / 7  │                      │
│       └─────────┴──────────┴─────────┘                      │
│       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░                   │
│                                                             │
│  Updated 1s ago · same-machine mirror                       │
└─────────────────────────────────────────────────────────────┘
```

The player tab broadcasts a sanitized state snapshot to `localStorage` on every timer tick; the spectator tab listens for `storage` events and re-renders. **Public progress only** — no SPL queries, no codes, no answers leak through the channel. A **SPECTATOR** button on the QR handoff modal opens the spectator URL in one click.

### Attract loop (unattended kiosk)

When the mode-select screen sits idle for 60 s with telemetry configured (or `?attract=1` on the URL), an overlay cycles "TAP TO PLAY" teasers and the local leaderboard every 6 s. Honors `prefers-reduced-motion`. Any input (touch, key, mouse) dismisses immediately.

### Live narrative alerts

Three saved searches (`Vault Alert - Unauthorized Access Pattern Detected`, `Encrypted Radio Intercept`, `Suspicious HVAC Anomaly`) now run on a 5-minute cron with a 1-hour throttle, so booth visitors see narrative clues fire live in the alerts panel of their Splunk session.

### Live session telemetry

Opt-in HEC posting drives the facilitator board. The game emits `session_start`, `act_start`, `task_complete`, `task_fail`, `hint_used`, `trap_hit`, `pause`, `resume`, `session_end`, `achievement`, `heartbeat`, and `session_feedback` events with strict allow-listing (no free-form payload acceptance). When HEC is unreachable, events queue in `localStorage` (capped at 500, oldest-first eviction) and drain on `online` / `focus` / `pagehide`. The game never blocks on telemetry.

Tokens are **never** accepted via URL params (would land in browser history, Referer headers, access logs). See [`docs/DEPLOY.md`](DEPLOY.md) for the recommended same-origin reverse-proxy pattern.

### Accessibility (WCAG 2.2 AA)

- `prefers-reduced-motion` honored — scanlines, VHS tracking, screen shake all become static fallbacks.
- New high-contrast white-phosphor CRT theme alongside green / amber / blue.
- `aria-live` regions announce traps, correct codes, task completion, hints revealed, victory, game over, and timer milestones (10 / 5 / 1 min remaining, 30 s).
- Visible focus ring restored across the entire UI.
- Custom controls (theme dots, mode-select cards, difficulty selector) wired as keyboard-navigable `radio` / `button` widgets with proper ARIA state.
- Touch targets ≥ 48 × 48 px on coarse-pointer devices.
- Decorative VHS / VCR overlays marked `aria-hidden`.

---

## 8. Hint-Token Economy (v2.6; Rookie update in v2.17.2)

Most difficulties use a **finite, scenario-wide token pool**. Every revealed hint spends one token and applies the existing score penalty. Rookie is intentionally unlimited as of v2.17.2: learners can reveal every available hint, but each reveal still reduces their score. Usage is counted in every mode when a hint level is actually revealed, **not** when the player opens and cancels the confirmation.

### Per-difficulty starting count

| Difficulty | Tokens | Hint levels per task | Notes |
|---|---|---|---|
| `rookie` | Unlimited (`∞`) | all 4 | learners are never locked out; point penalties still apply |
| `operative` | 3 | 3 | default — encourages thinking before asking |
| `mastermind` | 1 | 1 | matches the existing 1-hint-level cap; spend it well |
| `iron_man` | **0** | 0 | no hints at all — Pacifist Run is the only outcome |
| `demo` | 5 | all 4 | booth visitors should never feel locked out |

### On-screen UI

- **HUD chip** (`#hint-tokens`) — Renders `TOK: ∞/∞` for Rookie or a finite balance such as `TOK: 2/3`. Finite pools go red when depleted. Iron Man stays visible at `0/0` with a distinct red-bordered treatment.
- **Spend animation** — On every successful spend, the chip pulses (or, for `prefers-reduced-motion`, briefly changes border colour). On exhaustion, a longer red flash + screen-reader-assertive announcement.
- **Hint button label** — Reads `HINT 2/3 (-150 pts) · UNLIMITED (H)` on Rookie or `· 1 TOKEN (H)` for finite modes, keeping the point cost visible.
- **Three terminal states** — `ALL HINTS REVEALED` (per-task limit hit), `NO TOKENS LEFT` (global pool exhausted), or the normal active prompt. CSS distinguishes the two disabled states so colour-blind players can tell them apart.
- **Iron Man** — Hint button is hidden entirely; the chip alone communicates the no-hints contract.
- **Post-game breakdown** — The victory overlay surfaces `Hint tokens spent: 2 (unlimited)` for Rookie or the finite spent/starting balance elsewhere.

### Achievements

- **Pacifist Run** (🕊️) — Awarded when `state.hintTokensSpent === 0` at the victory trigger. Functionally identical to "No Hints" today, but tracked separately so future content (e.g., free lore reveals in branching storylines, v2.10+) can decouple "hint shown" from "token spent" without migrating save data.
- **Iron Man** (🧍) — Awarded for any iron-man completion. Iron Man clears automatically also earn Pacifist Run, the existing `Yippee-ki-yay` (now mastermind *or* iron-man), and any other criteria-based achievements.

### Telemetry

Two new event types extend the v2.4 schema:

- **`hint_token_spent`** — Emitted on every successful hint reveal. Payload: `act`, `task_id`, `hint_level`, `tokens_remaining`, `tokens_initial`. Lets the facilitator board chart spending velocity per team.
- **`pacifist_run_completed`** — Emitted on victory when `hintTokensSpent === 0`. Distinct from `session_end` so a dashboard can simply count distinct emitters without filtering a complex predicate.

`session_end` itself now includes `hint_tokens_initial`, `hint_tokens_spent`, `hint_tokens_remaining` so the post-mortem panel can plot "spent / starting" alongside hints + errors without a separate query. All new fields have explicit `EXTRACT-` rules in `nakatomi_heist/default/props.conf`.

### Accessibility

- The HUD chip's `aria-label` changes per state: `2 of 3 hint tokens remaining` / `No hint tokens remaining` / `No hints available — Iron Man mode`. Screen readers tabbing to the chip get the right context.
- Spend / exhaustion announcements go through the same polite/assertive `aria-live` regions used for traps and task completion.
- The post-game breakdown's "Pacifist Run" callout is rendered as bold text in the same row as the token line, not as a separate `aria-live` flourish, so it doesn't double-announce after the victory celebration.

---

## 9. Populated World — NPCs, Side Mysteries, Red Herrings, Easter Eggs, Lore (v2.9)

v2.9 grows the data world around the main heist without changing the critical path. Five complementary layers ship together:

### 9.1 Background population

The `generate.py` generator emits a full week of pre-heist baseline badge traffic (`Dec 17 → Dec 24`) from **60 named NPCs** across five work patterns: `day_shift` (32), `late_engineers` (10), `cleaning_crew` (6), `security_rotation` (8), `vendors` (4). A dedicated **Christmas-party guest crowd** (47 badges, `GUEST-001`–`GUEST-047`) floods floor 30 during 20:00–22:00 so Seal 2's `dc(badge_id) by floor` is unambiguously floor 30.

Booth operators skip the baseline with `python3 generate.py --booth-mode` — the resulting ~1,172-event dataset keeps all puzzles, side stories, easter eggs, and lore bulletins solvable while staying legible for 5-minute demos.

### 9.2 Side mysteries

Eight hand-authored trails live in the dataset. Each is reachable by entering a unique **`9xxx`** code on the keypad — the 9-prefix namespace is reserved for side stories and never triggers wrong-answer penalties. On discovery, a golden toast reveals the narrative payoff and an achievement unlocks:

| Code | Title | What it teaches |
|---|---|---|
| `9012` | The Affair | Correlating badge locations with diary entries |
| `9050` | Petty Cash Skim | Arithmetic anomaly detection in finance logs |
| `9086` | The Pineapple Incident | Filtering catering/order streams |
| `9099` | The Ghost Account | Cross-referencing lookups with event activity (terminated employees who still swipe) |
| `9200` | The Y2K Test | Scanning for future-dated test events |
| `9315` | The Disgruntled Sysadmin | Identifying insider-threat signals in IT logs |
| `9425` | The Blind Spot | Spotting gaps in camera coverage |
| `9552` | Theo's Homework | Proxy-log forensics |

Meta achievements unlock at **1 story** (Curious), **4 stories** (Investigator), and **all 8** (Completionist). A **Discoveries panel** in the pause menu shows the current count and lists discovered titles; undiscovered stories appear as redacted placeholders. Side-story events are present in both full and booth modes so even a 15-minute run can stumble onto one.

### 9.3 Red herrings

Three patterns deliberately tempt naive approaches, then reward the player (via lore or a narrative toast) when the correct technique is applied:

- **Debounce "ghost reads"** — Badge reader `RDR-30-NORTH` has a documented hardware bug: every swipe by Joseph Takagi (`JT-0001`) during the party window emits a ghost duplicate 0.4–0.8s later with `ghost_read=true`. A naive `| stats count by badge_id` overcounts; the taught correction is `| dedup _time badge_id reader` or `| bin _time span=2s | stats …`. 8 primary + 8 ghost swipes = 16 events, all scoped to `sourcetype=nakatomi:access:badge`.
- **Cross-index echoes** — 13 events in `index=nakatomi_building` carry `ref_badge=JT-0001` / `HT-0001` / `HE-3301` / `TH-0099` in their message text across `intranet:it`, `intranet:hr`, and `proxy:http` sourcetypes. Players doing `index=* badge_id=JT-0001` see the extra hits and learn to scope: `index=nakatomi_access` for swipes, not `index=*`. Echoes never land in access sourcetypes, so correctly scoped queries see zero false positives.
- **Trap-code lore** — Four existing trap codes (`1990`, `0911`, `1666`, `1988`) gained narrative lore cards that appear ~0.9s after the penalty lands. The penalty still hits (`wrong_count` bumps, audio sting plays); the lore toast lives at the bottom of the viewport in a red/alert palette (distinct from the amber side-story palette) for 4.5s. Wired into tasks 1.2 (Find Takagi), 2.5 (Intercept the Call), 3.4 (The Roof Trap), and 5.4 (Final Extraction) respectively.

Facilitator dashboards can filter `trap_hit` events by the new `has_lore=true` field to see whether teams who encounter lore-tagged decoys learn faster than those who only hit silent traps.

### 9.4 Easter eggs

Fifteen hidden moments reward curiosity without punishing the player. Fourteen are claimable via the new **`6xxx`** keypad namespace — a dedicated range that checks before the wrong-answer penalty fires, so entering an egg code never hurts the score. Each keypad egg has a **data anchor** somewhere in the generated dataset (diary entry, maintenance ticket, intercepted radio traffic, proxy-log oddity, …) so players can discover the code via SPL queries instead of brute-forcing:

| Code | Title | Where the data anchor lives |
|---|---|---|
| `6024` | Holly's Diary, Dec 24 | `index=nakatomi_building sourcetype=intranet:diary` |
| `6030` | Floor 30 Elevator (Fixed Again) | `NAK-88-2204` ticket in `intranet:it` |
| `6042` | The Coffee Murder | `EM-30-2` espresso machine in `building:sensors` |
| `6089` | The Pineapple War, Round 2 | `#trading-floor` chat in `intranet:chat` |
| `6093` | Ode to Joy | Culture-committee bulletin in `intranet:culture` |
| `6147` | Theo's 147 | Proxy-summary entry for `TH-0099` |
| `6199` | Yippee-Ki-Yay | `intercept:mcclane` on `nakatomi_comms` |
| `6220` | No More Table | `intercept:hans` on `nakatomi_comms` |
| `6252` | Ho. Ho. Ho. | `intercept:hans` with a base64 attachment |
| `6401` | Argyle on the Carphone | `intercept:argyle` on `nakatomi_comms` |
| `6404` | The Archive Door | `FAC-30-v7` schematic in `intranet:facilities` |
| `6411` | D-A-D in Morse | Slow-loop Morse on `intercept:morse` |
| `6777` | Roy Rogers Checks In | Guest badge `GUEST-ROY-ROGERS` in `intranet:security` |
| `6911` | HAL 9000 User Agent | Proxy log with HAL 9000 UA string |

The fifteenth egg is a **Konami code** (↑ ↑ ↓ ↓ ← → ← → B A anywhere on the keyboard) that triggers a 30-second BIOS-era credits roll. The overlay respects `prefers-reduced-motion` (becomes a static credit card instead of scrolling) and emits `easter_egg_found{trigger=konami}` for the facilitator dashboard.

Discovering eggs unlocks three new meta-achievements: **Secret Keeper** (5 eggs), **Egg Hunter** (10 eggs), and **Ultimate Completionist** (all side stories + all eggs in a single run). The **Discoveries panel** gains a second section alongside the side-story list; undiscovered entries render as count-only placeholders so players never see spoilers for eggs they haven't found.

A new `nakatomi_comms` data path is exercised for the first time in v2.9. Facilitators running `scripts/load_data.sh` must include `nakatomi_comms` in the HEC token's allowed-indexes list; without it, the five comms-tier eggs (McClane's yippee, Hans's ho-ho-ho and no-more-table, Argyle's carphone, D-A-D in Morse) still claim from the keypad but are not SPL-discoverable.

### 9.5 World-building lore (codex + intranet announcements)

The fifth layer is pure texture — no new puzzles, no new codes, no new telemetry. It makes the tower feel lived-in and gives facilitators canonical answers to the "who is this person?" questions that side stories and easter eggs provoke.

**`docs/NAKATOMI_LORE.md`** — the authoritative world bible. It covers:

- **A brief history of Nakatomi Plaza** (1974 groundbreaking → 1977 topping-out → 1981 full occupancy → 1985 Car #2 elevator fire → 1986 clearance-tier rollout → 1987 Room 30-B incident → 1988 status quo → the Y2K side-story setup).
- **Two prior incidents** with case references, locations, outcomes, and lessons learned. These aren't just lore: they explain why Eduardo Vasquez is the head of Facilities in 1988 (promoted after the 1985 fire), why Takagi is the CEO and not the COO (promoted after the 1987 hostage situation), and why Sergeant Al Powell knows the building blueprint (1987 liaison officer).
- **Department + tenancy table** — every floor 1–39 mapped to a tenant, function, and head of floor. Side-story and red-herring queries now resolve into a coherent building instead of an abstract event bag.
- **~20 character bios** — Executives & Key Staff, Building Security, Facilities & Janitorial, Engineering/IT/R&D, Admin & Finance, Catering & Vendors, External Parties, and Antagonists. Every bio carries a badge ID, department, role, and a short narrative beat explaining why the character shows up in the logs.
- **"How this lore appears in Splunk"** — SPL pointers from the codex directly into the announcements, HR memos, diary entries, schematics, comms intercepts, and sensor telemetry, so facilitators can show the connections live on a screen during a booth shift.
- **Authoring rules** for future contributors (no new codes, no collisions with seal/trap/side-story/easter-egg namespaces, tone and era constraints).

**Seven intranet announcements** seed the codex into the dataset itself, so the lore is reachable by SPL without anyone needing to open a markdown file:

| Bulletin ID | Author | Topic |
|---|---|---|
| `ANN-88-CEO-HOLIDAY` | Joseph Takagi | Holiday message referencing the Room 30-B incident |
| `ANN-88-HR-RSVP` | Olivia Park-Hammond | RSVP reminder for the Dec 24 Christmas party |
| `ANN-88-FAC-HVAC` | Eduardo Vasquez | Roof-chiller service window, Zone 4 |
| `ANN-88-SEC-PARKING` | James Marsh | B2 reduced capacity for party-catering staging |
| `ANN-88-IT-MAINT` | Mads Sorensen | Y2K pilot maintenance window (cross-link to side story `9200`) |
| `ANN-88-FAC-ANNIVERSARY` | Eduardo Vasquez | Plaza's upcoming 13-year anniversary |
| `ANN-88-SEC-DRILL` | James Marsh | Q4 fire-safety drill recap |

All seven live in `index=nakatomi_building sourcetype=intranet:announcements`. Every bulletin is **pure texture**: the generator runs a reserved-code scanner at every build and fails loud if any `subject` or `message` contains any 4-digit number that matches a seal, trap, side-story, or easter-egg code. Contributors cannot accidentally introduce a false lead.

Booth mode ships all seven announcements (~1 KB total); the full-mode count is unchanged at ~47k.

### 9.6 Integrity guarantees

Seals remain deterministic across seeds and modes: Takagi's latest badge floor (Seal 1.2) stays at **30**, and the busiest party floor by `dc(badge_id)` (Seal 2) stays at **30 / 67** even with all Phase-6 noise added. The 14 easter-egg anchor events carry unique identifiers (`egg_id`, `egg_code`) but never collide with seal codes, trap codes, or side-story codes — the generator fails loud if any future scenario edit introduces a clash. The seven intranet announcements are likewise scanned for standalone 4-digit numbers at build time; any collision with a reserved code aborts the build with a pointer at the offending bulletin.

### 9.7 Booth-wide discovery analytics (v2.9)

The facilitator board's Discovery Analytics row turns the sum of individual sessions into a booth-level story. Every `side_story_discovered` and `easter_egg_found` event a player emits is aggregated live into three tables:

1. **Top 10 side stories** — "The Pineapple Incident was found by 12 of 19 teams today (63%)." Helps facilitators see which mysteries land and which ones are too obscure to stumble on.
2. **Top 10 easter eggs** — The same ranking for the 15 eggs, split by discovery trigger so the Konami code cinematic doesn't visually dominate the SPL-only eggs.
3. **Top 10 curiosity teams** — `dc(story_id) + dc(egg_id)` per team, ranked. Gives the booth operator a "most inquisitive team of the day" line for the closing announcement — a parallel scoreboard to the pure-speed leaderboard.

All three respect the existing `$booth_token$` filter, so a single shared dashboard URL cleanly partitions per-booth views when multiple booths run at once. No new telemetry events, no new indexes, no new HEC paths — everything is derived from events already emitted since v2.9's Phase 6b and 6d shipped, so pre-existing session data benefits retroactively.

### 9.8 Adaptive Hans (v2.10)

Hans Gruber now reacts to what players are doing. The `HansAntagonist` engine watches six signals — idle teams (≥2 min quiet), lazy broad queries (no filters), keypad spam (6 wrongs in 60 s), fast solves, side-story discoveries, and the Konami code — and fires one of 36 hand-authored reaction lines. A tone bias driven by act number steers the selection: acts 1–2 favour **light** lines (taunting, arrogant), acts 4–5 favour **sinister** lines (intimate, menacing). Each team sees at most one reaction every 5 minutes, and the same reaction ID can't repeat within a 3-line window per tone bucket, so the system feels atmospheric rather than nagging.

Where do players find Hans's reactions? Two places at once:

- **In-world:** the raw intercept drops into `index=nakatomi_comms sourcetype=intercept:hans` alongside the hand-authored transcripts, indistinguishable by SPL. A player searching `intercept:hans "your hesitation"` won't be able to tell whether Hans said it at build time or 30 seconds ago in response to their idle stretch.
- **For facilitators:** a lightweight `hans_reaction` metadata event (no transcript) lands on `index=nakatomi_sessions`, driving the Adaptive Hans row on the facilitator board (recent reactions table, trigger + tone mix, daily count KPI).

Why do it this way? The dual-destination wire format keeps the narrative texture rich on the comms index (where players look for story) while keeping the session index tight for analytics (no free-text blobs bloating the dashboards). A v2.10 `INTERCEPT_TARGETS` allow-list in `NakaTelemetry` deny-by-default blocks any future caller from spraying events at arbitrary indexes; the only approved target is `intercept:hans`, and every reaction line passes through the same `safeId()` / `safeText()` sanitizers as player input. The regression test `scripts/tests/test_hans_antagonist.js` asserts the HEC token never leaks into a queued payload even when telemetry is fully configured.

A speech-bubble UI overlay surfaces each reaction in the game pane for 6 seconds, auto-dismissing without stealing focus. Screen readers announce each line via the existing `a11yAnnounce()` live region, so the effect isn't visual-only. Reactions are suspended while the game is paused — the throttle clock only runs during active play — so pausing for a break doesn't silently exhaust your Hans budget.

### 9.9 Facilitator phone-call cinematic (v2.10)

Sitting alongside Adaptive Hans is a **facilitator-directed phone cinematic** — a one-shortcut way to inject a scripted in-character call mid-session. A top-right overlay rings, the ambient synth bed smooth-ducks to 30%, and when the player accepts the call the transcript is rendered and voiced via the browser's `SpeechSynthesis` with a caller-specific voice profile (Powell sounds measured and warm; Hans sounds clipped and European; Holly sounds urgent). Browsers without speech synth still render the transcript as text so no dialogue is silently lost.

Three callers, three narrative purposes:

- **Sgt. Al Powell** — tactical support / hint nudge. Use when a team has stalled on an act without asking for a hint token; Powell's line is always a gentle "have you looked at X?" prompt that doesn't spoil the puzzle.
- **Hans Gruber** — antagonist threat. Use when a team just discovered a side story or cracked the Konami code; Hans's line acknowledges their cleverness and threatens retaliation. Higher z-index than the Adaptive Hans speech bubble so a concurrent call visually takes precedence.
- **Holly Gennero** — emotional beat. Use sparingly — Holly's lines land best at the narrative mid-point, when a team has bought the Act 2 heist briefing but hasn't yet entered the vault.

Three trigger paths:

1. **Hotkey** — `Ctrl+Shift+1/2/3` (or `⌘⇧1/2/3` on macOS) summons Powell / Hans / Holly. Active during pause, so you can cue a cinematic while holding the floor for a booth talk. Ignored when a text input is focused.
2. **URL hash** — `#call=powell` fires a preset rotation line on load. For live booth talks, `#call=hans:Listen+carefully+Mr+Gennero` fires an ad-hoc facilitator-authored line via live TTS. The hash is cleared after trigger so browser-back doesn't re-ring.
3. **Programmatic** — `PhoneCalls.trigger(caller, customLine?)` from the browser console or a future KV-Store poll. This is how a facilitator dashboard could eventually push calls from their own screen.

Telemetry captures the cinematic on three new event types on `index=nakatomi_sessions`: `phone_call_incoming` (fires when the call is queued, carries `caller` / `delivery_type` / `line_preset_id` / `act` / `task_id`), `phone_call_answered` (fires on accept, carries `latency_ms` from ring to answer), and `phone_call_missed` (fires on decline / ESC / 30 s auto-expire, carries `ring_duration_ms`). A dedicated **Facilitator Phone Calls** row on the facilitator board shows a daily KPI, a recent-events table, and a caller × delivery-type stacked chart.

**Privacy note:** when a facilitator uses the ad-hoc `#call=hans:...` path to improvise a line tied to a specific audience, **the raw text is never written to telemetry** — only the fact that an ad-hoc call fired, with `delivery_type=adhoc` and `line_preset_id=adhoc`. This is a deliberate design decision so live booth improvisation stays off the retained log. The regression test `scripts/tests/test_phone_calls.js` asserts this property so a future refactor cannot regress it silently.

Accessibility: the ringing pulse animation is suppressed under `prefers-reduced-motion`; the accept / decline buttons are ≥48 px and reachable by tab order; ESC dismisses an active call with the highest-priority overlay escape path (so it always cancels a mistaken cue, even if other overlays are open). Muting the game audio cancels any in-flight TTS and stops the ring immediately — muting is a real audio kill switch, not just an ambient-bed switch. `PhoneCalls.setMuted(true)` exposes a phone-specific mute for facilitators who want to keep ambient music playing but suppress TTS during a talk.

### 9.10 Investigation board (v2.10)

The **investigation board** is a full-screen corkboard overlay (hotkey `B`, also reachable from the pause menu) where teams connect the evidence they've gathered into a visible detective narrative. It's the answer to a long-standing booth observation: teams find a lot of stuff (phone intercepts, side stories, easter eggs, lore bulletins), but the stuff lives in scattered toasts and a progress bar, and nothing on-screen lets them say "*this* call relates to *that* side story." The board turns that implicit mental model into a physical, exportable artefact.

Six pin categories, each with its own colour and telemetry facet:

- **Task** (amber) — completed story-beat objectives, pinned automatically when an act task completes.
- **Side story** (cyan) — optional `9xxx` mysteries, pinned on first discovery via `handleSideStoryDiscovery`.
- **Intercept** (teal) — answered phone calls from the Phase 5i cinematic system, pinned on accept with a weak fingerprint so replaying the same preset doesn't duplicate the pin.
- **Easter egg** (magenta) — `6xxx` secrets found via SPL or the Konami code.
- **Lore** (grey-amber) — decoy keypad codes (`1990`, `0911`, `1666`, `1988`) whose narrative payoff is worth preserving alongside the real finds.
- **Suspect** (red) — manually flagged by right-clicking (or long-pressing on touch) an existing pin to upgrade it, for the "who is actually behind this" moment late in a session.

**Auto-pin hooks fire from six game events**, so teams don't manually transcribe what they've already found: task completion, side-story discovery, easter-egg discovery, answered phone call, trap-code lore toast, and manual drag from the clue tray. Every auto-pin carries a stable `sourceId` — a second auto-pin with the same sourceId is a no-op, so the board never accumulates duplicates even across replays.

**Connection threads** — click a pin, then click a second pin, and a red string renders between them in an SVG overlay beneath the pins. Threads survive pin deletion by being pruned when their endpoint goes away. **Freehand notes** (double-click the canvas) are length-capped at 300 characters and are stored purely in `localStorage` — note bodies are deliberately **not emitted** to telemetry, following the same ad-hoc-text rule as the phone cinematic.

**PNG export** — a `DOWNLOAD PNG` button on the victory breakdown (and in the pause menu) renders the board to a 1920×1080 canvas with the team code + timestamp watermark. The render path intentionally **does not** serialize the DOM; it redraws each pin's text through the module's local `esc()` helper so a pin title containing `<script>` tags can only corrupt the attacker's own PNG. The image is downloaded via a blob URL — it is never uploaded or posted anywhere.

**Booth mode** (`?booth=1`) simplifies the board to pin-only: the tray and pins remain, but threads and notes are hidden. Keeps the "see what you've found" value for 5-minute queue visitors without adding cognitive load under time pressure.

**Cap with eviction** — the persistent state is bounded at 200 pins / 300 threads / 50 notes. Overflow evicts oldest-first (and prunes dangling threads), so long marathon sessions don't blow the `localStorage` quota. The cap is enforced at mutation time, not at save time — a caller that triggers `autoPin()` 10,000 times in a loop cannot amplify to a storage DoS.

**Facilitator board (v2.10) investigation-board row** — three panels on the live booth TV:

- **Board Pins Today** — daily KPI across all teams in the booth.
- **Pin Type Mix** — stacked column chart by `pin_type`, split by `source`. Facilitators can see at a glance "are teams finding the easter eggs tonight, or mostly just completing tasks?"
- **Top Investigating Teams** — a table ranked by `detective_score = pins + threads × 2 + notes + exports × 5`. A useful post-session talking point: recognise teams who invested in the meta-puzzle, not just the critical path.

**Telemetry** is four new event types, all on `index=nakatomi_sessions sourcetype=nakatomi:session:event`: `clue_pinned` (pin_id, pin_type, source, running totals), `thread_drawn` (thread_id, from/to pin types, same_type boolean), `note_added` (note_id, note_length — **not** the body), and `board_exported` (trigger, counts, elapsed_seconds — **not** the image). All four are on the `NakaTelemetry.EVENT_TYPES` allow-list; emit-time validation rejects events with any other type.

**Accessibility** — the board is a full-screen modal with a labelled close button, keyboard navigation between pins (arrow keys + Enter to open a pin's inspector), screen-reader announcements via the existing `a11yAnnounce()` live region, touch support for drag + long-press-to-flag, and ≥48 px tap targets throughout. Honors `prefers-reduced-motion` (no animated thread-drawing transition, no pulse on new auto-pin). ESC closes the board without clearing state.

**Regression coverage** — `scripts/tests/test_investigation_board.js` extracts `NakaTelemetry` + `InvestigationBoard` into a sandboxed `vm` context with stubbed DOM and canvas, asserting 69 behaviours including module surface, registry integrity, event allow-list, auto-pin happy path + dedup + 200-pin cap + type fallback, XSS resistance, `localStorage` persistence, `clear()` semantics, `exportPNG()` telemetry, and `isOpen()`/`toggle()` round-trip. With the existing Hans (69) and Phone (84) harnesses, the module test suite is now **222 assertions, all passing**.

### 9.11 Free-roam Floor-30 hub (v2.11)

The **Floor-30 hub** is a full-screen blueprint-style overlay (hotkey `M`, also reachable from the pause menu via the new `FLOOR-30 MAP` button) that turns a linear 26-task escape-room march into a visibly explorable crime scene. It's the first tranche of Phase 8 on the game-polish roadmap: a shippable **UI layer** over the existing linear flow, without yet changing any scenario JSON. The deeper scenario-schema-v2 additions (dynamic `available_when` / `completes_when` logic, hub-driven branching leads, side-stories as discoverable leads instead of implicit background goals) land in a later v2.x release and will load on top of v2.11 without breaking anything built for 2.11.

The hub sits at `z-index:9450`, deliberately between the Investigation Board (9500) and the pause menu (9800), so pausing always still wins and the board can route through the hub without fighting for focus. Opening the hub from the pause menu auto-dismisses the pause overlay — the two become siblings, not stacking peers.

**Seven interactive stations** live on a blueprint-style floor plan with a subtle pulsing glow on the vault:

- **Security Terminal** (always available) — opens the scenario briefing intro and surfaces the current task's pre-filled SPL assist. The canonical "I forgot what I'm supposed to be doing" station.
- **Vault Keypad** (locked until Act ≥ 3) — focuses the keypad entry field even if the hub was opened from the pause menu. The locked tooltip reads something like "Vault remains sealed until the code chain reassembles" so the gating feels diegetic.
- **Leads Ledger** (always available) — opens the in-game dossier with the Leads tab pre-selected. Shows discovered side stories, trap-code lore, and intercept echoes in one reviewable list.
- **Briefing Wall** (always available) — replays the current act's scripted briefing cinematic on demand. For teams who paused through it the first time and want to re-hear the narrative framing.
- **Blueprint** (available once the first discovery fires) — opens the Nakatomi Plaza floor-30 blueprint viewer overlay. A physical anchor for the where-am-I question.
- **Comms Intercepts** (always available) — opens the dossier with the Comms tab pre-selected. Hans + Powell + Holly transcripts, both generator-authored and live facilitator-pushed (the v2.10 phone cinematic lines land here too).
- **Investigation Board** (hidden in `?booth=1` mode, otherwise always available) — closes the hub and defers to `InvestigationBoard.open('hub')`, so the two overlays never fight for focus.

**Availability engine** — each station's default-availability rule is evaluated on every `refresh()`. States are `available` (clickable, lit), `locked` (visible but disabled, tooltip explains the unlock condition), or `hidden` (completely absent from the DOM, reserved for modes where the station doesn't apply — e.g., `board` in booth mode). `HubOverlay.setAvailability(overrides)` lets future scenarios override the defaults without forking the module.

**Live status panel** — the hub's right-hand side panel refreshes on every open with current act / current task / elapsed session time / hint tokens remaining / side stories discovered / easter eggs found / trap codes tripped / (when the Investigation Board has content) board pin / thread / note counts. Values are sourced directly from `state.*` and `InvestigationBoard.stats()` so there's no duplicate-state drift risk.

**Three entry points, all instrumented:**

1. **`M` hotkey** — `M` for "Map" toggles the hub from anywhere (except text inputs / textareas, and except while a phone-call overlay is active). Listed in the `?` shortcuts help overlay.
2. **Pause menu** — `FLOOR-30 MAP [M]` button joins the pause overlay (auto-dismisses pause when clicked).
3. **Programmatic** — `HubOverlay.open('autoload')` for future scenario-driven entry. Scenario pack v2 will add an optional `auto_open_hub_at_act` key that calls this on act transition; until then it's a manual / hotkey experience.

**Telemetry** is three new event types, all on `index=nakatomi_sessions sourcetype=nakatomi:session:event`:

- `hub_opened` (trigger ∈ {hotkey, pause_menu, autoload}, act, task_id, available/locked/hidden station counts)
- `hub_closed` (trigger ∈ {hotkey, station_click, esc, backdrop_click, game_over, reset}, `elapsed_ms` for this open, `interactions` count of station clicks during this open)
- `hub_station_clicked` (station_id from the `STATION_IDS` allow-list, `availability` ∈ {available, locked, hidden}, act, task_id)

All three are on the `NakaTelemetry.EVENT_TYPES` allow-list; emit-time validation rejects any other type, and `hub_station_clicked` also validates the `station_id` against the allow-list so a compromised caller can't spray telemetry at arbitrary station IDs.

**Facilitator board (v2.11) Floor-30 Hub row** — three panels on the live booth TV:

- **Hub Sessions Today** — daily KPI of distinct teams that opened the hub at least once.
- **Station Click Mix** — stacked column chart by `station_id`, split by `availability`. Facilitators can see at a glance which stations are popular, **and, critically, whether teams are repeatedly clicking locked stations** (strong signal they don't understand the current gating and need a nudge).
- **Hub Dwell Time** — stats table with median and max `elapsed_ms` grouped by `trigger`. Teaches facilitators how their cohort actually uses the hub: as a strategic overview (high dwell on `esc`), as a launchpad (high dwell on `station_click`), or accidentally (spikes on `backdrop_click` may indicate teams don't realise click-outside dismisses the overlay).

All hub panels honour the per-booth `booth_token` input alongside the discovery, Hans, phone, and board panels.

**Accessibility** — arrow keys cycle focus across available stations; `Enter` / `Space` activates the focused station; `Escape` closes and restores focus to wherever it was before the hub opened. Every station is a real `<button>` with an `aria-label`, and the status panel updates are announced via the shared `a11yAnnounce()` live region. Honors `prefers-reduced-motion` (no ambient vault-pulse, no station hover scale-up); the hub still functions identically, only the embellishments are dropped.

**Security posture** — the hub has **no** `localStorage` writes (it's a pure presentational overlay over existing game state), **no** `eval` / `new Function` / `innerHTML`-from-user-input paths (station routing is a hard-coded switch on the `STATION_IDS` allow-list), and station labels/icons are emitted via the module's local `esc()` helper identical to the Investigation Board pattern. In `?booth=1` mode the board station is hidden entirely (no module load), further narrowing the attack surface for queue visitors.

**Regression coverage** — `scripts/tests/test_hub_overlay.js` extracts `NakaTelemetry` + `HubOverlay` into a sandboxed `vm` context with stubbed DOM + global helpers (`toggleDossier`, `showActIntro`, `togglePause`, `a11yAnnounce`, `toast`), asserting 68 behaviours including module surface, event allow-list, `STATION_IDS` registry integrity, default availability rules (`keypad` locked at Act 1 → available at Act ≥ 3; `board` hidden under booth mode), open/close idempotency, toggle correctness, unknown-station safety, locked-station telemetry (clicks register but route handlers don't fire), `setAvailability()` overrides, HEC-token hygiene (token never in any queued payload), and pause-handoff (opening the hub while paused auto-dismisses pause). With the existing Hans (69), Phone (84), and Investigation Board (69) harnesses, the module test suite is now **290 assertions, all passing**.

### 9.12 Ending-only branches (v2.12)

The **ending-only branches** system (Phase 7 Tier 1 on the game-polish roadmap) adds four tonally distinct Act-5 denouements that are selected from cumulative performance the instant a team wins. The underlying task order never changes, no mid-game fork appears (that's Phase 7 Tier 2, gated on live telemetry signals from v2.11), and the feature adds **zero runtime cost** to the critical path — the classifier runs exactly once, inside `triggerVictory()`, before `session_end` is emitted.

The four branches, in priority order (only one is ever assigned):

1. **Speedrunner** — wins if `elapsed_seconds < 0.5 × TIMER_SECONDS`. Tonally breathless: "Hans is still mid-sentence on the radio when the last vault tumbler drops. Theo looks up: 'That's… not possible.'" Any time-cap beats every other ending. Colour: ice-blue.
2. **Analyst** — wins if `wrong_count ≤ 1 ∧ hint_tokens_spent ≤ 1 ∧ side_stories_discovered ≥ 3`. Tonally measured: "Carl Winslow lights a cigarette on the roof. 'The FBI finally showed up. Whoever ran point tonight — tell 'em the Bureau is hiring.'" Rewards clean, curious play. Colour: amber.
3. **Cowboy** — wins if `wrong_count ≥ 4` (team wins anyway despite being messy). Tonally exasperated: "Powell: 'You're a cop, aren't you? I'm a cop too. A cop does not open seven wrong vault codes before finding the right one.'" Colour: red-orange.
4. **Default** — fallback for everyone else: "$640 million in bearer bonds. A holiday party that didn't go quite as anyone planned." Colour: soft green. This is the canonical "Welcome to the party, pal." ending.

**Per-ending content** — each branch supplies its own `title`, `subtitle`, and `narrative` paragraph, injected into the victory overlay between the "Yippee-ki-yay" tagline and the elapsed-time row. The overlay also gets an ending-specific CSS class for the colour theme. Each branch has its own **audio sting** replacing the default victory arpeggio: `playVictoryAnalyst()` (reflective low-pad), `playVictoryCowboy()` (brassy cavalry motif), `playVictorySpeedrunner()` (compressed staccato pulse), and `default` falls through to the original `playVictory()`. And each branch fires its own **achievement badge**: `ending_analyst`, `ending_cowboy`, `ending_speedrunner`, or `ending_default` — they stack with every other victory achievement the team earned (Pacifist Run, Iron Man, etc.).

**Telemetry** is a single new event type on `index=nakatomi_sessions sourcetype=nakatomi:session:event`: `ending_classified`, emitted **before** `session_end` so both share the victory timestamp. Payload: `ending_id`, `elapsed_seconds`, `wrong_count`, `hint_tokens_spent`, `side_stories_discovered`, `difficulty`, `mode`, `act` — the full set of classifier inputs so the decision is auditable post-hoc. No PII, no raw SPL text, no DOM content. Added to the `NakaTelemetry.EVENT_TYPES` allow-list.

**Facilitator board (v2.12) Ending Branches row** — three panels on the live booth TV (canvas extended `1920×2620 → 1920×2860`):

- **Endings Today** — daily KPI of `ending_classified` events (one per victory).
- **Ending Distribution** — stacked column by `ending_id`, split by `difficulty`. A booth stuffed with Cowboy endings on `iron-man` difficulty tells a different story than the same count on `demo` difficulty — the split makes the tonal signal legible.
- **Recent Endings** — 20 most-recent classifications with `ts / team_code / ending_id / elapsed / wrong_count / hint_tokens_spent / side_stories_discovered / difficulty`. Lets facilitators ground-truth the classifier visually: every Speedrunner row should have `elapsed < 50 %` of the timer, every Analyst row should have `wrong_count ≤ 1 ∧ side_stories_discovered ≥ 3`.

All ending panels honour the per-booth `booth_token` input alongside every other row.

**Security posture** — the `Endings` module is a pure IIFE. `classify()` has **no** side effects (no DOM, no audio, no telemetry); every output path (overlay paint, audio sting, achievement fire, telemetry emit) is driven off the `state.endingId` value it returns. All narrative content is HTML-escaped via a module-local `_esc()` helper before rendering — this matters because the v2 scenario JSON schema (documented in the module header) will eventually let scenario packs override the default endings, at which point the content becomes untrusted input and the escape is already wired. The module has **no** `localStorage` / IndexedDB writes; `state.endingId` lives in the same `state` object cleared by `resetGame()`.

**Regression coverage** — `scripts/tests/test_endings.js` extracts the `Endings` IIFE, `NakaTelemetry` allow-list, and victory-overlay painter into a sandboxed `vm` context with DOM stubs plus fakes for the `playVictory*` audio functions, asserting **120 behaviours** including registry shape, classification priority (speedrunner > analyst > cowboy > default across every boundary combination), threshold edges (`wrong_count = 1 / 4`, `hint_tokens_spent = 1`, `side_stories_discovered = 3`, `elapsed < 0.5 × TIMER_SECONDS` strict inequality), `_esc` XSS hygiene, overlay application (repeated calls don't stack classes), audio dispatch routing, and headless null-safety for stripped Splunk Cloud contexts. With the existing Hans (69), Phone (84), Investigation Board (69), and Hub (68) harnesses, the module test suite is now **410 assertions, all passing**.

---

*Document version: v13 (v2.12 ending-only branches — four tonal Act-5 outcomes, pure priority-based classifier, dedicated `ending_classified` telemetry event, facilitator distribution panel, 410-assertion regression suite)*
*Last updated: April 2026*
