#!/usr/bin/env python3

from pathlib import Path
import re
import unittest

SCRIPTS = Path(__file__).resolve().parent
SINK = re.compile(r"(?:\b(?:echo|printf)\b|console\.(?:log|error|warn)\s*\(|process\.(?:stdout|stderr)\.write\s*\()")
SENSITIVE_NAME = re.compile(
    r"(?:^|_)(?:PASS(?:WORD)?|SECRET(?:_KEY)?|TOKEN|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?)(?:$|_)",
    re.IGNORECASE,
)
INTERPOLATION = re.compile(r"\$\{?([A-Za-z_][A-Za-z0-9_]*)")
ASSIGNMENT_LABEL = re.compile(
    r"(?:PASS(?:WORD)?|SECRET(?:_KEY)?|TOKEN|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?)\s*=",
    re.IGNORECASE,
)
FILE_REDIRECT = re.compile(r"(?:^|\s)(?:1)?>>?\s+(?!&)(?:['\"$./~]|[A-Za-z_])")


def output_statements(text: str):
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        if not SINK.search(lines[index]):
            index += 1
            continue
        start = index
        sink_match = SINK.search(lines[index])
        assert sink_match
        statement = lines[index][sink_match.start() :]
        if "process." in lines[index] or "console." in lines[index]:
            balance = statement.count("(") - statement.count(")")
            while balance > 0 and index + 1 < len(lines):
                index += 1
                statement += "\n" + lines[index]
                balance += lines[index].count("(") - lines[index].count(")")
        else:
            while statement.rstrip().endswith("\\") and index + 1 < len(lines):
                index += 1
                statement += "\n" + lines[index]
        yield start + 1, statement
        index += 1


def is_sensitive_name(name: str) -> bool:
    if re.search(r"(?:_|^)(?:ID|NAME|OWNER|PATH|FILE|DIR)$", name, re.IGNORECASE):
        return False
    lower = name.lower()
    return bool(
        SENSITIVE_NAME.search(name)
        or any(part in lower for part in ("pass", "secret", "token", "accesskey", "privatekey", "credential"))
    )


def exposes_secret(statement: str) -> bool:
    # A file redirect is a materialization destination, not deployment output.
    # stderr/stdout fd redirects (>&2, /dev/stdout) intentionally do not qualify.
    if FILE_REDIRECT.search(statement) and "/dev/std" not in statement:
        return False
    # Single-quoted shell text is literal: ${TOKEN} in the npmrc template is not
    # expanded by the shell and therefore is not a credential value.
    interpolation_source = re.sub(r"'[^']*'", "", statement)
    names = INTERPOLATION.findall(interpolation_source)
    if any(is_sensitive_name(name) for name in names):
        return True
    if ASSIGNMENT_LABEL.search(interpolation_source) and names:
        return True
    return bool(
        re.search(
            r"(?:console\.(?:log|error|warn)|process\.(?:stdout|stderr)\.write)\s*\(\s*"
            r"(?:pass|password|secret|token|access_key|secret_key)\s*\)",
            statement,
            re.IGNORECASE,
        )
    )


class DeploymentSecretOutputTest(unittest.TestCase):
    def test_detects_raw_secret_output_patterns(self):
        unsafe = [
            'echo "$APP_PASS"',
            'console.error(`login: ${user} / ${pass}`);',
            'console.error(secret);',
            'console.error(`bearer: ${appSecret}`);',
            'process.stdout.write(`API_SECRET=${shared}\\n`);',
        ]
        for source in unsafe:
            with self.subTest(source=source):
                statement = next(output_statements(source))[1]
                self.assertTrue(exposes_secret(statement))

    def test_allows_protected_file_materialization_and_safe_confirmation(self):
        safe = [
            'printf "APP_PASS=%s\\n" "$APP_PASS" > "$ROOT/app/.env.local"',
            'console.error(`operator login configured for ${JSON.stringify(user)} (password hidden)`);',
            'console.error(`secrets wired for ${agents.join(", ")}`);',
        ]
        for source in safe:
            with self.subTest(source=source):
                statement = next(output_statements(source))[1]
                self.assertFalse(exposes_secret(statement))

    def test_deployment_scripts_do_not_log_secret_values(self):
        failures = []
        for path in sorted(SCRIPTS.rglob("*.sh")):
            text = path.read_text()
            for line, statement in output_statements(text):
                if exposes_secret(statement):
                    failures.append(f"{path.relative_to(SCRIPTS)}:{line}: {statement}")
        self.assertEqual([], failures, "raw secret output source found:\n" + "\n".join(failures))


if __name__ == "__main__":
    unittest.main()
