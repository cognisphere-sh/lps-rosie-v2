#!/usr/bin/env python3
"""Check bounded instruction entry points, versions, local links and helper syntax."""
import argparse
import ast
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ("rosie", "daisy", "lily")


def check():
    errors, metrics = [], {}
    for agent in AGENTS:
        root = ROOT / "harness/agents" / agent
        skills = root / "skills/agent"
        prompts = list((root / "system_prompts").glob("*.md"))
        total_entries, descriptions = 0, 0
        for path in skills.glob("*/SKILL.md"):
            text = path.read_text()
            total_entries += len(text)
            header = text.split("---", 2)[1] if text.startswith("---\n") else ""
            version = re.search(r'^  version: "(\d+\.\d+\.\d+)"$', header, re.M)
            description = re.search(r"^description: (.+)$", header, re.M)
            name = re.search(r"^name: ([a-z0-9]+(?:-[a-z0-9]+)*)$", header, re.M)
            if not (version and description and name):
                errors.append(f"{path}: invalid/missing frontmatter")
                continue
            descriptions += len(description[1])
            if name[1] != path.parent.name or len(name[1]) > 64:
                errors.append(f"{path}: invalid skill name")
            if len(description[1]) > 400 or f"(v{version[1]})" not in description[1]:
                errors.append(f"{path}: long description or mismatched version")
            changelog = path.with_name("CHANGELOG.md")
            if not changelog.exists() or not re.search(r"^## " + re.escape(version[1]) + r"$", changelog.read_text(), re.M):
                errors.append(f"{path}: missing current changelog")
            if len(text) > 6500:
                errors.append(f"{path}: entry point exceeds 6500 characters; split task detail")
        for path in skills.glob("**/*.md"):
            if path.name == "CHANGELOG.md":
                continue
            text = path.read_text()
            # Fenced examples can contain intentional placeholder links.
            prose = re.sub(r"```.*?```", "", text, flags=re.S)
            for dest in re.findall(r"\]\(([^)]+)\)", prose):
                if ":" in dest or dest.startswith("#") or "<" in dest:
                    continue
                target = dest.split("#", 1)[0]
                if target and not (path.parent / target).exists():
                    errors.append(f"{path}: broken link {dest}")
            if re.search(r"(?:§|section )\d", prose):
                errors.append(f"{path}: stale numbered cross-reference")
            if "bash scripts/gws/email" in text:
                errors.append(f"{path}: email CLI is a Node executable")
        for path in skills.glob("*/scripts/*"):
            if path.is_file() and path.read_bytes().startswith(b"#!/usr/bin/env python3"):
                try:
                    ast.parse(path.read_text(), filename=str(path))
                except SyntaxError as exc:
                    errors.append(str(exc))
                if not path.name.endswith('.test.py') and not os.access(path, os.X_OK):
                    errors.append(f"{path}: helper is not executable")
        # Harness-owned 0-* and plugin prompts are not optimization targets.
        deployment = [p for p in prompts if p.name.startswith("1")]
        deployment_chars = sum(len(p.read_text()) for p in deployment)
        if deployment_chars > 6500:
            errors.append(f"{agent}: deployment prompts exceed 6500 characters")
        metrics[agent] = {"deployment_prompt_chars": deployment_chars,
                          "all_prompt_chars": sum(len(p.read_text()) for p in prompts),
                          "skill_entry_chars": total_entries,
                          "skill_description_chars": descriptions}
    copies = [(ROOT / f"harness/agents/{a}/skills/agent/database-access/scripts/schema").read_bytes() for a in ("rosie", "daisy")]
    if len(set(copies)) != 1:
        errors.append("schema selector copies have drifted")
    return errors, metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    errors, metrics = check()
    if args.json:
        print(json.dumps({"metrics": metrics, "errors": errors}, indent=2))
    else:
        for agent, values in metrics.items():
            print(f"{agent}: " + ", ".join(f"{k}={v}" for k, v in values.items()))
        for error in errors:
            print(error, file=sys.stderr)
        print(f"Instruction checks: {len(errors)} errors")
    sys.exit(bool(errors))
