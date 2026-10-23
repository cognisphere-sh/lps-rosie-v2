#!/usr/bin/env bash
# Build the local demo stack the onboarding videos are recorded on:
#   1. local Supabase (Docker) with the reconstructed schema,
#   2. a copy of app/ WITHOUT .env* files, built against that local stack,
#   3. demo/local.env with the local keys for reset.sh and the recorders.
# Then run: demo/harness-mock.mjs, the app (next start -p 3217) and rec/chN.mjs.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
WORK=${DEMO_WORK:-$HERE/.work}   # gitignored: the app copy lives here

(cd "$HERE/stack" && supabase start -x studio,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta,mailpit)
(cd "$HERE/stack" && supabase status -o env | grep -E '^(SERVICE_ROLE_KEY|API_URL)=') > "$HERE/local.env"
set -a; . "$HERE/local.env"; set +a
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: API_URL is not local" >&2; exit 1 ;; esac
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -q -v ON_ERROR_STOP=1 -f "$HERE/schema.sql"

# The app imports harness/plugins/webchat/questions.ts from ../harness, so keep that shape.
mkdir -p "$WORK/harness/plugins/webchat"
cp "$REPO/harness/plugins/webchat/questions.ts" "$WORK/harness/plugins/webchat/"
rsync -a --delete --exclude node_modules --exclude .next --exclude '.env*' --exclude public/docs "$REPO/app/" "$WORK/app/"
find "$WORK/app" -path "$WORK/app/node_modules" -prune -o -name '*.test.ts*' -print -delete >/dev/null
# Turbopack must see ../harness from the copy.
WORK="$WORK" perl -pi -e 's|^const config: NextConfig = \{|const config: NextConfig = {\n  turbopack: { root: "$ENV{WORK}" },|' "$WORK/app/next.config.ts"
cat > "$WORK/app/.env.production.local" <<EOF
SUPABASE_URL=$API_URL
SUPABASE_SECRET_KEY=$SERVICE_ROLE_KEY
APP_SESSION_SECRET=$(openssl rand -hex 24)
AUTH_EMAIL_DOMAIN=demo.invalid
HARNESS_URL=http://127.0.0.1:4799
WEBCHAT_APP_SECRET=demo-secret
SUPPLIER_EVENTS_APP_SECRET=demo-secret
HARNESS_APP_SECRET=
ARTIFACTS_APP_SECRET=
ARTIFACTS_AGENTS=
DOMAIN=
DEV_ORIGIN=
EOF
(cd "$WORK/app" && npm install --no-fund --no-audit && npx next build)
"$HERE/reset.sh" S2
echo "Ready. Start: (cd $WORK/app && npx next start -p 3217 -H 127.0.0.1)"
