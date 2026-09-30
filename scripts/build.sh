#!/usr/bin/env bash
# build.sh — install deps + build the user-facing app (when app/ exists).
# Optional target: all (default), app, harness. --if-needed reuses successful
# installs/builds when their content fingerprints still match (used by restart).
# Run as the app user, no sudo:   ./scripts/build.sh
#
# The three commands:
#   sudo ./scripts/setup-server.sh   one-time prod prep (deps, systemd, nginx, HTTPS)
#   sudo ./scripts/server.sh build   build only (start/restart also run this build)
#                                    (or ./scripts/build.sh directly as the app user)
#   sudo ./scripts/server.sh …       start | stop | restart | status | logs | secrets | dev
# Typical deploy loop:  git pull && sudo ./scripts/server.sh restart
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/config" ]] && source "$ROOT/config"

TARGET="${1:-all}"
case "$TARGET" in all|app|harness) ;; *) echo "usage: $0 [all|app|harness] [--if-needed]" >&2; exit 1 ;; esac
INCREMENTAL=false
case "${2:-}" in "") ;; --if-needed) INCREMENTAL=true ;; *) echo "usage: $0 [all|app|harness] [--if-needed]" >&2; exit 1 ;; esac

cd "$ROOT"
# Serialize builds so concurrent restarts cannot reuse an unfinished build.
exec 9>"$ROOT/.server-build.lock"
flock 9

export BUILD_PNPM_VERSION="$(pnpm --version)"
FINGERPRINT="$ROOT/scripts/lib/build-fingerprint.mjs"
DEPS_STAMP="$ROOT/node_modules/.cache/server-build/dependencies.sha256"
APP_STAMP="$ROOT/app/.next/.server-build.sha256"
DEPS_INPUTS="$(node "$FINGERPRINT" dependencies "$ROOT")"
INSTALL_NEEDED=false
if ! $INCREMENTAL || [[ ! -f "$DEPS_STAMP" ]] || [[ "$(cat "$DEPS_STAMP")" != "$DEPS_INPUTS" ]] \
   || [[ ! -f "$ROOT/harness/node_modules/@cognisphere-sh/cognisphere-harness/package.json" ]] \
   || { [[ -f "$ROOT/app/package.json" ]] && [[ ! -f "$ROOT/app/node_modules/next/package.json" ]]; }; then
  INSTALL_NEEDED=true
  # Clear success markers before work: a failed install/build must be retried.
  rm -f "$DEPS_STAMP" "$APP_STAMP"
  # Resolve the package token only when an install is actually needed.
  export COGNISPHERE_NPM_TOKEN="${COGNISPHERE_NPM_TOKEN:-$(gh auth token 2>/dev/null || true)}"
  echo ">> installing dependencies"
  pnpm install --frozen-lockfile
  DEPS_INPUTS="$(node "$FINGERPRINT" dependencies "$ROOT")"
  mkdir -p "$(dirname "$DEPS_STAMP")"
  printf '%s\n' "$DEPS_INPUTS" > "$DEPS_STAMP"
else
  echo ">> dependencies unchanged — skipping install"
fi

if [[ "$TARGET" != harness && -f "$ROOT/app/package.json" ]]; then
  APP_INPUTS="$(node "$FINGERPRINT" app "$ROOT")"
  if $INCREMENTAL && ! $INSTALL_NEEDED && [[ -f "$APP_STAMP" && -s "$ROOT/app/.next/BUILD_ID" \
      && -f "$ROOT/app/.next/required-server-files.json" && -d "$ROOT/app/.next/server" && -d "$ROOT/app/.next/static" ]] \
      && [[ "$(cat "$APP_STAMP")" == "$APP_INPUTS $(cat "$ROOT/app/.next/BUILD_ID")" ]]; then
    echo ">> app inputs unchanged — skipping build"
  else
    rm -f "$APP_STAMP"
    echo ">> building app"
    pnpm --dir "$ROOT/app" run build
    if [[ "$APP_INPUTS" != "$(node "$FINGERPRINT" app "$ROOT")" ]]; then
      echo ">> app inputs changed during build — rerun before restarting" >&2
      exit 1
    fi
    printf '%s %s\n' "$APP_INPUTS" "$(cat "$ROOT/app/.next/BUILD_ID")" > "$APP_STAMP"
  fi
fi
echo ">> build ok — apply with: sudo ./scripts/server.sh restart"
