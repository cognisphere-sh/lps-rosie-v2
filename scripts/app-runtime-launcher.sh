#!/usr/bin/env bash
# Installed by setup-server.sh into /usr/local/lib/<name>/app-runtime.
# It intentionally has no dependency on the Git worktree.
set -euo pipefail
META="${1:?pipeline metadata path required}"
read_key() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$META" "$1"; }
runtime="$(read_key runtimeRoot)"; releases="$runtime/releases"
# During deployment, current is allowed only while the exact deploy process
# recorded in the fsynced journal is alive in this boot. After SIGKILL/power
# loss (or PID reuse), an operator/systemd restart boots durable healthy.
pointer="$runtime/current"
if [[ -f "$runtime/transaction.json" ]]; then
  if ! python3 - "$runtime/transaction.json" <<'PY'
import json, pathlib, sys
j=json.load(open(sys.argv[1])); boot=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()
if j.get('bootId') != boot: raise SystemExit(1)
pid=int(j['deployPid'])
try: start=pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(') ',1)[1].split()[19]
except (OSError, ValueError, KeyError): raise SystemExit(1)
raise SystemExit(0 if start == str(j.get('pidStart')) else 1)
PY
  then pointer="$runtime/healthy"; fi
fi
[[ -L "$pointer" ]] || { echo "no healthy app release" >&2; exit 1; }
release="$(readlink -f -- "$pointer")"
[[ "$release" == "$releases/"* && -f "$release/.release.json" && -f "$release/app/server.js" ]] || { echo "invalid app release" >&2; exit 70; }
build_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["buildId"])' "$release/.release.json")"
[[ "$build_id" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || exit 70
cd "$release/app"
export LPS_RELEASE_BUILD_ID="$build_id"
exec node server.js
