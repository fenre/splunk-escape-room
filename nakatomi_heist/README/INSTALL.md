# Install Nakatomi Heist without host CLI access

This package targets a self-managed Splunk Enterprise instance. It contains the
application, indexes, complete synthetic puzzle dataset, parsing configuration,
lookups, dashboards, and compiled UI assets. It does not require HTTP Event
Collector (HEC), a token, Python, or shell access on the Splunk server.

The puzzle events use December 1988 timestamps. Always select **All time** when
searching them.

## Before installation

You need:

- a Splunk Enterprise administrator account;
- permission to install apps and restart Splunk from Splunk Web;
- the release files `nakatomi_heist-2.17.1.spl` and `SHA256SUMS`;
- a new or clean Splunk instance for the most predictable first load.

The `.spl` contains no password, token, certificate, license key, or Splunk
terms acceptance.

## 1. Verify the download

Compare the SHA-256 of the `.spl` with the value in `SHA256SUMS`. On macOS this
can be done in Terminal with:

```bash
shasum -a 256 nakatomi_heist-2.17.1.spl
```

On Windows PowerShell:

```powershell
Get-FileHash .\nakatomi_heist-2.17.1.spl -Algorithm SHA256
```

This command runs on your own computer, not on the Splunk server.

## 2. Install through Splunk Web

1. Sign in to Splunk Web as an administrator.
2. Open **Apps → Manage apps**.
3. Select **Install app from file**.
4. Choose `nakatomi_heist-2.17.1.spl`.
5. If this is an upgrade, enable the option to replace the existing app.
6. Select **Upload**.
7. If Splunk requests a restart, accept it. Otherwise open
   **Settings → Server controls → Restart Splunk**.
8. Wait for Splunk Web to return, then sign in again.

No Splunk CLI command is needed.

## 3. Verify the app and indexes

Open the app picker and confirm **Nakatomi Heist** is listed.

Open **Settings → Indexes** and confirm these indexes exist:

- `nakatomi_access`
- `nakatomi_vault`
- `nakatomi_building`
- `nakatomi_comms`
- `nakatomi_sessions`

The first four contain static puzzle data. `nakatomi_sessions` is reserved for
optional live Event Mode telemetry and is normally empty in this deployment.

## 4. Verify the static dataset

Open **Search & Reporting**, set the time picker to **All time**, and run:

```spl
index=nakatomi_access OR index=nakatomi_vault OR index=nakatomi_building OR index=nakatomi_comms
| stats count BY index, sourcetype
| sort index, sourcetype
```

Results should appear for all four puzzle indexes. The exact expected counts
are recorded in `README/seed-data-manifest.json` inside the `.spl` release.

If no events appear:

1. confirm the time picker says **All time**;
2. wait two minutes and search again because the one-shot inputs may still be
   indexing;
3. confirm all four indexes exist;
4. check **Settings → Data inputs → Files & directories** for enabled
   `nakatomi_heist/data/seed_*.log` batch inputs;
5. ask the Splunk administrator to review internal indexing messages for
   `nakatomi_heist`.

The package intentionally uses `move_policy = sinkhole`: each seed file is
removed after Splunk ingests it. This prevents duplicate events after restarts.

## 5. Start the game

1. In Splunk, open **Nakatomi Heist → Mission Brief**.
2. Keep the Splunk time picker on **All time**.
3. Open the project’s GitHub Pages URL in a separate browser tab or player
   device.
4. Select a difficulty and use Splunk searches to discover answers.
5. Enter the answers on the GitHub Pages game board.

GitHub Pages is static and credential-free. Its leaderboard is local to each
browser. The shared Facilitator Board in Splunk remains empty unless a trusted
Event Mode telemetry service is configured separately.

## Upgrade and replay behavior

Installing a newer app package updates dashboards, parsing, and other app
content. It does not guarantee that Splunk will ingest the same seed paths
again because Splunk remembers previously processed batch inputs.

For a fresh race using the same static dataset, retain the indexed puzzle data;
the game board can be reset independently in the browser.

For a completely clean replay, use a clean Splunk instance or have an
administrator remove the four puzzle indexes and the existing app through
approved Splunk Enterprise administration procedures before reinstalling. Do
not delete production indexes that contain unrelated data.

## Security notes

- Do not add an HEC token to the GitHub Pages files or browser URL.
- Do not expose administrator credentials to players.
- Keep the Facilitator Board restricted to administrators.
- Use the existing Splunk deployment’s TLS, authentication, backup, and access
  policies; this app does not replace them.
