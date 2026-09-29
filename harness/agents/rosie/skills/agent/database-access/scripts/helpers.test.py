"""Offline tests for Rosie's helper scripts. A fake query binary records the
SQL it receives and prints canned CSV, so nothing touches the database."""
from datetime import datetime
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
SKILLS = HERE.parents[1]
JOB_SNAPSHOT = HERE / "job-snapshot"
SET_NOTE = HERE / "set-note"
APS_PRICE = SKILLS / "plant-and-supplier-search/scripts/aps-price"
QUOTE_JOB = SKILLS / "quote-generation/scripts/quote-job"
DAILY_NOTE = SKILLS / "message-routing/scripts/daily-note"
INDEX_ADD = SKILLS / "message-routing/scripts/index-add"

FAKE = """#!/usr/bin/env python3
import os, sys
open(os.environ["FAKE_SQL_LOG"], "a").write(sys.stdin.read() + "\\n--END--\\n")
sys.stdout.write(open(os.environ["FAKE_OUT"]).read())
"""


class FakeDb:
    def __init__(self):
        self.dir = tempfile.TemporaryDirectory()
        root = Path(self.dir.name)
        self.bin, self.log, self.out = root / "query", root / "sql.log", root / "out.csv"
        self.bin.write_text(FAKE)
        self.bin.chmod(0o755)
        self.log.write_text("")

    def respond(self, value):
        cell = json.dumps(value).replace('"', '""')
        self.out.write_text(f'SET\nj\n"{cell}"\n')

    def run(self, script, *args):
        env = dict(os.environ, ROSIE_QUERY_BIN=str(self.bin), FAKE_SQL_LOG=str(self.log),
                   FAKE_OUT=str(self.out))
        return subprocess.run([sys.executable, str(script), *args], capture_output=True,
                              text=True, env=env)

    def sql(self):
        return self.log.read_text()


JOB = {"job": {"id": 83, "name": "Praetorian Build | Plan", "status": "quoted", "is_active": True,
               "customer_id": 12, "customer": "Praetorian Build", "edd": None, "method": None,
               "note_for_customer": None, "note_internal": "Flat count?"},
       "items": [{"id": 900, "name": "Wax Myrtle", "size": "15 G", "qty": 2, "unit_price": 105,
                  "total": 210, "status": "pending", "avail": None, "sel": None,
                  "note_for_customer": None, "note_internal": None},
                 {"id": 901, "name": "Texas Sedge | Carex texensis", "size": "1 G", "qty": 21,
                  "unit_price": None, "total": None, "status": "pending", "avail": None, "sel": None,
                  "note_for_customer": "How many?", "note_internal": "line1\nline2"}],
       "changes": [{"at": "09-28 05:20", "actor": "chris", "action": "update", "item_id": 900,
                    "fields": "unit_price"}],
       "candidates": None, "order_lines": None}


class HelperTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()

    def tearDown(self):
        self.db.dir.cleanup()

    def test_job_snapshot_is_compact_and_read_only(self):
        self.db.respond(JOB)
        result = self.db.run(JOB_SNAPSHOT, "83", "--changes", "3")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("LINES 2 active, 1 priced, total $210.00", result.stdout)
        self.assertIn("line1 / line2", result.stdout)
        self.assertIn("CANDIDATES 0 (none)", result.stdout)
        sql = self.db.sql()
        self.assertIn("job_request_id = 83", sql)
        self.assertIn("LIMIT 3", sql)
        self.assertNotRegex(sql.upper(), r"\b(UPDATE|INSERT|DELETE)\b")

    def test_job_snapshot_rejects_non_numeric_ids(self):
        result = self.db.run(JOB_SNAPSHOT, "83; DROP TABLE x")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.db.sql(), "")

    def test_set_note_guards_and_keeps_text_literal(self):
        new = Path(self.db.dir.name) / "new.txt"
        new.write_text("APS generic Crossvine 1 G $8 — it's `ok`\n")
        self.db.respond({"updated": 1, "value": "APS generic Crossvine 1 G $8", "exists": True})
        result = self.db.run(SET_NOTE, "--table", "job_request_items", "--id", "901",
                             "--field", "note_internal", "--new-file", str(new), "--expect-null")
        self.assertEqual(result.returncode, 0, result.stderr)
        sql = self.db.sql()
        self.assertIn("SET app.actor TO 'rosie'", sql)
        self.assertIn("note_internal IS NULL", sql)
        self.assertIn("$8 — it's `ok`$q", sql)  # dollar-quoted, untouched

    def test_set_note_reports_concurrent_change(self):
        new = Path(self.db.dir.name) / "new.txt"
        old = Path(self.db.dir.name) / "old.txt"
        new.write_text("new")
        old.write_text("old")
        self.db.respond({"updated": 0, "value": "Chris edited this", "exists": True})
        result = self.db.run(SET_NOTE, "--table", "job_requests", "--id", "83", "--field",
                             "note_internal", "--new-file", str(new), "--expect-file", str(old))
        self.assertEqual(result.returncode, 3)
        self.assertIn("Chris edited this", result.stdout)

    def test_set_note_refuses_other_fields_and_missing_guard(self):
        new = Path(self.db.dir.name) / "new.txt"
        new.write_text("x")
        bad_field = self.db.run(SET_NOTE, "--table", "job_request_items", "--id", "1",
                                "--field", "unit_price", "--new-file", str(new), "--expect-null")
        no_guard = self.db.run(SET_NOTE, "--table", "job_request_items", "--id", "1",
                               "--field", "note_internal", "--new-file", str(new))
        self.assertEqual(bad_field.returncode, 2)
        self.assertEqual(no_guard.returncode, 2)
        self.assertEqual(self.db.sql(), "")

    def test_aps_price_marks_nearest_sizes_and_rules(self):
        rows = [{"rel": 1, "name_key": "nolina", "id": f"id-{s}", "name": "Nolina",
                 "common_name": "Nolina", "botanical_name": "Nolina lindheimeriana", "cultivar": None,
                 "size": s, "size_std": s.replace(" ", ""), "unit_price": p, "internal_notes": None,
                 "listed": "2026-09-01"} for s, p in (("1 G", 7), ("5 G", 23), ("15 G", 175))]
        self.db.respond({"rows": rows, "aliases": None, "size": "7G"})
        result = self.db.run(APS_PRICE, "nolina", "--size", "7 G")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("5 G $23.00 ◀ nearest smaller", result.stdout)
        self.assertIn("15 G $175.00 ▶ nearest larger", result.stdout)
        self.assertNotIn("EXACT", result.stdout)
        self.assertIn("WHERE supplier_id = 1", self.db.sql())

    def test_aps_price_exact_size(self):
        rows = [{"rel": 1, "name_key": "sedge", "id": "abc", "name": "Sedge", "common_name": "Sedge",
                 "botanical_name": None, "cultivar": None, "size": "1 G", "size_std": "1G",
                 "unit_price": 6.5, "internal_notes": "Also prices Texas Sedge 1 G", "listed": None}]
        self.db.respond({"rows": rows, "aliases": [{"name": "Texas Sedge", "other_name": "Carex texensis"}],
                         "size": "1G"})
        result = self.db.run(APS_PRICE, "texas sedge", "--size", "1g")
        self.assertIn("1 G $6.50 EXACT", result.stdout)
        self.assertIn("Texas Sedge = Carex texensis", result.stdout)
        self.assertIn("Price rules", result.stdout)

    def test_quote_job_names_unpriced_lines(self):
        self.db.respond({"job_id": 83, "note_for_customer": None, "items": [
            {"id": 900, "job_request_id": 83, "name": "Wax Myrtle", "size": "15 G",
             "demanded_quantity": 2, "unit_price": "105.00", "status": "available", "note_for_customer": None},
            {"id": 901, "job_request_id": 83, "name": "Texas Sedge | Carex texensis", "size": "1 G",
             "demanded_quantity": 21, "unit_price": None, "status": "pending", "note_for_customer": None}]})
        blocked = self.db.run(QUOTE_JOB, "83")
        self.assertEqual(blocked.returncode, 2)
        self.assertIn("901", blocked.stderr)
        status = self.db.run(QUOTE_JOB, "83", "--status")
        self.assertEqual(status.returncode, 0, status.stderr)
        self.assertIn("2 x 15 G Wax Myrtle - ✅ - $105.00 - $210.00", status.stdout)
        self.assertIn("21 x 1 G Texas Sedge - Pending", status.stdout)


class WorkspaceHelperTests(unittest.TestCase):
    def test_daily_note_one_paragraph_per_thread(self):
        module = runpy.run_path(str(DAILY_NOTE))
        with tempfile.TemporaryDirectory() as tmp:
            module["add"].__globals__["NOTES"] = Path(tmp)
            now = datetime(2026, 9, 28, 9, 30, tzinfo=ZoneInfo("America/Chicago"))
            module["add"]("jr-83", "Loaded 26 lines.", now)
            module["add"]("main", "Routed JR-83.", now)
            path = module["add"]("jr-83", "AR published.", now)
            text = path.read_text()
        self.assertEqual(text.count("jr-83 — "), 1)
        self.assertIn("jr-83 — 2026-09-28 09:30:00: Loaded 26 lines. 09:30:00: AR published.", text)
        self.assertIn("main — 2026-09-28 09:30:00: Routed JR-83.", text)

    def test_daily_note_extends_older_bracket_format_line(self):
        module = runpy.run_path(str(DAILY_NOTE))
        with tempfile.TemporaryDirectory() as tmp:
            module["add"].__globals__["NOTES"] = Path(tmp)
            path = Path(tmp) / "2026-09-28.md"
            path.write_text("2026-09-28 05:14:09 [jr-83] Intake done.\n"
                            "2026-09-28 05:24:52 [supplier-x] Published.\n")
            now = datetime(2026, 9, 28, 9, 30, tzinfo=ZoneInfo("America/Chicago"))
            module["add"]("jr-83", "Priced.", now)
            lines = path.read_text().splitlines()
        self.assertEqual(lines[0], "2026-09-28 05:14:09 [jr-83] Intake done. 09:30:00: Priced.")
        self.assertEqual(lines[1], "2026-09-28 05:24:52 [supplier-x] Published.")

    def test_aps_price_box_is_not_exact_for_gallons(self):
        rows = [{"rel": 1, "name_key": "x", "id": i, "name": "Holly", "common_name": "Holly",
                 "botanical_name": None, "cultivar": None, "size": s, "size_std": s, "unit_price": p,
                 "internal_notes": None, "listed": None}
                for i, s, p in (("a", '24" Box', 395), ("b", "15G", 195), ("c", "45G", 495))]
        mark = runpy.run_path(str(APS_PRICE))["mark"]
        labels = mark(rows, "30G")
        self.assertNotIn("EXACT", labels.values())
        self.assertEqual(labels["b"], "◀ nearest smaller")

    def test_index_add_replaces_same_path(self):
        module = runpy.run_path(str(INDEX_ADD))
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "index.md"
            index.write_text("# Workspace index\n\n- `threads/jr-1/` — old\n")
            module["upsert"].__globals__["INDEX"] = index
            self.assertEqual(module["upsert"]("threads/jr-83/notes.md", "JR-83 plan"), "added")
            self.assertEqual(module["upsert"]("threads/jr-1/", "JR-1 updated"), "replaced")
            lines = index.read_text().splitlines()
        self.assertEqual(lines[2], "- `threads/jr-83/notes.md` — JR-83 plan")
        self.assertIn("- `threads/jr-1/` — JR-1 updated", lines)
        self.assertEqual(sum("jr-1/" in line for line in lines), 1)


if __name__ == "__main__":
    unittest.main()
