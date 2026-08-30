#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; command -v sudo >/dev/null || { echo 'SKIP: sudo unavailable'; exit; }; sudo -n true 2>/dev/null || { echo 'SKIP: passwordless sudo unavailable'; exit; }
TMP="$(mktemp -d)"; NAME="pipeline-fixture-$$"; USER_NAME="$(id -un)"; TX=""
cleanup(){ [[ -z "$TX" ]] || sudo bash "$ROOT/scripts/install-app-pipeline.sh" rollback "$TX" || true; sudo rm -rf "/etc/$NAME" "/var/lib/$NAME-app-runtime" "/usr/local/lib/$NAME" "/etc/systemd/system/$NAME-app.service" "/run/lock/$NAME-app-build.lock"; rm -rf "$TMP"; }; trap cleanup EXIT
F="$TMP/home"; mkdir -p "$F/scripts" "$F/app" "$F/bin"
cp "$ROOT/scripts/"{app-build.sh,app-pipeline.py,app-runtime-launcher.sh,server.sh,verify-runtime-env.mjs} "$F/scripts/"
for f in package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc; do cp "$ROOT/$f" "$F/$f"; done
cp "$ROOT/app/"{package.json,tsconfig.json,next.config.ts,next-env.d.ts} "$F/app/"; printf 'APP_NAME=%s\n' "$NAME" > "$F/config"; echo source > "$F/app/page.tsx"
cat > "$F/bin/pnpm" <<'SH'
#!/usr/bin/env bash
if [[ " $* " == *" install "* ]]; then mkdir -p app/node_modules; fi
SH
cat > "$F/bin/node" <<'SH'
#!/usr/bin/env bash
mkdir -p "$LPS_NEXT_DIST_DIR/static/chunks" "$LPS_NEXT_DIST_DIR/standalone/app"
echo fixturebuild1 > "$LPS_NEXT_DIST_DIR/BUILD_ID"; echo '{}' > "$LPS_NEXT_DIST_DIR/build-manifest.json"; echo '{}' > "$LPS_NEXT_DIST_DIR/routes-manifest.json"
echo chunk > "$LPS_NEXT_DIST_DIR/static/chunks/app.js"; echo server > "$LPS_NEXT_DIST_DIR/standalone/app/server.js"
SH
printf '#!/usr/bin/env bash\nexit 0\n' > "$F/bin/verify-node"; printf '#!/usr/bin/env bash\necho "$*" >> "${CONTROL_LOG:-/dev/null}"\nexit 0\n' > "$F/bin/systemctl"; printf '#!/usr/bin/env bash\nexit 0\n' > "$F/bin/systemd-analyze"; printf '#!/usr/bin/env bash\necho holder-start >> "$CONTROL_LOG"\nsleep 2\necho holder-end >> "$CONTROL_LOG"\n' > "$F/bin/hold"; chmod +x "$F/bin/"* "$F/scripts/"*
sudo python3 "$F/scripts/app-pipeline.py" init-lock "/run/lock/$NAME-app-build.lock" production
# Symlink/collision fails without following or partially installing.
sudo ln -s "$TMP" "/etc/$NAME"; if sudo env PATH="$F/bin:/usr/bin:/bin" ROOT="$F" NAME="$NAME" RUN_USER="$USER_NAME" UNIT_PATH="/usr/bin:/bin" APP_PORT=3999 HARNESS_PORT=3998 LOCK_PATH="/run/lock/$NAME-app-build.lock" LPS_NODE_BIN="$F/bin/node" LPS_VERIFY_NODE_BIN="$F/bin/verify-node" bash "$ROOT/scripts/install-app-pipeline.sh" prepare >/dev/null 2>&1; then exit 1; fi; sudo rm "/etc/$NAME"; [[ ! -e "/var/lib/$NAME-app-runtime" && ! -e "/usr/local/lib/$NAME" ]]
sudo mkdir "/etc/$NAME"; sudo ln -s "$TMP" "/etc/$NAME/app-pipeline.json"; if sudo env PATH="$F/bin:/usr/bin:/bin" ROOT="$F" NAME="$NAME" RUN_USER="$USER_NAME" UNIT_PATH="/usr/bin:/bin" APP_PORT=3999 HARNESS_PORT=3998 LOCK_PATH="/run/lock/$NAME-app-build.lock" LPS_NODE_BIN="$F/bin/node" LPS_VERIFY_NODE_BIN="$F/bin/verify-node" bash "$ROOT/scripts/install-app-pipeline.sh" prepare >/dev/null 2>&1; then exit 1; fi; sudo rm -rf "/etc/$NAME"; [[ ! -e "/var/lib/$NAME-app-runtime" && ! -e "/usr/local/lib/$NAME" ]]
TX="$(sudo env PATH="$F/bin:/usr/bin:/bin" ROOT="$F" NAME="$NAME" RUN_USER="$USER_NAME" UNIT_PATH="/usr/bin:/bin" APP_PORT=3999 HARNESS_PORT=3998 LOCK_PATH="/run/lock/$NAME-app-build.lock" LPS_NODE_BIN="$F/bin/node" LPS_VERIFY_NODE_BIN="$F/bin/verify-node" bash "$ROOT/scripts/install-app-pipeline.sh" prepare)"
meta="/etc/$NAME/app-pipeline.json"; launcher="/usr/local/lib/$NAME/app-runtime"; unit="/etc/systemd/system/$NAME-app.service"
[[ "$(stat -c '%U:%a' "$meta")" == root:644 && "$(stat -c '%U:%a' "$launcher")" == root:755 && "$(stat -c '%U:%a' "$unit")" == root:644 ]]
python3 "$ROOT/scripts/app-pipeline.py" validate-metadata "$meta" "$F" "$NAME" >/dev/null
sudo chmod 0666 "$meta"; if python3 "$ROOT/scripts/app-pipeline.py" validate-metadata "$meta" "$F" "$NAME" >/dev/null 2>&1; then exit 1; fi; sudo chmod 0644 "$meta"
sudo cp "$meta" "$TMP/meta.good"; sudo python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["repoRoot"]="/wrong"; open(p,"w").write(json.dumps(d))' "$meta"; if python3 "$ROOT/scripts/app-pipeline.py" validate-metadata "$meta" "$F" "$NAME" >/dev/null 2>&1; then exit 1; fi; sudo cp "$TMP/meta.good" "$meta"; sudo chown root:root "$meta"; sudo chmod 0644 "$meta"
grep -q "WorkingDirectory=/var/lib/$NAME-app-runtime" "$unit"; grep -q "ExecStart=/usr/local/lib/$NAME/app-runtime" "$unit"
# App stop/control waits on the exact installed lock; harness-only does not use this path.
: > "$TMP/control"; sudo env CONTROL_LOG="$TMP/control" python3 "$F/scripts/app-pipeline.py" with-lock "/run/lock/$NAME-app-build.lock" -- "$F/bin/hold" & holder=$!; sleep .2
sudo env PATH="$F/bin:/usr/bin:/bin" CONTROL_LOG="$TMP/control" bash "$F/scripts/server.sh" stop harness
sudo env PATH="$F/bin:/usr/bin:/bin" CONTROL_LOG="$TMP/control" bash "$F/scripts/server.sh" stop app; wait "$holder"
sequence="$(sed -E 's/^holder-(start|end)$/holder-\1/; s/^stop .*harness.*/stop-harness/; s/^stop .*app.*/stop-app/' "$TMP/control" | grep -E '^(holder|stop)' | tr '\n' ' ')"
[[ "$sequence" == 'holder-start stop-harness holder-end stop-app ' ]]
release="/var/lib/$NAME-app-runtime/releases/release-test"; sudo mkdir -p "$release/app"; echo 'require("fs").writeFileSync(process.env.RUNTIME_MARKER, process.cwd())' | sudo tee "$release/app/server.js" >/dev/null; echo '{"buildId":"fixturebuild1"}' | sudo tee "$release/.release.json" >/dev/null; sudo ln -s "$release" "/var/lib/$NAME-app-runtime/current"; sudo ln -s "$release" "/var/lib/$NAME-app-runtime/healthy"; sudo chmod -R a+rX "$release"
sudo -u "$USER_NAME" env RUNTIME_MARKER="$TMP/runtime.started" "$launcher" "$meta"; grep -q "^$release/app$" "$TMP/runtime.started"
# Rerun is idempotent; rolling back the second prepare restores the first set.
TX2="$(sudo env PATH="$F/bin:/usr/bin:/bin" ROOT="$F" NAME="$NAME" RUN_USER="$USER_NAME" UNIT_PATH="/usr/bin:/bin" APP_PORT=3999 HARNESS_PORT=3998 LOCK_PATH="/run/lock/$NAME-app-build.lock" LPS_NODE_BIN="$F/bin/node" LPS_VERIFY_NODE_BIN="$F/bin/verify-node" bash "$ROOT/scripts/install-app-pipeline.sh" prepare)"
sudo bash "$ROOT/scripts/install-app-pipeline.sh" rollback "$TX2"; [[ -f "$meta" && -x "$launcher" && -f "$unit" ]]
sudo rm -rf "$release" "/var/lib/$NAME-app-runtime/current" "/var/lib/$NAME-app-runtime/healthy"
sudo bash "$ROOT/scripts/install-app-pipeline.sh" rollback "$TX"; TX=""
[[ ! -e "$meta" && ! -e "$launcher" && ! -e "$unit" && ! -e "/var/lib/$NAME-app-runtime" ]]
echo 'transactional pipeline install/rollback: ok'
