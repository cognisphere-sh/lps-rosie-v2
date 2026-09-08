#!/usr/bin/env bash
# Deployment-owned production proxy additions. Sourced by ../setup-server.sh
# after Certbot has generated the public vhosts.

if $HAS_APP; then
  "$ROOT/scripts/app/configure-nginx-upload-limit.py" \
    "/etc/nginx/sites-available/$NAME" "$DOMAIN" "$APP_PORT"
  nginx -t
  systemctl reload nginx
fi
