#!/usr/bin/env bash
# build.sh — install deps + build the web app from the local checkout.
# Run as the app user, no sudo:   ./build.sh
#
# The three commands:
#   sudo ./setup-server.sh   one-time prod prep (deps, systemd, nginx, HTTPS)
#   sudo ./server.sh build   build only (start/restart also run this build)
#                            (or ./build.sh directly as the app user)
#   sudo ./server.sh …       start | stop | restart | status | logs | secrets | dev
# Typical deploy loop:  git pull && sudo ./server.sh restart   (restart = secrets + build + restart)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$DIR/config" ]] && source "$DIR/config"

# @cognisphere-sh/* need a read:packages token even though they're public.
# ~/.npmrc references ${COGNISPHERE_NPM_TOKEN} (written by setup-server.sh);
# export it from config, falling back to the gh CLI token.
export COGNISPHERE_NPM_TOKEN="${COGNISPHERE_NPM_TOKEN:-$(gh auth token 2>/dev/null || true)}"

cd "$DIR"
pnpm install --frozen-lockfile
pnpm --filter web build
echo ">> build ok — apply with: sudo ./server.sh restart"
