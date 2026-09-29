"""Shared by the ingestion helpers: safe literals and one JSON query."""
import csv
import io
import json
import os
from pathlib import Path
import secrets
import subprocess

AGENT_ROOT = Path(__file__).resolve().parents[4]
# Tests point DAISY_QUERY_BIN at a fake; production uses the guarded wrapper.
QUERY_BIN = os.environ.get("DAISY_QUERY_BIN") or str(AGENT_ROOT / "scripts/agent/supabase/query")


def lit(text):
    """Dollar-quote text so $, quotes and backticks stay literal."""
    if text is None:
        return "NULL"
    tag = "q" + secrets.token_hex(4)
    while f"${tag}$" in text:
        tag = "q" + secrets.token_hex(4)
    return f"${tag}${text}${tag}$"


def run(sql):
    """Run SQL on stdin (never through the shell); return CSV rows."""
    result = subprocess.run([QUERY_BIN, "--csv"], input=sql, text=True,
                            capture_output=True, cwd=AGENT_ROOT)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip() or "query failed")
    return list(csv.reader(io.StringIO(result.stdout)))


def json_value(sql):
    """Run a SELECT returning one json column; return it parsed."""
    # psql may print command tags (e.g. SET) and a header; take the last JSON cell.
    for row in reversed(run(sql)):
        if row and row[0].startswith(("{", "[")):
            return json.loads(row[0])
    return None


def cell(value, width=0):
    """Compact one value for text output: NULL → ∅, newlines flattened."""
    if value is None:
        return "∅"
    text = " / ".join(str(value).split("\n")) if isinstance(value, str) else str(value)
    return text if not width or len(text) <= width else text[: width - 1] + "…"


def money(value):
    return "∅" if value is None else f"${float(value):,.2f}"
