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
apt-get install -y curl ca-certificates nginx zip sqlite3
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
command -v aws >/dev/null || apt-get install -y awscli   # S3 backups

# Node (NodeSource) + pnpm via corepack
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi
# The corepack bundled with Node can be too old to launch a recent pnpm
# (throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING). Update it first.
npm install -g corepack@latest
corepack enable
corepack prepare pnpm@latest --activate

# ---- GitHub Packages token --------------------------------------------------
# @cognisphere-sh/* live on GitHub Packages, whose npm registry requires a token
# with the read:packages scope EVEN for public packages (anonymous = 401, a
# scope-short token = 403). Prefer COGNISPHERE_NPM_TOKEN from config (a PAT); else
# use the run user's gh CLI token. A gh OAuth token (gho_*) exists but often lacks
# read:packages, so a bare `gh auth token` check would pass yet still 403 at fetch
# time — verify/repair the scope here instead of failing mid-build.
if [[ -z "${COGNISPHERE_NPM_TOKEN:-}" ]]; then
  command -v gh >/dev/null || { echo "no COGNISPHERE_NPM_TOKEN in config and gh CLI not installed. Set COGNISPHERE_NPM_TOKEN (a PAT with read:packages) in config, or install gh and run: sudo -u $RUN_USER gh auth login -s read:packages"; exit 1; }
  # gh runs as the app user; ensure it's logged in and the token carries read:packages.
  # (gh prints "Token scopes:" to stderr, hence 2>&1.)
  if ! sudo -u "$RUN_USER" gh auth status >/dev/null 2>&1; then
    echo ">> gh is not authenticated for $RUN_USER — launching login (needs read:packages)"
    sudo -u "$RUN_USER" gh auth login -s read:packages || { echo "gh auth login failed"; exit 1; }
  elif ! sudo -u "$RUN_USER" gh auth status 2>&1 | grep -q 'read:packages'; then
    echo ">> gh token for $RUN_USER lacks the read:packages scope — refreshing"
    sudo -u "$RUN_USER" gh auth refresh -s read:packages || { echo "gh auth refresh failed"; exit 1; }
  fi
  COGNISPHERE_NPM_TOKEN="$(sudo -u "$RUN_USER" gh auth token 2>/dev/null || true)"
fi
[[ -n "$COGNISPHERE_NPM_TOKEN" ]] || { echo "no GitHub token for @cognisphere-sh packages. Set COGNISPHERE_NPM_TOKEN in config (a PAT with read:packages), or run: sudo -u $RUN_USER gh auth refresh -s read:packages"; exit 1; }
# pnpm refuses to expand env-var credentials from the committed project .npmrc,
# so the auth line must live in the run user's ~/.npmrc (a trusted source).
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
sudo -u "$RUN_USER" touch "$RUN_HOME/.npmrc"
sudo -u "$RUN_USER" grep -qF 'npm.pkg.github.com/:_authToken' "$RUN_HOME/.npmrc" \
  || echo '//npm.pkg.github.com/:_authToken=${COGNISPHERE_NPM_TOKEN}' | sudo -u "$RUN_USER" tee -a "$RUN_HOME/.npmrc" >/dev/null

# ---- credentials ------------------------------------------------------------
# `server.sh secrets` is the single source: it writes users.json (harness login)
# and web/.env.local (service login + DOMAIN/PORT/HARNESS_URL). Blank APP_PASS
# is generated once and reused. Runs as RUN_USER so the files are owned
# correctly. It echoes the resolved "app login: <user> / <pass>".
install -d -o "$RUN_USER" "$APP_DIR/lps-harness/.secrets"
sudo -u "$RUN_USER" bash "$APP_DIR/server.sh" secrets

# ---- build (as the app user so node_modules aren't root-owned) -------------
# Delegated to build.sh — the same command used for every later deploy
# (git pull && sudo ./server.sh restart).
sudo -u "$RUN_USER" env COGNISPHERE_NPM_TOKEN="$COGNISPHERE_NPM_TOKEN" bash "$APP_DIR/build.sh"

# ---- systemd units --------------------------------------------------------
NODE_BIN_DIR="$(dirname "$(command -v node)")"
# pnpm lives where corepack@latest installed it (the npm global bin, e.g.
# /usr/local/bin) — NOT necessarily next to node. The OS may also ship an older
# /usr/bin/pnpm (apt node-corepack) that throws
# ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING on Node 22, so resolve the active pnpm
# explicitly and put its dir first on the unit PATH instead of assuming
# $NODE_BIN_DIR/pnpm.
PNPM_BIN="$(command -v pnpm)"
PNPM_BIN_DIR="$(dirname "$PNPM_BIN")"
# The harness spawns the `pi` coding agent by name (PATH lookup). pi is a
# per-user install ($RUN_HOME/.local/bin/pi), so that dir MUST be on the unit
# PATH or every spawn fails with `spawn pi ENOENT`. node/pnpm may both live in
# /usr/bin, so don't rely on their dirs to carry it.
UNIT_PATH="$RUN_HOME/.local/bin:$PNPM_BIN_DIR:$NODE_BIN_DIR:/usr/bin:/bin"

cat > /etc/systemd/system/rosie-harness.service <<EOF
[Unit]
Description=Rosie cognisphere harness (backend + built-in UI)
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR/lps-harness
Environment=PATH=$UNIT_PATH
# Empty so pnpm can expand the \${COGNISPHERE_NPM_TOKEN} ref in the run user's
# ~/.npmrc without warning. The service does no installs, so no real token is
# needed at runtime.
Environment=COGNISPHERE_NPM_TOKEN=
ExecStart=$PNPM_BIN exec cognisphere serve --port $HARNESS_PORT
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
Environment=PATH=$UNIT_PATH
Environment=NODE_ENV=production
Environment=PORT=$WEB_PORT
Environment=HARNESS_URL=http://127.0.0.1:$HARNESS_PORT
Environment=COGNISPHERE_NPM_TOKEN=
# `next start` honors \$PORT; passing "-- -p" trips Next 16's arg parser (it
# reads -p as a project dir), so rely on the PORT env above.
ExecStart=$PNPM_BIN --filter web start
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

# ---- S3 backups (cron) -----------------------------------------------------
# backup.sh zips the whole app dir (consistent SQLite snapshots, minus
# node_modules/.next/.venv) to BACKUP_S3_BUCKET and prunes to BACKUP_KEEP.
# AWS auth = the instance IAM role; no keys in config needed.
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  H="${BACKUP_EVERY_HOURS:-24}"
  # cron can't express "every N hours" for N>=24 — degrade to daily at 03:00 UTC.
  if [[ "$H" =~ ^[0-9]+$ ]] && (( H >= 1 && H <= 23 )); then SCHED="0 */$H * * *"; else SCHED="0 3 * * *"; fi
  install -d -o "$RUN_USER" "$APP_DIR/logs"
  cat > /etc/cron.d/rosie-backup <<EOF
# Rosie S3 backup — written by setup-server.sh; edit config, not this file.
$SCHED $RUN_USER $APP_DIR/backup.sh >> $APP_DIR/logs/backup.log 2>&1
EOF
  chmod 644 /etc/cron.d/rosie-backup
  echo ">> backups: $SCHED -> s3://${BACKUP_S3_BUCKET%/} (keep ${BACKUP_KEEP:-14})"
else
  rm -f /etc/cron.d/rosie-backup
  echo ">> backups: off (BACKUP_S3_BUCKET is blank)"
fi

echo ">> done. app: https://$DOMAIN  console: https://$CONSOLE_DOMAIN  |  manage: ./server.sh status"
