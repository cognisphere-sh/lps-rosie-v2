#!/usr/bin/env python3
"""Idempotently add the LPS upload-body limit to the generated app vhost."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import tempfile

BEGIN = "    # BEGIN LPS APP UPLOAD LIMIT"
END = "    # END LPS APP UPLOAD LIMIT"


def managed_block(app_port: int) -> str:
    return f"""{BEGIN}
    # Keep the public proxy ceiling aligned with webchat's per-file 25 MiB cap.
    # The partner chat endpoint also carries non-upload requests; GET/small JSON
    # bodies are unaffected, while `?upload=1` can stream the documented limit.
    location ~ ^/api/(?:chat/[^/]+/upload|partner/[^/]+/chat)$ {{
        client_max_body_size 25m;
        proxy_pass http://127.0.0.1:{app_port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
{END}
"""


def server_ranges(text: str) -> list[tuple[int, int]]:
    lines = text.splitlines(keepends=True)
    starts: list[int] = []
    ranges: list[tuple[int, int]] = []
    offset = 0
    depth = 0
    start_offset: int | None = None
    for line in lines:
        code = line.split("#", 1)[0]
        if depth == 0 and re.match(r"^\s*server\s*\{\s*$", code):
            start_offset = offset
            starts.append(offset)
        depth += code.count("{") - code.count("}")
        offset += len(line)
        if start_offset is not None and depth == 0:
            ranges.append((start_offset, offset))
            start_offset = None
    if start_offset is not None or len(starts) != len(ranges):
        raise ValueError("unbalanced Nginx server block")
    return ranges


def transform(text: str, domain: str, app_port: int) -> str:
    candidates: list[tuple[int, int]] = []
    server_name = re.compile(rf"^\s*server_name\s+{re.escape(domain)}\s*;\s*$", re.MULTILINE)
    upstream = f"proxy_pass http://127.0.0.1:{app_port};"
    for start, end in server_ranges(text):
        block = text[start:end]
        if server_name.search(block) and upstream in block:
            candidates.append((start, end))
    if len(candidates) != 1:
        raise ValueError(
            f"expected exactly one app server for {domain} -> 127.0.0.1:{app_port}; found {len(candidates)}"
        )

    start, end = candidates[0]
    block = text[start:end]
    replacement = managed_block(app_port)
    if BEGIN in block or END in block:
        pattern = re.compile(rf"^\s*{re.escape(BEGIN.strip())}\n.*?^\s*{re.escape(END.strip())}\n?", re.MULTILINE | re.DOTALL)
        if len(pattern.findall(block)) != 1:
            raise ValueError("malformed or duplicate managed upload-limit block")
        block = pattern.sub(replacement, block, count=1)
    else:
        location = re.search(r"^\s*location\s+/\s*\{", block, re.MULTILINE)
        if not location:
            raise ValueError("app server has no generated `location /` proxy block")
        block = block[: location.start()] + replacement + block[location.start() :]
    return text[:start] + block + text[end:]


def write_atomic(path: Path, content: str) -> None:
    original = path.stat()
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as temp:
        temp.write(content)
        temp_path = Path(temp.name)
    try:
        os.chmod(temp_path, original.st_mode)
        os.chown(temp_path, original.st_uid, original.st_gid)
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("site", type=Path)
    parser.add_argument("domain")
    parser.add_argument("app_port", type=int)
    args = parser.parse_args()
    before = args.site.read_text()
    after = transform(before, args.domain, args.app_port)
    if after != before:
        write_atomic(args.site, after)
        print(f"updated {args.site}: 25 MiB upload locations")
    else:
        print(f"unchanged {args.site}: 25 MiB upload locations already present")


if __name__ == "__main__":
    main()
