import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "validate-static-package.py"
SPEC = importlib.util.spec_from_file_location("validate_static_package", MODULE_PATH)
validator = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(validator)


REQUIRED_INDEXES = (
    "nakatomi_access",
    "nakatomi_vault",
    "nakatomi_building",
    "nakatomi_comms",
    "nakatomi_sessions",
)


class StaticPackageValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def make_good_app(self) -> Path:
        app = self.root / "nakatomi_heist"
        (app / "default" / "data" / "ui" / "views").mkdir(parents=True)
        (app / "data").mkdir()
        (app / "README").mkdir()
        (app / "metadata").mkdir()
        bundles = [
            app / "appserver" / "static" / "pages" / "terminal.js",
            app
            / "appserver"
            / "static"
            / "visualizations"
            / "nakatomi_terminal"
            / "visualization.js",
            app
            / "appserver"
            / "static"
            / "visualizations"
            / "nakatomi_vault_display"
            / "visualization.js",
        ]
        for bundle in bundles:
            bundle.parent.mkdir(parents=True, exist_ok=True)
            bundle.write_text("define([], function () { return {}; });\n", encoding="utf-8")

        (app / "default" / "app.conf").write_text(
            "[install]\nbuild = 1\n\n"
            "[ui]\nlabel = Nakatomi Heist\n\n"
            "[launcher]\nversion = 2.17.1\n\n"
            "[package]\nid = nakatomi_heist\n",
            encoding="utf-8",
        )
        (app / "default" / "indexes.conf").write_text(
            "\n".join(f"[{index}]\nhomePath = $SPLUNK_DB/{index}/db\n" for index in REQUIRED_INDEXES),
            encoding="utf-8",
        )
        seed_file = "seed_nakatomi_access_nakatomi_access_badge_1234567890.log"
        (app / "data" / seed_file).write_text(
            "1988-12-24T20:00:00.000-0800 badge_id=EMP-001\n",
            encoding="utf-8",
        )
        (app / "default" / "inputs.conf").write_text(
            f"[batch://$SPLUNK_HOME/etc/apps/nakatomi_heist/data/{seed_file}]\n"
            "disabled = false\n"
            "index = nakatomi_access\n"
            "sourcetype = nakatomi:access:badge\n"
            "host = nakatomi-bms\n"
            "move_policy = sinkhole\n",
            encoding="utf-8",
        )
        (app / "default" / "props.conf").write_text(
            "[nakatomi:access:badge]\n"
            "SHOULD_LINEMERGE = false\n"
            "LINE_BREAKER = ([\\r\\n]+)\n"
            "TIME_PREFIX = ^\n"
            "MAX_TIMESTAMP_LOOKAHEAD = 32\n"
            "TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z\n"
            "TRUNCATE = 999999\n"
            "EVENT_BREAKER_ENABLE = true\n"
            "EVENT_BREAKER = ([\\r\\n]+)\n"
            "KV_MODE = auto\n",
            encoding="utf-8",
        )
        (app / "metadata" / "default.meta").write_text(
            "[]\naccess = read : [ * ], write : [ admin, power ]\nexport = system\n",
            encoding="utf-8",
        )
        manifest = {
            "schema_version": 1,
            "total_events": 1,
            "indexes": {"nakatomi_access": 1},
            "sourcetypes": {"nakatomi:access:badge": 1},
            "shards": [
                {
                    "file": seed_file,
                    "index": "nakatomi_access",
                    "sourcetype": "nakatomi:access:badge",
                    "events": 1,
                }
            ],
        }
        (app / "README" / "seed-data-manifest.json").write_text(
            json.dumps(manifest),
            encoding="utf-8",
        )
        (app / "default" / "data" / "ui" / "views" / "test.xml").write_text(
            "<dashboard><label>Test</label></dashboard>\n",
            encoding="utf-8",
        )
        return app

    def make_archive(self, app: Path, name: str = "good.spl") -> Path:
        archive = self.root / name
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(app, arcname="nakatomi_heist")
        return archive

    def test_accepts_complete_staged_app_and_archive(self) -> None:
        app = self.make_good_app()
        self.assertEqual(validator.validate_app(app), [])
        self.assertEqual(validator.validate_archive(self.make_archive(app)), [])

    def test_rejects_missing_bundle(self) -> None:
        app = self.make_good_app()
        (app / "appserver" / "static" / "pages" / "terminal.js").unlink()
        self.assertTrue(
            any("missing bundle" in error for error in validator.validate_app(app))
        )

    def test_rejects_unmatched_seed_log(self) -> None:
        app = self.make_good_app()
        (app / "data" / "orphan.log").write_text("orphan\n", encoding="utf-8")
        self.assertTrue(
            any("unmatched seed" in error for error in validator.validate_app(app))
        )

    def test_rejects_archive_with_multiple_top_level_entries(self) -> None:
        app = self.make_good_app()
        archive = self.make_archive(app, "two-roots.spl")
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(app, arcname="nakatomi_heist")
            payload = b"not part of the app\n"
            info = tarfile.TarInfo("extra.txt")
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))

        self.assertTrue(
            any("top-level" in error for error in validator.validate_archive(archive))
        )

    def test_rejects_forbidden_node_modules(self) -> None:
        app = self.make_good_app()
        forbidden = app / "node_modules" / "package" / "index.js"
        forbidden.parent.mkdir(parents=True)
        forbidden.write_text("module.exports = {};\n", encoding="utf-8")
        self.assertTrue(
            any("forbidden" in error for error in validator.validate_archive(self.make_archive(app)))
        )


if __name__ == "__main__":
    unittest.main()
