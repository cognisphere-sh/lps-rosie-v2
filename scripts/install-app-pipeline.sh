#!/usr/bin/env bash
# Transactionally install/rollback root-owned app pipeline metadata, launcher,
# runtime dirs and systemd unit. Called only by setup-server.sh.
set -euo pipefail
cmd="${1:-prepare}"
if [[ "$cmd" == commit ]]; then rm -rf -- "${2:?}"; exit; fi
if [[ "$cmd" == rollback ]]; then
  tx="${2:?}"; [[ -f "$tx/state" && -f "$tx/lock" ]] || exit 1
  if [[ "${INSTALL_PIPELINE_LOCKED:-0}" != 1 ]]; then exec python3 "$(dirname "$0")/app-pipeline.py" with-lock "$(cat "$tx/lock")" -- env INSTALL_PIPELINE_LOCKED=1 bash "$0" rollback "$tx"; fi
  python3 "$(dirname "$0")/app-pipeline.py" verify-lock "$(cat "$tx/lock")" 9
  while IFS='|' read -r path existed backup; do
    rm -rf -- "$path"
    [[ "$existed" == 1 ]] && cp -a -- "$tx/$backup" "$path"
  done < "$tx/state"
  while IFS= read -r dir; do rmdir "$dir" 2>/dev/null || true; done < <(tac "$tx/dirs")
  systemctl daemon-reload || true; rm -rf -- "$tx"; exit
fi
[[ "$cmd" == prepare && $EUID -eq 0 ]] || exit 2
: "${ROOT:?}" "${NAME:?}" "${RUN_USER:?}" "${UNIT_PATH:?}" "${APP_PORT:?}" "${HARNESS_PORT:?}" "${LOCK_PATH:?}"
HELPER="$ROOT/scripts/app-pipeline.py"
if [[ "${INSTALL_PIPELINE_LOCKED:-0}" != 1 ]]; then exec python3 "$HELPER" with-lock "$LOCK_PATH" -- env INSTALL_PIPELINE_LOCKED=1 bash "$0" prepare; fi
python3 "$HELPER" verify-lock "$LOCK_PATH" 9
PIPELINE_DIR="/etc/$NAME"; RUNTIME="/var/lib/$NAME-app-runtime"; LIB="/usr/local/lib/$NAME"
tx="$(mktemp -d /tmp/$NAME-pipeline-install.XXXXXXXX)"; : > "$tx/state"; : > "$tx/dirs"; printf '%s\n' "$LOCK_PATH" > "$tx/lock"
prepared=false
rollback_on_exit(){ rc=$?; trap - EXIT INT TERM HUP; if ! $prepared && ((rc != 0)); then bash "$0" rollback "$tx"; fi; exit "$rc"; }
trap rollback_on_exit EXIT INT TERM HUP
mkdir -p "$tx/stage"
cp "$ROOT/scripts/app-runtime-launcher.sh" "$tx/stage/app-runtime"; chmod 0755 "$tx/stage/app-runtime"; bash -n "$tx/stage/app-runtime"
ROOT="$ROOT" NAME="$NAME" RUN_USER="$RUN_USER" LOCK_PATH="$LOCK_PATH" RUNTIME="$RUNTIME" python3 <<'PY' > "$tx/stage/app-pipeline.json"
import json, os
print(json.dumps({'version':1,'installed':True,'appName':os.environ['NAME'],'repoRoot':os.path.realpath(os.environ['ROOT']),
 'lockPath':os.environ['LOCK_PATH'],'runtimeRoot':os.environ['RUNTIME'],'unit':os.environ['NAME']+'-app.service','buildUser':os.environ['RUN_USER']},sort_keys=True))
PY
chmod 0644 "$tx/stage/app-pipeline.json"
cat > "$tx/stage/app.service" <<EOF
[Unit]
Description=$NAME user-facing app
After=network.target $NAME-harness.service
Wants=$NAME-harness.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$RUNTIME
Environment=PATH=$UNIT_PATH
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=HARNESS_URL=http://127.0.0.1:$HARNESS_PORT
EnvironmentFile=-/etc/$NAME/app.env
ExecStart=$LIB/app-runtime $PIPELINE_DIR/app-pipeline.json
TimeoutStopSec=${APP_STOP_TIMEOUT:-15}
KillMode=control-group
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
for dir in "$PIPELINE_DIR" "$RUNTIME" "$RUNTIME/releases" "$LIB"; do
  if [[ ! -e "$dir" ]]; then mkdir -m 0755 "$dir"; echo "$dir" >> "$tx/dirs"; fi
  [[ -d "$dir" && ! -L "$dir" && "$(stat -c %u "$dir")" == 0 ]] || exit 70
done
backup(){ path="$1"; tag="$2"; if [[ -e "$path" || -L "$path" ]]; then cp -a -- "$path" "$tx/$tag"; echo "$path|1|$tag" >> "$tx/state"; else echo "$path|0|$tag" >> "$tx/state"; fi; }
meta="$PIPELINE_DIR/app-pipeline.json"; launcher="$LIB/app-runtime"; unit="/etc/systemd/system/$NAME-app.service"; want="/etc/systemd/system/multi-user.target.wants/$NAME-app.service"
for existing in "$meta" "$launcher" "$unit"; do
  if [[ -e "$existing" || -L "$existing" ]]; then [[ -f "$existing" && ! -L "$existing" && "$(stat -c %u "$existing")" == 0 ]] || exit 70; fi
done
[[ ! -e "$meta" ]] || python3 "$HELPER" validate-metadata "$meta" "$ROOT" "$NAME" >/dev/null
backup "$meta" meta.old; backup "$launcher" launcher.old; backup "$unit" unit.old; backup "$want" want.old
atomic_install(){ src="$1" dst="$2" mode="$3"; tmp="$dst.new.$$"; install -o root -g root -m "$mode" "$src" "$tmp"; mv -Tf "$tmp" "$dst"; }
atomic_install "$tx/stage/app-pipeline.json" "$meta" 0644
atomic_install "$tx/stage/app-runtime" "$launcher" 0755
atomic_install "$tx/stage/app.service" "$unit" 0644
python3 "$HELPER" validate-metadata "$meta" "$ROOT" "$NAME" >/dev/null
systemd-analyze verify "$unit" >/dev/null
systemctl daemon-reload
# Verification build uses the just-installed canonical identity while setup owns
# its lock through the child open-file description.
python3 "$HELPER" exec-as "$RUN_USER" -- env COGNISPHERE_NPM_TOKEN="${COGNISPHERE_NPM_TOKEN:-}" LPS_PIPELINE_INNER=1 LPS_LOCK_PATH="$LOCK_PATH" LPS_PIPELINE_METADATA="$meta" bash "$ROOT/scripts/app-build.sh" check >&2
prepared=true; trap - EXIT INT TERM HUP
printf '%s\n' "$tx"
