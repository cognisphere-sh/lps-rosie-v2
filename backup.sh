#!/usr/bin/env bash
# backup.sh — zip the whole app dir to S3. Driven by the cron job that
# setup-server.sh writes (/etc/cron.d/rosie-backup); config keys:
# BACKUP_S3_BUCKET (bucket or bucket/prefix; blank = off), BACKUP_KEEP.
#
# What's in the zip: everything under this directory — .secrets, agent
# workspaces/sessions, .git — EXCEPT node_modules/.next/.venv (reproducible
# via pnpm install / next build) and the LIVE SQLite files.
# SQLite: each *.db is snapshotted with `sqlite3 .backup` into <name>.db.snap
# (consistent even mid-write under WAL); the live .db/.db-wal/.db-shm are
# excluded. RESTORE: unzip, then rename each *.db.snap back to *.db.
#
# AWS auth: the aws CLI default chain — on EC2 that's the instance IAM role
# (needs s3:PutObject/ListBucket/DeleteObject on the backup bucket).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=config.example
source "$DIR/config"
[[ -n "${BACKUP_S3_BUCKET:-}" ]] || exit 0   # backups disabled
# Local testing: honor the config's named aws-cli profile (EC2 uses the IAM role).
[[ -n "${AWS_PROFILE:-}" ]] && export AWS_PROFILE

KEEP="${BACKUP_KEEP:-14}"
DEST="s3://${BACKUP_S3_BUCKET%/}"
NAME="rosie-$(date -u +%Y%m%d-%H%M%S).zip"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; find "$DIR" -name '*.db.snap' -not -path '*/node_modules/*' -delete 2>/dev/null || true; }
trap cleanup EXIT

# Consistent SQLite snapshots next to each live DB (picked up by the zip).
while IFS= read -r db; do
  sqlite3 "$db" ".backup '$db.snap'"
done < <(find "$DIR" -name '*.db' -not -path '*/node_modules/*' 2>/dev/null)

cd "$DIR/.."
zip -qr "$TMP/$NAME" "$(basename "$DIR")" \
  -x '*/node_modules/*' '*/.next/*' '*/.venv/*' '*.db' '*.db-wal' '*.db-shm'

aws s3 cp --only-show-errors "$TMP/$NAME" "$DEST/$NAME"

# Retention: keep the newest $KEEP, delete the rest (names sort chronologically).
aws s3 ls "$DEST/" | awk '/rosie-[0-9]{8}-[0-9]{6}\.zip$/ {print $4}' | sort | head -n -"$KEEP" \
  | while read -r old; do aws s3 rm --only-show-errors "$DEST/$old"; done

echo "$(date -u +%FT%TZ) backup ok: $NAME -> $DEST (keep $KEEP)"
