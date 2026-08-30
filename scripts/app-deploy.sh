#!/usr/bin/env bash
# Production wrapper: only the validated installed namespace can select identity.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; [[ -f "$ROOT/config" ]] && source "$ROOT/config"
NAME="${APP_NAME:-$(basename "$ROOT")}"; [[ "$NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || exit 70
META="/etc/$NAME/app-pipeline.json"; python3 "$ROOT/scripts/app-pipeline.py" validate-metadata "$META" "$ROOT" "$NAME" >/dev/null
exec bash "$ROOT/scripts/app-deploy-core.sh" "$META" production
