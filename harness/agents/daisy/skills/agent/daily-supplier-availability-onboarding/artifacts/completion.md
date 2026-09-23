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
