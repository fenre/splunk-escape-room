# Static Splunk Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, self-seeding `nakatomi_heist.spl` that installs through Splunk Web without HEC or host CLI access.

**Architecture:** Generate canonical HEC envelopes on the build machine, convert every event into deterministic raw seed shards in a staging copy of the app, and generate matching batch/parsing configuration there. Compile all required browser bundles, validate the staged app, then create a one-root `.spl` plus checksum. GitHub Pages remains unchanged because its existing workflow already publishes the credential-free game board.

**Tech Stack:** Python 3 standard library and PyYAML, Bash, Node.js 20, webpack 5, Splunk Enterprise app configuration, tar/gzip.

## Global Constraints

- Target Splunk Enterprise, self-managed; Splunk Cloud is out of scope.
- The installed package must not require HEC, a setup form, a scripted input, an external service, or Splunk-host CLI access.
- Package every canonical event, including intranet, intercept, lore, side-story, red-herring, and easter-egg sourcetypes.
- Never embed a password, HEC token, API key, certificate, cookie, license key, or terms acceptance.
- Preserve the existing restricted permissions on `facilitator_board`.
- Leave GitHub Pages unchanged unless a failing verification demonstrates a concrete defect.
- Every seed input uses `move_policy = sinkhole` and targets only `nakatomi_access`, `nakatomi_vault`, `nakatomi_building`, or `nakatomi_comms`.
- The archive has exactly one top-level `nakatomi_heist/` directory and excludes `node_modules`, source-only frontend files, caches, local configuration, tests, and macOS metadata.

---

### Task 1: Complete deterministic seed conversion

**Files:**
- Modify: `generator/json_to_logs.py`
- Create: `generator/test_json_to_logs.py`

**Interfaces:**
- Consumes: four canonical files in `generator/output/`, each containing one HEC JSON object per line.
- Produces: `convert_all(output_dir: Path, data_dir: Path, inputs_path: Path, props_path: Path, manifest_path: Path) -> dict`, raw seed shards, complete generated `inputs.conf`, appended parsing stanzas, and a JSON count manifest.

- [ ] **Step 1: Write failing converter tests**

Create temporary canonical files containing two existing sourcetypes and one previously skipped `intranet:announcements` event. Assert that conversion:

```python
manifest = convert_all(source, data, inputs, props, manifest_path)
self.assertEqual(manifest["total_events"], 3)
self.assertEqual(sum(manifest["sourcetypes"].values()), 3)
self.assertIn("[batch://$SPLUNK_HOME/etc/apps/nakatomi_heist/data/", inputs.read_text())
self.assertIn("sourcetype = intranet:announcements", inputs.read_text())
self.assertIn("[intranet:announcements]", props.read_text())
```

Add negative tests for an unexpected index, missing sourcetype, missing event body, duplicate filename collision, and count mismatch.

- [ ] **Step 2: Run the converter tests and observe the expected failure**

Run:

```bash
python3 -m unittest generator/test_json_to_logs.py -v
```

Expected: failure because `convert_all` and the parameterized output contract do not exist.

- [ ] **Step 3: Implement complete conversion**

Replace the fixed 11-sourcetype map with grouping by `(index, sourcetype)`. Restrict indexes with:

```python
ALLOWED_INDEXES = {
    "nakatomi_access",
    "nakatomi_vault",
    "nakatomi_building",
    "nakatomi_comms",
}
```

Generate filenames from a SHA-256-backed slug so distinct sourcetypes cannot overwrite each other. Write each raw event exactly once, generate one batch stanza per shard, append a canonical timestamp/KV parsing stanza only when it is absent from the base `props.conf`, and write sorted manifest JSON containing total, per-index, and per-sourcetype counts.

- [ ] **Step 4: Run converter tests**

Run:

```bash
python3 -m unittest generator/test_json_to_logs.py -v
```

Expected: all converter tests pass.

- [ ] **Step 5: Commit the converter**

```bash
git add generator/json_to_logs.py generator/test_json_to_logs.py
git commit -m "feat: package complete static seed data"
```

---

### Task 2: Build and validate a staged Splunk app

**Files:**
- Create: `scripts/build-static-package.sh`
- Create: `scripts/validate-static-package.py`
- Create: `scripts/tests/test_static_package.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: app source, generator, Node lockfiles, and `APP_VERSION` read from `default/app.conf`.
- Produces: `build/stage/nakatomi_heist/`, `dist/nakatomi_heist-<version>.spl`, `dist/SHA256SUMS`.

- [ ] **Step 1: Write failing package validator tests**

Construct temporary good and bad staged apps. Assert rejection of:

```python
self.assertIn("missing bundle", validate_app(stage_without_terminal_js))
self.assertIn("multiple top-level", validate_archive(two_root_archive))
self.assertIn("unmatched seed input", validate_app(stage_with_orphan_log))
self.assertIn("forbidden node_modules", validate_archive(archive_with_node_modules))
```

Assert acceptance only when all five indexes, three JavaScript bundles, seed manifest, matching inputs, matching props stanzas, app metadata, and one archive root are present.

- [ ] **Step 2: Run validator tests and observe the expected failure**

Run:

```bash
python3 -m unittest scripts/tests/test_static_package.py -v
```

Expected: failure because the validator does not exist.

- [ ] **Step 3: Implement the package validator**

Implement a standard-library validator that parses `.conf` stanza headers, parses dashboard XML and Dashboard Studio CDATA JSON, rejects duplicate stanzas and forbidden paths, verifies manifest/input/log/props closure, confirms bundle size is non-zero, checks the five indexes, and inspects tar members without extracting them.

- [ ] **Step 4: Implement the reproducible build script**

The script must:

```bash
python3 generator/generate.py
npm --prefix nakatomi_heist ci
npm --prefix nakatomi_heist run build
bash scripts/build-viz.sh
```

It then creates a clean staging copy, excludes development-only content, invokes `json_to_logs.py` against the staging copy, runs `validate-static-package.py` before and after tar creation, creates the archive with `COPYFILE_DISABLE=1`, and writes SHA-256 output using `shasum -a 256`.

- [ ] **Step 5: Run validator tests**

Run:

```bash
python3 -m unittest scripts/tests/test_static_package.py -v
```

Expected: all package validator tests pass.

- [ ] **Step 6: Commit build tooling**

```bash
git add .gitignore scripts/build-static-package.sh scripts/validate-static-package.py scripts/tests/test_static_package.py
git commit -m "build: add reproducible static app package"
```

---

### Task 3: Installation documentation and CI release parity

**Files:**
- Create: `nakatomi_heist/README/INSTALL.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the artifact and checksum produced by Task 2.
- Produces: Web-only installation instructions and CI that calls the same package script used locally.

- [ ] **Step 1: Write a failing documentation/CI contract test**

Extend `scripts/tests/test_static_package.py` to assert:

```python
self.assertIn("Manage apps", install_text)
self.assertIn("Server controls", install_text)
self.assertIn("All time", install_text)
self.assertIn("build-static-package.sh", ci_text)
self.assertNotIn("tar -czf", package_job_text)
```

- [ ] **Step 2: Run the contract test and observe the expected failure**

Run:

```bash
python3 -m unittest scripts/tests/test_static_package.py -v
```

Expected: failure because the install guide and shared CI build path are absent.

- [ ] **Step 3: Add Web-only installation and replay guidance**

Document checksum verification, app upload, replacement during upgrade, restart from Server controls, All-time verification SPL, expected manifest location, GitHub Pages board use, first-install behavior, and clean-instance replay. Do not instruct the operator to use Splunk CLI.

- [ ] **Step 4: Make tagged CI call the shared build script**

Replace direct `tar -czf` packaging with:

```bash
bash scripts/build-static-package.sh
```

Upload `dist/*.spl`, `dist/SHA256SUMS`, and the seed manifest. Keep all credential guidance explicit: no token is needed or read.

- [ ] **Step 5: Run the contract and existing regression tests**

Run:

```bash
python3 -m unittest scripts/tests/test_static_package.py -v
bash scripts/test.sh
```

Expected: all tests pass.

- [ ] **Step 6: Commit documentation and CI**

```bash
git add nakatomi_heist/README/INSTALL.md README.md .github/workflows/ci.yml scripts/tests/test_static_package.py
git commit -m "docs: add web-only static app installation"
```

---

### Task 4: Build and inspect the release artifact

**Files:**
- Generated: `dist/nakatomi_heist-2.17.1.spl`
- Generated: `dist/SHA256SUMS`
- Generated in staged app: `README/seed-data-manifest.json`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: final installable artifact and verification evidence.

- [ ] **Step 1: Build from a clean generated-output state**

Run:

```bash
rm -rf generator/output build/stage dist
bash scripts/build-static-package.sh
```

Expected: exit 0 with one `.spl`, checksum, full event count, and three compiled bundle checks.

- [ ] **Step 2: Run all static verification**

Run:

```bash
bash scripts/test.sh
python3 -m unittest generator/test_json_to_logs.py scripts/tests/test_static_package.py -v
python3 scripts/validate-static-package.py dist/nakatomi_heist-2.17.1.spl
tar tzf dist/nakatomi_heist-2.17.1.spl
shasum -a 256 -c dist/SHA256SUMS
```

Expected: zero test failures, validator PASS, all tar members under `nakatomi_heist/`, and checksum `OK`.

- [ ] **Step 3: Scan the artifact for forbidden content and credentials**

Extract into a temporary directory and verify there is no `node_modules`, `local/`, cache, key, PEM, certificate, `.DS_Store`, resource fork, token assignment, or private-key block. If any certificate-like file is encountered, inspect it with `openssl x509 -text -noout` and remove it because no certificate belongs in this package.

- [ ] **Step 4: Attempt a clean Splunk Enterprise integration test**

Use the existing local Event Mode Splunk container only if Docker is available. Install the built artifact into a fresh volume, restart, and verify with All-time searches that each manifest index/sourcetype count is present. If Docker or the Splunk image is unavailable, record that live installation remains the operator’s acceptance step rather than presenting static checks as live proof.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Confirm no unrelated Event Mode or GitHub Pages changes were introduced by this implementation.
