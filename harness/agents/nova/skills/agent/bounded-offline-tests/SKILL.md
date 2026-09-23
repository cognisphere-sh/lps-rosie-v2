---
name: bounded-offline-tests
description: Run only explicitly authorized, known-small offline Node test files in serial bounded user-systemd units. Covers authorization and HOLD boundaries, exact-code identity, clean payload environment, ownership, exit/TAP evidence, cancellation and cleanup, plus a payload helper and review manifest. Use when approved focused offline tests need a bounded lifecycle independent of a chat tool invocation; not for full suites, builds, typechecks or browsers. Limits reduce exposure, not guarantee host safety. (v1.0.0)
metadata:
  author: nova
  version: "1.0.0"
---

# Bounded offline tests

## Scope and non-guarantees

This is a **narrow execution procedure, not permission to execute**. An operator
HOLD stays in force until the responsible operator explicitly authorizes the
particular work. An apparent memory surplus, idle host, old approval, small
passing test, or this skill's existence does not clear it. Do not sample host
resources unless separately authorized; sampling would not constitute clearance.
**UNVALIDATED — STOP normal runtime use.** Static approval or installation is
not permission to execute. The initial runtime validation itself requires a
separate explicit bounded plan; no use under an unresolved resource HOLD.

The profile is fixed: one previously reviewed small offline file at a time,
`MemoryMax=512M`, `MemorySwapMax=0`, Node old-space `192` MiB,
`RuntimeMaxSec=75s`, `TasksMax=64`, test concurrency `1`. These are ceilings,
not reserved capacity or a safe-host certification. No automatic retries,
continuation after failure, increased caps, changed patterns or pass hunting.
Full suites, typechecks, builds, dependency installs, servers and real browsers
need a separate authorized resource plan; do not split one into many small
units to bypass a HOLD. A focused PASS never passes those other release gates.

Distinguish:
- V8 old-space limits one JS heap, not total process RSS, external buffers,
  native allocations, child heaps or the host.
- A service memory limit bounds its own cgroup, not concurrent services or
  overall host pressure. Swap zero applies to this service only.
- A global OOM can kill a process **below** its service cap, including its
  controller or user bus. A signal9, missing marker or `Result=oom-kill` alone
  cannot distinguish global from cgroup OOM. Label the cause unknown unless
  retained kernel/cgroup evidence supports it; seek approval before further
  diagnostics. Never tune the host or live services to make a test pass.

## 1. Agree scope and prepare evidence

1. Obtain a recorded approval identifying the exact candidate, offline file(s),
   command, profile, execution window, owner and outstanding HOLDs. Agree with
   the coordinator that no other QA task runs in parallel. User units with
   different names are **not** a global serial lock; tool parallelism and other
   agents can defeat seriality. If coordination is uncertain, stop.
2. Review each chosen test and its imports beforehand: mocked transports only,
   no live DB/API, browser startup, child server, environment loader or hidden
   fixture writes. Clean environment is **not network or filesystem isolation**.
   `env -i` only clears the payload environment: it is not a manager/controller/
   loader secret sandbox and cannot hide filesystem-readable credentials.
   This procedure has no network sandbox and cannot make arbitrary tests offline.
   If offline behavior is uncertain, do not launch; ask for a separately reviewed
   isolation plan. Never access credentials to make an offline test work.
   A historical pass with a test-name filter does not authorize running its
   entire file. The supplied helper intentionally supports only a whole known-
   small file; filtered-only authorization is BLOCKED by this template.
3. Use an isolated disk-backed candidate, never the primary checkout or live
   `.next`. Do not assume `/tmp` is disk-backed. Record commit/base, candidate
   patch/tree and relevant file hashes, lockfile identity and dependency/tool
   realpaths. Existing dependencies may be read-only-used when approved; no
   installs or dependency writes. Record any dirty files explicitly. Hash the
   inputs immediately before launch and after completion; mismatch invalidates
   evidence. An older log cannot certify changed inputs. Do not copy env files,
   secrets, production config or credential stores into the candidate.
4. Create a new persistent evidence directory for **each attempt**, plus a
   private empty disk-backed scratch home under the isolated candidate. Protect
   them from other users. Fill `artifacts/review-manifest.md`. Record the exact
   payload helper hash too. Do not overwrite failed or interrupted attempts.
5. Select a fresh unique unit name such as
   `nova-offline-<task>-<utcstamp>-<random>.service`. Record the full exact name
   and owner before launch. Create evidence/scratch0700 under `umask 077`;
   create new directories, never reuse old ones. Precreate both logs0600 as
   below; payload umask alone cannot protect a log systemd opens first.
   Check only that name is not already loaded; collision means BLOCK, not
   permission to stop/reuse it. Names are never reused, even after collection.
   Retain the successful-launch line with this name and its InvocationID from
   `unit-wait.log` when emitted. A proposed name or a later status query alone
   does not prove ownership. If no successful launch ID was captured, ownership
   is UNKNOWN: do not stop/reset any unit on that evidence.
   Resolve an existing bus: `/run/user/$(/usr/bin/id -u)/bus` must be a socket.
   Missing bus is BLOCKED: no sudo, new manager, config change or restart.

## 2. Launch one reviewed file

Resolve all paths and record them before invoking this template. `APP` is the
isolated app path; `TSX` the existing absolute tsx executable; `TEST` one explicit
relative test filename (no glob); `SKILL` this skill's absolute directory;
`OUT` the new absolute evidence directory; `SCRATCH` the private empty scratch
home; `NODE_BIN` the directory containing the approved recorded Node executable
(no colon/PATH separators); `UNIT` the fresh owned name. These are local shell variables, **not sourced
from any env/config file**. Do not emit the ambient environment or use
`/usr/bin/systemctl show-environment`. Record the command with nonsecret paths only.
Pin controller utilities to `/usr/bin/systemd-run`, `/usr/bin/systemctl`,
`/usr/bin/id`, `/usr/bin/realpath` as shown; confirm those existing paths belong
in the approved plan. Missing utilities mean BLOCK, not PATH fallback/install.
Inspect the approved TSX launcher and symlink chain and record hashes: determine
its actual Node selection under this clean PATH. The observed pnpm shim prefers
an executable sibling `node` before PATH lookup. Its selected Node realpath must
match the recorded approved Node; otherwise BLOCK. Do not assume setting
NODE_BIN pins Node, or bypass a shim with different loader semantics. Recheck
this static identity with each attempt; no version/Node invocation is needed.

The helper runs exclusively inside the approved service, not as an unbounded
fallback. It does not accept arbitrary commands, flags or multiple test files.
All supplied paths/arguments must be trusted and absolute where specified.
Reject literal `$`, `%`, CR and LF **before any user-unit submission**: shell
quotes and `env -i` do not prevent systemd's earlier dollar/specifier expansion.
This includes every variable passed below and every resolved input path. No
`EnvironmentFile`, `PassEnvironment`, production `NODE_ENV`, credential variables
or ambient `NODE_OPTIONS` are forwarded.

```bash
for value in "$APP" "$TSX" "$TEST" "$SKILL" "$OUT" "$SCRATCH" "$NODE_BIN" "$UNIT"; do
  case "$value" in *'$'*|*'%'*|*$'\r'*|*$'\n'*) exit 125 ;; esac
done
case "$NODE_BIN" in *:*) exit 125 ;; esac
app_real=$(/usr/bin/realpath -e -- "$APP") || exit 125
test_real=$(/usr/bin/realpath -e -- "$APP/$TEST") || exit 125
for value in "$app_real" "$test_real"; do
  case "$value" in *'$'*|*'%'*|*$'\r'*|*$'\n'*) exit 125 ;; esac
done
case "$test_real" in "$app_real"/*) ;; *) exit 125 ;; esac
runtime="/run/user/$(/usr/bin/id -u)"
test -S "$runtime/bus" || exit 1
umask 077
# OUT is a fresh private0700 directory: these files do not already exist.
: >"$OUT/tap.log"
: >"$OUT/unit-wait.log"
# Shell must not errexit before the outer status is saved.
set +e
XDG_RUNTIME_DIR="$runtime" DBUS_SESSION_BUS_ADDRESS="unix:path=$runtime/bus" \
  /usr/bin/systemd-run --user --unit="$UNIT" --wait --collect \
  -p Type=exec -p Restart=no -p UMask=0077 \
  -p MemoryMax=512M -p MemorySwapMax=0 -p TasksMax=64 \
  -p RuntimeMaxSec=75s -p TimeoutStopSec=5s -p KillMode=control-group \
  -p "WorkingDirectory=$APP" \
  -p "StandardOutput=append:$OUT/tap.log" \
  -p "StandardError=append:$OUT/tap.log" \
  /usr/bin/env -i PATH="$NODE_BIN:/usr/bin:/bin" \
  HOME="$SCRATCH" TMPDIR="$SCRATCH" LANG=C.UTF-8 \
  NODE_OPTIONS=--max-old-space-size=192 \
  /bin/bash --noprofile --norc "$SKILL/scripts/test-payload.sh" \
  "$TSX" "$TEST" "$OUT" >"$OUT/unit-wait.log" 2>&1
runner_status=$?
printf '%s\n' "$runner_status" >"$OUT/runner-exit.txt"
```

The service remains transient, not enabled. Its output goes directly to the
owned file, not a pipe tied to a tool call. User-manager ownership and runtime
ceiling reduce dependence on the controller surviving. They do **not** promise
survival of logout/manager shutdown, host OOM or machine restart. Runtime75s
can be followed by up to5s stop grace; do not call it an absolute75s wall-clock
bound. Do not silently remove unsupported properties or fall back to nohup.

## 3. Classify before any next launch

Retain all of `tap.log`, `test-exit.txt`, `unit-wait.log`, `runner-exit.txt`,
identity before/after, approval and ownership. Complete the provided
`artifacts/review-manifest.md` for every attempt. Require all of the following
for a scoped PASS:
- test exit explicitly0, controller exit explicitly0, and retained systemd
  terminal summary showing success and main process `code=exited,status=0`;
- complete TAP plan and summary matching the approved selection and expected
  count, no failures, cancellations, unexpected skips or TODOs; truncated TAP
  or “some tests passed” is not enough;
- unchanged input identity and successful cleanup verification.

`--collect` may unload a completed unit before `systemctl show` can inspect it.
Keep the `--wait` terminal summary; unit absence alone proves neither success
nor a zero exit. If the controller disappears, even a surviving test's TAP and
exit0 do not supply the missing service outcome: mark INCOMPLETE unless a
separately authorized recovery obtains equivalent terminal evidence. Never
manufacture an exit marker. Known assertion failure = FAIL; timeout/OOM,
interruption, missing result or contradictory records = FAIL/INCOMPLETE, not
PASS. Preserve each attempt separately and report it before asking for a new
execution decision. Do not repeat automatically after a tool timeout/retry.

## 4. Cancellation and cleanup

On cancellation, interruption, or uncertain state, **do not launch another
unit**. Connect only to the same existing user bus. Inspect only the exact name
with `/usr/bin/systemctl --user show "$UNIT"` and the property allowlist
`LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,ControlGroup,
InvocationID`; retain this record, never environment properties. Before **each**
stop/reset, require its InvocationID to equal the retained successful-launch ID
for this exact name. Missing launch proof, missing/mismatching ID, collision,
reuse or ambiguous state means BLOCK/report, **not cleanup**. Do not establish
ownership by copying the queried current ID into the launch record.

Show-then-stop/reset is **not an atomic compare-and-act**: it depends on
coordinated exclusive ownership and never-reused unique names. Any contradictory
state between checks means BLOCK/report, not retry or broader cleanup.
Only after a fresh exact match, stop this service with
`/usr/bin/systemctl --user stop "$UNIT"` and retain outcome. Reset-failed only
this exact name if still failed and its InvocationID still matches; if the ID
was cleared/unavailable, do not reset. An already collected unit requires no
stop/reset. `KillMode=control-group` applies to the owned service's children.
Verify exact unit absent or fully stopped with no remaining owned cgroup
processes before another launch; disappearance alone still does not prove PASS.
If verification is unavailable, cleanup is UNKNOWN/BLOCKED; notify the parent.
Missing bus/permissions do not authorize system-wide cleanup. Never broad
`pkill`, prefix sweeps, unnamed `reset-failed`, or stop live app/harness.
Cancellation is not a PASS even if partial TAP looked green.

After evidence is retained and cleanup verified, remove only the private scratch
home created for this attempt; keep logs and failures. Report scoped result,
identity, counts, exits, limits, cleanup, remaining gates and evidence paths.

## Evidence basis and validation boundary

Sep22 focused mocked suites used serial user units at these limits and finished
in approximately5–17s, reported peaks178–229M. They were direct invocations,
not an established standalone runner. The historical payload used `env
NODE_OPTIONS=...`, **not** `env -i`; do not claim clean-env behavior was validated.
Sep18 retained evidence includes 1G/2G cgroup OOM failures and a diagnostic
supervisor killed by global OOM while far below its own cap.

**UNVALIDATED proposal:** this skill adds clean payload environment, direct
file output and the explicit payload exit helper. These tighten the proposed
boundary but are not runtime-validated by that history. Independently review these
changes before adoption; any validation run needs its own explicit approval.
The helper and instructions do not certify host safety or replace technical,
build, independent visual or deployment gates.
