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

A new Splunk dashboard, **Facilitator Board** (`facilitator_board.xml`), is designed for a 1920×1080 booth TV behind the operator. Panels:

- KPIs — active / completed / failed sessions; average win time.
- Live leaderboard — ranked by score, with elapsed and act.
- Per-act funnel — how many teams are in Act 1 vs Act 5 right now.
- Trap-hit log — who tripped which decoy and when.
- Hint distribution — column chart of hints used per task.
- Recent session-end incidents — pinned victory / loss / timeout outcomes.

Optional `booth_token` input filters every panel to a single conference booth without needing per-event index changes.

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

## 8. Hint-Token Economy (v2.6)

v2.6 replaces the previous "unlimited hints, just take the score penalty" model with a **finite, scenario-wide token pool**. Every revealed hint costs one token, and tokens never refill mid-game. The score penalty stacks on top — so a careless team has to *both* spend a token *and* eat the points hit. Tokens are decremented when a hint level is actually revealed, **not** when the hint button is clicked but the player aborts the confirmation.

### Per-difficulty starting count

| Difficulty | Tokens | Hint levels per task | Notes |
|---|---|---|---|
| `rookie` | 5 | all 4 | forgiving, room to learn |
| `operative` | 3 | 3 | default — encourages thinking before asking |
| `mastermind` | 1 | 1 | matches the existing 1-hint-level cap; spend it well |
| `iron_man` | **0** | 0 | no hints at all — Pacifist Run is the only outcome |
| `demo` | 5 | all 4 | booth visitors should never feel locked out |

### On-screen UI

- **HUD chip** (`#hint-tokens`) — Renders `TOK: 2/3` next to the existing `HINTS:` counter. Goes red and styled as a depleted box when the pool reaches zero. For Iron Man, the chip stays visible at `0/0` with a distinct red-bordered "iron-man" treatment so the player can tell at a glance this is the no-hints mode rather than mid-game exhaustion.
- **Spend animation** — On every successful spend, the chip pulses (or, for `prefers-reduced-motion`, briefly changes border colour). On exhaustion, a longer red flash + screen-reader-assertive announcement.
- **Hint button label** — Now reads `HINT 2/3 (-150 pts) · 1 TOKEN (H)` so the dual cost (score penalty + token spend) is visible at the point of decision.
- **Three terminal states** — `ALL HINTS REVEALED` (per-task limit hit), `NO TOKENS LEFT` (global pool exhausted), or the normal active prompt. CSS distinguishes the two disabled states so colour-blind players can tell them apart.
- **Iron Man** — Hint button is hidden entirely; the chip alone communicates the no-hints contract.
- **Post-game breakdown** — The victory overlay surfaces `Hint tokens spent: 2 / 3 (1 unused)`, or `0 / 3 — Pacifist Run` when nothing was spent.

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

*Document version: v4 (hint-token economy update)*
*Last updated: April 2026*
