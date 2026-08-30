#!/usr/bin/env bash
# Immutable isolated Next check/QA/candidate builds under one canonical lock.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; APP="$ROOT/app"; HELPER="$ROOT/scripts/app-pipeline.py"
MODE="${1:-check}"; NODE_BIN="${LPS_NODE_BIN:-node}"; VERIFY_NODE="${LPS_VERIFY_NODE_BIN:-node}"; case "$MODE" in check|qa|candidate) ;; *) exit 2;; esac
[[ -f "$ROOT/config" ]] && source "$ROOT/config"; NAME="${APP_NAME:-$(basename "$ROOT")}"; [[ "$NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || exit 70
META="/etc/$NAME/app-pipeline.json"
metadata() {
  if [[ -e "/etc/$NAME" || -L "/etc/$NAME" ]]; then
    [[ -f "$META" && ! -L "$META" ]] || { echo "installed pipeline namespace exists but metadata is missing/invalid" >&2; exit 70; }
    python3 "$HELPER" validate-metadata "$META" "$ROOT" "$NAME" >/dev/null
    echo "$META"; return
  fi
  if [[ -e "/run/lock/$NAME-app-build.lock" || -L "/run/lock/$NAME-app-build.lock" ]]; then
    echo "installed lock namespace exists without valid metadata" >&2; exit 70
  fi
  # Explicit pre-setup mode. Linked worktrees resolve through git-common-dir,
  # so every checkout of this repository shares one lock inode.
  local common lock localmeta
  common="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)"; [[ -d "$common" && ! -L "$common" ]] || exit 70
  lock="$common/app-build.local.lock"; localmeta="$common/app-pipeline.local.json"
  python3 "$HELPER" init-lock "$lock" local
  printf '{"installed":false,"lockPath":"%s"}\n' "$lock" > "$localmeta"
  echo "$localmeta"
}
if [[ "${LPS_PIPELINE_INNER:-0}" == 1 ]]; then META="${LPS_PIPELINE_METADATA:?}"; else META="$(metadata)"; fi
LOCK="$(python3 "$HELPER" json-get "$META" lockPath)"
if [[ "${LPS_PIPELINE_INNER:-0}" != 1 ]]; then exec python3 "$HELPER" with-lock "$LOCK" -- env LPS_PIPELINE_METADATA="$META" bash "$0" "$MODE"; fi
python3 "$HELPER" verify-lock "$LOCK" 9

python3 "$HELPER" init-dir "$APP/.build-work" 700
find "$APP/.build-work" -mindepth 1 -maxdepth 1 -type d -mmin +360 -exec rm -rf -- {} +
work="$(python3 "$HELPER" reserve-dir "$APP/.build-work" "$MODE-")"; child=""; keep=false
cleanup() { status=$?; trap - EXIT INT TERM HUP; [[ -z "$child" ]] || { kill "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; }; $keep || rm -rf -- "$work"; exit "$status"; }
trap cleanup EXIT INT TERM HUP
source_digest="$(python3 "$HELPER" snapshot "$ROOT" "$work")"
# Next loads the private snapshot's .env* files with its own @next/env semantics.
# They are build inputs only and are never copied into the standalone release.
(cd "$work" && pnpm install --filter app --frozen-lockfile)
token="$(basename "$work" | tr -cd 'A-Za-z0-9_-')"; dist="$(python3 "$HELPER" reserve-dir "$work/app" ".next.$MODE-$token-")"; dist="$(basename "$dist")"
tsc="$work/app/$dist.tsconfig.json"; (set -o noclobber; : > "$tsc"); cat "$work/app/tsconfig.json" > "$tsc"
(cd "$work/app" && LPS_NEXT_DIST_DIR="$dist" LPS_NEXT_TSCONFIG="$dist.tsconfig.json" "$NODE_BIN" "$work/app/node_modules/next/dist/bin/next" build)
rm -f "$tsc"; python3 "$HELPER" verify-source "$ROOT" "$work/.source-manifest.json" >/dev/null
id="$(tr -d '\r\n' < "$work/app/$dist/BUILD_ID")"; [[ "$id" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || exit 1
standalone="$work/app/$dist/standalone"; [[ -f "$standalone/app/server.js" ]] || { echo "missing standalone server" >&2; exit 1; }
runtime="$work/runtime"; mkdir -m 700 "$runtime"; cp -a "$standalone/." "$runtime/"
mkdir -p "$runtime/app/$dist"; cp -a "$work/app/$dist/static" "$runtime/app/$dist/static"; cp -a "$work/app/$dist/BUILD_ID" "$runtime/app/$dist/BUILD_ID"
[[ ! -d "$work/app/public" ]] || cp -a "$work/app/public" "$runtime/app/public"
find "$runtime" -name '.env*' -print -quit | grep -q . && { echo "secret env file in runtime" >&2; exit 1; }
python3 "$HELPER" verify-release-links "$runtime"
"$VERIFY_NODE" "$ROOT/scripts/verify-runtime-env.mjs" "$work/app" "$runtime"
lock_digest="$(sha256sum "$work/pnpm-lock.yaml" | cut -d' ' -f1)"; printf '{"buildId":"%s","sourceDigest":"%s","lockDigest":"%s"}\n' "$id" "$source_digest" "$lock_digest" > "$runtime/.release.json"
case "$MODE" in
 check) echo ">> immutable standalone check ok: $id" ;;
 candidate) keep=true; printf '%s\n' "$work" ;;
 qa)
  port="${LPS_QA_PORT:-3100}"; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1024 && port<=65535)) || exit 2
  (cd "$runtime/app" && PORT="$port" LPS_RELEASE_BUILD_ID="$id" "$NODE_BIN" server.js) & child=$!; wait "$child"; child="" ;;
esac
