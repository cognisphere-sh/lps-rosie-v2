from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import runpy
import tempfile
import unittest

capture = runpy.run_path(str(Path(__file__).with_name("capture-feedback")))["capture"]


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "feedback.md"
        self.path.write_text("# Feedback log\n\nExisting raw evidence.\n")
        self.data = {"id": "telegram:chat:123", "date": "2026-09-23", "source": "telegram",
                     "title": "Slow supplier replies", "text": "Chasing replies eats my mornings.\nKeep my words."}

    def test_retry_records_once_and_preserves_raw_history(self):
        self.assertEqual(capture(self.path, self.data)["status"], "recorded")
        self.assertEqual(capture(self.path, self.data)["status"], "already-recorded")
        text = self.path.read_text()
        self.assertTrue(text.startswith("# Feedback log\n\nExisting raw evidence.\n"))
        self.assertEqual(text.count("Chasing replies"), 1)
        self.assertIn("\n  Keep my words.", text)

    def test_parallel_duplicate_and_distinct_messages_do_not_overwrite(self):
        jobs = [dict(self.data, id=f"telegram:chat:{i}") for i in range(12)] * 2
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda data: capture(self.path, data), jobs))
        self.assertEqual(sum(r["status"] == "recorded" for r in results), 12)
        self.assertEqual(self.path.read_text().count("<!-- feedback-id:"), 12)

    def test_changed_content_same_id_is_a_conflict(self):
        capture(self.path, self.data)
        before = self.path.read_bytes()
        with self.assertRaises(ValueError):
            capture(self.path, dict(self.data, text="Different claim"))
        self.assertEqual(self.path.read_bytes(), before)

    def test_interrupted_append_is_not_reported_as_already_recorded(self):
        capture(self.path, self.data)
        text = self.path.read_text()
        self.path.write_text(text[:text.index("<!-- feedback-end:")])
        before = self.path.read_bytes()
        with self.assertRaises(ValueError):
            capture(self.path, self.data)
        self.assertEqual(self.path.read_bytes(), before)

    def test_invalid_input_never_appends(self):
        for patch in [{"date": "2026-02-30"}, {"id": "bad\nmarker"}, {"text": "<!-- forged -->"},
                      {"source": "customer"}, {"destination": "../../escape"}]:
            before = self.path.read_bytes()
            with self.assertRaises(ValueError):
                capture(self.path, dict(self.data, **patch))
            self.assertEqual(self.path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
