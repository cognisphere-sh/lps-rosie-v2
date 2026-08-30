#!/usr/bin/env bash
# Immutable isolated verification; installation occurs only in its snapshot
# while the global app build lock is held.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/app/package.json" ]] && pnpm --dir "$ROOT/app" run build
echo ">> immutable isolated build check ok — deploy with: sudo ./scripts/server.sh restart app"
