#!/usr/bin/env bash
# Deployment-owned production proxy additions. Sourced by ../setup-server.sh
# after Certbot has generated the public vhosts.

# HTTP/2 on every Certbot TLS vhost. Over HTTP/1.1 a browser holds at most six
# connections per host across all its tabs, and each open app page keeps one or
# two SSE streams; a few tabs exhaust the pool and every further request sits
# "pending". HTTP/2 multiplexes them on one connection. Delete-then-add keeps
# re-runs idempotent.
sed -i -E \
  -e '/^[[:space:]]*http2 on;[[:space:]]*$/d' \
  -e 's/^([[:space:]]*)listen 443 ssl;.*$/&\n\1http2 on;/' \
  "/etc/nginx/sites-available/$NAME"

if $HAS_APP; then
  "$ROOT/scripts/app/configure-nginx-upload-limit.py" \
    "/etc/nginx/sites-available/$NAME" "$DOMAIN" "$APP_PORT"
fi
nginx -t
systemctl reload nginx
