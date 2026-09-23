# daily-supplier-availability-onboarding — changelog

## 2.12.0

- Separate coordinator recovery, eligibility, research and reporting; retain run-state safeguards and avoid loading every downstream skill before its branch is needed.

## 2.11.0

2026-08-28 — targeted-review import crash-window and physical-evidence fix.
Prepared replay now no-follow verifies and accepts an already-renamed batch root
only when exact expected filenames/bytes exist with no extras. Logs-written replay
recognizes an already atomically written run only when it exactly equals the
rederived frozen payload. Logs-written, run-frozen and committed/idempotent replay
all independently verify the physical logs against rederived canonical lines and
reject missing, changed, extra or symlinked entries. Thirty-one tests add both
write-before-phase-update crash windows and committed missing/changed/extra logs.
v2.7/v2.8 qualification rules are unchanged.

## 2.10.0

2026-08-28 — sixth-review recovery-import integrity fix. State now records the
canonical run/cohort and exact manifest/evidence paths/hashes before import.
Pending import requires explicit replay with those same external files; ordinary
commands block instead of trusting journal payload. Every prepared,
logs-written, run-frozen and committed replay reloads canonical state, physical
run, manifest/evidence and artifact hashes, rederives exact plan, ordered
results/events/batch lines, frozen payload, hashes and transaction id, and rejects
cohort/content/path substitution. Twenty-eight tests add the exact coherent
supplier substitution plus manifest, evidence and path changes across partial
phases. v2.7/v2.8 qualification rules are unchanged.

## 2.9.0

2026-08-28 — fifth-review lock/rollout hardening. Lock acquisition now records
the pre-open pathname inode, compares it after `flock`, and rescans deleted
holders after descriptor/path verification, closing the exact pre-scan→open
unlink race. Documents the Linux `/proc/<pid>/fd` dependency and same-user
safe-DoS trust boundary. The idempotent run-id migration now updates standalone
historical run files as well as embedded state; pre-v2.6 completed files without
frozen logs are explicitly marked legacy and remain status-readable without a
false canonical-provenance claim. Twenty-four tests include the exact
`v260_lock_race.py` reproduction and standalone migration/replay.

## 2.8.0

2026-08-28 — Chris clarified that verified membership in an original source
cohort is a prior-human-qualification signal. The Texas gate now preserves exact
verified provenance, gives those suppliers focused review rather than treating
missing website shipping language alone as a low-priority stop, and queues a
narrow availability-and-Texas-service question only for separate approval. It
explicitly prohibits inferring membership and preserves Texas-first/no-unapproved
email rules; provenance is not proof of current availability, price, delivery or
business type. Cohort ordering and batch reporting now expose the signal.

## 2.7.0

2026-08-28 — Chris designated attributable, current trade-association membership
as a supplier-qualification signal. The Texas-service gate now reviews and records
association evidence with geography and retrieval provenance; direct
shipping/service evidence still prevails, and membership alone is not treated as a
universal service guarantee. The daily report must state the classification
rationale and how association evidence affected it. Adds TNLA/La Croix and an
Alabama association/Louisiana supplier example.

## 2.6.0

2026-08-28 — fourth-review integrity hardening. Every running/completed payload
now carries a `run_id` bound to physical filename, state key, journal basename,
transaction core/delta and import payload; semantic date substitution blocks
even after unkeyed hashes are recomputed. A one-time idempotent legacy-state
migration adds historical payload IDs. Lock acquisition now rejects symlinks,
wrong owner/mode/type, an opened/path inode mismatch and a still-open deleted
lock inode; creation fsyncs its parent and the tool never unlinks locks.
Transaction-critical JSON/log reads use no-follow opens and `fstat`. The corrected
plan-mutation test passes required state and checks the real divergence error.
Twenty-three tests include the exact semantic-substitution and lock-replacement
reproductions.

## 2.5.0

2026-08-28 — closes the prepared-evidence race from the third adversarial
review. Freeze, append/correct, latest, non-complete merge and completion now
share one global-state → run → sorted-batch lock hierarchy. Recovery reacquires
it and independently rebuilds canonical plan/provenance/event/result hashes
before a prepared journal can write; late evidence blocks instead of being
overwritten. Completed status compares canonical run data to latest logs and
fails on divergence. State and delta semantics (run/date, exact reviewed IDs,
order, cursor and hashes) are validated rather than trusting a self-hash. Twenty
tests add prepared-crash/late-correction, stale merge, completed-log divergence
and semantic-tamper/invalid-state reproductions.

## 2.4.0

2026-08-28 — second adversarial hardening. Completion journals now carry a
hash-bound idempotent state delta, never a stale full-state snapshot; every
pending transaction is validated/recovered under the global lock before another
date can complete. Tampering blocks progress, normal dates are monotonic, and
status exposes pending phases/dispatch blocking. All state/run/lock/transaction/
batch paths reject symlinks and non-regular components. Recovery import now
requires exact canonical decimal keys, hashed reconciliation artifacts and
explicit read-only-check assertions, and is itself resumable/idempotent across
journaled phases. Seventeen tests reproduce cross-date replay, tampering, cursor
regression, symlink escape, import collisions/replay/crashes and prior cases.

## 2.3.0

2026-08-28 — adversarial hardening after review: a stable global lock now
serializes state completion across dates; a prepared transaction journal makes
the two-file run/state update recoverable and replay-idempotent without claiming
multi-file atomicity. Plans are frozen and hashed before dispatch, safe slugs and
event schemas are enforced, orphan logs block merge, completed runs are
immutable, corrections carry predecessor hashes/reason/evidence, and partial
writes are looped/fsynced. Adds worker `latest`/coordinator `status`, mechanical
completion evidence, and a separate no-action legacy recovery importer. Ten
adversarial tests cover the reproduced races and recovery paths.

## 2.2.0

2026-08-28 — prevents parallel cohort workers from racing whole-file writes.
Workers now append immutable, fsynced supplier snapshots only to their assigned
batch log; the coordinator deterministically locks and atomically merges every
batch, rejects missing/overlapping/torn evidence, and advances completion state
only after exact terminal coverage. Adds concurrency, correction and crash-
recovery tests. Also corrects the documented coordinator state path to the
active `daily-supplier-availability-onboarding` thread.

## 2.1.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 2.1.0

2026-08-23 — category vocabulary updated to Chris's target tag set (migration
0067): the §2 out-of-state retained-future-market exception now names
`Wholesale Supplier` (previously `Wholesaler` or `Nursery`, both retired).

## 2.0.0

2026-08-23 — Bhoumik's agent restructure: ingestion and supplier-side writes
are no longer dispatched to generic task threads or the retired
`availability-drop-intake` path — they go to each supplier's dedicated thread
(`suppliers.daisy_thread_id`, migration 0064), which runs
`availability-ingestion` itself. Also folds in two 2026-08-20 directives:
placeholder-supplier holds (Devil Mountain pattern — special-material
placeholders get no routine effort) and Bhoumik's regenerate-on-correction
rule for the batch artifact. The draft rule no longer references the dropped
`supplier_messages` table — contact recording follows
`supplier-communications`. The 3 AM schedule stays paused pending the
category-tag migration.

- Chris-approved Texas-first policy: prioritize Growers, require explicit Texas-service evidence before availability work becomes actionable, retain out-of-state wholesale nurseries without routine outreach, and audit/hold drafts rather than reviving them.

## 1.2.0

- Bhoumik-approved change: best-effort signup now checks required consent and attempts normally solvable CAPTCHA before holding; unresolved CAPTCHA, email verification and technical failures retain exact evidence.

## 1.1.0

- Bhoumik-approved correction: every detected subscription form now requires a recorded attempted success, precise human/CAPTCHA hold, or technical-failure outcome; a detected form alone is not complete.

## 1.0.0

- Initial Bhoumik-approved 3 AM daily routine for safe, idempotent review of 100 suppliers without availability data.
