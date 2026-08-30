#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp "$ROOT/"{package.json,pnpm-lock.yaml,pnpm-workspace.yaml,.npmrc} "$TMP/"
mkdir "$TMP/harness"; cp "$ROOT/harness/package.json" "$TMP/harness/"
[[ ! -e "$TMP/node_modules" && ! -e "$TMP/harness/node_modules" ]]
COGNISPHERE_NPM_TOKEN="${COGNISPHERE_NPM_TOKEN:-$(gh auth token)}" pnpm --dir "$TMP" install --filter cognisphere-harness-rosie... --frozen-lockfile >/dev/null
[[ -x "$TMP/harness/node_modules/.bin/cognisphere" ]]
COGNISPHERE_NPM_TOKEN=x "$TMP/harness/node_modules/.bin/cognisphere" --help | grep -q 'multi-agent harness CLI'
echo 'empty-host frozen harness install: ok'
