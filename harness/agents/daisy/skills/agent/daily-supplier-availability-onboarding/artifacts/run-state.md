# Run state

```sh
RS=skills/agent/daily-supplier-availability-onboarding/scripts/run-state
STATE=workspace/threads/daily-supplier-availability-onboarding/files/state.json
RUN=workspace/threads/daily-supplier-availability-onboarding/files/runs/<YYYY-MM-DD>.json
```

The script does the locking, journals and crash recovery. If it blocks
(`dispatch_blocked`, a tampered/orphan file, a changed plan), stop and report
it; never edit state files by hand or work around it.

## Start

1. First run only: create `$STATE` as
   `{"schema_version":1,"last_completed_run":null,"last_supplier_id":0,"reviewed_supplier_ids":[],"runs":{}}`.
   Legacy state with no journal yet: run `$RS migrate-state-run-ids --state-file "$STATE"` once
   (`--runs-dir` only if runs aren't in `files/runs/`). Old completed runs
   then show `unavailable-for-pre-v2.6-run` in status; that is expected.
2. `$RS status --run-file "$RUN" --state-file "$STATE"` before choosing or
   dispatching anything. Pending transactions or missing results →
   recover first. Completed → return its report; never redo or append.
3. Cohort (read-only query): **active** suppliers with no active inventory and
   no active sources. Order: Growers first, then never-reviewed, then least
   recently reviewed (from state), then id. Take 100 (fewer if fewer
   qualify; say so). Within the same priority, suppliers with verified
   original-cohort evidence go first (never over Grower-first, the Texas
   gate, placeholder holds or the no-send rule). Null availability columns
   don't mean "no data". Record the exact ids in the run file before review.
4. Create `$RUN` with `run_id` = the date, `status: running`, ISO
   `started_at`, the ids, empty `supplier_results`. Write `/tmp/batch-plan.json`
   (task slug → disjoint id lists covering the cohort exactly) and freeze it
   **before** dispatching: `$RS freeze-plan --run-file "$RUN" --state-file "$STATE" --batch-plan /tmp/batch-plan.json`.
   A frozen plan can't be renamed or changed.

## Workers (task threads)

- Before every external action or write: `$RS latest --run-file "$RUN" --state-file "$STATE" --batch-id "$TASK" --supplier-id "$ID"`;
  find and verify anything already done (draft, signup, source, ingest)
  instead of repeating it.
- Right after anything irreversible, append an `in-progress` snapshot; append
  `final` when that supplier is done:
  `$RS append --run-file "$RUN" --state-file "$STATE" --batch-id "$TASK" --supplier-id "$ID" --result-file /tmp/supplier-result.json`.
- Corrections never erase: add `--correct --reason '<what changed>' --evidence-reference '<path#proof>'`.

## Finish (coordinator only)

1. `$RS merge --run-file "$RUN" --state-file "$STATE"`.
2. Build `/tmp/completion-evidence.json` from read-only checks: ISO
   `verified_at`, `verified_by`, honest `method`; `read_only_assertions`
   (whether DB and Gmail were actually checked, and
   `no_external_actions_performed: true`); paths and SHA-256 of the
   reconciliation files; selected/result and outcome counts; every source id
   with `is_active: true` and its active-row count, plus totals; every draft id
   with `status: draft`, plus count; each failed signup with `terminal: true`,
   plus count; `sent_email_count: 0`, `contact_count: 0`. A `false` assertion
   means "attested, not checked live" — say so.
3. `$RS merge --run-file "$RUN" --state-file "$STATE" --evidence-manifest /tmp/completion-evidence.json --complete`.
   This advances the cursor and review history; completion must be newer than
   `last_completed_run`.

## Damaged legacy run (no frozen plan)

Not a normal resume. After a checked reconciliation gives exact results, a
batch plan and the evidence manifest:
`$RS import-recovery --run-file "$RUN" --state-file "$STATE" --manifest /tmp/recovery.json --evidence-manifest /tmp/completion-evidence.json`.
If it stops midway, rerun the same command with the same files. Then merge,
recheck, regenerate the whole report, and complete only if allowed. Never
guess missing results.
