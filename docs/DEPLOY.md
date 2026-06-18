# Deployment Guide

This document covers deploying `game.html` for live booth / classroom use with
the v2.4.0 telemetry features. **Read the entire Security Model section
before configuring HEC** — the wrong choice puts a Splunk write token
in front of every conference attendee.

`game.html` is a single, self-contained HTML file. By default it is **fully
offline and posts nothing to the network.** Telemetry only activates when
`window.NakatomiConfig` (or the `#nakatomi-config` JSON block) is present
with a `hecUrl`.

---

## 1. Three Ways To Run

| Mode | Telemetry | Use Case |
| --- | --- | --- |
| **Standalone HTML** | Off | Single player, no Splunk needed. Just open `game.html` in a browser. |
| **Same-origin proxy** _(recommended)_ | On | Booth / conference; HEC token never reaches the browser. |
| **Direct HEC** _(NOT recommended)_ | On | Internal trusted network only; explained below for completeness. |

The **standalone** mode requires no setup. The rest of this document
covers turning on telemetry.

---

## 2. Security Model (read before deploying)

The game writes to two Splunk endpoints when telemetry is enabled:

1. **HEC** at `index=nakatomi_sessions sourcetype=nakatomi:session:event`
   for the live event stream the facilitator dashboard reads.
2. **KV-Store** at `collection=vault_progress` for per-team progress
   snapshots used by the existing progress dashboard.

Both endpoints require an authentication token (HEC token or Splunk session
cookie). **That token must never reach the player's browser as a value the
player can read.**

### Trust model

| Threat | Risk if violated | Mitigation enforced by `game.html` |
| --- | --- | --- |
| HEC token in URL parameter | Token leaks via browser history, server access logs, Referer headers, screen-shares | URL params named `hecToken` or `token` are **rejected with a console warning** and never honored. |
| HEC token in inline `<script>` committed to git | Token in repo history forever, scrapeable from GitHub | Documented as the wrong pattern. The injected `<script>` must be added by the deployment server at request time and **never committed**. |
| Player console-runs `NakaTelemetry.debugInfo()` | Exposes token to anyone who can open DevTools | `debugInfo()` returns booleans (`hasHecToken: true/false`) **never the token itself**. The token lives only in the closure-scoped `hecToken` variable. |
| Cross-site script injection writes events as another team | Garbage in the dashboard | All payload string fields go through `safeId()` (allowlist `[A-Za-z0-9 _-.:]`, length-capped) before being serialized. Free-form `feedback`/`note` fields go through `safeText()` which strips control chars / CR / LF to defeat log injection. |
| Open redirect / data: URL as `hecUrl` | Token sent to attacker | `hecUrl` parser rejects `javascript:`, `data:`, `vbscript:`, `file:` schemes outright. |
| Telemetry abused as DoS sink | Quota burn / browser hang | Queue is capped at 500 events with oldest-first eviction; exponential backoff on POST failures; max 16 KB per HTTP request; sendBeacon fallback only when no token is needed. |

If any of those mitigations don't fit your environment, **do not enable
telemetry.** Run the standalone HTML mode and collect feedback another way.

---

## 3. Recommended: Same-Origin Reverse Proxy

This is the only deployment topology where the HEC token never enters
the player's browser at all.

```
┌─────────────────┐    fetch /proxy/hec/...      ┌───────────────────┐
│  game.html      │ ──────────────────────────►  │  reverse proxy    │
│  (browser)      │                              │  (nginx, Caddy,   │
│                 │ ◄──────────────────────────  │   Cloudflare,     │
│  hecToken = ''  │       2xx / 4xx              │   Splunk SSO LB)  │
└─────────────────┘                              └─────────┬─────────┘
                                                           │ injects
                                                           │ Authorization:
                                                           │ Splunk <token>
                                                           ▼
                                                ┌──────────────────┐
                                                │   HEC endpoint   │
                                                │  /services/      │
                                                │   collector/raw  │
                                                └──────────────────┘
```

The browser POSTs to `/proxy/hec/services/collector` on the same origin.
The proxy is the only thing that knows the real HEC token. The token is
loaded from a vault / KMS / environment file that lives only on the
proxy host.

### `nginx` example

```nginx
# Mount the proxy at the same origin as game.html.
# THIS BLOCK MUST BE BEHIND SSO / IP allow-list — it is a write endpoint.
location /proxy/hec/services/collector {
    # CSP from game.html only allows connect-src 'self', so this MUST be
    # served from the same origin as game.html itself.
    proxy_pass https://splunk.internal.example.com:8088/services/collector;

    # Inject the token from a file readable only by the nginx user.
    # Generate the token in Splunk: Settings → Data inputs → HTTP Event
    # Collector → New Token. Bind the token to ONLY indexes
    # 'nakatomi_sessions' (and 'main' for KV writes if needed). Disable
    # acknowledgments. Use a short-lived rotation schedule.
    proxy_set_header Authorization "Splunk $hec_token_from_disk";
    proxy_set_header Content-Type application/json;

    # Defense in depth: enforce method and reasonable size limits at the proxy.
    if ($request_method !~ ^POST$) { return 405; }
    client_max_body_size 32k;

    # Strip the player's Authorization header if any (paranoia).
    proxy_set_header Cookie "";
    proxy_pass_request_headers off;
    proxy_set_header Host splunk.internal.example.com;
    proxy_set_header Content-Length $content_length;

    proxy_ssl_verify on;
    proxy_ssl_protocols TLSv1.3 TLSv1.2;
}
```

Then inject the config block into `game.html` server-side, **without** a
token (the proxy supplies it):

```html
<!-- inserted by the SSO landing page or a Splunk app proxy_serve handler -->
<script id="nakatomi-config" type="application/json">
{
  "hecUrl": "/proxy/hec/services/collector",
  "kvUrl":  "/proxy/kv/storage/collections/data/vault_progress",
  "boothId": "conf26-booth-3",
  "scenario": "default"
}
</script>
```

`hecToken` is **not** present. The browser detects this, sets
`Authorization` to nothing, and lets the proxy inject the real value.
The status pill on the mode-select screen reports "Telemetry: same-origin
proxy → booth=conf26-booth-3" so the facilitator can confirm at a glance.

---

## 4. Direct HEC (NOT Recommended)

Use this only on a closed internal network where every player has the
same level of trust as a Splunk indexer admin (e.g., an SE workshop on
your private VLAN). Anyone with browser DevTools can read the token in
flight from the Network tab.

```html
<script>
  window.NakatomiConfig = {
    hecUrl: "https://splunk-hec.internal.example.com:8088/services/collector",
    hecToken: "INJECT_AT_REQUEST_TIME_FROM_VAULT",  // never commit
    boothId: "internal-workshop-1",
    scenario: "default"
  };
</script>
```

If you ship this pattern to production, also:

* Restrict the HEC token to **`nakatomi_sessions` only** (not `main`).
* Restrict the source IP allowlist on the HEC token to the workshop NAT.
* Set the token TTL to the duration of the workshop.
* Rotate the token when the event ends; revoke any test tokens.
* Add `connect-src https://splunk-hec.internal.example.com:8088` to the
  CSP `<meta>` tag (the shipped CSP is `connect-src 'self'`, which
  blocks direct HEC requests by design).

---

## 5. KV Store Writes (vault_progress)

The game also writes per-team progress snapshots to the existing
`vault_progress` KV-Store collection. Schema added in v2.4 (preserves
v2.3 fields):

| Field | Type | Notes |
| --- | --- | --- |
| `team_code` | string | 4-char team identifier (e.g. `KFRT`). |
| `team_name` | string | Optional human label, sanitized through `safeText()`. |
| `booth_id` | string | Operator-supplied booth identifier. |
| `scenario` | string | Scenario pack id (default `default`). |
| `mode` | string | `physical` or `digital`. |
| `completed_tasks` | number | Live counter. |
| `total_tasks` | number | Always 26 in v2.4. |
| `last_task_id` | string | Last completed task id. |
| `reason` | string | On loss: `mcclane`, `timer`, `trap`, `roof`. |
| `started_at` | time | Session start. |
| `finished_at` | time | Session end (win or loss). |
| `ts` | time | Last update. |

The KV endpoint is `POST /servicesNS/<owner>/<app>/storage/collections/data/vault_progress`.
Proxy it under the same `/proxy/kv/...` path used by HEC so the same
SSO + injection logic applies.

---

## 6. Per-Team / Booth URL Handoff (NON-secret URL params)

The following URL parameters are **explicitly safe** to put in a
print-out / QR code at the booth — they don't carry any secret:

* `?team=KFRT` — pre-fills the team code field.
* `?booth=conf26-3` — sets the booth identifier in HUD + telemetry.
* `?scenario=xmas` — selects a scenario pack.

Any URL containing `?hecToken=...` or `?token=...` is **rejected** with
a console warning and the token is not honored. This is enforced in
`NakaTelemetry.readUrlNonSecrets()`.

---

## 7. Data Retention & Privacy

* `nakatomi_sessions` index has `frozenTimePeriodInSecs = 7776000`
  (90 days) and `maxTotalDataSizeMB = 5120`. Tune in `indexes.conf`.
* `team_name` is the only player-supplied PII in the event stream.
  It is sanitized but not redacted. If your jurisdiction requires it,
  document a retention policy or strip the field at index time with
  a `props.conf` `SEDCMD-strip_team_name`.
* Telemetry is **opt-out** by setting
  `localStorage.nakatomi_telemetry_optout = '1'` (or calling
  `NakaTelemetry.setOptOut(true)` from DevTools). When opted out, the
  game continues to function locally with no network activity.

### 7.1. KV-Store retention (30-day target)

Splunk does not auto-expire KV-Store records the way it auto-freezes
indexed events. The `vault_progress` collection grows unbounded
unless you prune it. For a 30-day window, schedule the following
saved search to run nightly (set `dispatch.earliest_time = -1d`):

```spl
| inputlookup vault_progress
| where _time < relative_time(now(), "-30d@d")
| outputlookup vault_progress
```

This is a destructive search; review the rows it would delete with
the same query minus `outputlookup` before scheduling.

### 7.2. GDPR / DSAR scripts (v2.15)

Two helper scripts ship with the app for ad-hoc data subject access
requests against `nakatomi_sessions` + `vault_progress`:

```bash
# Export every record matching a team_code or session_id.
SPLUNK_HOST=https://splunk.example.com:8089 \
SPLUNK_TOKEN=$(cat ~/.nakatomi/dsar.token) \
bash scripts/export_sessions.sh --team-code NAKA --output naka.json

# Right-to-erasure: delete the same set. Requires --confirm.
SPLUNK_HOST=https://splunk.example.com:8089 \
SPLUNK_TOKEN=$(cat ~/.nakatomi/dsar.token) \
bash scripts/purge_sessions.sh --team-code NAKA --confirm yes-i-mean-it
```

**Token requirements** — both scripts require a token bound to a
dedicated `nakatomi_dsar` role (per
[`codeguard-0-data-storage`](.cursor/rules/codeguard-0-data-storage)
least-privilege guidance):

| Capability | Need | Used by |
| --- | --- | --- |
| `search` + `read` on `nakatomi_sessions` | Both | export, purge |
| `read/write` on `vault_progress` collection | Both | export, purge |
| `can_delete` on the search head | **purge only** | purge |
| Read-only on every other index | Yes (defense-in-depth) | both |

Do **not** reuse the booth-display token (which has read-only access
to non-PII indexes only) — DSAR scripts need elevated capabilities
that the booth role explicitly does not have.

The scripts:

- Reject any filter value containing characters outside `[A-Za-z0-9._-]`
  (defends against SPL injection per
  [`codeguard-0-input-validation-injection`](.cursor/rules/codeguard-0-input-validation-injection)).
- Pass auth via `Authorization: Bearer` headers, never URL params
  (per [`codeguard-0-authentication-mfa`](.cursor/rules/codeguard-0-authentication-mfa)).
- Write export output with `umask 077` so a JSON sitting on a
  shared host doesn't leak by default.
- Audit-log every purge with a SHA-256 hash of the filter (not the
  raw team_code) to `/var/log/nakatomi/purge.log` when present, or
  stdout otherwise. The purge audit retains who did what without
  storing the original identifier.

---

## 8. Verifying the Deployment

1. Open `game.html` from the deployment URL.
2. The mode-select screen should display a green pill:
   `Telemetry: same-origin proxy → booth=<your-booth-id>`.
3. Open DevTools → Network → filter on `collector`. You should see
   POST requests to your proxy path returning `200 OK`.
4. In Splunk, run:
   ```spl
   index=nakatomi_sessions sourcetype=nakatomi:session:event
   | head 5
   ```
   You should see the most recent `session_start` / `heartbeat` events.
5. Open the facilitator board — active teams should appear with their
   team_code labels.
6. Toggle airplane mode mid-session: the status pill flips to
   `Telemetry queued (N) — HEC unreachable, retrying.`. Re-enable
   network and the queue drains within ~15 s.
7. From DevTools, run `NakaTelemetry.debugInfo()`. The output **must
   not contain the token value** — only `hasHecToken: true/false`.

If any of these checks fail, do not run a public booth session until
they all pass.
