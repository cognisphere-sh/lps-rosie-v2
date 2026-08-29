---
name: daily-supplier-availability-onboarding
description: Run the approved daily review of up to 100 active suppliers without availability data. Covers stable-inode locks, explicit run identity, frozen plans, append-only evidence, canonically revalidated delta journals, no-action legacy import, provenance- and association-aware Texas-service qualification, dedicated-thread ingestion, and reporting. Use when the daily schedule fires, running/recovering a cohort, or reviewing a past batch. (v2.10.0)
metadata:
  author: daisy
  version: "2.10.0"
---

# Daily supplier availability onboarding

Run this approved operational batch only from its dedicated coordinator thread,
`daily-supplier-availability-onboarding`. It discovers availability channels; it does
not turn a lack of data into supplier contact or inventory claims.

## Boundaries and prerequisites

1. Read `knowledge/files/SCHEMA.md` before every SQL query, and read the current
   `supplier-onboarding`, `availability-ingestion`, `search-email`,
   `supplier-communications`, and `publish-artifact` skills before applying their
   owned steps. This skill coordinates; supplier-side writes belong exclusively to
   `supplier-onboarding`, inventory/source/alias writes exclusively to
   `availability-ingestion`.
2. Never send supplier email. A Gmail **draft** is not correspondence: do not
   record it as a contact. Record contact only if actual correspondence ever
   occurs, following `supplier-communications`.
3. Use `workspace/threads/daily-supplier-availability-onboarding/files/` for durable
   run state and reports. Keep temporary page conversions and email MIME work in
   `/tmp`. Use task threads for meaningful email/site research batches; their
   briefs name the applicable skill, preserve the no-send rule, and report
   structured evidence back. **Any actual ingestion or supplier-side write goes
   to that supplier's dedicated thread** (`suppliers.daisy_thread_id`), never a
   generic task thread.
4. This is not a historical backfill. A usable public page reviewed today is a
   **manual/current-receipt** handoff only. It can be ingested only where supplier
   and location scope are unambiguous, and must retain the currentness/confirmation
   caveat required by `availability-ingestion`. Never infer that a static catalog
   is live availability.
5. LPS's addressable market is Texas. This coordinator's market gate is
   **read-only** and does not override the standing no-send authorization: a
   supplier can be outreach-eligible only for the later, still-unsent discovery
   steps in this skill. It is not permission to send email, submit an order, or
   claim availability.

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
exists, run `scripts/run-state migrate-state-run-ids --state-file "$STATE"`.
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
scripts/run-state freeze-plan --run-file "$RUN" --state-file "$STATE" \
  --batch-plan /tmp/batch-plan.json
```

If a run is completed, do not append, correct, merge anew or repeat it. Return
its recorded report. Before selecting or dispatching any date, run
`scripts/run-state status --run-file "$RUN" --state-file "$STATE"`. It shows
exact missing IDs and every pending completion/import journal; any pending
transaction or missing result sets `dispatch_blocked: true`. Recover it first.
An unexpected/orphan entry, symlink, altered plan, malformed event or torn tail
blocks the run for review instead of being followed or ignored.

**Workers never edit run/state.** A task brief must name this skill, its frozen
batch slug and IDs, `$RUN`, and these mechanics: before every external or write
action call `scripts/run-state latest --run-file "$RUN" --state-file "$STATE"
--batch-id "$TASK" --supplier-id "$SUPPLIER_ID"`; discover and mechanically verify any recorded
draft/signup/source/ingest rather than repeating it. After an irreversible action
append a complete `status: in-progress` supplier snapshot immediately; append a
`status: final` snapshot when review ends. Each task writes only its own fsynced
`files/runs/batch-results/<date>/<task>.jsonl`:

```bash
scripts/run-state append --run-file "$RUN" --state-file "$STATE" \
  --batch-id "$TASK" --supplier-id "$SUPPLIER_ID" \
  --result-file /tmp/supplier-result.json
```

A correction never erases history and must name its evidence:

```bash
scripts/run-state append ... --correct --reason "what changed" \
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
scripts/run-state merge --run-file "$RUN" --state-file "$STATE"
scripts/run-state merge --run-file "$RUN" --state-file "$STATE" \
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
scripts/run-state import-recovery --run-file "$RUN" --state-file "$STATE" \
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
and transaction id; and compares all of them to the journal. Changed content or
path substitution blocks. Other commands block on pending import rather than
advancing it without those external canonical inputs. Identical validated replay
returns unchanged success and `actions_performed: 0`. It does not advance current cursor,
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

## 2. Texas-first read-only outreach-eligibility gate

Run this gate and record its terminal result **before** any Gmail availability
search, availability-page parsing/ingest handoff, POC lookup, newsletter attempt,
or new supplier-email draft.

1. Record the supplier's actual category and location evidence already held, but
   do not turn a state, city, ZIP, or the supplied Texas market names into a
   service-area conclusion. The Texas market names are business context only;
   never derive coverage from a guessed ZIP/city mapping.
2. Where an original Google Sheet/cohort artifact is available, check for
   **verified original-cohort provenance** before assigning a low-priority hold.
   Verification must bind this supplier/company (not merely a similar name) to an
   identifiable source row/list and preserve the exact original label, artifact or
   URL/path, and retrieval date. Record `original-cohort-verified` or
   `original-cohort-unverified` with the reason; a current app category, a guessed
   match, or an absent/uncertain artifact is never cohort membership. Verified
   membership is a prior-human-qualification signal only: it does not prove
   current availability, price, Texas delivery, current business type, or a right
   to contact the supplier.
3. An **out-of-state supplier classified `Wholesale Supplier`** is the one
   approved categorical exception: classify it `retained-future-market`, with
   the category/state evidence. Do no routine availability, POC, newsletter,
   signup, draft, or other contact effort in this run. Retain it in the cohort
   state and report it for future expansion; do not delete, retire, or mark it
   ineligible in the database.
4. For every other supplier, establish Texas service evidence from an explicit
   public delivery/service-area statement, sales terms, a documented direct
   business fact, or equivalent evidence. A Texas address alone is not proof of
   service. If evidence is absent or conflicting, classify
   `held-service-to-Texas-unverified`; do only the bounded read-only research
   needed to record that gap, then stop. Do not search availability, seek a POC,
   subscribe, create a draft, or dispatch ingestion. For an
   `original-cohort-verified` supplier, do not treat missing website shipping
   language **alone** as a low-priority reason to stop: record the same unresolved
   Texas-service fact as `held-service-to-Texas-unverified-prior-qualified`, give
   it focused bounded read-only review, and, if still unresolved, queue a direct
   availability-and-Texas-service question for a later, separately Chris-approved
   supplier-thread action. The signal neither authorizes that question nor permits
   a draft, send, availability search, POC lookup, newsletter signup, or ingest in
   this held run.
5. Review trade-association membership as a **supporting qualification signal**
   for market/service reach when it is current and attributable to the supplier:
   record the association name, supplier identity as listed, exact current public
   URL or other dated evidence, geography/market relevance, and retrieval date.
   For example, Texas Nursery & Landscape Association (TNLA) membership is direct
   Texas-market evidence for La Croix Nursery; an Alabama nursery/landscape
   association membership supports a Louisiana supplier's reach beyond Louisiana.
   Direct delivery/shipping/service-area statements and documented direct business
   facts take precedence. Membership alone is not a universal guarantee of service
   to Texas or another market; only classify it as dispositive where Chris has
   named that supplier/case or made that decision. Otherwise record it as
   supporting evidence and retain/hold according to the stronger evidence.
6. If explicit evidence supports serving Texas, classify
   `eligible-Texas-service` and proceed to §3. Growers are reviewed first;
   Texas wholesale nurseries are relevant regional prospects after that priority.
   This priority does not make their stock actionable until the same service
   evidence is recorded.
7. Existing drafts are audit records, not a workaround: never send, delete,
   duplicate, or revive one because of this gate. For a held or retained supplier,
   record its draft id, recipient, subject, and why it is `draft-held-market-gate`.
   Only a later eligible run plus Chris's separate authorization can move it
   toward correspondence.
8. **Respect placeholder holds.** A supplier Chris has designated a placeholder
   for special material (e.g. Devil Mountain, 2026-08-20 — big specimen trees
   only) gets no routine availability, POC or newsletter effort: record the
   hold and move on.

## 3. Per-supplier evidence loop

For each supplier that passed §2, record supplier id/name, website, active
contact emails, Texas-service evidence, and all evidence/URLs checked.

### A. Search 2026 email, not notifications

Use `search-email` with `in:anywhere after:2025/12/31 before:2027/01/01` and
one known active contact email at a time; where a company domain is established,
use a bounded domain search too. Search likely availability terms (`availability`,
`avail`, `price`, `price list`, `inventory`) and inspect actual hits with
`scripts/gws/email read`, including attachments/links where necessary. A mailbox
notification or an unrelated marketing email is not evidence. Record message id,
Gmail thread id, received date, sender and why it is/is not usable availability.

If an actual 2026 availability drop is found, mark **email availability found**;
do not replay it merely because this cohort found it. Report it for review. If a
newly found, previously unprocessed current drop truly needs ingestion, forward
it to the supplier's dedicated thread (`daisy_thread_id`) to run
`availability-ingestion` with correct classification, not this coordinator's
own SQL.

### B. Review only ordinary public website material

Open the normal public website (not credentials, guessing URL paths, or bypassing
gates). Look for availability, inventory, pricing, catalog/download, dealer or
newsletter pages. Record each exact URL and what it establishes.

A public file/page is usable only when it clearly represents live or current
supplier availability/pricing and its supplier/location scope is safe. Before
any ingest, cheaply compare URL/page timestamp, HTTP metadata or a content hash
against evidence already recorded in state/source records; skip unchanged data.
Dispatch changed, usable data to the supplier's dedicated thread
(`daisy_thread_id`) to run `availability-ingestion`, with a
manual/current-receipt classification, retrieval timestamp, exact URL/file,
location evidence and confirmation-required caveat. That thread owns all
writes and may stop on ambiguity. Record its report/source IDs in the run state.
Otherwise mark hosted data as found-but-not-ingested and state why (static,
undated, gated, ambiguous, unchanged, or unusable).

### C. Newsletter / availability subscription

Locate a normal subscription form. **Detection is not an outcome:** every form
found must end in one recorded terminal state — `subscribed`, `held-human` with
an exact URL and blocker, or `technical-failure` with exact URL/reason. Make the
best safe effort to subscribe `chris.r@localplantsupply.com`: check a required
marketing-consent box, complete ordinary fields, and attempt a CAPTCHA normally
when the browser can solve it. Record each action and its observed result. A
CAPTCHA that remains unsolved, a technical failure, account/login barrier, or an
email-verification link requiring human access is a human hold only **after**
that attempt; do not merely detect it and stop. Do not blindly repeat a failed
form submission, and never retry a previously successful subscription.

### D. No form: create an unsent supplier-email draft

Only if no subscription form exists, locate a verified active supplier contact
email. Create **one** plain-text Gmail draft, addressed to that contact and sent
as Chris if later approved. Do not send it, do not add a signature/footer, and
specifically omit the Keep-me-in-To footer. Use a compact body such as:

```
Hello,

We are updating our supplier availability records. Is your website the best place
to find current availability and pricing, or do you send regular availability
updates by email? Also, who is the right contact for availability and pricing?

Thank you,
Chris Runyon
```

Use Gmail drafts creation (RFC 822 `To`, `Subject`, and plain-text body encoded
as the API requires); capture and store draft id, recipient, subject and exact
body in run state. Before creating, search existing drafts/state for the same
supplier and purpose; reuse/report it rather than duplicate it. If no safe
recipient exists, do not draft; report that as a blocker.

## 4. Complete, publish, notify

Build a responsive, self-contained **private** artifact per `publish-artifact`,
using a stable slug such as `supplier-availability-onboarding-daily`. Include
as-of time and exact cohort IDs/count, with these sections:

- Texas-service gate outcomes and evidence, separately counting Growers,
  eligible Texas wholesale-nursery prospects, `held-service-to-Texas-unverified`,
  `held-service-to-Texas-unverified-prior-qualified`, and
  `retained-future-market` out-of-state wholesale nurseries. For every outcome,
  state the classification rationale and evidence type; for verified original
  cohort provenance include the exact label, artifact/path or URL and retrieval
  date, and explicitly say that it was not used as proof of availability, price,
  or Texas delivery. For association evidence include the association,
  attributable/current evidence URL or dated record, geography, and whether
  stronger direct/shipping evidence or Chris's named decision controlled the
  result;
- retained future-market suppliers (supplier/category/state evidence and an
  explicit confirmation that no routine availability, POC, newsletter, draft,
  or contact effort was made);
- availability emailed in 2026 (message/thread/date/evidence; no replay claim);
- hosted data (URL, currentness/scope assessment, change check, ingest/source
  evidence or why held);
- precise unsent drafts eligible for Chris approval, **and** market-gate-held
  drafts (supplier, recipient, draft id, subject, full body, hold reason, and
  confirmation that none was sent);
- human-intervention URLs and blockers (CAPTCHA, verification, login, etc.);
- processed, skipped and errors, plus source/ingest evidence and counts.

Publish privately; record returned URL in the run state, mark it completed, then
send **only** that private URL plus a one-line batch summary through agent
messaging to `daisy` thread `main`. Never contact Telegram/Chris directly from
this thread. Update this thread's notes and the daily note with the batch result.
If a correction pass changes any result, **regenerate the whole artifact from
final state** (Bhoumik, 2026-08-20) — never publish an incremental patch over a
stale report.

## 5. Failure handling

- Gmail/browser/auth failure: record supplier-level error, continue the cohort,
  and report it; do not loop or claim a check occurred.
- Any uncertain supplier/location/currentness, Texas-service eligibility, or
  write risk: hold it, report exact evidence and reason; do not ingest.
- If a task thread reports a blocker, retain its evidence in the run record and
  include it in the artifact. Do not substitute a guess or contact a supplier.
