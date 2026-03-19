# Nakatomi Plaza: Vault Heist — Physical Model Design

**Electronics, Locks, and Build Guide for the 7-Seal Vault**

**Visual diagram**: Open [physical_model_diagram.svg](physical_model_diagram.svg) in a browser for a full-page visual showing front panel layout, back electronics placement, wiring schematic, side cross-section, and wire color legend.

---

## 1. Architecture Overview

The physical model is a vault panel (or enclosure) with 7 lock mechanisms, a keypad for code entry, an LCD for feedback, LEDs for seal status, and a buzzer for audio cues. An ESP32 microcontroller runs the game logic and optionally connects to Splunk over WiFi.

### 1.1 System Block Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │              12V DC SUPPLY                   │
                          │         (barrel jack, fused)                 │
                          └────────┬──────────────┬─────────────────────┘
                                   │              │
                          ┌────────▼──────┐  ┌────▼────────────────────┐
                          │  5V Regulator │  │  12V Bus                │
                          │  (LM7805 /   │  │  ┌──────────────────┐   │
                          │   buck conv.) │  │  │ Solenoid Locks   │   │
                          └───────┬───────┘  │  │ (Seals 3-5)      │   │
                                  │          │  │ via MOSFETs       │   │
                          ┌───────▼───────┐  │  ├──────────────────┤   │
                          │    ESP32      │  │  │ Magnetic Lock    │   │
                          │  DevKit V1   │  │  │ (Seal 6)         │   │
                          │              │  │  │ via relay         │   │
                          │  ┌─────────┐ │  │  ├──────────────────┤   │
                          │  │ WiFi    │ │  │  │ NC Relay         │   │
                          │  │ (Splunk)│ │  │  │ (Seal 7)         │   │
                          │  └─────────┘ │  │  │ power-loss latch │   │
                          └──┬──┬──┬──┬──┘  │  └──────────────────┘   │
                             │  │  │  │     └─────────────────────────┘
                    ┌────────┘  │  │  └──────────┐
                    │     ┌─────┘  └─────┐       │
               ┌────▼──┐ ┌▼────────┐ ┌───▼───┐ ┌─▼──────────────┐
               │Keypad │ │LCD I2C  │ │Buzzer │ │NeoPixel Strip  │
               │4x4    │ │20x4    │ │       │ │(7+ LEDs)       │
               └───────┘ └────────┘ └───────┘ └────────────────┘
                                                ┌────────────────┐
                                                │ Servo Locks    │
                                                │ (Seals 1-2)   │
                                                │ via PWM        │
                                                └────────────────┘
```

### 1.2 Why ESP32?

| Requirement | ESP32 capability |
|---|---|
| Enough GPIO for all components | 30+ usable pins |
| WiFi for Splunk / game orchestrator | Built-in 802.11 b/g/n |
| PWM for servos | Hardware PWM on any GPIO |
| I2C for LCD | Native I2C support |
| NeoPixel data line | RMT peripheral (ideal for WS2812B) |
| Dual-core for network + game logic | Two Xtensa cores at 240 MHz |
| Price | ~$5–8 for a DevKit V1 board |
| Ecosystem | Arduino IDE, PlatformIO, MicroPython |

### 1.3 Power Architecture

```
Mains AC ─► 12V DC adapter (2A+ fused) ─► Barrel jack on vault panel
                                              │
                          ┌───────────────────┤
                          │                   │
                    ┌─────▼─────┐       ┌─────▼──────────┐
                    │ 5V reg.   │       │ 12V bus        │
                    │ (LM7805   │       │ solenoids,     │
                    │  or buck) │       │ mag lock,      │
                    └─────┬─────┘       │ Seal 7 relay   │
                          │             └────────────────┘
                    ┌─────▼─────┐
                    │ ESP32     │
                    │ 3.3V     │
                    │ (onboard  │
                    │  regulator│
                    │  from 5V) │
                    ├───────────┤
                    │ NeoPixels │
                    │ (5V data) │
                    ├───────────┤
                    │ Servos    │
                    │ (5V)      │
                    ├───────────┤
                    │ LCD       │
                    │ (5V)      │
                    └───────────┘

Backup for Seal 7 victory sequence:
  ─► Supercapacitor (2.7V 10F) or small LiPo
     charges from 5V rail while powered;
     keeps ESP32 alive ~10s after main power cut
     to play victory lights + sound.
```

- **12V rail**: solenoid locks, magnetic lock, Seal 7 relay
- **5V rail**: ESP32 (via Vin), servos, NeoPixels, LCD, buzzer
- **3.3V rail**: ESP32 GPIO logic (onboard regulator)

---

## 2. Hinged Compartment Doors

Each seal level on the tower has a small **hinged door panel** on the front face. The lock mechanism (servo arm, solenoid bolt, or electromagnetic hold) physically latches that floor's door shut. When the seal is broken, the lock retracts and the door swings open — revealing a compartment behind it containing the clue or artifact needed for the next seal.

### 2.1 Door Construction

Each door is a section of the tower facade, approximately **150mm wide × 70mm tall**, cut from the same material as the tower panel and attached with small piano hinges (continuous hinges) or 3D-printed living hinges on the left edge.

```
                    TOWER FRONT (per floor)
          ┌─────────────────────────────────────┐
          │  ┌──────────────────────────────┐   │
          │  │         HINGED DOOR          │←lock mechanism
          │  │    (swings open to right)    │   holds door shut
          │  │                              │   │
          │  │   [SEAL n]  ◄── LED          │   │
          │  │                              │   │
          │  └─hinge──────────────────┘     │   │
          │      ↑ left edge hinge          │   │
          └─────────────────────────────────────┘
```

**Key design points**:

- **Hinge placement**: Left edge of each door. The door swings outward to the right when the lock releases.
- **Spring assist**: A small torsion spring on the hinge (or a compressed foam block behind the door) gently pushes the door open once the lock retracts. This creates a satisfying "pop" effect.
- **Compartment depth**: Each compartment behind the door is ~40–60mm deep (enough to hold a folded clue card, a small prop, or a USB stick).
- **Door stops**: Small foam bumpers prevent doors from swinging more than ~110° and slamming into adjacent levels.
- **Seal indicator**: The seal number and its LED are mounted on the door face itself, so they move with the door. The LED wiring uses a small flex pigtail to accommodate the hinge movement.

### 2.2 Compartment Contents (Clue Chain)

Each compartment reveals something the team needs for the next seal. This creates a **physical dependency chain** — you literally cannot proceed without opening the previous floor.

| Seal | Floor | Reveals | How it helps |
|---|---|---|---|
| 1 | Roof | Folded blueprint fragment | Shows a partial floor plan with Seal 2's code hidden in room numbers |
| 2 | 30F | USB stick or SD card | Contains a log file that must be analyzed in Splunk to find Seal 3's code |
| 3 | 25F | Printed cipher wheel or decoder ring | Physical decoder needed to translate an encrypted Splunk field into Seal 4's code |
| 4 | 20F | Radio frequency card + small note | A frequency/channel number and callsign; the team must find the matching Splunk event |
| 5 | 15F | Access badge prop (laminated card) | Has a barcode/QR or employee ID that maps to a Splunk lookup table for Seal 6's code |
| 6 | 5F | A power cable or note saying *"Cut the power"* | The hint for Seal 7's meta-solution: unplug the barrel jack |
| 7 | Vault (B1) | **The bearer bonds** (prop money / certificate) | The prize! Game complete. |

**Design note**: The clue objects should be **physically distinct** (paper, plastic, metal, electronic) so each reveal feels different. Seal 6's compartment is the most important narratively — it must clearly hint at the power-cut solution without spelling it out.

### 2.3 Door-to-Lock Integration

Each lock type latches its door differently:

| Seals | Lock type | How it latches the door |
|---|---|---|
| 1–2 | Servo | Servo arm rotates through a slot in the door edge; acts as a latch bolt |
| 3–5 | Solenoid | Solenoid bolt extends through the panel frame into a strike plate on the door edge |
| 6 | Mag lock | Electromagnet on frame, steel armature plate on door; magnetic hold |
| 7 | Power-loss latch | Spring-loaded solenoid bolt; releases when power is cut |

The lock mechanisms are described in detail in Section 3 below.

---

## 3. Lock Mechanisms

The seven seals use a deliberate mix of lock types. Early seals are simple and quiet; later seals are louder and more dramatic. This escalation builds tension as the team progresses.

### 3.1 Seals 1–2: Servo Locks

**Type**: SG90 micro servo (180°) rotating a 3D-printed or bent-wire latch arm.

**How it works**:
- Locked position: servo at 0° — latch arm blocks a bolt or pin.
- Unlocked position: servo rotates to 90° — latch arm swings clear, bolt drops or slides.
- Audible "whirr" provides feedback.

**Wiring**:
- Signal wire → ESP32 PWM-capable GPIO
- Power → 5V rail (not ESP32 3.3V pin — servos draw too much current)
- GND → common ground

**Mounting**: Servo body mounted on the tower frame behind the door's hinge edge. The latch arm protrudes through a slot in the door edge, acting as a bolt that prevents the door from swinging open. When the servo rotates to 90°, the arm clears the slot and the spring-assist pushes the door open.

**Reset**: Servo returns to 0° (locked) on reset command.

### 3.2 Seals 3–5: Solenoid Locks

**Type**: 12V DC push-pull solenoid bolt lock (JF-0530B or similar).

**How it works**:
- Default (unpowered): bolt extended — locked.
- Powered: bolt retracts — unlocked.
- Satisfying electromagnetic "thunk" when the bolt pulls in.

**Driver circuit (per solenoid)**:

```
ESP32 GPIO ──► 1kΩ resistor ──► IRLZ44N gate
                                  │
                              source ──► GND
                                  │
                              drain ──► solenoid (−)
                                         │
                              solenoid (+) ──► 12V
                                  │
                          flyback diode (1N4007)
                          cathode ──► 12V
                          anode ──► drain (solenoid −)
```

- **MOSFET**: IRLZ44N (logic-level, switches at 3.3V gate voltage).
- **Flyback diode**: 1N4007 across solenoid terminals. Protects MOSFET from back-EMF when the solenoid de-energizes. **Do not omit.**
- **Gate resistor**: 1kΩ limits inrush to the gate.

**Mounting**: Solenoid body mounted on the tower frame beside the door. The bolt extends through the frame into a strike plate (small metal loop or drilled hole) on the door's latch edge. When the solenoid retracts the bolt, the strike plate is freed and the door swings open.

**Reset**: ESP32 drives GPIO LOW → solenoid de-energizes → bolt extends into strike plate (re-locks the door). The facilitator must manually push each door closed before resetting.

### 3.3 Seal 6: Magnetic Lock

**Type**: 12V DC electromagnetic lock (small form factor, 60–100 kg holding force).

**How it works**:
- Default (powered): electromagnet holds armature plate — locked.
- Unpowered: magnet releases — unlocked.
- Heavy, satisfying "clunk" when the armature drops away.

**Driver circuit**:

```
ESP32 GPIO ──► relay module IN
                    │
               relay COM ──► 12V
               relay NO ──► mag lock (+)
               mag lock (−) ──► GND
                    │
            flyback diode (1N4007) across mag lock terminals
```

- **Relay module**: 5V single-channel relay (SRD-05VDC-SL-C or similar). Opto-isolated modules are preferred.
- Default state: relay energized (COM→NO connected) → mag lock powered → locked.
- To unlock: ESP32 drives relay GPIO LOW → relay de-energizes → COM disconnects from NO → mag lock loses power → releases.

**Mounting**: Electromagnet mounted on the tower frame at the Seal 6 level; a steel armature plate is bonded to the door's latch edge. The magnetic hold keeps the door firmly shut. When the mag lock de-powers, the armature releases and the spring-assist pushes the door open with a heavy, satisfying "clunk."

**Reset**: ESP32 re-energizes the relay → mag lock re-powers. The facilitator pushes the door closed; the magnet grabs the armature plate and holds.

### 3.4 Seal 7: Power-Loss Latch (Meta Solution)

**Type**: Normally-closed (NC) relay holding a spring-loaded mechanical latch.

**How it works**:
- While main 12V is present: NC relay is energized → holds latch pin → locked.
- When players unplug the barrel jack: relay de-energizes → NC contacts close (or, if using NC wiring, the relay's rest state releases the latch) → spring pushes latch open.
- No code required. The system never tells the player this; it's the "movie twist."

**Detailed in Section 6 below.**

---

## 4. Input System

### 4.1 Keypad

**Part**: 4x4 membrane matrix keypad (16 keys: 0–9, A, B, C, D, *, #).

**Layout**:
```
┌─────┬─────┬─────┬─────┐
│  1  │  2  │  3  │  A  │
├─────┼─────┼─────┼─────┤
│  4  │  5  │  6  │  B  │
├─────┼─────┼─────┼─────┤
│  7  │  8  │  9  │  C  │
├─────┼─────┼─────┼─────┤
│  *  │  0  │  #  │  D  │
└─────┴─────┴─────┴─────┘

*  = Clear / backspace
#  = Submit code
A  = (reserved / facilitator)
D  = (reserved / reset combo)
```

**Wiring**: 8 pins (4 rows + 4 columns) to ESP32 GPIOs. The `Keypad` Arduino library handles scanning.

**Pins**: Use GPIOs that are safe for input (avoid strapping pins GPIO0, GPIO2, GPIO12, GPIO15 on ESP32).

### 4.2 LCD Display

**Part**: I2C 20x4 character LCD with PCF8574 backpack (or 16x2 for compact builds).

**Wiring**: 4 wires only (VCC→5V, GND, SDA→GPIO21, SCL→GPIO22).

**Display states**:

| Game state | Line 1 | Line 2 | Line 3 | Line 4 |
|---|---|---|---|---|
| Ready | `NAKATOMI VAULT` | `SEAL 1: ENTER CODE` | `CODE: ____` | `ATTEMPTS: 0/3` |
| Code entry | `NAKATOMI VAULT` | `SEAL 3: ENTER CODE` | `CODE: 74**` | `ATTEMPTS: 1/3` |
| Correct | `>>> CORRECT <<<` | `SEAL 3 OPEN` | *(flash for 2s)* | |
| Wrong | `ACCESS DENIED` | `ATTEMPTS: 2/3` | *(flash for 2s)* | |
| Game over | `GAME OVER` | `McCLANE GOT YOU` | | |
| Victory | `VAULT OPEN` | `$640 MILLION` | `IN BEARER BONDS` | `Yippee-ki-yay` |

### 4.3 Optional: Rotary Encoder (for one seal)

For variety, one seal (e.g., Seal 2) could require turning a dial to a specific number instead of typing a code. A rotary encoder with a push button provides a "safe-cracking" feel.

**Part**: KY-040 rotary encoder module.
**Wiring**: CLK→GPIO, DT→GPIO, SW→GPIO (with pull-up), VCC→3.3V, GND.

---

## 5. Feedback Systems

### 5.1 NeoPixel LEDs

**Part**: WS2812B NeoPixel strip or 7 individual NeoPixel modules.

**Per-seal LED states**:

| State | Color | Pattern |
|---|---|---|
| Locked (not yet active) | Dim red | Solid |
| Active (current seal) | Amber | Slow pulse (fade in/out) |
| Unlocked | Green | Solid |
| Wrong code entered | Bright red | Fast flash (3x), then back to amber |
| Game over | Red | All flash simultaneously |
| Victory (all open) | Green → rainbow | Chase / rainbow cycle |

**Wiring**:
- Data in → ESP32 GPIO (use GPIO13 or GPIO18; avoid GPIO0/2/15)
- Power → 5V rail
- GND → common ground
- Add a 330Ω resistor on the data line and a 100µF cap across power at the strip.

**Library**: FastLED or Adafruit_NeoPixel (Arduino).

### 5.2 Buzzer / Speaker

**Part**: Passive piezo buzzer (for tones) or small 8Ω speaker with PAM8403 amplifier.

**Tone map**:

| Event | Tone |
|---|---|
| Key press | Short click (1000 Hz, 30 ms) |
| Code submitted | Short beep (800 Hz, 100 ms) |
| Correct code | Ascending: C5→E5→G5 (200 ms each) |
| Wrong code | Descending buzz: 400 Hz → 200 Hz (500 ms) |
| Seal 7 opens | Victory: C4→E4→G4→C5 (300 ms each) |
| Game over | Descending: C4→A3→F3→D3 (400 ms each) |

**Wiring**: Signal → ESP32 GPIO (via 100Ω resistor for piezo); GND → common ground.

---

## 6. Seal 7 — Meta Solution Circuit (Detailed)

This is the most important mechanical design: the "movie twist" where unplugging power opens the final seal. When Seal 7's door swings open, it reveals the final compartment containing the bearer bonds.

### 6.1 Option A — Power-Loss Detection (Recommended)

**Principle**: Seal 7's lock is held closed by a relay that is powered from the main 12V supply. When the player unplugs the barrel jack, the relay de-energizes, and a spring-loaded latch releases.

**Circuit**:

```
                    12V Main Supply
                         │
                    ┌────┤
                    │    │
              ┌─────▼──────┐
              │  5V Relay   │
              │  Module     │
              │  (NC used)  │
              │             │
              │ VCC ── 5V   │
              │ GND ── GND  │
              │ IN ── 5V    │◄── Always energized while main power on
              │             │    (tied to 5V via jumper, not to ESP32)
              │ COM ────────┤──► Latch solenoid (+)
              │ NC ─────────┤──► Not connected
              │ NO ─────────┤──► 12V
              └─────────────┘
                                 Latch solenoid (−) ──► GND
                                      │
                              flyback diode (1N4007)

POWER STATE LOGIC:
  Main power ON  → relay energized → COM connects to NO → solenoid gets 12V → bolt retracted (held open internally, latch engaged)
  Main power OFF → relay drops     → COM connects to NC → solenoid loses power → spring pushes bolt → SEAL 7 OPENS
```

**Alternate approach (simpler)**:

```
12V ──► Seal 7 solenoid (+)     (solenoid holds latch pin while powered)
         solenoid (−) ──► GND
              │
      flyback diode (1N4007)

When 12V is present: solenoid pulls pin, holds latch shut.
When 12V removed (unplug): solenoid releases, spring pushes latch open.
```

This simpler version works if the solenoid is a "pull" type that retracts a pin when powered and a spring extends it when unpowered. The pin blocks a latch; when it extends, the latch is free to open.

**Power-sense pin** (so ESP32 knows Seal 7 opened):

```
12V ──► 10kΩ ──┬──► ESP32 GPIO (power_sense)
               │
              3.3kΩ
               │
              GND

Divider output: 12V × 3.3k / (10k + 3.3k) ≈ 3.0V → HIGH on ESP32
When unplugged: 0V → LOW → ESP32 detects power loss → plays victory
```

**Backup power for victory sequence**:

The ESP32 needs to stay alive for ~10 seconds after main power is cut to play the victory LEDs and sound. Options:

| Option | Part | Hold time | Notes |
|---|---|---|---|
| Supercapacitor | 2.7V 10F (×2 in series for 5V) | ~8–12s | Simple, no charge circuit needed, long life |
| Small LiPo | 3.7V 500mAh with TP4056 charger | Minutes | More complex, needs charge management |
| 9V battery + Schottky diode | 9V alkaline | Hours | Dead simple; diode prevents backfeed |

**Recommended**: 9V battery with a Schottky diode (1N5819) to the ESP32 Vin pin. The battery only supplies power when the main 5V rail drops below ~8V. Simple, reliable, no charge circuit.

```
Main 5V ──► Schottky diode (anode) ──┬──► ESP32 Vin
                                      │
9V battery (+) ──► Schottky diode ────┘
9V battery (−) ──► GND
```

Whichever diode has the higher voltage wins; when main power is cut, the 9V battery seamlessly takes over.

### 6.2 Option B — Hidden Switch

A simpler alternative: an SPDT toggle switch mounted out of sight (back of the model, under the table, behind a removable panel).

```
ESP32 GPIO (with INPUT_PULLUP) ──► switch COM
                                    switch NO ──► GND

Switch open (default): GPIO reads HIGH → seal 7 locked
Switch closed (player finds and flips it): GPIO reads LOW → seal 7 opens
```

The ESP32 detects the state change, fires the Seal 7 solenoid/servo, and plays the victory sequence. No power-loss detection needed.

### 6.3 Option C — Magnetic Breakaway Cable

A prop "power cable" that uses a magnetic pogo-pin connector (like old MagSafe). When disconnected, it breaks a circuit that the ESP32 monitors — same logic as the hidden switch, but the physical action is "cutting" or "unplugging" a visible cable.

**Part**: Magnetic pogo-pin USB connector (2-pin, available on AliExpress).

---

## 7. Splunk / Game Orchestrator Integration

### 7.1 Connectivity Modes

| Mode | Network | Use case |
|---|---|---|
| **Standalone** | None | All codes pre-programmed on ESP32; no Splunk integration; simplest setup |
| **Connected** | WiFi (local) | ESP32 serves a REST API; Splunk or a game UI polls/controls the vault |
| **Full integration** | WiFi + HEC | ESP32 sends events to Splunk via HTTP Event Collector; Splunk alerts can trigger seal opens |

### 7.2 REST API (ESP32 as HTTP Server)

The ESP32 runs a lightweight HTTP server (using the `ESPAsyncWebServer` library).

**Endpoints**:

| Method | Path | Description | Example response |
|---|---|---|---|
| `GET` | `/status` | Current game state | `{"seals":[0,0,0,0,0,0,0],"wrong_count":1,"phase":"vault","active_seal":3}` |
| `POST` | `/open/{n}` | Remotely open seal n (1–7) | `{"ok":true,"seal":3,"state":"open"}` |
| `POST` | `/reset` | Reset all seals for next team | `{"ok":true,"state":"ready"}` |
| `POST` | `/gameover` | Trigger game-over sequence | `{"ok":true,"state":"gameover"}` |
| `POST` | `/code` | Submit a code (body: `{"code":"7428"}`) | `{"correct":true,"seal":3}` or `{"correct":false,"wrong_count":2}` |

**Authentication**: For a local game network, a simple shared token in the `Authorization` header is sufficient. The ESP32 checks `Bearer <token>` on POST requests.

### 7.3 Splunk HEC Integration

The ESP32 can push events to Splunk's HTTP Event Collector for real-time logging of game actions.

**Event format**:

```json
{
  "event": {
    "action": "seal_open",
    "seal": 3,
    "method": "code",
    "code": "7428",
    "elapsed_seconds": 1842
  },
  "sourcetype": "nakatomi_vault_physical",
  "index": "nakatomi_vault"
}
```

Events to log: seal opens, wrong codes, game start, game over, reset, Seal 7 power-loss detected.

### 7.4 Standalone Mode

If no WiFi is available, the ESP32 runs entirely offline:

- Seal codes are stored in firmware (or in a config file on SPIFFS/LittleFS).
- The keypad + LCD is the only interface.
- A facilitator reset combo (e.g., hold `A` + `D` + `#` for 3 seconds) resets the game.

---

## 8. Wiring Reference

### 8.1 ESP32 Pin Assignment

| GPIO | Function | Component | Notes |
|---|---|---|---|
| 13 | NeoPixel data | WS2812B strip | Via 330Ω resistor |
| 14 | Servo 1 signal | Seal 1 (SG90) | PWM |
| 27 | Servo 2 signal | Seal 2 (SG90) | PWM |
| 26 | MOSFET gate 3 | Seal 3 (solenoid) | Via 1kΩ resistor |
| 25 | MOSFET gate 4 | Seal 4 (solenoid) | Via 1kΩ resistor |
| 33 | MOSFET gate 5 | Seal 5 (solenoid) | Via 1kΩ resistor |
| 32 | Relay IN | Seal 6 (mag lock) | Active LOW |
| — | Seal 7 relay | Tied to 5V rail | Not controlled by ESP32; de-energizes on power loss |
| 35 | Power sense | Seal 7 voltage divider | Input only; 3.0V when powered, 0V when unplugged |
| 4 | Keypad row 1 | 4x4 membrane keypad | |
| 16 | Keypad row 2 | | |
| 17 | Keypad row 3 | | |
| 5 | Keypad row 4 | | |
| 18 | Keypad col 1 | | |
| 19 | Keypad col 2 | | |
| 23 | Keypad col 3 | | |
| 15 | Keypad col 4 | | Use pull-down if strapping pin causes boot issues |
| 21 | I2C SDA | LCD display | |
| 22 | I2C SCL | LCD display | |
| 12 | Buzzer | Passive piezo | Via 100Ω resistor |

**Pins to avoid on ESP32 DevKit V1**:
- GPIO0, GPIO2: strapping pins (affect boot mode). Usable with care but avoid for critical inputs.
- GPIO6–11: connected to internal flash. **Never use.**
- GPIO34–39: input only (no internal pull-up). Fine for power-sense (GPIO35).

### 8.2 Power Distribution

```
12V DC Adapter (2A, center-positive barrel jack)
│
├──► Fuse (2A blade fuse in inline holder)
│
├──► 12V bus ──► Seal 3 solenoid (via MOSFET)
│             ──► Seal 4 solenoid (via MOSFET)
│             ──► Seal 5 solenoid (via MOSFET)
│             ──► Seal 6 mag lock (via relay)
│             ──► Seal 7 solenoid (direct, NC when powered)
│             ──► Voltage divider (power sense for ESP32)
│
├──► LM7805 or MP1584 buck converter ──► 5V bus
│     │
│     ├──► ESP32 Vin
│     ├──► Servo 1, Servo 2 (power)
│     ├──► NeoPixel strip (power)
│     ├──► LCD (power)
│     ├──► Relay module (VCC)
│     └──► Seal 7 relay coil (IN tied to 5V)
│
└──► GND bus (common ground for all components)

Backup: 9V battery ──► Schottky diode ──► ESP32 Vin
        (takes over when main power is cut)
```

### 8.3 MOSFET Driver (Solenoid Seals 3–5)

One circuit per solenoid:

```
                         12V
                          │
                    ┌─────┤
                    │     │
               ┌────▼────┐│
               │Solenoid ││
               │         ││
               └────┬────┘│
                    │     │
              flyback     │
              diode ──────┘
              (1N4007)
                    │
                    │ (drain)
               ┌────▼────┐
               │ IRLZ44N │
               │ MOSFET  │
               └────┬────┘
                    │ (source)
                   GND

Gate circuit:
  ESP32 GPIO ──► 1kΩ ──► IRLZ44N gate
  10kΩ pull-down: gate ──► GND (ensures MOSFET is OFF at boot)
```

---

## 9. Bill of Materials

### 9.1 Controller and Core

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 1 | ESP32 DevKit V1 | Dual-core, WiFi, 30-pin | $6 | AliExpress / Amazon |
| 1 | Micro-USB cable | Programming and power (dev only) | $3 | — |
| 1 | Breadboard or PCB | Prototype board (half-size) | $3 | — |
| 1 | Terminal blocks | Screw terminals for wire connections | $3 | — |

### 9.2 Power

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 1 | 12V 2A DC adapter | Barrel jack, center-positive | $8 | Amazon |
| 1 | Barrel jack panel mount | 5.5×2.1mm, panel-mount socket | $2 | — |
| 1 | LM7805 or MP1584 | 5V voltage regulator / buck converter | $3 | — |
| 1 | Inline fuse holder + 2A fuse | Blade fuse, inline | $3 | — |
| 1 | 9V battery + clip | Backup for Seal 7 victory sequence | $4 | — |
| 2 | 1N5819 Schottky diode | OR-ing diodes for backup power | $1 | — |
| 1 | 100µF electrolytic cap | Across 5V bus (decoupling) | $0.50 | — |
| 1 | 100µF electrolytic cap | Across 12V bus (decoupling) | $0.50 | — |

### 9.3 Locks

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 2 | SG90 micro servo | 180°, for Seals 1–2 | $4 | AliExpress |
| 3 | 12V DC solenoid lock | Push-pull bolt (JF-0530B or similar), for Seals 3–5 | $15 | AliExpress / Amazon |
| 1 | 12V electromagnetic lock | Small mag lock (60–100kg), for Seal 6 | $8 | AliExpress |
| 1 | 12V solenoid (pull type) | For Seal 7 latch (spring-return) | $5 | AliExpress |

### 9.4 Electronics

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 3 | IRLZ44N MOSFET | Logic-level N-channel, for solenoid drivers | $3 | — |
| 2 | 5V relay module | 1-channel, opto-isolated (Seal 6 + Seal 7) | $4 | — |
| 3 | 1N4007 diode | Flyback protection for solenoids | $1 | — |
| 3 | 1kΩ resistor | MOSFET gate resistors | $0.50 | — |
| 3 | 10kΩ resistor | MOSFET gate pull-downs | $0.50 | — |
| 1 | 10kΩ resistor | Voltage divider (top, power sense) | $0.25 | — |
| 1 | 3.3kΩ resistor | Voltage divider (bottom, power sense) | $0.25 | — |
| 1 | 330Ω resistor | NeoPixel data line | $0.25 | — |
| 1 | 100Ω resistor | Buzzer | $0.25 | — |

### 9.5 Input and Feedback

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 1 | 4x4 membrane keypad | Matrix keypad, 8-pin ribbon | $3 | AliExpress / Amazon |
| 1 | I2C LCD 20x4 | HD44780 with PCF8574 backpack | $6 | AliExpress / Amazon |
| 1 | WS2812B NeoPixel strip | 7+ LEDs (cut to length), or 7 individual modules | $4 | Adafruit / AliExpress |
| 1 | Passive piezo buzzer | 5V, through-hole or panel-mount | $1 | — |

### 9.6 Enclosure, Doors, and Hardware

| Qty | Part | Description | Est. price | Source |
|---|---|---|---|---|
| 1 | Tower enclosure / panel | MDF, plywood, or acrylic; ~200mm wide x ~700mm tall tower shape | $15–35 | Hardware store / custom |
| 7 | Piano hinges (small) | 30–40mm continuous hinges for compartment doors, or 14 small butt hinges | $8 | Hardware store |
| 7 | Torsion springs or foam blocks | Spring-assist to push doors open when locks release | $5 | Hardware store / Amazon |
| 7 | Door panels (cut to size) | ~150mm x 70mm panels matching tower material; pre-cut from same sheet | incl. | — |
| — | M3 screws, nuts, standoffs | Mounting hardware for servos, solenoids, PCB, hinges | $5 | — |
| — | Wire (22 AWG, various colors) | Hookup wire for internal wiring | $5 | — |
| — | Dupont connectors / JST connectors | For removable connections | $3 | — |
| — | Heat shrink tubing | Insulation for solder joints | $3 | — |
| — | Zip ties | Cable management | $2 | — |
| — | Foam bumper pads | Door stops to prevent over-swing | $2 | — |

### 9.7 Total Estimated Cost

| Category | Subtotal |
|---|---|
| Controller + core | ~$15 |
| Power | ~$22 |
| Locks (all 7) | ~$32 |
| Electronics (drivers, resistors) | ~$10 |
| Input + feedback | ~$14 |
| Enclosure, doors + hardware | ~$40–65 |
| **Total** | **~$133–158** |

Prices are approximate (2025 AliExpress/Amazon). Buying in bulk or using parts on hand will reduce cost.

---

## 10. Build Procedure

### Step 1: Build the Tower Shell

1. Cut the tower shape from MDF, plywood, or thick acrylic (~200mm wide × ~700mm tall). Include the setback crown at the top.
2. Cut 7 door panels (~150mm × 70mm each) from the same material sheet. These will become the hinged compartment doors at each seal level.
3. Mark and cut the tower face to create the 7 door openings, leaving the frame (side columns and horizontal dividers between floors) intact. Leave ~25mm of frame material on each side.
4. Cut or build 7 shallow compartment boxes (~150mm × 70mm × 50mm) from thin MDF/foam board to create the spaces behind each door. These can be open-backed (the electronics panel closes them from behind).
5. Attach piano hinges to the left edge of each door panel. Mount doors into their openings; verify they swing freely outward.
6. Add torsion springs or compressed foam blocks behind each door for spring-assist opening.
7. Add foam bumper pads to limit door swing to ~110°.
8. Mark and cut holes/slots for:
   - Keypad mounting area (lobby level)
   - LCD cutout (lobby level)
   - Barrel jack panel mount (base)
   - NeoPixel wiring pass-through (small holes beside each seal)
9. Label each seal position (1–7) and floor designation on the front face.

### Step 2: Mount the Locks

1. Mount servos (Seals 1–2) on the tower frame beside their door openings. Attach latch arms that extend through a slot in each door's latch edge.
2. Mount solenoids (Seals 3–5) on the frame with bolts that extend into strike plates on each door's latch edge. Verify bolt alignment with door closed.
3. Mount the electromagnetic lock (Seal 6) on the frame. Bond the steel armature plate to the Seal 6 door's latch edge.
4. Mount the Seal 7 solenoid with its spring-return latch mechanism on the frame at the vault level.
5. Close each door and test each lock mechanically: push/pull bolts, rotate latch arms, verify the spring-assist opens the door when the lock releases.
6. Adjust spring tension so doors open smoothly but don't fly open violently.

### Step 3: Wire Power Distribution

1. Mount the barrel jack panel socket.
2. Wire 12V from barrel jack through the inline fuse to the 12V bus.
3. Wire the 5V regulator (input from 12V, output to 5V bus).
4. Wire the 9V battery backup (through Schottky diode to ESP32 Vin).
5. Establish a common GND bus.
6. Add decoupling caps (100µF) across both the 12V and 5V buses.

### Step 4: Wire Lock Drivers

1. Build three MOSFET driver circuits (Seals 3–5): solder IRLZ44N, gate resistor, pull-down, and flyback diode on a small perfboard or proto-PCB.
2. Wire relay modules for Seal 6 and Seal 7.
3. Connect servo signal wires to designated ESP32 GPIOs; power servos from 5V bus.
4. Wire the Seal 7 relay's IN pin to the 5V rail (always energized while power is on).
5. Wire the power-sense voltage divider (12V → 10kΩ → sense point → 3.3kΩ → GND) to ESP32 GPIO35.

### Step 5: Connect Input Devices

1. Connect the 4x4 keypad's 8-pin ribbon to the designated ESP32 GPIOs.
2. Mount the I2C LCD and connect SDA→GPIO21, SCL→GPIO22, VCC→5V, GND.
3. (Optional) Connect rotary encoder to GPIOs if using for one seal.

### Step 6: Wire Feedback Devices

1. Mount NeoPixel LEDs at each seal position.
2. Connect NeoPixel data-in to ESP32 GPIO13 (via 330Ω resistor).
3. Power NeoPixels from 5V bus.
4. Mount and wire the buzzer to ESP32 GPIO12 (via 100Ω resistor).

### Step 7: Flash and Test the ESP32

1. Connect the ESP32 via USB to a computer.
2. Flash the firmware (Arduino IDE or PlatformIO).
3. Test each component individually:
   - Keypad: verify all 16 keys register correctly.
   - LCD: verify text displays.
   - NeoPixels: run a test pattern (all red → all green).
   - Buzzer: play a test tone.
   - Each lock: open and close via serial commands.
   - Power sense: read GPIO35 value with/without 12V.
4. Test WiFi connectivity (if using connected mode).

### Step 8: Load Compartments

1. Place clue items into each compartment (see Section 2.2 for the clue chain):
   - Seal 1: Blueprint fragment
   - Seal 2: USB stick / SD card
   - Seal 3: Cipher wheel / decoder ring
   - Seal 4: Radio frequency card
   - Seal 5: Access badge prop
   - Seal 6: Power cable hint / note
   - Seal 7: Bearer bonds (prop money or certificate)
2. Close all doors and verify each lock engages. Ensure clue items don't interfere with door closure or lock mechanisms.
3. Check that items are retrievable when the door opens — nothing should be wedged or stuck.

### Step 9: Integration Test

1. Run a full game sequence:
   - Enter correct codes for Seals 1–6 in order. Verify each lock opens and LEDs turn green.
   - Enter a wrong code. Verify "ACCESS DENIED" and wrong-count increment.
   - Enter 3 wrong codes. Verify game-over sequence.
   - Reset. Verify all seals re-lock.
   - Run again through Seals 1–6, then unplug barrel jack. Verify Seal 7 opens, victory sequence plays on backup power.
2. Test the REST API (if connected mode): call `/status`, `/open/3`, `/reset`, `/gameover`.
3. Time the backup power hold: confirm ESP32 stays alive at least 10 seconds after unplug.

---

## 11. Reset and Replay Procedure

### Facilitator Reset Checklist

1. **Plug main power back in** (if Seal 7 was triggered by unplugging).
2. **Issue reset command** via one of:
   - Keypad: hold `A` + `D` + `#` for 3 seconds.
   - REST API: `POST /reset` (connected mode).
   - Hardware: press the reset button on the ESP32 (last resort).
3. **Close all doors**: Push each door shut (starting from Seal 7 up to Seal 1). Replace any clue items that the previous team removed.
4. **Issue reset command** to re-engage locks:
   - Servos (1–2) rotate back to locked position → latch arms engage doors.
   - Solenoids (3–5) de-energize → bolts extend into strike plates.
   - Mag lock (6) re-energizes → holds armature plate on door.
   - Seal 7 relay re-energizes → holds spring latch.
5. **Verify each door is latched** — gently tug each one to confirm it holds.
6. **Verify LCD shows** `NAKATOMI VAULT / SEAL 1: ENTER CODE`.
7. **Verify all NeoPixels show dim red** (all locked).
8. **Verify wrong-code counter is 0**.
9. **Ready for next team.**

### Code Update (Between Sessions)

Seal codes are stored in firmware or in a config file on ESP32's LittleFS filesystem. To change codes between events:

- **LittleFS method**: Upload a new `codes.json` file via the web interface or serial.
- **Firmware method**: Edit `SEAL_CODES[]` array in firmware and re-flash.
- **REST API method**: `POST /config` with new codes (connected mode, if implemented).

---

## 12. Safety Notes

1. **All voltages are 12V DC or below.** No mains voltage anywhere in the build. The only mains-connected component is the 12V DC adapter, which is a sealed unit.
2. **Flyback diodes on every inductive load.** Solenoids and relays produce voltage spikes when de-energized. Every solenoid and relay coil must have a 1N4007 diode across its terminals (cathode to positive). Omitting this will destroy MOSFETs and the ESP32.
3. **Fused power supply.** A 2A inline fuse protects against short circuits. If a wire comes loose and shorts 12V to GND, the fuse blows instead of the adapter or wiring catching fire.
4. **Barrel jack for safe unplug.** The Seal 7 "unplug" action uses a standard DC barrel jack — low voltage, no spark risk, safe to handle.
5. **No exposed conductors.** All solder joints should be covered with heat-shrink tubing. Wire runs should be secured with zip ties and kept away from moving parts (servos, solenoid bolts).
6. **Servo and solenoid pinch hazard.** Label or shield any moving parts that could pinch fingers (servo latch arms, solenoid bolts).
7. **Magnetic lock strength.** If using a strong mag lock (60+ kg), warn users not to try to force it open. The lock releases cleanly when de-powered; forcing it can damage the mount.
8. **Battery safety.** If using a LiPo for backup (instead of 9V alkaline), use a proper charge board (TP4056) and do not short-circuit. A 9V alkaline battery is inherently safer and recommended.

---

## Appendix A — Component Datasheets and Libraries

### Arduino Libraries

| Library | Purpose | Install |
|---|---|---|
| `Keypad` | 4x4 matrix keypad scanning | Arduino Library Manager |
| `LiquidCrystal_I2C` | I2C LCD display | Arduino Library Manager |
| `FastLED` or `Adafruit_NeoPixel` | WS2812B LED control | Arduino Library Manager |
| `ESP32Servo` | Servo control on ESP32 | Arduino Library Manager |
| `ESPAsyncWebServer` + `AsyncTCP` | HTTP REST API server | GitHub / PlatformIO |
| `ArduinoJson` | JSON serialization for API | Arduino Library Manager |
| `LittleFS` | Filesystem for config/codes | Built into ESP32 Arduino core |

### Key Component Links

- **IRLZ44N datasheet**: Logic-level MOSFET, V_GS(th) = 1.0–2.0V (switches fully at 3.3V)
- **SG90 servo**: 4.8–6V, 180° rotation, ~1.8 kg·cm torque
- **JF-0530B solenoid**: 12V DC, push-pull, 10mm stroke
- **WS2812B**: 5V, 60mA per LED (full white), single data wire

---

## Appendix B — Enclosure Construction Notes

### Recommended: Nakatomi Tower with Compartment Doors

The primary design is a tall tower (~200mm × 700mm) with 7 hinged compartment doors, one per seal level. The front face resembles Nakatomi Plaza; each floor opens to reveal a clue compartment.

**Materials by build level**:

| Level | Material | Pros | Cons |
|---|---|---|---|
| Quick prototype | Foam board + hot glue | Fast, cheap, lightweight | Fragile, can't take repeated use |
| Standard build | 6mm MDF + wood glue | Sturdy, easy to cut/drill, paintable | Heavier, needs sealing/paint |
| Premium | 3mm acrylic (laser cut) | Precise, professional look, can be translucent | Requires laser cutter, more expensive |
| Mixed | MDF frame + acrylic doors | Doors look great, frame is sturdy | More complex assembly |

**Tips for door reliability**:

- Use **flush-mount piano hinges** so the door face sits level with the frame.
- Add a thin **felt strip** around each door opening to reduce rattle and provide a clean seal.
- If doors tend to stick, lightly sand the edges and apply a dry lubricant (wax or PTFE spray).
- For the spring-assist, **compressed foam blocks** (cut from packing foam) are the easiest option. Torsion springs give a snappier "pop" but require more precise mounting.

---

*Document version: First draft*
*Last updated: March 2025*
