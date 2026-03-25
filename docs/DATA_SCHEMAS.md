# Nakatomi Plaza: Vault Heist — Data Schemas

**Sourcetypes, indexes, field definitions, sample events, and lookup tables.**

This document specifies every piece of data that exists in the Splunk environment during gameplay. The [data generator](../generator/generate.py) uses these schemas to produce the dataset; the [puzzle catalogue](STORY_AND_MYSTERIES.md) references them for each seal's solution path.

---

## 1. Indexes

| Index | Purpose | Sourcetypes | Approx. event count |
|-------|---------|-------------|---------------------|
| `nakatomi_access` | Badge swipes, door events, physical access control | `nakatomi:access:badge`, `nakatomi:access:door` | ~600 |
| `nakatomi_vault` | Vault terminal sessions, code attempts, vault system logs | `nakatomi:vault:attempt`, `nakatomi:vault:system` | ~150 |
| `nakatomi_building` | HVAC, elevator, power, fire suppression, security radio intercepts | `nakatomi:building:hvac`, `nakatomi:building:security` | ~500 |

Total: ~1,250 events. Enough to create a realistic haystack without overwhelming search performance.

---

## 2. Timeline

All events occur on **2025-12-24** (Christmas Eve). The timeline mirrors the Die Hard film:

| Time Window | Phase | What's Happening |
|-------------|-------|------------------|
| 18:00–20:00 | Normal operations | Christmas party setup, early guests arrive, normal badge traffic |
| 20:00–22:00 | Party in full swing | Heavy badge activity on floor 30, catering, elevator traffic |
| 22:00–22:10 | **Takeover** | Lobby seized, floors locked down, security overridden |
| 22:10–22:20 | Hostage consolidation | Hostages moved to floor 30, building secured |
| 22:20–22:30 | Takagi confrontation | Vault access attempts from Takagi's terminal |
| 22:30–23:00 | Vault work begins | Hans's team working the vault, McClane active |
| 23:00–23:15 | FBI arrives | Radio traffic on security channels, perimeter established |
| 23:15–23:30 | Power grid operations | FBI orders power cut, building systems respond |
| 23:30–00:00 | Roof / endgame | C4 activity, final confrontation, vault protocol 7 |

---

## 3. Sourcetype Definitions

### 3.1 `nakatomi:access:badge`

Badge swipe events from the building's access control system. Every badge tap at a reader generates one event.

**Index**: `nakatomi_access`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time (ISO 8601) | `2025-12-24T20:15:33.000-0800` |
| `badge_id` | string | Employee or visitor badge identifier | `NP-4472`, `HG-1988`, `MAINT-007` |
| `name` | string | Badge holder name | `Naomi Park`, `Hans Gruber` |
| `department` | string | Department or affiliation | `Vault Operations`, `external` |
| `floor` | integer or string | Floor number or label | `1`, `30`, `roof` |
| `room` | string | Room name | `Security Office`, `Conference Room B` |
| `action` | string | Type of access event | `swipe`, `override`, `attempt` |
| `outcome` | string | Result | `allow`, `deny`, `override`, `timeout` |
| `detail` | string | Additional context (optional) | Free-text; seal codes are embedded here |

**`_raw` format** (key=value pairs, one event per line):

```
2025-12-24T20:15:33.000-0800 badge_id=NP-4472 name="Naomi Park"
  department="Vault Operations" floor=30 room="Main Hall"
  action=swipe outcome=allow detail="regular access"
```

**Event distribution**:
- ~200 events during party hours (18:00–22:00): normal swipes, guests, catering, security rounds.
- ~80 events during takeover (22:00–22:30): forced entries, overrides, denied attempts.
- ~40 events post-takeover (22:30–00:00): hostage movement, crew access.

**Puzzle-critical events** (Seal 1 and Seal 2):
- Seal 1: One `action=override` event on floor 1, Security Office, at 22:02 with `detail` containing `access_code=2512`.
- Seal 2: One event on floor 30, Conference Room B, at 19:45 with `detail` containing `vault maintenance cycle 7439`.

---

### 3.2 `nakatomi:access:door`

Door state change events from the building management system.

**Index**: `nakatomi_access`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | `2025-12-24T22:03:16.000-0800` |
| `door_id` | string | Door identifier | `D1-SEC-01`, `D30-CONF-B` |
| `floor` | integer or string | Floor number | `1`, `30` |
| `room` | string | Room | `Security Office` |
| `state` | string | Door state | `open`, `closed`, `locked`, `unlocked`, `forced` |
| `method` | string | How the state changed | `badge`, `manual`, `remote`, `forced`, `auto` |

**`_raw` format**:

```
2025-12-24T22:03:16.000-0800 door_id=D1-SEC-01 floor=1
  room="Security Office" state=open method=badge
```

**Event distribution**: ~200 events. Doors open/close throughout the evening. Post-takeover, several `method=forced` events appear.

---

### 3.3 `nakatomi:vault:attempt`

Vault terminal session events. Each interaction with the vault system generates a session with begin/attempt/end events.

**Index**: `nakatomi_vault`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | `2025-12-24T22:21:15.000-0800` |
| `session_id` | string | Vault session identifier | `VS-0042`, `VS-0001` |
| `user` | string | Terminal user | `takagi`, `hans`, `ellis`, `system` |
| `action` | string | Session event type | `session_begin`, `code_attempt`, `session_end`, `system_check` |
| `detail` | string | Event-specific data | `input=4`, `maintenance_complete`, `abort_reason=timeout` |
| `result` | string | Outcome | `success`, `fail`, `abort`, `pending`, `nominal` |

**`_raw` format**:

```
2025-12-24T22:21:15.000-0800 session_id=VS-0042 user=takagi
  action=code_attempt detail="input=4" result=fail
```

**Event distribution**: ~100 events across ~45 sessions. Most sessions are automated system checks (1–2 events each). A few are human-initiated sessions with code attempts.

**Puzzle-critical events** (Seal 3):
Session VS-0042 contains:
```
22:20:28  session_id=VS-0042 user=takagi action=session_begin detail="terminal_auth=biometric" result=pending
22:21:15  session_id=VS-0042 user=takagi action=code_attempt detail="input=4" result=fail
22:22:03  session_id=VS-0042 user=takagi action=code_attempt detail="input=2" result=fail
22:23:18  session_id=VS-0042 user=takagi action=code_attempt detail="input=9" result=fail
22:24:02  session_id=VS-0042 user=takagi action=code_attempt detail="input=1" result=fail
22:24:22  session_id=VS-0042 user=takagi action=session_end detail="max_attempts_exceeded" result=abort
```

---

### 3.4 `nakatomi:vault:system`

Vault infrastructure events — system status, protocol documentation, maintenance logs.

**Index**: `nakatomi_vault`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | `2025-12-24T14:30:00.000-0800` |
| `system` | string | Subsystem | `vault_protocol`, `vault_monitor`, `vault_power` |
| `event` | string | Event category | `documentation`, `status`, `alert` |
| `action` | string | What happened | `system_note`, `heartbeat`, `power_check` |
| `message` | string | Free-text message | Vault protocol documentation, status messages |

**`_raw` format**:

```
2025-12-24T14:30:00.000-0800 system=vault_protocol
  event=documentation action=system_note
  message="VAULT PROTOCOL 7: Secondary release —
  electromagnetic failsafe. Final lock disengages on power loss.
  Not accessible via terminal. See facilities manual ref VP-7."
```

**Event distribution**: ~50 events. Periodic heartbeats, status checks, and a few documentation/note entries loaded from the vault's configuration database.

**Puzzle-critical events** (Seal 7, optional hint):
One `vault_protocol` documentation event at 14:30 mentions the electromagnetic failsafe and power-loss release.

---

### 3.5 `nakatomi:building:hvac`

Building management system telemetry — temperature, pressure, humidity, elevator, power, fire suppression.

**Index**: `nakatomi_building`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | `2025-12-24T23:12:00.000-0800` |
| `system` | string | Building subsystem | `hvac`, `elevator`, `power`, `fire` |
| `event` | string | Event type | `temp_reading`, `car_call`, `grid_status`, `alarm_test` |
| `floor` | integer or string | Floor | `roof`, `30`, `1` |
| `zone` | string | Building zone | `mechanical`, `east_wing`, `lobby` |
| `value` | number | Sensor reading | `72.4`, `115.2`, `0` |
| `unit` | string | Measurement unit | `F`, `PSI`, `kW`, `RPM` |
| `encoded_message` | string | Optional encoded text | ROT13-encoded strings (Seal 4 puzzle) |

**`_raw` format**:

```
2025-12-24T23:12:00.000-0800 system=hvac event=temp_reading
  floor=roof zone=mechanical value=98.7 unit=F
  encoded_message="GURER VF AB CBJRE JVGUBHG PBQR 8086"
```

**Event distribution**: ~350 events. Temperature readings every 5 minutes per zone (normal range 68–74°F), elevator calls, power grid status, fire system checks.

**Puzzle-critical events** (Seal 4):
One HVAC event on the roof at 23:12 with `value=98.7` (anomalous — 26°F above normal) and `encoded_message` containing the ROT13-encoded code 8086.

**Red herring encoded messages** (decode to mundane text):
- `"UHZVQVGL PNYVOENGVBA PBZCYRGR"` → "HUMIDITY CALIBRATION COMPLETE"
- `"SVYGRE ERCYNPRQ MBAR 4"` → "FILTER REPLACED ZONE 4"
- `"NAAHNY VAFCRPGVBA QHR 2026-01-15"` → "ANNUAL INSPECTION DUE 2026-01-15"

---

### 3.6 `nakatomi:building:security`

Building security system events — alarms, camera alerts, radio intercepts, perimeter status.

**Index**: `nakatomi_building`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | `2025-12-24T23:18:45.000-0800` |
| `system` | string | Security subsystem | `security`, `radio`, `camera`, `alarm` |
| `event_type` | string | Event category | `radio_intercept`, `alarm_trigger`, `camera_motion` |
| `floor` | integer or string | Floor (if applicable) | `0` (exterior), `1`, `30` |
| `zone` | string | Security zone | `exterior`, `perimeter`, `north_entrance` |
| `channel` | string | Radio channel (for intercepts) | `freq_14`, `freq_12`, `freq_16` |
| `severity` | string | Alert level | `info`, `low`, `medium`, `high`, `critical` |
| `message` | string | Free-text event description | Unstructured radio transcript or alarm text |

**`_raw` format**:

```
2025-12-24T23:18:45.000-0800 system=radio event_type=radio_intercept
  floor=0 zone=exterior channel=freq_14 severity=high
  message="FBI FIELD CMD // GRID-SEC-7 // AUTH:5765
  // PRIORITY:IMMEDIATE // CONFIRM POWER DISCONNECT"
```

**Event distribution**: ~150 events. Alarm checks, camera motion triggers, radio intercepts (multiple channels).

**Puzzle-critical events** (Seal 5):
One radio intercept on `channel=freq_14` at 23:18 with `AUTH:5765` in the message.

**Red herring radio traffic**:

| Channel | Message excerpt | AUTH code | Purpose |
|---------|----------------|-----------|---------|
| freq_12 | `"LAPD TAC-3 // AUTH:9901 // SWAT STAGING CONFIRMED"` | 9901 | Wrong channel (LAPD, not FBI) |
| freq_14 | `"FBI FIELD CMD // ALL UNITS HOLD POSITION"` | none | Same channel, no AUTH code |
| freq_14 | `"FBI FIELD CMD // REF:5765-A // ACKNOWLEDGE"` | none (REF, not AUTH) | Cross-reference, not authorization |
| freq_16 | `"LAFD COMMAND // AUTH:3388 // HAZMAT STANDBY"` | 3388 | Wrong channel (fire dept) |
| freq_14 | `"FBI FIELD CMD // HELICOPTER ETA 10 MINUTES"` | none | Noise on correct channel |

---

### 3.7 `nakatomi:vault:physical` (ESP32 HEC events)

Real-time events from the physical vault model, sent via HTTP Event Collector during gameplay. These are **not** generated by the Python script — they come from the ESP32 firmware.

**Index**: `nakatomi_vault`

**Fields**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_time` | timestamp | Event time | auto (HEC receipt time) |
| `action` | string | What happened | `seal_open`, `wrong_code`, `game_start`, `game_over`, `reset`, `power_loss` |
| `seal` | integer | Seal number (1–7) | `3` |
| `method` | string | How it was triggered | `code`, `remote`, `power_loss` |
| `code` | string | Code entered (if applicable) | `4291`, `0000` |
| `elapsed_seconds` | integer | Seconds since game start | `1842` |

**HEC payload format** (from ESP32):

```json
{
  "event": {
    "action": "seal_open",
    "seal": 3,
    "method": "code",
    "code": "4291",
    "elapsed_seconds": 1842
  },
  "sourcetype": "nakatomi_vault_physical",
  "index": "nakatomi_vault"
}
```

---

## 4. Lookup Tables

### 4.1 `floor_directory.csv`

Maps floor numbers to names, tenants, and access restrictions.

| floor | floor_name | tenant | floor_group | restricted |
|-------|-----------|--------|-------------|------------|
| B2 | Parking Level 2 | Building Services | basement | false |
| B1 | Vault Level | Nakatomi Trading | basement | true |
| 1 | Main Lobby | Building Management | lobby | false |
| 2 | Mail Room / Loading | Building Services | lower | false |
| 3 | Building Maintenance | Facilities | lower | false |
| 5 | Legal / Compliance | Nakatomi Legal | lower | false |
| 10 | Human Resources | Nakatomi HR | mid | false |
| 15 | International Trade | Nakatomi Trading | mid | false |
| 20 | Finance | Nakatomi Finance | upper | false |
| 25 | R&D / Tech | Nakatomi Tech | upper | true |
| 28 | Executive Support | Nakatomi Exec | upper | true |
| 30 | Executive Suite / Event | Nakatomi Executive | upper | true |
| 35 | CEO / Board | Nakatomi Board | penthouse | true |
| roof | Mechanical / Helipad | Facilities | roof | true |

### 4.2 `employee_directory.csv`

Employee badge registry. ~50 entries. Key rows for the puzzles:

| badge_id | name | department | clearance_level | status | hire_date |
|----------|------|-----------|----------------|--------|-----------|
| NP-4472 | Naomi Park | Vault Operations | LEVEL-5 | active | 2019-03-15 |
| NP-4471 | Robert Chen | IT Operations | LEVEL-3 | active | 2020-06-01 |
| JT-0001 | Joseph Takagi | CEO | LEVEL-6 | terminated | 2018-01-10 |
| HE-3301 | Harry Ellis | International Trade | LEVEL-2 | active | 2021-09-20 |
| HG-1988 | Hans Gruber | External Contractor | EXTERNAL | active | 2025-12-24 |
| KA-2205 | Karl Vreski | External Contractor | EXTERNAL | active | 2025-12-24 |
| AG-0077 | Argyle | Building Services | LEVEL-1 | active | 2024-11-01 |
| HP-1015 | Holly Gennaro | International Trade | LEVEL-4 | active | 2017-05-22 |
| MAINT-007 | Eduardo Vasquez | Facilities | LEVEL-2 | active | 2016-08-14 |
| SE-0012 | James Marsh | Security | LEVEL-3 | active | 2020-02-28 |
| ... | *(~40 more employees)* | *(various)* | *(LEVEL-1 to LEVEL-4)* | active | *(various)* |

### 4.3 `system_codes.csv`

System authorization codes mapped to clearance levels.

| system_id | description | clearance_level | vault_auth_code | location |
|-----------|-------------|----------------|-----------------|----------|
| SYS-ELEV | Elevator Override | LEVEL-2 | — | All floors |
| SYS-HVAC | HVAC Master Control | LEVEL-3 | — | Mechanical |
| SYS-FIRE | Fire Suppression Override | LEVEL-4 | 2817 | All floors |
| SYS-VAULT | Vault Primary Authorization | LEVEL-5 | 3940 | B1 |
| SYS-EXEC | Executive Override | LEVEL-6 | 6102 | Floor 35 |
| SYS-MAIN | Building Master | LEVEL-1 | — | Lobby |

---

## 5. Splunk Configuration

### 5.1 `props.conf` (field extraction)

All sourcetypes use key=value format, which Splunk's `KV_MODE=auto` handles natively. Minimal props.conf needed:

```ini
[nakatomi:access:badge]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi:access:door]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi:vault:attempt]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi:vault:system]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi:building:hvac]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi:building:security]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 32
KV_MODE = auto
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\r\n]+)

[nakatomi_vault_physical]
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
KV_MODE = json
SHOULD_LINEMERGE = false
```

### 5.2 `transforms.conf` (lookup definitions)

```ini
[floor_directory]
filename = floor_directory.csv
case_sensitive_match = false

[employee_directory]
filename = employee_directory.csv
case_sensitive_match = false

[system_codes]
filename = system_codes.csv
case_sensitive_match = false
```

### 5.3 `indexes.conf`

```ini
[nakatomi_access]
homePath = $SPLUNK_DB/nakatomi_access/db
coldPath = $SPLUNK_DB/nakatomi_access/colddb
thawedPath = $SPLUNK_DB/nakatomi_access/thaweddb

[nakatomi_vault]
homePath = $SPLUNK_DB/nakatomi_vault/db
coldPath = $SPLUNK_DB/nakatomi_vault/colddb
thawedPath = $SPLUNK_DB/nakatomi_vault/thaweddb

[nakatomi_building]
homePath = $SPLUNK_DB/nakatomi_building/db
coldPath = $SPLUNK_DB/nakatomi_building/colddb
thawedPath = $SPLUNK_DB/nakatomi_building/thaweddb
```

---

## 6. Data Integrity Rules

These rules ensure the puzzles are solvable and unambiguous:

1. **Each seal code appears exactly once** in the dataset, in the field and format specified in the puzzle catalogue.
2. **No red herring matches the real code** in the same field. Close matches (wrong channel, wrong badge, wrong session) are designed to be eliminable.
3. **All events have valid timestamps** within the 18:00–00:00 window (or 14:00 for the vault protocol documentation).
4. **`KV_MODE=auto` extracts all fields correctly** from the `_raw` format. No manual field extraction setup is required by the player.
5. **Lookup tables are pre-loaded** in the Splunk app before the game starts. Players use `inputlookup` and `lookup` commands — they do not need to upload files.
6. **The dataset is deterministic** — the same generator seed always produces the same events with the same codes. Changing the seed in `scenario.yaml` produces a different dataset (different codes, different character names in noise events, different timestamps for noise) while preserving the puzzle structure.

---

*Document version: First draft*
*Last updated: March 2025*
