import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("json_to_logs.py")
SPEC = importlib.util.spec_from_file_location("json_to_logs", MODULE_PATH)
json_to_logs = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(json_to_logs)


def write_canonical(output_dir: Path, records: list[dict]) -> None:
    files = {name: [] for name in json_to_logs.CANONICAL_JSON}
    for record in records:
        files[f"{record['index']}.json"].append(record)
    for name, file_records in files.items():
        with (output_dir / name).open("w", encoding="utf-8") as handle:
            for record in file_records:
                handle.write(json.dumps(record) + "\n")


class ConvertAllTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.output = self.root / "output"
        self.data = self.root / "data"
        self.output.mkdir()
        self.inputs = self.root / "inputs.conf"
        self.props = self.root / "props.conf"
        self.manifest = self.root / "seed-data-manifest.json"
        self.props.write_text(
            "[nakatomi:access:badge]\n"
            "TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z\n"
            "KV_MODE = auto\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    @staticmethod
    def event(index: str, sourcetype: str, value: str) -> dict:
        return {
            "time": -347126400.0,
            "host": "nakatomi-bms",
            "source": "nakatomi:test",
            "sourcetype": sourcetype,
            "index": index,
            "event": f"1988-12-24T20:00:00.000-0800 value={value}",
        }

    def convert(self) -> dict:
        return json_to_logs.convert_all(
            self.output,
            self.data,
            self.inputs,
            self.props,
            self.manifest,
        )

    def test_converts_every_sourcetype_and_preserves_counts(self) -> None:
        records = [
            self.event("nakatomi_access", "nakatomi:access:badge", "badge"),
            self.event("nakatomi_building", "intranet:announcements", "lore"),
            self.event("nakatomi_comms", "intercept:hans", "radio"),
        ]
        write_canonical(self.output, records)

        manifest = self.convert()

        self.assertEqual(manifest["total_events"], 3)
        self.assertEqual(sum(manifest["indexes"].values()), 3)
        self.assertEqual(sum(manifest["sourcetypes"].values()), 3)
        self.assertEqual(len(list(self.data.glob("*.log"))), 3)
        inputs_text = self.inputs.read_text(encoding="utf-8")
        self.assertEqual(inputs_text.count("[batch://"), 3)
        self.assertIn("sourcetype = intranet:announcements", inputs_text)
        self.assertIn("sourcetype = intercept:hans", inputs_text)
        props_text = self.props.read_text(encoding="utf-8")
        self.assertIn("[intranet:announcements]", props_text)
        self.assertIn("[intercept:hans]", props_text)
        self.assertEqual(props_text.count("[nakatomi:access:badge]"), 1)
        self.assertIn("TRUNCATE = 999999", props_text)
        self.assertEqual(
            json.loads(self.manifest.read_text(encoding="utf-8")),
            manifest,
        )

    def test_rejects_unexpected_index(self) -> None:
        write_canonical(
            self.output,
            [self.event("nakatomi_access", "nakatomi:access:badge", "ok")],
        )
        path = self.output / "nakatomi_access.json"
        record = self.event("main", "nakatomi:access:badge", "bad")
        path.write_text(json.dumps(record) + "\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "unexpected index"):
            self.convert()

    def test_rejects_missing_sourcetype(self) -> None:
        record = self.event("nakatomi_access", "nakatomi:access:badge", "bad")
        record["sourcetype"] = ""
        write_canonical(self.output, [record])

        with self.assertRaisesRegex(ValueError, "missing sourcetype"):
            self.convert()

    def test_rejects_missing_event_body(self) -> None:
        record = self.event("nakatomi_vault", "nakatomi:vault:system", "bad")
        record["event"] = ""
        write_canonical(self.output, [record])

        with self.assertRaisesRegex(ValueError, "missing event body"):
            self.convert()

    def test_requires_all_canonical_files(self) -> None:
        (self.output / "nakatomi_access.json").write_text("", encoding="utf-8")

        with self.assertRaisesRegex(FileNotFoundError, "canonical"):
            self.convert()


if __name__ == "__main__":
    unittest.main()
