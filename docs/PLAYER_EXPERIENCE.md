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
   python3 generate.py
   ```
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
5. **Verify**: Run `index=nakatomi_access | stats count` — should return ~500 events.
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

*Document version: v2 (dual-mode update)*
*Last updated: March 2026*
