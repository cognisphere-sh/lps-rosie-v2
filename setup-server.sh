#!/usr/bin/env bash
# One-time prod setup: deps, build, systemd units, nginx + Let's Encrypt HTTPS.
# Run as root on a fresh Ubuntu/Debian box:  sudo ./setup-server.sh
# Re-runnable: rebuilds, rewrites units/nginx, renews cert.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$APP_DIR/config" ]] || { echo "no config file — run: cp config.example config && edit it"; exit 1; }
# shellcheck source=config.example
source "$APP_DIR/config"
RUN_USER="${RUN_USER:-${SUDO_USER:-$USER}}"

[[ $EUID -eq 0 ]] || { echo "run as root (sudo)"; exit 1; }
echo ">> web=$DOMAIN:$WEB_PORT console=$CONSOLE_DOMAIN:$HARNESS_PORT dir=$APP_DIR user=$RUN_USER"

# ---- system packages ------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates nginx
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx

# Node (NodeSource) + pnpm via corepack
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@latest --activate

# ---- build (as the app user so node_modules aren't root-owned) -------------
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && pnpm install --frozen-lockfile"
sudo -u "$RUN_USER" bash -c "cd '$APP_DIR' && pnpm --filter web build"

# ---- systemd units --------------------------------------------------------
NODE_BIN_DIR="$(dirname "$(command -v node)")"

cat > /etc/systemd/system/rosie-harness.service <<EOF
[Unit]
Description=Rosie cognisphere harness (backend + built-in UI)
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR/lps-harness
Environment=PATH=$NODE_BIN_DIR:/usr/bin:/bin
ExecStart=$NODE_BIN_DIR/pnpm exec cognisphere serve --port $HARNESS_PORT
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/rosie-web.service <<EOF
[Unit]
Description=Rosie web app (Next.js)
After=network.target rosie-harness.service
Wants=rosie-harness.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR/web
Environment=PATH=$NODE_BIN_DIR:/usr/bin:/bin
Environment=NODE_ENV=production
Environment=PORT=$WEB_PORT
Environment=HARNESS_URL=http://127.0.0.1:$HARNESS_PORT
ExecStart=$NODE_BIN_DIR/pnpm --filter web start -- -p $WEB_PORT
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now rosie-harness.service rosie-web.service

# ---- nginx: web on $DOMAIN, harness UI on $CONSOLE_DOMAIN ------------------
# Console UI binds to 127.0.0.1 only; nginx is the sole public entry.
proxy_block() { cat <<EOF
    location / {
        proxy_pass http://127.0.0.1:$1;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF
}

cat > /etc/nginx/sites-available/rosie <<EOF
server {
    listen 80;
    server_name $DOMAIN;
$(proxy_block "$WEB_PORT")
}
server {
    listen 80;
    server_name $CONSOLE_DOMAIN;
$(proxy_block "$HARNESS_PORT")
}
EOF
ln -sf /etc/nginx/sites-available/rosie /etc/nginx/sites-enabled/rosie
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---- HTTPS (both names; needs DNS pointing here already) ------------------
certbot --nginx -d "$DOMAIN" -d "$CONSOLE_DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

echo ">> done. app: https://$DOMAIN  console: https://$CONSOLE_DOMAIN  |  manage: ./server.sh status"
