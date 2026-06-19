#!/usr/bin/env bash
# Control both services.  Usage: sudo ./server.sh {start|stop|restart|status|logs|harness|dev}
set -euo pipefail
UNITS=(rosie-harness.service rosie-web.service)

# Load deploy params (DOMAIN, ports, ...) if present.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$DIR/config" ] && . "$DIR/config"

case "${1:-}" in
  start)   systemctl start   "${UNITS[@]}" ;;
  stop)    systemctl stop    "${UNITS[@]}" ;;
  restart) systemctl restart "${UNITS[@]}" ;;
  status)  systemctl status --no-pager "${UNITS[@]}" ;;
  logs)    journalctl -u rosie-harness -u rosie-web -f ;;
  harness) cd "$DIR/lps-harness" && exec pnpm exec cognisphere serve --port "${HARNESS_PORT:-7331}" ;;
  dev)
    # Run the harness (port HARNESS_PORT) and the web dev server together so the
    # web app's /api + /admin proxy has a backend. Harness runs in the
    # background; Ctrl-C tears both down.
    ( cd "$DIR/lps-harness" && pnpm exec cognisphere serve --port "${HARNESS_PORT:-7331}" ) &
    HARNESS_PID=$!
    trap 'kill "$HARNESS_PID" 2>/dev/null' EXIT INT TERM
    DOMAIN="${DOMAIN:-}" HARNESS_URL="http://127.0.0.1:${HARNESS_PORT:-7331}" pnpm --filter web dev
    ;;
  *) echo "usage: $0 {start|stop|restart|status|logs|harness|dev}"; exit 1 ;;
esac
