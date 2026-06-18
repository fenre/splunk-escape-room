# Scenario Packs (v2.16+)

The v2.16 game.html ships a runtime overlay system that lets the same 26-task heist replay against a different *story-beat* surface — narrative re-skins on top of the canonical Christmas-noir scenario. Three packs ship with the app:

| `?scenario=<name>` | Tone | What changes |
| --- | --- | --- |
| **`default`** *(default)* | Christmas-noir 1988 | Canonical Hans-Gruber heist. The default pack ships as a no-op overlay for round-trip safety; the inline content in `game.html` is what plays |
| **`roof`** | Windy / exposed | Rooftop edition — the heist runs from the helipad, ambient swaps to wind + helicopter drone, intercepts swap to Karl/Theo rooftop chatter |
| **`afterparty`** | Forensic debrief | After-party / morning-after edition — you're McClane reconstructing the heist from the logs the next morning, ambient swaps to distant 80s radio chatter |

The pack is a small JSON file (≤ 64 KB) at `scenarios/<name>.json`. Every value is fed through length caps + control-char strip + key-format validation before reaching the runtime, so a hostile pack can't inject markup, escape the allow-list, or DOM-XSS through a story beat.

**Tasks, codes, indices, sourcetypes, and the data layout are NOT overridable in v2.16.** The pack is pure narrative re-skinning. The full extraction of ACTS/tasks to JSON is a v3.0-capstone job.

---

## How to load a pack

### Option A — URL parameter (booth + handout)

```
https://your-deploy/game.html?scenario=roof
```

The URL parameter is matched against the in-code allow-list (`default | roof | afterparty`). Anything else silently falls back to `default` — there is no error message, no console warning, no fetch attempt. This is intentional: URL params are untrusted input, and the project's security model never lets one drive a fetch off the allow-list.

### Option B — Inline JSON (same-origin proxy)

Same convention as `NakatomiConfig` and `nakatomi-i18n`:

```html
<script id="nakatomi-scenario" type="application/json">
{
  "$schema_version": 2,
  "$id": "roof",
  "ambient": { "label": "Roof wind", "description": "..." },
  "story_beats": { "act_1_open": "...", "act_5_intro": "..." },
  "intercepts": { "lobby_alarm_replacement": "..." },
  "endings":    { "default_intro_override": "..." }
}
</script>
```

Inject server-side before sending `game.html` to the browser. The runtime reads the inline block first; the URL-param fetch is the fallback. This is the booth-friendly deploy pattern — zero extra round-trips, works under the kiosk's locked-down CSP, file:// safe.

---

## Schema v2 reference

All packs MUST set `$schema_version: 2` and `$id` to one of the allow-listed pack names. Any other top-level keys are silently dropped.

```typescript
{
  "$schema_version": 2,
  "$id": "default" | "roof" | "afterparty",
  "$description"?: string,                       // human-readable, ignored by runtime
  "metadata"?: {
    "name"?: string,                              // human display name
    "tone"?: string,                              // editorial tag
    "duration_minutes"?: number,
    "version"?: string,                           // pack version (semver-ish)
    "author"?: string
  },
  "ambient"?: {
    "label"?: string,                             // shown in the audio mix readout
    "description"?: string                        // editor note, ignored by runtime
  },
  "story_beats"?: {
    [key: string]: string                         // key matches /^[a-zA-Z0-9_]{1,40}$/
  },
  "intercepts"?: {
    [key: string]: string                         // same key shape as story_beats
  },
  "endings"?: {
    [key: string]: string                         // key matches /^[a-zA-Z_]{1,32}$/
  }
}
```

### Reserved keys

The runtime currently consumes these keys; everything else is preserved for future use but won't render:

| Section | Key | Used at |
| --- | --- | --- |
| `story_beats` | `act_1_open`, `act_5_intro` | Mission-briefing card / Act 5 transition |
| `intercepts` | `lobby_alarm_replacement` | Replaces the canonical lobby intercept when present |
| `endings` | `default_intro_override` | Replaces the default-ending narrative paragraph |

Adding a new override slot involves: (a) authoring the override in the pack, (b) calling `ScenarioPacks.getStoryBeat('your_key')` from the matching render path, (c) updating this table.

---

## Security model

**No DOM injection from packs.** Every override is rendered through `escHTML()` (or `_esc()` inside Endings) at the consuming call site. Treat pack content as untrusted input, even from your own packs.

**Allow-list bounds.** Pack `$id` MUST match the in-code allow-list. The fetch URL is fixed-shape `scenarios/<allowlisted>.json` — no path traversal, no scheme override, no query-string smuggling. The fetch sets `credentials: 'omit'` so cookies and auth headers don't leak across origins.

**Size caps.** A pack body is rejected if it's > 64 KB. Each string field is capped at 2048 bytes. The cap is enforced both at parse time AND on the response stream (`content-length` check pre-`text()` read).

**Prototype-pollution defense.** Keys named `__proto__`, `constructor`, or `prototype` are silently dropped during validation, in addition to the regex-based key allow-list.

**file:// fallback.** When `game.html` is opened directly (no web server), `fetch()` to `scenarios/...` may fail or be blocked by browser CORS rules. The runtime detects `location.protocol === 'file:'` and skips the fetch entirely. Use the inline `<script id="nakatomi-scenario">` block when shipping a pack alongside an offline copy of the game.

**Audit trail.** A successful pack load fires an `a11yAnnounce()` (`"Scenario loaded: <ambient label>"`) for screen readers. There is no `scenario_loaded` telemetry event in v2.16; if you need it, allow-list it in `EVENT_TYPES` first.

---

## Authoring a new pack

1. **Pick a name.** Add it to `ALLOWED` inside the `ScenarioPacks` IIFE in `game.html`. Without that line, the pack is unreachable.
2. **Write the pack** at `scenarios/<name>.json`, following the schema above. Start by copying `scenarios/default.json` and editing the values you want overridden.
3. **Verify locally** — `bash scripts/test.sh` runs the scenario-pack regression which validates the on-disk JSON against `_validate()`. A pack that fails validation is silently ignored at runtime, so this test is your only signal until live integration.
4. **Add a row** to the table at the top of this file.
5. **Smoke-test** — open `game.html?scenario=<name>` and walk Act 1 + the victory overlay. Story beats and intercepts should reflect the override. Confirm there's NO console error, NO network 404 (other than for the canonical `default` skip), NO unsanitized HTML in the DOM.

---

## i18n (v2.16+)

Companion to scenario packs is the lightweight `I18n` module. It loads a translations table from `i18n/<lang>.json` (allow-listed: `en | es | de | ja`) and exposes `I18n.t(key, fallback)`. The DEFAULTS table inside the module covers the most-visible ~30 UI strings (mode-select, HUD, pause menu, victory overlay, game-over). Bulk inline strings stay in `game.html` until the v3.0 capstone refactor extracts every string to keys.

URL: `?lang=es` switches to Spanish; unknown values fall back to `en` with no fetch.

The same security model applies — fixed-shape URL, size cap (32 KB), key allow-list (`/^[a-zA-Z0-9_.]{1,80}$/`), control-char strip, prototype-pollution defense.
