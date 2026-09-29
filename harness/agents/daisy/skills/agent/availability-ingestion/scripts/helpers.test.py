"""Offline tests for ingest-context, qa-check, apply-plan and match-candidates
--plan. A fake query binary records the SQL it receives and prints canned
output, so nothing touches the database."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
FAKE = """#!/usr/bin/env python3
import os, sys
args = sys.argv[1:]
sql = open(args[args.index("-f") + 1]).read() if "-f" in args else sys.stdin.read()
open(os.environ["FAKE_SQL_LOG"], "a").write(sql + "\\n--END--\\n")
outs = open(os.environ["FAKE_OUT"]).read().split("\\n--NEXT--\\n")
n = int(open(os.environ["FAKE_N"]).read() or 0)
open(os.environ["FAKE_N"], "w").write(str(n + 1))
sys.stdout.write(outs[min(n, len(outs) - 1)])
sys.exit(int(os.environ.get("FAKE_STATUS", "0")))
"""
SOURCE = "037993a4-c94a-4c15-b5f4-a62a880ae550"
ROW = "2e715795-84cd-4dee-90d7-085a3d911bee"


class Fake:
    def __init__(self):
        self.dir = tempfile.TemporaryDirectory()
        root = Path(self.dir.name)
        self.bin, self.log, self.out, self.n = (root / "query", root / "sql.log",
                                                root / "out", root / "n")
        self.bin.write_text(FAKE)
        self.bin.chmod(0o755)
        self.log.write_text("")
        self.n.write_text("0")
        self.status = "0"

    def respond(self, *outputs):
        self.out.write_text("\n--NEXT--\n".join(outputs))

    def json(self, value):
        cell = json.dumps(value).replace('"', '""')
        return f'j\n"{cell}"\n'

    def run(self, script, *args):
        env = dict(os.environ, DAISY_QUERY_BIN=str(self.bin), FAKE_SQL_LOG=str(self.log),
                   FAKE_OUT=str(self.out), FAKE_N=str(self.n), FAKE_STATUS=self.status)
        return subprocess.run([sys.executable, str(HERE / script), *args],
                              capture_output=True, text=True, env=env)

    def plan(self, value):
        path = Path(self.dir.name) / "plan.json"
        path.write_text(json.dumps(value))
        return str(path)


class Tests(unittest.TestCase):
    def setUp(self):
        self.db = Fake()

    def tearDown(self):
        self.db.dir.cleanup()

    def test_ingest_context_renders_locations_and_notes(self):
        self.db.respond(self.db.json({
            "head": {"id": 24, "name": "Purtis", "daisy_thread_id": "supplier-purtis", "website": None,
                     "channel": "Email", "hosted_url": None, "every_days": 7},
            "locations": [{"id": 24, "name": "Purtis", "city": "Eustace", "state": "TX", "category": "Grower",
                           "active_rows": 332, "newest_source": None}],
            "notes": [{"id": 24, "notes": "PDF is the source of truth."}], "recent_sources": None}))
        result = self.db.run("ingest-context", "--thread", "supplier-purtis")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("LOCATIONS 1 active", result.stdout)
        self.assertIn("[24] PDF is the source of truth.", result.stdout)
        self.assertIn("daisy_thread_id = $q", self.db.log.read_text())

    def test_ingest_context_unknown_supplier(self):
        self.db.respond(self.db.json({"head": None}))
        self.assertEqual(self.db.run("ingest-context", "--supplier", "9").returncode, 1)

    def test_qa_check_flags_failures(self):
        self.db.respond(self.db.json({
            "sources": 1, "by_location": [{"supplier_id": 24, "total": 10, "inserted": 8, "updated": 2,
                                           "priced": 10, "inactive": 0}],
            "size_std": {"3G": 10}, "size_without_std": [{"id": "x", "size": "3 G"}]}))
        result = self.db.run("qa-check", "--source", SOURCE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("CHECK mostly inserts", result.stdout)
        self.assertIn("FAIL size_without_std: 1", result.stdout)
        self.assertIn("1 check(s) failed", result.stdout)

    def test_qa_check_rejects_bad_uuid(self):
        self.assertEqual(self.db.run("qa-check", "--source", "x'; drop").returncode, 1)

    def base_plan(self, rows):
        return {"supplier_id": 24, "source_id": SOURCE, "rows": rows}

    def test_apply_plan_refuses_invalid_plans(self):
        bad = [
            [{"action": "review"}],
            [{"action": "insert", "set": {"common_name": "Oak"}}],                      # not searched
            [{"action": "insert", "searched": True, "set": {"size": "15 G", "size_std": "15G"}}],  # no name
            [{"action": "update", "id": ROW, "set": {"name": "x"}}],                    # derived column
            [{"action": "update", "id": ROW, "set": {"size": "15 G"}}],                 # no size_std
            [{"action": "update", "id": ROW, "set": {"size": "15 G", "size_std": "15 Gal"}}],
            [{"action": "update", "id": ROW, "set": {"unit_price": "12"}}],             # not a number
            [{"action": "update", "id": ROW, "set": {"unit_price": 1}},
             {"action": "update", "id": ROW, "set": {"unit_price": 2}}],                # duplicate id
        ]
        for rows in bad:
            result = self.db.run("apply-plan", self.db.plan(self.base_plan(rows)))
            self.assertEqual(result.returncode, 1, (rows, result.stdout))
        self.assertEqual(self.db.log.read_text(), "")  # nothing was sent

    def test_apply_plan_dry_run_sql_shape(self):
        self.db.respond('result\n"source_ok=1"\nresult\n"updated=1 ok=1"\nresult\n"inserted=1 ok=1"\n'
                        'result\n"size_without_std=0"\n')
        plan = self.base_plan([
            {"action": "update", "id": ROW, "set": {"unit_price": 12.5, "internal_notes": "costs $5, it's"},
             "expect": {"source_id": SOURCE}},
            {"action": "insert", "searched": True,
             "set": {"common_name": "Live Oak", "size": "15 G", "size_std": "15G", "unit_price": 48}},
            {"action": "park", "why": "two rows could match"}])
        result = self.db.run("apply-plan", self.db.plan(plan))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DRY RUN", result.stdout)
        self.assertIn("parked=1", result.stdout)
        sql = self.db.log.read_text()
        self.assertTrue(sql.startswith("BEGIN;"))
        self.assertIn("ROLLBACK;", sql)
        self.assertNotIn("COMMIT;", sql)
        self.assertIn("internal_notes || E'\\n' ||", sql)       # appended, not replaced
        self.assertIn("costs $5, it's", sql)                     # dollar-quoted literally
        self.assertIn("is_active = true", sql)
        self.assertIn("supplier_id = 24", sql)
        self.assertNotIn(" quantity =", sql)                      # silence is not a value
        self.assertIn("count(*) = 1", sql)

    def test_apply_plan_commit_and_failure(self):
        plan = self.db.plan(self.base_plan([{"action": "update", "id": ROW, "set": {"quantity": None}}]))
        self.db.respond('result\n"source_ok=1"\nresult\n"updated=1 ok=1"\nresult\n"size_without_std=0"\n')
        result = self.db.run("apply-plan", plan, "--commit")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("COMMITTED", result.stdout)
        self.assertIn("COMMIT;", self.db.log.read_text())
        self.db.status = "3"
        self.db.respond("")
        result = self.db.run("apply-plan", plan, "--commit")
        self.assertEqual(result.returncode, 2)
        self.assertIn("nothing kept", result.stderr)

    def test_match_candidates_plan_searches_inserts(self):
        entries = Path(self.db.dir.name) / "entries.json"
        entries.write_text(json.dumps([
            {"common_name": "Live Oak", "size": "15 G", "size_std": "15G", "unit_price": 50},
            {"common_name": "Zzyzx Shrub", "size": "3 G", "size_std": "3G", "unit_price": 9},
            {"common_name": "Wax Myrtle", "size": "5 G", "size_std": "5G", "unit_price": 20}]))
        head = "idx,rn,score,dupes,cultivar_mismatch,id,name,cultivar,size,size_std,unit_price,quantity,height,width,caliper,is_active"
        candidates = head + f"\n0,1,1.0,1,f,{ROW},Live Oak,,15 G,15G,48,,,,,t\n"
        search = ("idx,id,name,size,size_std,unit_price,is_active,relevance\n"
                  "2,11111111-1111-1111-1111-111111111111,Myrica cerifera,5 G,5G,19,t,3.1\n")
        self.db.respond(candidates, search)
        out = Path(self.db.dir.name) / "plan.json"
        result = self.db.run("match-candidates", "--supplier", "24", "--entries", str(entries), "--plan", str(out))
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = json.loads(out.read_text())["rows"]
        self.assertEqual([r["action"] for r in rows], ["update", "insert", "review"])
        self.assertEqual(rows[0]["id"], ROW)
        self.assertNotIn("common_name", rows[0]["set"])   # a match keeps its stored name
        self.assertTrue(rows[1]["searched"])
        self.assertIn("Myrica cerifera", rows[2]["why"])


if __name__ == "__main__":
    unittest.main()
