# Static Splunk Package and GitHub Pages

## Goal

Produce one finished `nakatomi_heist.spl` for a self-managed Splunk Enterprise
instance where the operator has Splunk Web administrator access but no host
shell access. The operator installs the package through **Manage Apps**, restarts
Splunk, selects **All time**, and can immediately use the complete escape-room
content.

GitHub Pages hosts the player-facing game board. The board remains a static,
credential-free client: players transfer answers found in Splunk to the board
manually.

## Deployment Boundary

### Splunk Enterprise

The `.spl` package owns everything that can run safely and statically in
Splunk:

- five `nakatomi_*` indexes and the extended retention window needed for
  December 1988 events;
- complete pre-generated puzzle events for every generated sourcetype;
- parsing configuration, lookups, saved searches, dashboards, navigation,
  permissions, and KV Store definitions;
- compiled React page and custom-visualization assets;
- app documentation and an installation/verification guide.

The package uses one-shot `batch://` inputs for its seed files. Splunk ingests
the files after installation and removes them through `move_policy = sinkhole`.
No HEC token, setup form, generator, scripted input, external service, or
Splunk-host CLI is required.

### GitHub Pages

Pages publishes:

- `game.html`;
- the landing page and visual assets;
- scenario packs;
- translation packs.

The Pages deployment does not contain credentials and does not call Splunk.
The browser-local leaderboard works per device. A shared public scoreboard and
live facilitator telemetry are not part of this static deployment because they
require an authenticated runtime write/read service.

## Dataset Build

The build runs `generator/generate.py` on a trusted build machine and converts
the four canonical newline-delimited HEC outputs into raw log shards grouped by
their actual `(index, sourcetype)` pair.

Each emitted shard has:

- a deterministic, filesystem-safe filename;
- a matching `batch://` stanza;
- the intended `nakatomi_*` index;
- the exact generated sourcetype;
- a stable host and one-shot sinkhole policy.

The conversion must include all canonical events, including the intranet,
intercept, lore, side-story, red-herring, and easter-egg sourcetypes currently
skipped by `json_to_logs.py`. The converter fails if an event targets an
unexpected index, has no sourcetype, has no raw event body, or if output counts
do not equal canonical input counts.

Generated seed logs are release inputs and are included in the `.spl`.
Transient HEC-envelope output remains excluded from version control and the
package.

## Asset Build

Before packaging, the build compiles:

1. the React terminal page into
   `appserver/static/pages/terminal.js`;
2. `nakatomi_terminal/visualization.js`;
3. `nakatomi_vault_display/visualization.js`.

Source trees, package manifests, and lockfiles may remain in the repository,
but the release archive excludes `node_modules`, local configuration, caches,
tests, editor files, and macOS metadata. Runtime bundles required by Splunk are
included.

## Reproducible Packaging

A repository build script creates:

- `dist/nakatomi_heist-2.17.1.spl`;
- `dist/SHA256SUMS`;
- a machine-readable seed-data manifest containing counts by index and
  sourcetype.

The `.spl` is a gzipped tar archive with exactly one top-level directory named
`nakatomi_heist`. The build never embeds passwords, HEC tokens, API keys,
certificates, session cookies, or license material.

CI uses the same build path as local releases rather than directly archiving
the source app. Tagged releases therefore cannot silently omit generated data
or compiled assets.

## Installation Experience

The operator:

1. verifies the package SHA-256;
2. logs into Splunk Web as an administrator;
3. opens **Apps → Manage Apps → Install app from file**;
4. uploads the `.spl` and permits replacement if upgrading;
5. restarts from **Settings → Server controls**;
6. opens **Nakatomi Heist** and searches with **All time**;
7. runs the bundled verification search to compare index/sourcetype counts;
8. opens the GitHub Pages game board separately.

Reinstalling a package does not guarantee reseeding an already-populated
instance because Splunk tracks input ingestion state. A clean replay procedure
must therefore document removal of the existing app/index data or use a new
clean Splunk instance. The package is optimized for first install.

## Validation

The release is complete only when all of these pass:

1. the existing game regression suite;
2. generator scenario-consistency checks;
3. canonical event count equals packaged seed event count;
4. every packaged seed shard has a matching batch input and parsing stanza;
5. all five required indexes are present;
6. all three compiled JavaScript bundles are present and non-empty;
7. dashboard XML/JSON and Splunk configuration validation;
8. duplicate stanza and forbidden-file checks;
9. archive inspection confirms one top-level app directory and no source-only
   build dependencies or macOS artifacts;
10. secret scanning confirms no credentials or private keys;
11. a clean Splunk Enterprise integration test, where available, confirms the
    app loads and expected minimum event counts are searchable with **All
    time**.

If a local clean Splunk integration test cannot run, that limitation is
reported explicitly; static validation is not represented as proof of a live
install.

## Security

- No credential is stored in source code, generated data, the `.spl`, Pages,
  workflow files, checksums, or documentation.
- GitHub Pages never receives a Splunk token.
- Administrative dashboards retain their restricted metadata permissions.
- The package creates only synthetic game indexes and does not alter system
  authentication, TLS, or unrelated Splunk configuration.
- No certificate is bundled, so certificate validation and rotation are left
  to the existing Splunk deployment.

## Out of Scope

- Splunk Cloud installation;
- a shared scoreboard hosted by GitHub Pages;
- live session telemetry without a trusted proxy;
- player account provisioning;
- changing the existing Splunk administrator authentication;
- Docker/private GHCR distribution;
- automatic reset of an already-used Splunk instance.
