#!/usr/bin/env bash
# Control both services.  Usage: sudo ./server.sh {start|stop|restart|status|logs}
set -euo pipefail
UNITS=(rosie-harness.service rosie-web.service)

case "${1:-}" in
  start)   systemctl start   "${UNITS[@]}" ;;
  stop)    systemctl stop    "${UNITS[@]}" ;;
  restart) systemctl restart "${UNITS[@]}" ;;
  status)  systemctl status --no-pager "${UNITS[@]}" ;;
  logs)    journalctl -u rosie-harness -u rosie-web -f ;;
  *) echo "usage: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
