#!/usr/bin/env bash
# Internal deployment engine. app-deploy.sh supplies validated installed
# metadata; fixtures invoke the explicit fixture mode without environment path overrides.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; [[ -f "$ROOT/config" ]] && source "$ROOT/config"
HELPER="$ROOT/scripts/app-pipeline.py"; META="${1:?metadata}"; MODE="${2:-production}"; KILL_PHASE="${3:-}"; FIXTURE=false; [[ "$MODE" == fixture ]] && FIXTURE=true
[[ -f "$META" && ! -L "$META" ]] || { echo "pipeline metadata missing" >&2; exit 1; }
key() { python3 "$HELPER" json-get "$META" "$1"; }
NAME="$(key appName)"; LOCK="$(key lockPath)"; RUNTIME="$(key runtimeRoot)"; RELEASES="$RUNTIME/releases"; UNIT="$(key unit)"; BUILD_USER="$(key buildUser)"
APP_PORT="${APP_PORT:-3000}"; STOP_TIMEOUT="${APP_STOP_TIMEOUT:-15}"; HEALTH_TIMEOUT="${APP_HEALTH_TIMEOUT:-45}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"; CURL="${CURL:-curl}"; JOURNAL="$RUNTIME/transaction.json"
BOOT_ID="$(cat /proc/sys/kernel/random/boot_id)"; PID_START="$(python3 -c 'import sys; print(open(f"/proc/{sys.argv[1]}/stat").read().rsplit(") ",1)[1].split()[19])' "$$")"
[[ $EUID -eq 0 || "$MODE" == fixture ]] || { echo "deployment requires root" >&2; exit 1; }

if [[ "${LPS_PIPELINE_INNER:-0}" != 1 ]]; then exec python3 "$HELPER" with-lock "$LOCK" -- env LPS_PIPELINE_METADATA="$META" bash "$0" "$META" "$MODE" "$KILL_PHASE"; fi
python3 "$HELPER" verify-lock "$LOCK" 9
pointer() { [[ -L "$1" ]] && readlink -f -- "$1" || true; }
setlink() { python3 "$HELPER" atomic-symlink "$1" "$2"; }
unlink_durable() { python3 "$HELPER" durable-unlink "$1"; }

stop_bounded() {
  "$SYSTEMCTL" stop "$UNIT" --no-block || true; local end=$((SECONDS+STOP_TIMEOUT))
  while "$SYSTEMCTL" is-active --quiet "$UNIT" && ((SECONDS<end)); do sleep .2; done
  if "$SYSTEMCTL" is-active --quiet "$UNIT"; then "$SYSTEMCTL" kill --kill-who=all --signal=KILL "$UNIT" || true; "$SYSTEMCTL" stop "$UNIT" --no-block || true; fi
  ! "$SYSTEMCTL" is-active --quiet "$UNIT"
}
start_old() {
  local old="$1" was="$2"
  [[ -z "$old" ]] || setlink "$old" "$RUNTIME/current"
  if [[ -z "$old" ]]; then unlink_durable "$RUNTIME/current"; fi
  if [[ "$was" == true ]]; then "$SYSTEMCTL" start "$UNIT" || return 1; fi
}
write_journal() {
  local phase="$1" old="$2" candidate="$3" active="$4"
  printf '{"version":1,"phase":"%s","oldHealthy":"%s","candidate":"%s","serviceWasActive":%s,"deployPid":%s,"bootId":"%s","pidStart":"%s"}\n' "$phase" "$old" "$candidate" "$active" "$$" "$BOOT_ID" "$PID_START" | python3 "$HELPER" write-json "$JOURNAL" 0644
}

# Recovery runs before any new build. The stable launcher also ignores current
# and boots healthy while this journal exists, covering ordinary operator restart.
if [[ -f "$JOURNAL" ]]; then
  old="$(pointer "$RUNTIME/healthy")"; was="$(python3 "$HELPER" json-get "$JOURNAL" serviceWasActive)"
  # A killed deploy may have left its unverified candidate running. A plain
  # start would be a no-op, so stop it before restoring the durable pointer.
  stop_bounded || { echo "recovery could not stop incomplete candidate" >&2; exit 1; }
  if [[ -z "$old" || "$old" != "$RELEASES/"* ]]; then
    unlink_durable "$RUNTIME/current"
    if [[ "$was" == False || "$was" == false ]]; then
      abandoned="$(python3 "$HELPER" json-get "$JOURNAL" candidate)"
      [[ "$abandoned" != "$RELEASES/"* ]] || rm -rf -- "$abandoned"
      unlink_durable "$JOURNAL"
      echo "discarded incomplete first transaction; rerun deployment" >&2
      exit 75
    fi
    echo "incomplete transaction has no prior healthy release; service left stopped" >&2
    exit 1
  fi
  setlink "$old" "$RUNTIME/current"
  if [[ "$was" == True || "$was" == true ]]; then "$SYSTEMCTL" start "$UNIT" || { echo "recovery could not restart healthy release" >&2; exit 1; }; fi
  unlink_durable "$JOURNAL"; echo "recovered incomplete app transaction; rerun deployment" >&2; exit 75
fi

old="$(pointer "$RUNTIME/healthy")"; old_active=false; "$SYSTEMCTL" is-active --quiet "$UNIT" && old_active=true || true
if $old_active && [[ -z "$old" ]]; then echo "active legacy runtime has no durable rollback release; bootstrap is required before transactional deployment" >&2; exit 1; fi
phase=build; candidate_work="$(python3 "$HELPER" exec-as "$BUILD_USER" -- env LPS_PIPELINE_INNER=1 LPS_PIPELINE_METADATA="$META" LPS_LOCK_PATH="$LOCK" bash "$ROOT/scripts/app-build.sh" candidate | tail -n1)"
python3 "$HELPER" verify-source "$ROOT" "$candidate_work/.source-manifest.json" >/dev/null
python3 "$HELPER" init-dir "$RUNTIME" 755; python3 "$HELPER" init-dir "$RELEASES" 755
[[ "$(stat -c %d "$ROOT/app")" == "$(stat -c %d "$RELEASES")" ]] || exit 1
reserved="$(python3 "$HELPER" reserve-dir "$RELEASES" release-)"; rmdir "$reserved"; mv -- "$candidate_work/runtime" "$reserved"; rm -rf "$candidate_work"; release="$reserved"
python3 "$HELPER" verify-release-links "$release"; $FIXTURE || { chown -R root:root "$release"; chmod -R a-w "$release"; }
build_id="$(python3 "$HELPER" json-get "$release/.release.json" buildId)"; [[ "$build_id" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || exit 1

phase=prepared; write_journal "$phase" "$old" "$release" "$old_active"; completed=false
finish() {
  rc=$?; trap - EXIT INT TERM HUP
  rm -f /tmp/"$NAME-local.$$.json" /tmp/"$NAME-https.$$.json" /tmp/"$NAME-chunk.$$.js"
  if ! $completed && [[ -f "$JOURNAL" ]]; then
    stop_bounded || true
    if start_old "$old" "$old_active"; then unlink_durable "$JOURNAL"; else echo "rollback could not restart durable healthy release" >&2; rc=1; fi
  fi
  exit "$rc"
}
trap finish EXIT INT TERM HUP
killpoint() { if $FIXTURE && [[ "$KILL_PHASE" == "$1" ]]; then kill -KILL $$; fi; }
phase=stopping; write_journal "$phase" "$old" "$release" "$old_active"; "$SYSTEMCTL" stop "$UNIT" --no-block || true; killpoint stop-in-flight; stop_bounded || exit 1
killpoint stopped
phase=switching; write_journal "$phase" "$old" "$release" "$old_active"; setlink "$release" "$RUNTIME/current"
killpoint switched
phase=starting; write_journal "$phase" "$old" "$release" "$old_active"; "$SYSTEMCTL" start "$UNIT" || exit 1
killpoint health

health_once() {
  "$SYSTEMCTL" is-active --quiet "$UNIT" || return 1
  local lj=/tmp/"$NAME-local.$$.json" hj=/tmp/"$NAME-https.$$.json" got=/tmp/"$NAME-chunk.$$.js"
  "$CURL" -fsS --max-time 3 "http://127.0.0.1:$APP_PORT/api/health/build" >"$lj" || return 1
  python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))=={"buildId":sys.argv[2]}' "$lj" "$build_id" || return 1
  chunk="$(find "$release/app" -maxdepth 4 -path '*/.next.*/static/chunks/*.js' -type f -print -quit)"; [[ -n "$chunk" ]] || return 1; rel="/static/chunks/${chunk##*/}"
  "$CURL" -fsS --max-time 3 "http://127.0.0.1:$APP_PORT/_next$rel" >"$got" || return 1
  [[ "$(sha256sum "$chunk"|cut -d' ' -f1)" == "$(sha256sum "$got"|cut -d' ' -f1)" ]] || return 1
  if [[ -n "${DOMAIN:-}" && "${SKIP_HTTPS_HEALTH:-0}" != 1 ]]; then "$CURL" -fsS --max-time 5 "https://$DOMAIN/api/health/build" >"$hj" || return 1; cmp -s "$lj" "$hj" || return 1; "$CURL" -fsS --max-time 5 "https://$DOMAIN/_next$rel" >"$got" || return 1; [[ "$(sha256sum "$chunk"|cut -d' ' -f1)" == "$(sha256sum "$got"|cut -d' ' -f1)" ]] || return 1; fi
  rm -f "$lj" "$hj" "$got"
}
phase=health; write_journal "$phase" "$old" "$release" "$old_active"; end=$((SECONDS+HEALTH_TIMEOUT))
until health_once; do if ((SECONDS>=end)); then exit 1; fi; sleep .5; done
phase=verified; write_journal "$phase" "$old" "$release" "$old_active"
[[ -z "$old" ]] || setlink "$old" "$RUNTIME/previous"; setlink "$release" "$RUNTIME/healthy"; setlink "$release" "$RUNTIME/current"; unlink_durable "$JOURNAL"; completed=true; trap - EXIT INT TERM HUP
# Retain exactly all durable pointers; remove only unreferenced releases.
for dir in "$RELEASES"/release-*; do [[ -d "$dir" ]] || continue; keep=false; for p in current healthy previous; do [[ "$(pointer "$RUNTIME/$p")" == "$dir" ]] && keep=true; done; $keep || rm -rf -- "$dir"; done
echo ">> healthy immutable standalone release: $(basename "$release") build $build_id"
