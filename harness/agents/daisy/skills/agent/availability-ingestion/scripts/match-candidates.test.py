#!/usr/bin/env python3
"""Offline transport regressions: never invoke a real psql or use real secrets.

Run: python3 path/to/match-candidates.test.py
"""
import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("match-candidates")
loader = importlib.machinery.SourceFileLoader("match_candidates", str(SCRIPT))
spec = importlib.util.spec_from_loader(loader.name, loader)
helper = importlib.util.module_from_spec(spec)
loader.exec_module(helper)


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.sandbox = tempfile.TemporaryDirectory(prefix="match-transport-test-")
        self.addCleanup(self.sandbox.cleanup)
        self.root = Path(self.sandbox.name)
        tempdir = patch.object(helper.tempfile, "tempdir", self.sandbox.name)
        tempdir.start()
        self.addCleanup(tempdir.stop)
        self.sources = []

    def inspect_call(self, argv, **kwargs):
        self.assertEqual(argv[:3], ["/guarded/query", "--csv", "-f"])
        self.assertEqual(len(argv), 4)
        self.assertEqual(kwargs, {"stdin": subprocess.DEVNULL,
                                  "capture_output": True, "text": True})
        source = Path(argv[3])
        self.sources.append(source)
        self.assertEqual(stat.S_IMODE(source.stat().st_mode), 0o600)
        self.assertEqual(source.read_bytes(), self.sql.encode("utf-8"))

    def assert_cleaned(self):
        self.assertTrue(self.sources)
        self.assertTrue(all(not source.exists() for source in self.sources))
        self.assertEqual(list(self.root.glob("match-candidates-*.sql")), [])

    def test_large_unicode_sql_exact_bytes_and_csv(self):
        self.sql = "SELECT 'quoted, ''Unicode 🌳 café''\r\n" + "x" * 300_000 + "';\n"

        def run(argv, **kwargs):
            self.inspect_call(argv, **kwargs)
            return subprocess.CompletedProcess(argv, 0, 'id,name\n7,"Oak, 🌳"\n', '')

        with patch.object(helper.subprocess, "run", side_effect=run) as mocked:
            result = helper.run_query("/guarded/query", self.sql)
        self.assertEqual(result, [{"id": "7", "name": "Oak, 🌳"}])
        mocked.assert_called_once()
        self.assert_cleaned()

    def test_query_failure_keeps_stderr_exit_two_and_no_retry(self):
        self.sql = "SELECT 1;"

        def run(argv, **kwargs):
            self.inspect_call(argv, **kwargs)
            return subprocess.CompletedProcess(argv, 3, "", "original query error\n")

        stderr = io.StringIO()
        with patch.object(helper.subprocess, "run", side_effect=run) as mocked:
            with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit) as error:
                helper.run_query("/guarded/query", self.sql)
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(stderr.getvalue(), "original query error\n")
        mocked.assert_called_once()
        self.assert_cleaned()

    def test_spawn_failure_and_interruption_cleanup_without_retry(self):
        self.sql = "SELECT 1;"
        for failure in (FileNotFoundError("query missing"), KeyboardInterrupt()):
            with self.subTest(failure=type(failure).__name__):
                def run(argv, **kwargs):
                    self.inspect_call(argv, **kwargs)
                    raise failure

                with patch.object(helper.subprocess, "run", side_effect=run) as mocked:
                    with self.assertRaises(type(failure)):
                        helper.run_query("/guarded/query", self.sql)
                mocked.assert_called_once()
                self.assert_cleaned()

    def test_temp_creation_failure_never_invokes_query(self):
        with patch.object(helper.tempfile, "NamedTemporaryFile", side_effect=OSError("no space")):
            with patch.object(helper.subprocess, "run") as mocked:
                with self.assertRaises(OSError):
                    helper.run_query("/guarded/query", "SELECT 1;")
        mocked.assert_not_called()

    def test_batch_order_and_json_output_unchanged(self):
        entries = [{"name": f"Synthetic {i}", "size": "1 G"} for i in range(5)]
        source = self.root / "entries.json"
        source.write_text(json.dumps(entries))
        sqls = []
        stdout = io.StringIO()
        with patch.object(sys, "argv", [str(SCRIPT), "--supplier", "999999",
                                       "--entries", str(source), "--batch", "2", "--format", "json"]):
            with patch.object(helper, "run_query", side_effect=lambda query, sql: sqls.append(sql) or []):
                with contextlib.redirect_stdout(stdout):
                    helper.main()
        for i, entry in enumerate(entries):
            entry["idx"] = i
        self.assertEqual(sqls, [helper.build_sql(999999, entries[i:i+2], 5, 0.25, True)
                                for i in range(0, 5, 2)])
        result = json.loads(stdout.getvalue())
        self.assertEqual([r["idx"] for r in result], list(range(5)))
        self.assertTrue(all(r["candidates"] == [] and r["suggest"] == "insert" for r in result))

    def fake_psql_env(self):
        # PATH contains only a node symlink and this mock psql. No inherited
        # environment or credentials: a missing mock cannot reach a real DB.
        node = shutil.which("node")
        if not node:
            self.skipTest("node required for offline guarded-query integration")
        bindir = self.root / "bin"
        bindir.mkdir()
        (bindir / "node").symlink_to(node)
        psql = bindir / "psql"
        psql.write_text(f"#!{sys.executable}\n" + '''import json, os, sys
from pathlib import Path
Path(os.environ["CAPTURE"]).write_bytes(sys.stdin.buffer.read())
Path(os.environ["FLAGS"]).write_text(json.dumps(sys.argv[1:]))
sys.stdout.write("id,name\\n7,synthetic\\n")
sys.exit(int(os.environ["MOCK_STATUS"]))
''')
        psql.chmod(0o700)
        return {"PATH": str(bindir), "SUPABASE_PROJECT_ID": "offline-placeholder",
                "SUPABASE_DB_PASSWORD": "offline-placeholder", "PGHOST": "offline.invalid",
                "CAPTURE": str(self.root / "captured.sql"), "FLAGS": str(self.root / "flags.json"),
                "MOCK_STATUS": "0"}

    def test_real_guard_file_path_large_sql_reaches_only_mock_psql(self):
        env = self.fake_psql_env()
        sql = helper.build_sql(999999, [{"idx": 0, "name": "Synthetic 🌳 " + "x" * 300_000}],
                               5, 0.25, True)
        query = helper.find_query_script()
        with patch.dict(os.environ, env, clear=True):
            result = helper.run_query(query, sql)
        self.assertEqual(result, [{"id": "7", "name": "synthetic"}])
        self.assertEqual(Path(env["CAPTURE"]).read_bytes(), sql.encode("utf-8"))
        flags = json.loads(Path(env["FLAGS"]).read_text())
        self.assertEqual(flags, ["--no-psqlrc", "--pset=pager=off", "-v", "ON_ERROR_STOP=1",
                                 "--quiet", "--csv"])
        self.assertEqual(list(self.root.glob("match-candidates-*.sql")), [])

    def test_real_guard_still_blocks_forbidden_sql_before_mock_psql(self):
        env = self.fake_psql_env()
        stderr = io.StringIO()
        with patch.dict(os.environ, env, clear=True), contextlib.redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as error:
                helper.run_query(helper.find_query_script(), "SELECT 1; DROP TABLE synthetic;")
        self.assertEqual(error.exception.code, 2)
        self.assertIn("SQL validation failed", stderr.getvalue())
        self.assertFalse(Path(env["CAPTURE"]).exists())
        self.assertEqual(list(self.root.glob("match-candidates-*.sql")), [])

    def test_real_query_nonzero_stays_nonzero_and_cleans_up(self):
        env = self.fake_psql_env()
        env["MOCK_STATUS"] = "3"
        with patch.dict(os.environ, env, clear=True), self.assertRaises(SystemExit) as error:
            helper.run_query(helper.find_query_script(), "SELECT 1;")
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(Path(env["CAPTURE"]).read_bytes(), b"SELECT 1;")
        self.assertEqual(list(self.root.glob("match-candidates-*.sql")), [])


if __name__ == "__main__":
    unittest.main()
