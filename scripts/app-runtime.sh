#!/usr/bin/env bash
# Convenience entry point only; production systemd uses its root-installed copy
# of app-runtime-launcher.sh and never executes this worktree file.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; [[ -f "$ROOT/config" ]] && source "$ROOT/config"
NAME="${APP_NAME:-$(basename "$ROOT")}"; meta="/etc/$NAME/app-pipeline.json"
if [[ -f "$meta" ]]; then exec "/usr/local/lib/$NAME/app-runtime" "$meta"; fi
echo "no installed runtime; use pnpm qa for an isolated production server" >&2
exit 1
