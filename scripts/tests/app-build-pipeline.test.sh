#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; REAL_PATH="$PATH"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
F="$TMP/home"; mkdir -p "$F/scripts" "$F/app" "$F/bin"
cp "$REPO/scripts/"{app-build.sh,app-deploy-core.sh,app-pipeline.py,app-runtime-launcher.sh} "$F/scripts/"
for f in package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc; do cp "$REPO/$f" "$F/$f"; done
cp "$REPO/app/"{package.json,tsconfig.json,next.config.ts,next-env.d.ts} "$F/app/"; printf 'source\n' > "$F/app/page.tsx"; printf 'SECRET_VALUE=supersecretvalue\n' > "$F/app/.env.local"
cat > "$F/bin/pnpm" <<'SH'
#!/usr/bin/env bash
if [[ " $* " == *" install "* ]]; then
  printf 'start %s\n' "$$" >> "${EVENTS:?}"; mkdir -p app/node_modules; sleep "${INSTALL_SLEEP:-0}"; printf 'end %s\n' "$$" >> "${EVENTS:?}"
fi
SH
cat > "$F/bin/fake-node" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == *server.js && -z "${LPS_NEXT_DIST_DIR:-}" ]]; then
  if [[ "${PORT:-}" == 3199 ]]; then sleep 30; else printf '%s secret=%s\n' "$PWD" "${SECRET_VALUE:-unset}" >> "${LAUNCH_LOG:?}"; fi
  exit 0
fi
[[ "${BUILD_FAIL:-0}" != 1 ]] || exit 42
printf 'snapshot mutation\n' > next-env.d.ts
mkdir -p "$LPS_NEXT_DIST_DIR/static/chunks" "$LPS_NEXT_DIST_DIR/standalone/app"
printf '%s\n' "${BUILD_ID:-candidate123}" > "$LPS_NEXT_DIST_DIR/BUILD_ID"
printf '{}\n' > "$LPS_NEXT_DIST_DIR/build-manifest.json"; printf '{}\n' > "$LPS_NEXT_DIST_DIR/routes-manifest.json"
printf 'chunk-%s\n' "${BUILD_ID:-candidate123}" > "$LPS_NEXT_DIST_DIR/static/chunks/app.js"
cat > "$LPS_NEXT_DIST_DIR/standalone/app/server.js" <<'JS'
require('fs').appendFileSync(process.env.LAUNCH_LOG, `${process.cwd()} secret=${process.env.SECRET_VALUE || 'unset'}\n`)
JS
sleep "${BUILD_SLEEP:-0}"
SH
printf '#!/usr/bin/env bash\nexit 0\n' > "$F/bin/fake-verify"
chmod +x "$F/bin/"* "$F/scripts/"*; export PATH="$F/bin:$PATH" EVENTS="$TMP/events" LAUNCH_LOG="$TMP/launch" LPS_NODE_BIN="$F/bin/fake-node" LPS_VERIFY_NODE_BIN="$F/bin/fake-verify" COGNISPHERE_NPM_TOKEN=packagetoken123
git -C "$F" init -q
LOCK="$F/.git/app-build.local.lock"; RUNTIME="$TMP/runtime"; META="$F/pipeline.json"; python3 "$F/scripts/app-pipeline.py" init-lock "$LOCK" local
printf '{"version":1,"installed":true,"appName":"pipeline","lockPath":"%s","runtimeRoot":"%s","unit":"pipeline-app.service","buildUser":"%s"}\n' "$LOCK" "$RUNTIME" "$(id -un)" > "$META"
mkdir "$F/app/.next"; printf 'legacyold1\n' > "$F/app/.next/BUILD_ID"

# npm/check uses immutable source/install/output and the canonical metadata lock.
before="$(sha256sum "$F/app/next-env.d.ts" "$F/app/tsconfig.json" "$F/app/.next/BUILD_ID"):$(stat -c '%Y' "$F/app/next-env.d.ts")"
(cd "$F/app" && npm run build --silent) >/dev/null
after="$(sha256sum "$F/app/next-env.d.ts" "$F/app/tsconfig.json" "$F/app/.next/BUILD_ID"):$(stat -c '%Y' "$F/app/next-env.d.ts")"; [[ "$before" == "$after" ]]
! find "$F/app/.build-work" -mindepth 1 -print -quit | grep -q .
if BUILD_FAIL=1 bash "$F/scripts/app-build.sh" check >/dev/null 2>&1; then exit 1; fi
cp "$F/app/page.tsx" "$TMP/page"; BUILD_SLEEP=2 bash "$F/scripts/app-build.sh" candidate >/dev/null 2>&1 & p=$!; sleep 1; echo race >> "$F/app/page.tsx"; if wait "$p"; then exit 1; fi; cp -p "$TMP/page" "$F/app/page.tsx"
# Install itself serializes under the same inode.
: > "$EVENTS"; INSTALL_SLEEP=1 bash "$F/scripts/app-build.sh" check >/dev/null & a=$!; INSTALL_SLEEP=1 bash "$F/scripts/app-build.sh" check >/dev/null & b=$!; wait "$a" "$b"
[[ "$(cut -d' ' -f1 "$EVENTS" | tr '\n' ' ')" == 'start end start end ' ]]
# Alternate-path override and inherited-marker forgery are gone/fail closed.
if APP_BUILD_LOCK_PATH="$TMP/other" LPS_PIPELINE_INNER=1 LPS_LOCK_PATH="$TMP/other" bash "$F/scripts/app-build.sh" candidate >/dev/null 2>&1; then exit 1; fi
ln -s "$TMP/x" "$TMP/symlink-lock"; if python3 "$F/scripts/app-pipeline.py" init-lock "$TMP/symlink-lock" local >/dev/null 2>&1; then exit 1; fi
# QA TERM removes child/snapshot; no env file reaches runtime.
LPS_QA_PORT=3199 bash "$F/scripts/app-build.sh" qa >/dev/null 2>&1 & q=$!; sleep 1; kill -TERM "$q"; if wait "$q"; then exit 1; fi; ! find "$F/app/.build-work" -mindepth 1 -print -quit | grep -q .

cat > "$F/config" <<EOF
APP_NAME=pipeline
APP_PORT=3999
DOMAIN=pipeline.invalid
RUN_USER=$(id -un)
EOF
cat > "$F/bin/systemctl" <<'SH'
#!/usr/bin/env bash
state="${TEST_STATE:?}"; case "$1" in
 stop) echo inactive > "$state";; start) [[ "${FAIL_START:-0}" == 1 ]] && exit 1; echo active > "$state";;
 is-active) [[ "$(cat "$state")" == active ]];; kill) echo inactive > "$state";; esac
SH
cat > "$F/bin/curl" <<'SH'
#!/usr/bin/env bash
url="${*: -1}"; release="$(readlink -f "${TEST_RUNTIME:?}/current")"
case "$url" in */api/health/build) printf '{"buildId":"%s"}\n' "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["buildId"])' "$release/.release.json")";; */_next/static/chunks/app.js) cat "$(find "$release/app" -path '*/.next.*/static/chunks/app.js' -print -quit)";; *) exit 22;; esac
SH
chmod +x "$F/bin/systemctl" "$F/bin/curl"; export TEST_STATE="$TMP/state" TEST_RUNTIME="$RUNTIME" SYSTEMCTL="$F/bin/systemctl" CURL="$F/bin/curl"; echo inactive > "$TEST_STATE"
deploy() { SKIP_HTTPS_HEALTH="${1:-1}" APP_HEALTH_TIMEOUT=2 APP_STOP_TIMEOUT=2 bash "$F/scripts/app-deploy-core.sh" "$META" fixture "${LPS_TEST_KILL_PHASE:-}"; }

# First deploy fails closed rather than stop an active legacy runtime without a durable rollback.
echo active > "$TEST_STATE"; if deploy >/dev/null 2>&1; then exit 1; fi
[[ ! -f "$RUNTIME/transaction.json" && "$(cat "$TEST_STATE")" == active ]]
echo inactive > "$TEST_STATE"
# A killed fresh first transaction has no old service: recovery discards the
# unverified candidate, clears its journal and asks for an explicit rerun.
BUILD_ID=firstkill LPS_TEST_KILL_PHASE=switched deploy >/dev/null 2>&1 & first=$!; if wait "$first"; then exit 1; fi
[[ -f "$RUNTIME/transaction.json" ]]; if deploy >/dev/null 2>&1; then exit 1; else [[ $? -eq 75 ]]; fi
[[ ! -f "$RUNTIME/transaction.json" && ! -L "$RUNTIME/current" && "$(cat "$TEST_STATE")" == inactive ]]
# Fresh first deploy creates durable healthy.
deploy >/dev/null; healthy="$(readlink -f "$RUNTIME/healthy")"; [[ "$healthy" == "$(readlink -f "$RUNTIME/current")" && ! -e "$healthy/app/.env.local" ]]
# Stable launcher is worktree-independent and consumes current environment.
SECRET_VALUE=rotated "$F/scripts/app-runtime-launcher.sh" "$META"; grep -q "^$healthy/app secret=rotated$" "$LAUNCH_LOG"
mv "$F/app/.next" "$F/app/.next.destroyed"; SECRET_VALUE=two "$F/scripts/app-runtime-launcher.sh" "$META"; mv "$F/app/.next.destroyed" "$F/app/.next"
mv "$F/app" "$F/app.broken"; SECRET_VALUE=three "$F/scripts/app-runtime-launcher.sh" "$META"; mv "$F/app.broken" "$F/app"

# SIGKILL leaves durable journal. Launcher chooses healthy, then next deploy
# restores current/service, clears journal and exits 75 without building.
for phase in stop-in-flight stopped switched health; do
  echo active > "$TEST_STATE"; BUILD_ID="kill$phase" LPS_TEST_KILL_PHASE="$phase" deploy >/dev/null 2>&1 & d=$!; if wait "$d"; then exit 1; fi
  [[ -f "$RUNTIME/transaction.json" ]]; before_launch=$(wc -l < "$LAUNCH_LOG"); SECRET_VALUE=recovered "$F/scripts/app-runtime-launcher.sh" "$META"; [[ $(wc -l < "$LAUNCH_LOG") -eq $((before_launch+1)) ]]; tail -n1 "$LAUNCH_LOG" | grep -q "^$healthy/app "
  if deploy >/dev/null 2>&1; then exit 1; else [[ $? -eq 75 ]]; fi
  [[ ! -f "$RUNTIME/transaction.json" && "$(readlink -f "$RUNTIME/current")" == "$healthy" && "$(cat "$TEST_STATE")" == active ]]
done
# Normal failure rolls back immediately; failed rollback start leaves journal.
echo active > "$TEST_STATE"; if FAIL_START=1 BUILD_ID=badstart deploy >/dev/null 2>&1; then exit 1; fi; [[ -f "$RUNTIME/transaction.json" ]]; FAIL_START=0 deploy >/dev/null 2>&1 || [[ $? -eq 75 ]]
# HTTPS exact identity/chunk success promotes and preserves actual previous even
# when a newer orphan exists; orphan is removed, protected rollback is not.
mkdir "$RUNTIME/releases/release-newer-orphan"; touch -d 'next hour' "$RUNTIME/releases/release-newer-orphan"
echo active > "$TEST_STATE"; BUILD_ID=candidate999 deploy 0 >/dev/null; new="$(readlink -f "$RUNTIME/healthy")"; [[ "$new" != "$healthy" && "$(readlink -f "$RUNTIME/previous")" == "$healthy" && ! -e "$RUNTIME/releases/release-newer-orphan" ]]
[[ "$(find "$new" -type l -print | wc -l)" == 0 ]]; [[ ! -w "$new" || "$EUID" -ne 0 ]]

# Actual config/proxy contracts and canonical production wiring.
if PATH="$REAL_PATH" pnpm --dir "$REPO/app" exec next build >/dev/null 2>&1; then exit 1; fi
grep -q "pathname === PUBLIC_BUILD_HEALTH" "$REPO/app/proxy.ts"; grep -q 'EnvironmentFile=-/etc/\$NAME/app.env' "$REPO/scripts/install-app-pipeline.sh"
! grep -R -q 'APP_BUILD_LOCK_PATH\|LPS_BUILD_LOCK_HELD' "$REPO/scripts/app-build.sh" "$REPO/scripts/app-deploy.sh"

# Actual @next/env semantics and the documented narrow nonpublic-value policy.
E="$TMP/env-case"; mkdir -p "$E/app/node_modules/@next" "$E/runtime"; printf '{}\n' > "$E/app/package.json"
next_env="$(PATH="$REAL_PATH" node -e "console.log(require.resolve('@next/env',{paths:[require('path').resolve('$REPO/app')]}))")"
ln -s "$(dirname "$(dirname "$next_env")")" "$E/app/node_modules/@next/env"
cat > "$E/app/.env.local" <<'EOF'
export BASE="quoted value"
INTERPOLATED_SECRET="${BASE}-abcdefgh"
MULTILINE_SECRET="line1\nline2-abcdefgh"
NEXT_PUBLIC_SECRET=x
ARBITRARY_KEY=x
EOF
PATH="$REAL_PATH" node - <<'NODE' "$E/app"
const {createRequire}=require('module'), p=require('path'), app=process.argv[2];
const {loadEnvConfig}=createRequire(p.join(app,'package.json'))('@next/env'); const e=loadEnvConfig(app,false,{info(){},error(){}},true).combinedEnv;
if(e.BASE!=='quoted value'||e.INTERPOLATED_SECRET!=='quoted value-abcdefgh'||e.MULTILINE_SECRET!=='line1\nline2-abcdefgh'||e.NEXT_PUBLIC_SECRET!=='x'||e.ARBITRARY_KEY!=='x') process.exit(1)
NODE
PATH="$REAL_PATH" node "$REPO/scripts/verify-runtime-env.mjs" "$E/app" "$E/runtime"
printf 'quoted value-abcdefgh' > "$E/runtime/leak"; if PATH="$REAL_PATH" node "$REPO/scripts/verify-runtime-env.mjs" "$E/app" "$E/runtime" >/dev/null 2>&1; then exit 1; fi
rm "$E/runtime/leak"; echo 'SHORT_SECRET=x' >> "$E/app/.env.local"; if PATH="$REAL_PATH" node "$REPO/scripts/verify-runtime-env.mjs" "$E/app" "$E/runtime" >/dev/null 2>&1; then exit 1; fi

# Linked worktrees of a pre-setup repository resolve one git-common-dir lock.
git -C "$F" config user.email test@example.invalid; git -C "$F" config user.name test; git -C "$F" add .; git -C "$F" commit -qm init
W="$TMP/linked"; git -C "$F" worktree add -q "$W" HEAD
: > "$EVENTS"
INSTALL_SLEEP=1 bash "$F/scripts/app-build.sh" check >/dev/null & a=$!; INSTALL_SLEEP=1 bash "$W/scripts/app-build.sh" check >/dev/null & b=$!; wait "$a" "$b"
[[ "$(cut -d' ' -f1 "$EVENTS" | tr '\n' ' ')" == 'start end start end ' ]]
common="$(git -C "$F" rev-parse --path-format=absolute --git-common-dir)"; [[ -f "$common/app-build.local.lock" ]]
echo 'app build pipeline tests: ok'
