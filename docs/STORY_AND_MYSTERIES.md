# Nakatomi Plaza: Vault Heist — Story & Mysteries

Part 1 is the narrative (introduction, phase text, endings). Part 2 is the mystery/task catalogue (to be expanded).

---

## Part 1 — Story

### Introduction (read before play)

*Christmas Eve. Nakatomi Plaza, Los Angeles. A tower of glass and steel, and tonight there’s a party on the thirtieth floor. You’re not here for the party.*

*You’re part of the team that just took the building. While the rest of the crew secures the lobby and the floors above, your job is different: get into Nakatomi’s systems. Their access logs, their building controls, their vault protocols. Everything they thought was locked down. We need it.*

*There’s a vault in this building. Seven locks. Bearer bonds inside — a fortune. The man who knew the codes isn’t giving them up. So we crack it ourselves. You’ll use the data — in Splunk — to find the codes. You’ll enter them on the vault model in front of you. Open all seven seals before the police breach, before the loose cop in the building gets lucky, or before our own explosives change the plan. Move fast. One wrong move can end the night.*

*When we say go, get into the building’s data. Start with the lobby. Find your way in. Good luck.*

---

### Easter eggs

Easter eggs from the film (quotes, names, moments) are woven into narrative, Splunk log flavor, UI, and facilitator script. Use the table below to place them without overdoing it.

#### Quotes and spoken lines

| Quote / line | Source | Suggested placement |
|--------------|--------|----------------------|
| “Yippee-ki-yay” | McClane | Success ending (e.g. “We have the bonds. Yippee-ki-yay.”). |
| “Now I have a SPL. Ho-ho-ho.” | Variant of Hans | DESIGN.md tagline; optional in UI or success. |
| “Welcome to the party, pal.” | McClane | Phase transition when players hit party-floor / recon data. |
| “Come out to the coast, we’ll get together, have a few laughs.” | McClane | Intro or facilitator (twisted invite). |
| “We’re not terrorists — we’re something else.” | Hans | Intro or briefing. |
| “Now I have a machine gun.” | McClane | Phase transition when players get vault access. |
| “Hans, bubby, I’m your white knight.” | Ellis | Splunk log: `user=Ellis` or memo. |
| “I can get you in with Takagi.” | Ellis | Splunk log message or memo text. |
| “When they touch the vault, we’re rich.” | Hans | Facilitator script or phase transition. |
| “Just another American who saw too many movies.” | Hans (re: McClane) | Splunk log: e.g. `event=roof_access note="Just another American who saw too many movies"`. |
| “Shoot the glass.” / “That’s a great idea.” | Ellis / henchman | Log flavor or UI tooltip. |
| “Nine million terrorists in the world and I gotta kill one with feet smaller than my sister.” | McClane | Log or narrative (McClane activity). |
| “Ho-ho-ho.” | Hans | Log field: e.g. `badge_id=HO-HO-HO` or memo. |
| “I was in the neighborhood.” | McClane | Splunk log: McClane activity / incident. |

#### Characters and names

Use in log fields (`user`, `badge_id`, `contact`, `author`), UI labels, or narrative:

- **Hans**, **Takagi**, **Ellis**, **Holly**, **McClane**, **Argyle**, **Powell**, **Thornburg**, **Harry Ellis**, **Dwayne T. Robinson**.

#### Places and things

Use in `floor`, `location`, `asset`, or narrative:

- **30th floor**, **Nakatomi Plaza**, **roof**, **vault**, **bearer bonds**, **limo in the garage**, **“the coast”**, **“the party.”**

#### Moments (hinted)

Encode as short log messages or one-off narrative lines:

| Moment | Suggested use |
|--------|----------------|
| Cigarette on the roof | Log: `event=roof note="cigarette"` or similar. |
| “Shoot the glass” | Log flavor or facilitator. |
| Feet smaller than my sister | Log: McClane-related incident. |
| “No shoes” (McClane) | Log: e.g. `event=incident note="Subject reportedly barefoot"`. |
| FBI helicopters | Log: `event=response unit=FBI` or phase threat. |
| “Asian Dawn” (fake group) | Log or memo reference. |
| Vault’s seven locks | Narrative and UI (vault protocol). |
| Takagi’s refusal | Phase 3 narrative beat. |
| Hans falling | Game-over ending (“The plaza floor. Hans sends his regards.”). |

---

## Part 2 — Mystery Catalogue

Each seal has a **film moment**, a **narrative hook**, a **physical clue** from the previous seal, an **SPL skill** the player must use, a clear **search path**, **red herrings**, and a **compartment reward** that feeds the next seal. The six codes are all 4-digit numeric, entered on the vault keypad. Seal 7 has no code.

The seals must be opened in order. Each compartment contains a physical object that directs or enables the next search — creating an interleaving chain of digital investigation and physical discovery.

### Summary Table

| Seal | Film Beat | SPL Skill | Index | Code | Difficulty |
|------|-----------|-----------|-------|------|------------|
| 1 | Lobby takeover | `search`, `where`, `table` | nakatomi_access | 2512 | Easy |
| 2 | Securing the building | `stats`, `count`, `sort` | nakatomi_access | 7439 | Easy–Med |
| 3 | Takagi's refusal | `transaction`, `duration` | nakatomi_vault | 4291 | Medium |
| 4 | C4 on the roof | `eval`, calculated fields | nakatomi_building | 8086 | Medium |
| 5 | FBI cuts the power | `rex`, field extraction | nakatomi_building | 5765 | Med–Hard |
| 6 | The bearer bonds | `lookup`, `inputlookup` | nakatomi_vault + lookups | 3940 | Hard |
| 7 | "Shoot the glass" | N/A (physical meta) | N/A | — | Lateral |

---

### Seal 1 — The Lobby

**Film moment**: Karl's team storms the lobby, overwhelms the guards, and seizes control of building security. The moment the front desk goes dark.

**Narrative hook**: *"We're in. The lobby is ours. Get into the access system — find out how security was locked down. Start with Floor 1."*

**Physical clue**: None (this is the starting seal). The mission brief says "start with the lobby."

**Objective**: Search the building access logs to find the security override event from the takeover. The override event contains the code.

**SPL skill taught**: Basic `search`, `where` filtering, `table` for output.

**The search path**:

1. Player searches lobby access data:
   ```
   index=nakatomi_access floor=1
   ```
   Returns hundreds of badge swipes — too many to scan manually.

2. Player filters for unusual activity:
   ```
   index=nakatomi_access floor=1 action=override
   ```
   Returns exactly **one** event — the moment security was overridden at 22:02:

   ```
   2025-12-24T22:02:47.000-0800 badge_id=HG-1988 floor=1
   room="Security Office" action=override outcome=success
   detail="security override engaged, vault protocol initiated,
   access_code=2512"
   ```

3. The code is in the `detail` field: **2512**

**Code**: **2512** (December 25 — Christmas; thematic).

**Red herrings**:
- ~40 normal badge swipes on Floor 1 between 18:00–22:00 (party guests, security guards, maintenance).
- Badge `MAINT-007` accessed the Security Office at 19:30 for a routine check — `action=swipe`, not `override`.
- Several `outcome=denied` events around 22:00 (Ellis trying to get back from the parking garage, a late caterer).
- Badge `SE-0012` on Floor 1 at 22:05 — a guard's badge used *after* the takeover (the guard was already subdued; the badge was used by a henchman, but the action is `swipe`, not `override`).

**Compartment reward**: A folded **blueprint fragment** of Nakatomi Plaza. It shows partial floor plans for floors 25–35. Conference Room 30-B is circled in red ink. A handwritten note in the margin reads: *"Check Takagi's schedule — he keeps the vault rotation codes."*

**Digital mode clue card**: Aged-paper styled card showing a grid of room labels for floors 25–35. Conference Room 30-B is circled in red. Handwritten note: *"Check Takagi's schedule — he keeps the vault rotation codes."*

**Facilitator hint** (if stuck after ~3 min): *"Not all access events are regular swipes. Look for something different — something that overrides the normal procedure."*

---

### Seal 2 — Securing the Building

**Film moment**: Hans's team fans out, herds the hostages to the 30th floor, and takes control of every level. The Christmas party becomes a hostage situation.

**Narrative hook**: *"The building is ours. Now find the vault. It's somewhere above the 25th floor — the data will tell you where. Use the blueprint."*

**Physical clue**: The **blueprint fragment** from Seal 1 → Conference Room 30-B circled, note says "Check Takagi's schedule."

**Objective**: Use `stats` to identify which floor has the most activity, drill into the flagged room, and find the vault maintenance cycle code in Takagi's schedule entry.

**SPL skill taught**: `stats count by`, `sort`, aggregation, drill-down workflow.

**The search path**:

1. Player uses stats to find the busiest floor:
   ```
   index=nakatomi_access floor>25
   | stats count by floor
   | sort -count
   ```
   Floor 30 has the highest event count (party + hostage activity).

2. Player drills into floor 30, guided by the blueprint:
   ```
   index=nakatomi_access floor=30 room="Conference*"
   | stats count by room
   | sort -count
   ```
   Conference Room A has more events (the main party), but Conference Room B has a smaller cluster of unusual events.

3. Player inspects Conference Room B:
   ```
   index=nakatomi_access floor=30 room="Conference Room B"
   | sort _time
   | table _time badge_id action detail
   ```
   Among the results, one event from Takagi's terminal (19:45, before the takeover):
   ```
   detail="exec_calendar: vault maintenance cycle 7439
   — rotation scheduled 2025-12-25T02:00"
   ```

4. The code is: **7439**

**Code**: **7439** (vault maintenance cycle number).

**Red herrings**:
- Floor 35 (executive suites) also has elevated activity — late-working executives, but no vault references.
- Conference Room A on floor 30 has 3x more events than B (it's the party — lots of badge swipes, all normal).
- A log on floor 25 mentions "vault" but it's `detail="vault HVAC inspection — nominal"` — no code.
- An event in Conference Room B with `detail="schedule: board meeting 0900"` looks like a calendar entry but contains no code.

**Compartment reward**: A printed **log excerpt** — a partial printout on dot-matrix paper. Several lines of vault access logs are visible. One session ID is highlighted in yellow marker: **VS-0042**. "Takagi's terminal" is scribbled in pen in the margin, along with *"He entered the codes himself — but did he enter the RIGHT codes?"*

**Digital mode clue card**: Green-on-dark monospace dot-matrix printout showing vault access session log entries. Session VS-0042 (user: takagi) is highlighted. Pen-style margin notes: *"Takagi's terminal"* and *"He entered the codes himself — but did he enter the RIGHT codes?"*

**Facilitator hint** (if stuck after ~4 min): *"The blueprint points you to a specific room. What happened there before the party? Try counting events by floor first — find where the action is."*

---

### Seal 3 — Takagi's Refusal

**Film moment**: Hans takes Takagi to the 30th floor conference room and demands the vault codes. Takagi refuses. *"I don't have them. You'll just have to kill me."* But before he's shot, Takagi was at the vault terminal — and he entered something.

**Narrative hook**: *"Takagi wouldn't talk. But he was at the vault terminal — session VS-0042. He entered codes. Were they real? Were they wrong on purpose? Find out what he typed."*

**Physical clue**: The **log excerpt** from Seal 2 → session ID **VS-0042** highlighted, note about Takagi entering codes.

**Objective**: Use `transaction` to group vault access events by session, find Takagi's session, and reconstruct the sequence of digits he entered. The four failed code attempts spell out the seal code.

**SPL skill taught**: `transaction` command, grouping events by session, reading ordered event sequences.

**The search path**:

1. Player searches vault logs for Takagi:
   ```
   index=nakatomi_vault user=takagi
   ```
   Multiple events appear. Hard to read the sequence without grouping.

2. Player uses transaction to group by session:
   ```
   index=nakatomi_vault
   | transaction session_id startswith="action=session_begin"
     endswith="action=session_end"
   | search session_id="VS-0042"
   ```
   Returns one transaction with 6 events (begin, 4 code attempts, end). Duration: 247 seconds.

3. Player inspects the transaction's events:
   ```
   index=nakatomi_vault session_id="VS-0042"
   | sort _time
   | table _time action detail result
   ```
   The four `code_attempt` events show:
   ```
   22:21:15  code_attempt  input=4  result=fail
   22:22:03  code_attempt  input=2  result=fail
   22:23:18  code_attempt  input=9  result=fail
   22:24:02  code_attempt  input=1  result=fail
   ```

4. Reading the inputs in order: **4**, **2**, **9**, **1** → code is **4291**

**Code**: **4291** (Takagi's deliberate failed sequence — he was sabotaging the terminal, entering codes that were wrong for the vault but serve as the Seal 3 code).

**Red herrings**:
- Session **VS-0038** (maintenance test at 14:00): has code_attempt events with inputs 0, 0, 0, 0 — test sequence, not a real code.
- Session **VS-0040** (Ellis at 21:55, shortly before the takeover): `user=ellis`, inputs are 1, 2, 3, 4 — Ellis trying to impress, guessing the obvious.
- Session **VS-0041** (Hans at 22:18): `user=hans`, one `code_attempt` with `input=****`, `result=abort` — Hans tried once and gave up before confronting Takagi.
- Several sessions with durations under 10 seconds (automated system checks — no code_attempt events).

**Compartment reward**: A physical **cipher wheel** (two concentric discs with the alphabet, forming a Caesar cipher decoder). A sticky note attached reads: *"The building talks in code. Shift 13."* This is a ROT13 decoder.

**Digital mode clue card**: Interactive ROT13 decoder widget. Two alphabet rows show the A↔N, B↔O mapping. A text input field lets players paste encoded text and see the decoded output in real time. Yellow sticky note overlay reads: *"Shift 13 — The building talks in code."*

**Facilitator hint** (if stuck after ~4 min): *"You're looking for a session — a group of related events. Splunk has a command that groups events into sessions. What did Takagi type, step by step?"*

---

### Seal 4 — The Roof Trap

**Film moment**: Hans's team rigs the roof with C4 explosives. The building systems — HVAC, elevators, fire suppression — show the tampering if you know where to look. Something is wrong on the roof.

**Narrative hook**: *"The crew is rigging the roof. The building's systems know something's off — temperature spikes, pressure anomalies. Find the message they left in the machine room data."*

**Physical clue**: The **cipher wheel** from Seal 3 → ROT13 decoder, note says "The building talks in code. Shift 13."

**Objective**: Search building telemetry for anomalous readings on the roof level, use `eval` to identify the outlier, and decode an encoded message using the physical cipher wheel. The decoded message contains the code.

**SPL skill taught**: `eval`, `abs()`, calculated fields, conditional logic with `if()` or `case()`.

**The search path**:

1. Player searches roof-level building data:
   ```
   index=nakatomi_building floor=roof system=hvac
   ```
   Returns many temperature and pressure readings — normal operational data.

2. Player uses eval to find anomalies:
   ```
   index=nakatomi_building floor=roof system=hvac
   | eval temp_delta=abs(value - 72)
   | where temp_delta > 15
   | table _time event value temp_delta encoded_message
   ```
   One event stands out — a temperature spike at 23:12 with an `encoded_message` field:
   ```
   encoded_message="GURER VF AB CBJRE JVGUBHG PBQR 8086"
   ```

3. Player uses the physical cipher wheel (ROT13) to decode:
   - G→T, U→H, R→E, R→R, E→E ... → **"THERE IS NO POWER WITHOUT CODE 8086"**

4. The code is: **8086**

**Code**: **8086** (hidden in a ROT13-encoded maintenance message embedded in anomalous HVAC data).

**Red herrings**:
- Several other HVAC events with `encoded_message` fields that decode to mundane maintenance notes: `"UHZVQVGL PNYVOENGVBA PBZCYRGR"` → "HUMIDITY CALIBRATION COMPLETE", `"SVYGRE ERCYNPRQ MBAR 4"` → "FILTER REPLACED ZONE 4".
- An elevator event on the roof with `detail="service_code: E-4401"` — looks like a code but is just an elevator maintenance ID.
- Temperature readings on floors 28–32 that show slight anomalies (the party generating heat) but no encoded messages.
- A fire suppression system test event with a numeric value that could be mistaken for a code: `value=1234` (but it's a sensor ID, not a code).

**Compartment reward**: A laminated **radio frequency card**. It shows a frequency chart with one entry circled: **Channel: freq_14, Callsign: KILO-FOXTROT-BRAVO**. Handwritten on the back: *"Listen to what they're saying on this channel."*

**Digital mode clue card**: White/blue laminated RF authorization card with a frequency table. The row for `freq_14 / FBI Field Command / KILO-FOXTROT-BRAVO` is circled in red. Back side reads: *"Listen to what they're saying on this channel."*

**Facilitator hint** (if stuck after ~5 min): *"The building sensors have more than just numbers. Look for a field that doesn't belong in normal telemetry — something that looks like a message. And remember, you have a tool for decoding."*

---

### Seal 5 — The FBI

**Film moment**: The FBI arrives. Special Agent Johnson (and Special Agent Johnson — no relation) take command. They order the power grid shut down as a tactical move. Their radio traffic is in the building's security logs.

**Narrative hook**: *"The feds are here. Their radio chatter is hitting our security intercepts. Find the authorization they're using to kill the power — that code is what we need."*

**Physical clue**: The **radio frequency card** from Seal 4 → Channel freq_14, callsign KFB.

**Objective**: Search security system logs for radio intercepts on the specified channel, then use `rex` to extract a buried authorization code from unstructured message text.

**SPL skill taught**: `rex` (regular expression field extraction), extracting structure from unstructured data.

**The search path**:

1. Player searches security logs for the specific channel:
   ```
   index=nakatomi_building sourcetype="nakatomi:building:security"
     channel=freq_14
   ```
   Returns several intercepted radio messages — messy, unstructured text.

2. Player scans the messages and sees authorization codes mentioned:
   ```
   message="FBI FIELD CMD // GRID-SEC-7 // AUTH:5765
   // PRIORITY:IMMEDIATE // CONFIRM POWER DISCONNECT"
   ```
   But there are multiple messages with different AUTH values on different channels.

3. Player uses rex to extract the code:
   ```
   index=nakatomi_building channel=freq_14
   | rex field=message "AUTH:(?<auth_code>\d+)"
   | where isnotnull(auth_code)
   | table _time auth_code message
   ```
   On freq_14, only one message has an AUTH code: **5765**

4. The code is: **5765**

**Code**: **5765** (FBI tactical authorization code for the power grid shutdown).

**Red herrings**:
- Channel freq_12 has a message with `AUTH:9901` — LAPD tactical, not FBI. Wrong channel.
- Channel freq_14 has other messages without AUTH codes (chatter: "All units hold position", "Helicopter ETA 10 minutes", "Confirm perimeter is secure").
- Channel freq_16 has `AUTH:3388` — fire department coordination. Wrong channel.
- A security log with `event_type=alarm` that has a numeric alarm_code in the message — looks similar to an AUTH code but isn't.
- One message on freq_14 has `REF:5765-A` — same number but with a suffix. The `rex` pattern `AUTH:(\d+)` won't match this (it's a cross-reference, not an authorization), but a sloppy regex might pick it up. Only the AUTH: prefix gives the real code.

**Compartment reward**: A laminated **access badge** — Nakatomi Plaza employee ID card. Name: **Naomi Park**, Department: **Vault Operations**, Badge ID: **NP-4472**, Photo: generic silhouette. On the back in small print: *"Clearance: LEVEL-5"*. A post-it note stuck to it reads: *"Her clearance unlocks the final vault sequence. Cross-reference."*

**Digital mode clue card**: Employee ID badge card — Nakatomi Trading Corporation header, photo silhouette, Name: Naomi Park, Department: Vault Operations, Badge ID: NP-4472, Clearance: LEVEL-5 (in red). Post-it attached reads: *"Her clearance unlocks the final vault sequence. Cross-reference."*

**Facilitator hint** (if stuck after ~5 min): *"The card from the last compartment tells you exactly which channel to monitor. The authorization code is in the message, but it's buried in text. You need to extract just the code — Splunk has a command that uses patterns to pull fields out of raw text."*

---

### Seal 6 — The Bearer Bonds

**Film moment**: The vault sequence. Six of seven electromagnetic locks release. Hans has been working toward this all night. The bearer bonds — $640 million — are behind the last door. In the film, the vault opens when the FBI cuts the power. Here, the player must find the final authorization code by cross-referencing employee records.

**Narrative hook**: *"Six locks down, one to go. But the final vault sequence needs an authorized employee's code — someone with the right clearance level. You have a badge. Find who it belongs to and what code their clearance unlocks."*

**Physical clue**: The **access badge** from Seal 5 → Badge ID NP-4472, Clearance LEVEL-5, note says "Cross-reference."

**Objective**: Use Splunk lookup tables to cross-reference the badge ID with the employee directory, find the clearance level, then look up the vault authorization code associated with that clearance level.

**SPL skill taught**: `inputlookup`, `lookup`, CSV lookups, cross-referencing data across tables.

**The search path**:

1. Player checks the employee directory lookup:
   ```
   | inputlookup employee_directory.csv
   | search badge_id="NP-4472"
   ```
   Returns one row: Naomi Park, Vault Operations, clearance_level=LEVEL-5, status=active.

2. Player cross-references with the system codes lookup:
   ```
   | inputlookup employee_directory.csv
   | search badge_id="NP-4472"
   | lookup system_codes.csv clearance_level
   | table name department clearance_level vault_auth_code
   ```
   Returns: vault_auth_code=**3940**

3. Or in two steps:
   ```
   | inputlookup system_codes.csv
   | search clearance_level="LEVEL-5"
   | table clearance_level vault_auth_code description
   ```
   Returns one row with vault_auth_code=**3940**.

4. The code is: **3940**

**Code**: **3940** (vault authorization code for LEVEL-5 clearance).

**Red herrings**:
- `employee_directory.csv` has ~50 employees. Several have LEVEL-4 clearance (vault_auth_code=2817) and one has LEVEL-6 (vault_auth_code=6102 — the CEO, Takagi, but his status is "terminated" as of tonight).
- Badge NP-4471 belongs to a different employee (Robert Chen, IT Operations, clearance_level=LEVEL-3) — wrong badge, close number.
- `system_codes.csv` has entries for systems other than the vault (elevator overrides, HVAC master codes, fire suppression) — players might find these and think they're the answer.
- An employee with badge_id HG-1988 (Hans, from the Seal 1 override) appears in the directory with clearance_level=EXTERNAL — no vault_auth_code for that level.

**Compartment reward**: A folded note on Nakatomi Plaza letterhead. In large handwritten text: *"The seventh lock is not in the system."* Below, smaller: *"Think about what holds the vault shut. What happens when it doesn't have what it needs?"* A short, loose DC barrel plug cable is coiled beside the note — the same type as the one powering the vault model.

**Digital mode clue card**: Nakatomi Plaza letterhead with a translucent "NAKATOMI" watermark. Large centered text: *"The seventh lock is not in the system."* Below in smaller italic: *"Think about what holds the vault shut. What happens when it doesn't have what it needs?"* (The DC barrel plug cable has no digital equivalent — the clue text is sufficient to guide the player toward the game UI's power element.)

**Facilitator hint** (if stuck after ~5 min): *"You have a badge with a name and a clearance level. Splunk can look things up from CSV tables — like an employee directory or a codes list. Try using inputlookup to search those tables."*

---

### Seal 7 — Shoot the Glass

**Film moment**: The moment the FBI cuts the power to Nakatomi Plaza. In the film, this is exactly what Hans wanted — the electromagnetic locks on the vault are powered, and cutting the power releases them. The authorities think they're tightening the noose; instead, they hand Hans the vault. *"You asked for miracles, Theo. I give you the F. B. I."*

**Narrative hook**: There is no direct narrative cue for this seal. The note from Seal 6 is the only hint. If the team has been paying attention to the story — the FBI cutting power, the vault's electromagnetic locks, the cable in the compartment — they should realize the answer is physical, not digital. The seventh lock is not in the system.

**Physical clue**: The **note and DC cable** from Seal 6 → "The seventh lock is not in the system" + loose barrel plug cable matching the vault's power connector.

**Objective**: Unplug the vault's 12V barrel jack. When main power is cut, the Seal 7 relay de-energizes, the spring-loaded latch releases, and the final compartment door swings open — revealing the bearer bonds.

**SPL skill taught**: None. This is a **lateral thinking** puzzle. The answer is outside Splunk entirely — a meta-moment that rewards players for understanding the story, not just the tool.

**The "search" (optional, for stuck teams)**:

If the team is truly stuck, they might search for vault system documentation:
```
index=nakatomi_vault "failsafe" OR "secondary release" OR "power loss"
```
One event, buried deep in the vault logs:
```
2025-12-24T14:30:00.000-0800 system=vault_protocol
event=documentation action=system_note
message="VAULT PROTOCOL 7: Secondary release —
electromagnetic failsafe. Final lock disengages on power loss.
Not accessible via terminal. See facilities manual ref VP-7."
```

This confirms: the seventh lock opens when power is lost. The player must physically unplug the barrel jack.

**Code**: None. Physical action: **unplug the vault's barrel jack**.

**Red herrings**:
- Searching for a "seventh code" in the data will yield nothing — there is no code.
- The vault documentation event is timestamped at 14:30 (well before the takeover), making it easy to miss if players are only looking at takeover-era events.
- If players try entering 0000, 9999, or other desperation codes, the wrong-code counter increments (3 wrong = McClane game over).

**Compartment reward**: **The bearer bonds** — prop money or a certificate reading *"$640,000,000 in Bearer Bonds — Nakatomi Trading Corp."* along with a card: *"Vault open. Heist complete. Yippee-ki-yay."*

**Digital mode clue card**: Gold-bordered bearer bonds certificate — "$640,000,000 — Nakatomi Trading Corporation." Bottom reads: *"Vault open. Heist complete. Yippee-ki-yay."* This card appears after the power-down animation and before the victory overlay.

**Facilitator hint** (if stuck after ~3 min of trying codes): *"There is no seventh code. The answer isn't in Splunk. Look at what you're holding. Look at what keeps the vault alive."*

**Facilitator hint 2** (if still stuck after ~5 min): *"In the movie, the FBI cut the power. That's exactly what Hans wanted. Think about what happens to an electromagnetic lock when it loses power."*

---

### Puzzle Design Principles

**Progressive difficulty**: Seal 1 requires only `search` and `where`. Each subsequent seal layers on a new SPL concept. By Seal 6, players are chaining lookups across multiple tables. Seal 7 breaks the pattern entirely — teaching the meta-lesson that not every answer is in the data.

**Physical-digital interleaving**: Every compartment reward is a physical object that directs or enables the next digital search. The cipher wheel (Seal 3) is the strongest example — without the physical artifact, the data is unreadable. This makes the physical model essential, not decorative.

**No ambiguity**: Each code appears exactly once in the data and is discoverable through exactly one SPL path. Red herrings are designed to be eliminable through careful analysis — never to create a genuine 50/50 guess.

**Thematic consistency**: Every code, clue, and event ties back to the Die Hard narrative. The codes aren't arbitrary numbers — they connect to Christmas, vault procedures, Takagi's resistance, building systems, FBI operations, and employee clearances.

**Time budget**: Seals 1–2 should take ~3–5 minutes each (players are learning). Seals 3–5 take ~5–7 minutes. Seal 6 takes ~5 minutes. Seal 7 takes ~2–5 minutes (it's a moment of realization, not computation). Total puzzle time: ~28–39 minutes, leaving room for the phase 1–3 overhead within the 45–60 minute window.

---

## Part 3 — Branching Storylines *(planned: v2.10 + v2.11)*

The seven-seal core remains the canonical play, but two upcoming releases introduce branching paths that re-shape how a session is remembered (Tier 1) and how a session unfolds (Tier 2). The branch tree below is the design target for those releases.

### Branching policy (locked)

- **Branches never invalidate the seven-seal core** — every branch ends in the same vault and the same bearer-bonds payoff.
- **Branches are decided by behaviour, not by overt menu choices** — Tier 1 reads cumulative telemetry; Tier 2 surfaces a single decision point at a Die Hard story beat.
- **All branches ship as scenario JSON v2** — the schema gains `branch_point`, `leads_to`, and `available_when` keys; v1 scenarios continue to play without modification.
- **Per-branch achievements** — each ending and fork unlocks a distinct achievement so completionists have a reason to replay.

### Tier 1 — Ending branches (v2.10.0, `p7-branching-tier1`)

Driven by cumulative performance signals already tracked by `NakaTelemetry`:

```
Seal 1 ─ Seal 2 ─ Seal 3 ─ Seal 4 ─ Seal 5 ─ Seal 6 ─ Seal 7 ─┐
                                                              │
                                              ┌───────────────┤
                                              │ Ending branch │
                                              └───┬───────────┘
                                                  │
                  ┌───────────────────────────────┼───────────────────────────────┐
                  │                               │                               │
              Analyst                         Cowboy                         Speedrunner
        (≥80% no-hint solves,           (≥3 trap codes hit,             (sub-30 min on Operative,
         ≥6 first-try entries)           still won)                       ≤2 hints)
                  │                               │                               │
       Holly's calm exfiltration       McClane's wisecrack              FBI helicopters arrive
       monologue + bond-room            radio swap + getaway             5 seconds late + skyline
       handoff with Powell              with the limo                    sting on the roof
                  │                               │                               │
                  └───────────────────────────────┼───────────────────────────────┘
                                                  │
                                            Default ending
                                  ("Yippee-ki-yay" + standard victory)
```

Each ending swaps the Act 5 narrative beat, plays a unique audio sting, and unlocks a per-branch achievement. Telemetry emits `branch_chosen { branch_id, signals }` so the facilitator board's "Endings tonight" panel can show the spread.

### Tier 2 — Mid-game fork (v2.11.0, `p7-branching-tier2`, gated on Tier 1 telemetry)

Surfaces at the close of Seal 3 (Takagi's Refusal):

```
Seal 1 ─ Seal 2 ─ Seal 3 ─┐
                          │
                          │  Decision: Takagi is dead. What now?
                          │
              ┌───────────┴───────────┐
              │                       │
       "Call the FBI"           "Handle it ourselves"
              │                       │
              ▼                       ▼
   Seal 3a — Powell on the     Seal 3b — Holly's hostage
   line (new task: tail an      negotiation log (new task:
   FBI courier through          identify the henchman who
   building access logs)        moved Holly between floors)
              │                       │
              ▼                       ▼
   Seal 3c — Code drop in       Seal 3c' — Code drop in
   the FBI advance team's       Karl's encrypted radio
   shared lookup                intercept
              │                       │
              └───────────┬───────────┘
                          │
              Branches converge at Seal 4 (C4 on the Roof);
              branch choice is recorded for Tier-1 ending bias.
```

3–4 new tasks total across the two arms. The `branch_point` in scenario JSON v2 marks the fork; `leads_to` defines convergence. Tier 1 endings can read the Tier 2 choice as an additional signal (e.g. "Call the FBI" + Speedrunner trigger leans toward the FBI-helicopters ending).

### Out of scope until further notice

- Branching at Seal 1 or Seal 2 (would fragment the SPL learning ladder).
- Player-choice menus in the UI (we want behaviour-driven branches, not visual-novel branching).
- Multiple final vaults (the "seven seals → bonds" payoff stays canonical).

Detailed task scripts, red herrings, and SPL paths for each branch will be authored in this document when the corresponding release is implemented.
