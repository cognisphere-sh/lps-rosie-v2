#!/bin/bash
# Payload only: invoke via the skill's clean-env bounded user service, never directly.
# No automatic retries, process control, environment loading, or arbitrary commands.
set -eu
umask 077
[[ $# == 3 ]] || { printf '%s\n' 'Expected TSX TEST OUT' >&2; exit 125; }
tsx=$1
test_file=$2
out=$3
[[ "$tsx" == /* && -x "$tsx" && "$out" == /* && -d "$out" ]] || exit 125
[[ "$test_file" != /* && "$test_file" != -* && -f "$test_file" ]] || exit 125
case "$test_file" in *.test.ts|*.test.tsx) ;; *) exit 125 ;; esac
# Repeat the controller's containment check inside the service's approved cwd.
app_real=$(/usr/bin/realpath -e -- .)
test_real=$(/usr/bin/realpath -e -- "$test_file")
case "$test_real" in "$app_real"/*) ;; *) exit 125 ;; esac
# Never overwrite an earlier outcome or silently repeat a completed attempt.
[[ ! -e "$out/test-exit.txt" ]] || exit 125
set +e
"$tsx" --test --test-reporter=tap --test-concurrency=1 "$test_file"
test_status=$?
set -e
# Timeout/OOM may kill this shell before the marker: absence is INCOMPLETE, not zero.
printf '%s\n' "$test_status" >"$out/test-exit.txt"
exit "$test_status"
