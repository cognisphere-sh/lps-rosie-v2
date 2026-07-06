#!/usr/bin/env bash
# Control both services.  Usage: sudo ./server.sh {start|stop|restart|status|logs|build|harness|dev|secrets}
# The three commands: sudo ./setup-server.sh (one-time prod prep) · sudo
# ./server.sh build (build only) · sudo ./server.sh … (run/manage).
# start/restart run secrets + build themselves — deploy loop:
#   git pull && sudo ./server.sh restart
set -euo pipefail
UNITS=(rosie-harness.service rosie-web.service)

# Load deploy params (DOMAIN, ports, ...) if present.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$DIR/config" ] && . "$DIR/config"

# Materialize the deploy `config` into the files the stack reads:
#   lps-harness/.secrets/users.json — harness sign-in
#   web/.env.local                  — service login (availability-form route) +
#                                     DOMAIN/PORT/HARNESS_URL for local runs
# `config` is the single source of truth; both files are gitignored + regenerated.
# Blank APP_PASS = generated once, then REUSED from the existing users.json so
# a blank config doesn't churn the password across restarts. A tiny node writer
# does the JSON (safe escaping); node is a hard dependency of the harness.
gen_secrets() {
  install -d "$DIR/lps-harness/.secrets"
  DIR="$DIR" APP_USER="${APP_USER:-Dyson}" APP_PASS="${APP_PASS:-}" \
  DOMAIN="${DOMAIN:-}" WEB_PORT="${WEB_PORT:-3000}" HARNESS_PORT="${HARNESS_PORT:-7331}" \
  node <<'NODE'
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const E = process.env;
const usersPath = path.join(E.DIR, "lps-harness/.secrets/users.json");
let old = null; try { old = JSON.parse(fs.readFileSync(usersPath, "utf8")); } catch {}
const user = E.APP_USER || "Dyson";
const pass = E.APP_PASS || old?.users?.[0]?.password || crypto.randomBytes(12).toString("hex");
const write600 = (p, s) => { fs.writeFileSync(p, s); fs.chmodSync(p, 0o600); };
write600(usersPath, JSON.stringify({ users: [{ username: user, password: pass }] }, null, 2) + "\n");
write600(path.join(E.DIR, "web/.env.local"),
  "# Generated from ../config by server.sh — do not hand-edit.\n" +
  `HARNESS_USER=${user}\nHARNESS_PASS=${pass}\nDOMAIN=${E.DOMAIN}\nPORT=${E.WEB_PORT}\n` +
  `HARNESS_URL=http://127.0.0.1:${E.HARNESS_PORT}\n`);
console.error(`>> app login: ${user} / ${pass}`);
NODE
  echo ">> wrote lps-harness/.secrets/users.json + web/.env.local from config"
}

# Build via build.sh. Under sudo, drop to the app user so node_modules and
# .next don't end up root-owned (RUN_USER from config, else the sudo'er).
do_build() {
  local BUILD_USER="${RUN_USER:-${SUDO_USER:-}}"
  if [[ $EUID -eq 0 && -n "$BUILD_USER" ]]; then
    sudo -u "$BUILD_USER" bash "$DIR/build.sh"
  else
    bash "$DIR/build.sh"
  fi
}

# start/restart = secrets + build + systemctl, so `git pull && sudo ./server.sh
# restart` is the whole deploy. `build` alone is for building without touching
# the running services.
case "${1:-}" in
  secrets) gen_secrets ;;
  build)   do_build ;;
  start)   gen_secrets; do_build; systemctl start   "${UNITS[@]}" ;;
  stop)    systemctl stop    "${UNITS[@]}" ;;
  restart) gen_secrets; do_build; systemctl restart "${UNITS[@]}" ;;
  status)  systemctl status --no-pager "${UNITS[@]}" ;;
  logs)    journalctl -u rosie-harness -u rosie-web -f ;;
  harness) cd "$DIR/lps-harness" && exec pnpm exec cognisphere serve --port "${HARNESS_PORT:-7331}" ;;
  dev)
    # Run the harness (port HARNESS_PORT) and the web dev server together so the
    # web app's /api + /admin proxy has a backend. Harness runs in the
    # background; Ctrl-C tears both down.
    gen_secrets
    ( cd "$DIR/lps-harness" && pnpm exec cognisphere serve --port "${HARNESS_PORT:-7331}" ) &
    HARNESS_PID=$!
    trap 'kill "$HARNESS_PID" 2>/dev/null' EXIT INT TERM
    DOMAIN="${DOMAIN:-}" HARNESS_URL="http://127.0.0.1:${HARNESS_PORT:-7331}" pnpm --filter web dev
    ;;
  *) echo "usage: $0 {start|stop|restart|status|logs|build|harness|dev|secrets}"; exit 1 ;;
esac
