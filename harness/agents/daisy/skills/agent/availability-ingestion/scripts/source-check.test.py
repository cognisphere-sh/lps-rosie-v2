import json
from pathlib import Path
import runpy
import tempfile
import unittest

module = runpy.run_path(str(Path(__file__).with_name("source-check")))


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "artifacts").mkdir()
        (self.root / "SKILL.md").write_text("rules version one")
        self.body = self.root / "body.txt"
        self.body.write_text("use attachment")
        self.attachment = self.root / "list.pdf"
        self.attachment.write_bytes(b"source")
        self.state = self.root / "receipt.json"
        self.evidence = self.root / "evidence.json"
        self.evidence.write_text(json.dumps({"verified": True, "source_ids": ["source-1"]}))

    def digest(self, scope="farm:24"):
        return module["fingerprint"](scope, [self.body, self.attachment], self.root)

    def test_check_without_success_never_creates_skip_receipt(self):
        self.digest()
        self.assertIsNone(module["read_state"](self.state))
        self.assertFalse(self.state.exists())

    def test_body_location_attachment_and_rule_changes_invalidate(self):
        first = self.digest()
        self.assertNotEqual(first, self.digest("farm:25"))
        self.body.write_text("attachment prices increase ten percent")
        second = self.digest()
        self.assertNotEqual(first, second)
        self.attachment.write_bytes(b"new source")
        third = self.digest()
        self.assertNotEqual(second, third)
        (self.root / "artifacts/names.md").write_text("new identity rule")
        self.assertNotEqual(third, self.digest())

    def test_success_receipt_and_changed_source_record_guard(self):
        expected = self.digest()
        module["record"](self.state, "farm:24", expected, expected, self.evidence)
        self.assertEqual(module["read_state"](self.state)["fingerprint"], expected)
        self.body.write_text("amendment")
        with self.assertRaises(ValueError):
            module["record"](self.state, "farm:24", self.digest(), expected, self.evidence)
        self.assertEqual(module["read_state"](self.state)["fingerprint"], expected)

    def test_failed_or_corrupt_receipts_do_not_authorize_skip(self):
        self.evidence.write_text('{"verified":false,"source_ids":["x"]}')
        with self.assertRaises(ValueError):
            module["record"](self.state, "farm:24", self.digest(), self.digest(), self.evidence)
        self.assertFalse(self.state.exists())
        self.state.write_text("{torn")
        with self.assertRaises(ValueError):
            module["read_state"](self.state)

    def test_shaped_but_invalid_evidence_fails_closed(self):
        for evidence in ["yes", {"verified": True, "source_ids": "not-a-list"},
                         {"verified": False, "source_ids": ["x"]}]:
            self.state.write_text(json.dumps({"version": 1, "scope": "farm:24",
                                             "fingerprint": self.digest(), "evidence": evidence}))
            with self.assertRaises(ValueError):
                module["read_state"](self.state)


if __name__ == "__main__":
    unittest.main()
