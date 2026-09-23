## 1. Durable state and a deterministic cohort

State file: `workspace/threads/daily-supplier-availability-onboarding/files/state.json`.
Create it atomically on the first run, for example:

```json
{
  "schema_version": 1,
  "last_completed_run": null,
  "last_supplier_id": 0,
  "reviewed_supplier_ids": [],
  "runs": {}
}
```

Before first rollout against legacy state, and only while no transaction journal
exists, run `skills/agent/daily-supplier-availability-onboarding/scripts/run-state migrate-state-run-ids --state-file "$STATE"`.
It idempotently binds each historical embedded state entry **and standalone
`runs/<date>.json` file** to its date. Pre-v2.6 completed standalone files with no
frozen batch logs are marked `legacy_completed`; `status` reads them honestly as
`canonical_log_verification: unavailable-for-pre-v2.6-run` rather than failing or
claiming modern provenance verification. Use `--runs-dir` only if runs are not in
the state file's sibling `runs/` directory.

At the start, atomically create `runs/<YYYY-MM-DD>.json` with `run_id` exactly
equal to `<YYYY-MM-DD>`, `status: running`, a valid ISO `started_at`, selected
ids, and empty `supplier_results`. Physical filename, payload `run_id`, state
key, journal basename, transaction core/delta and imported payload must agree;
date substitution blocks recovery/status even if someone recomputes unkeyed
hashes.
Write a `/tmp` batch-plan JSON object whose safe task slugs each own a disjoint
id list and together cover the cohort exactly. **Before dispatching any task,**
freeze it; its hash is the plan identity and it cannot be renamed or changed
after evidence exists:

```bash
skills/agent/daily-supplier-availability-onboarding/scripts/run-state freeze-plan --run-file "$RUN" --state-file "$STATE" \
  --batch-plan /tmp/batch-plan.json
```

If a run is completed, do not append, correct, merge anew or repeat it. Return
its recorded report. Before selecting or dispatching any date, run
`skills/agent/daily-supplier-availability-onboarding/scripts/run-state status --run-file "$RUN" --state-file "$STATE"`. It shows
exact missing IDs and every pending completion/import journal; any pending
transaction or missing result sets `dispatch_blocked: true`. Recover it first.
An unexpected/orphan entry, symlink, altered plan, malformed event or torn tail
blocks the run for review instead of being followed or ignored.

**Workers never edit run/state.** A task brief must name this skill, its frozen
batch slug and IDs, `$RUN`, and these mechanics: before every external or write
action call `skills/agent/daily-supplier-availability-onboarding/scripts/run-state latest --run-file "$RUN" --state-file "$STATE"
--batch-id "$TASK" --supplier-id "$SUPPLIER_ID"`; discover and mechanically verify any recorded
draft/signup/source/ingest rather than repeating it. After an irreversible action
append a complete `status: in-progress` supplier snapshot immediately; append a
`status: final` snapshot when review ends. Each task writes only its own fsynced
`files/runs/batch-results/<date>/<task>.jsonl`:

```bash
skills/agent/daily-supplier-availability-onboarding/scripts/run-state append --run-file "$RUN" --state-file "$STATE" \
  --batch-id "$TASK" --supplier-id "$SUPPLIER_ID" \
  --result-file /tmp/supplier-result.json
```

A correction never erases history and must name its evidence:

```bash
skills/agent/daily-supplier-availability-onboarding/scripts/run-state append ... --correct --reason "what changed" \
  --evidence-reference "notes/path.md#specific-proof"
```

The event records its predecessor hash. Slugs, IDs, timestamps, status, plan
identity and paths are validated; logs and lock files are mode 0600.

Only the coordinator runs `merge`. It locks all frozen batch logs and atomically
replaces the one canonical run file in selected-ID order. Before completion,
build a machine-readable evidence manifest from read-only checks: ISO
`verified_at`, `verified_by`, an honest `method`; `read_only_assertions` booleans
saying whether DB and Gmail were actually checked plus
`no_external_actions_performed: true`; paths and SHA-256 hashes for the
reconciliation artifacts; selected/result and outcome counts; every source id
with `is_active: true` and active-row count plus source/row totals; every draft
id with `status: draft` plus draft count; each signup failure with `terminal:
true` plus failure count; and `sent_email_count: 0` / `contact_count: 0`. A false
DB/Gmail assertion is allowed and explicitly means attested evidence, **not live
truth**. The command verifies artifact hashes and recomputes declared totals.

```bash
skills/agent/daily-supplier-availability-onboarding/scripts/run-state merge --run-file "$RUN" --state-file "$STATE"
skills/agent/daily-supplier-availability-onboarding/scripts/run-state merge --run-file "$RUN" --state-file "$STATE" \
  --evidence-manifest /tmp/completion-evidence.json --complete
```

Every mutating/read-latest command follows one hierarchy: stable no-follow
state lock → stable run lock → sorted batch locks. After `flock`, the helper
records the path inode before open, then after `flock` compares both that identity
and the current path inode to the opened descriptor, and rescans for a still-open
deleted lock inode; lock files are never unlinked by the tool, are owner-only
0600, and new creation fsyncs the parent. Deleted-inode detection is
**Linux/procfs-dependent** (`/proc/<pid>/fd`). This deployment trusts same-user
processes not to sabotage lock files: a same-user process can still cause a safe
DoS by replacing/unlinking locks, but the command fails rather than entering the
critical section concurrently. Transaction-critical JSON
and logs use no-follow opens plus regular-file `fstat` checks. Freeze, append/correct,
non-complete merge and completion therefore cannot interleave stale run views.
Completion is **not a multi-file atomic write**. Under that hierarchy, the
script first validates and deterministically finishes every pending journal
before starting another date. Its integrity-checked journal
binds run/state paths, run/plan/result/evidence hashes and the completed-run
payload, but stores only an idempotent state **delta**. Replay applies that delta
to current canonical state, preserving unrelated runs and reviewed IDs; it never
installs a stale full-state snapshot. Prepared → run-written → committed phases
make interruption recoverable and keep `completed_at`, history and cursor stable.
Recovery independently rebuilds current latest batch evidence while holding the
same locks and compares plan, canonical running-run, provenance, event/result
and payload hashes before writing; evidence changed after prepare blocks rather
than being overwritten. Tampered journals or invalid state/delta semantics block
all new completion. Normal completion must be strictly
newer than `last_completed_run`; an older date is rejected and cannot regress the
global cursor. A pending older transaction is recovered before a newer one. Status performs
the same canonical provenance/result comparison for completed runs and exits
nonzero on post-completion log evidence or canonical divergence.

A legacy damaged run with no frozen plan is **not a normal resume**. After an
audited reconciliation produces exact canonical decimal result keys, an exact
batch plan and the evidence manifest above, run:

```bash
skills/agent/daily-supplier-availability-onboarding/scripts/run-state import-recovery --run-file "$RUN" --state-file "$STATE" \
  --manifest /tmp/recovery.json \
  --evidence-manifest /tmp/completion-evidence.json
```

The first import atomically records a canonical authorization in state: exact
run/cohort, manifest and evidence paths/hashes. The separate import journal then
writes complete logs before freezing the run. **Pending import is never recovered
from journal assertions alone**: rerun the same `import-recovery` command with
the original manifest/evidence paths. At prepared, logs-written, run-frozen and
committed replay it independently reloads canonical state, physical legacy/frozen
run, manifest, evidence and hashed reconciliation artifacts; rederives exact
selected cohort, plan, ordered results/events/batch lines, frozen payload, hashes
and transaction id; and compares all of them to the journal. Physical batch-log filenames and exact
bytes (with no extras and no symlink following) are verified independently at
logs-written, run-frozen and committed replay. A crash after replacing the batch
root but before updating journal phase accepts that root only when this exact
verification passes; a crash after atomically freezing the run but before phase
update accepts only the exact rederived frozen payload. Changed content or path
substitution blocks. Other commands block on pending import rather than advancing
it without those external canonical inputs. Identical validated replay returns
unchanged success and `actions_performed: 0`. It does not advance current cursor,
so a later completed date remains latest. Merge, recheck, regenerate the whole
private artifact, then complete only where monotonic policy allows. Never infer
missing results from the damaged canonical map.

Read-only discovery query: select **active** suppliers that have no active
`inventory` and no active `inventory_sources`, ordering Growers first, then those
absent from `reviewed_supplier_ids`, then by the least-recent reviewed timestamp
held in state, then `id`; select 100. Category supplies a priority, not evidence
that a supplier can serve Texas. The database is the cohort authority; state only
supplies rotation. Do not assume null availability columns mean no data. Record
the exact query result IDs in the run file before any review. If fewer than 100
qualify, process the smaller set and say so. Within an otherwise identical
Texas-gate/rotation priority, review a supplier with verified original-cohort
provenance before one without it; this never overrides Grower-first, the Texas
market gate, a placeholder hold, or the no-send rule.

At successful completion, the coordinator advances `last_supplier_id`/review
history and sets `last_completed_run`; keep a bounded recent history sufficient
to avoid immediate re-cohorting (at least the most recent full rotation). A crash
must therefore be safely resumable and an already-created Gmail draft must be
discovered/recorded rather than recreated.
