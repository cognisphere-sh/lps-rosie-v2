---
name: daily-supplier-availability-onboarding
description: Run the approved daily review of up to 100 active suppliers without availability data. Covers durable cohort/cursor state and idempotency, read-only discovery, 2026 Gmail checks, safe public-site review and bounded current-receipt ingestion, best-effort newsletter/signup outcomes including consent/CAPTCHA attempts, unsent Gmail drafts, private batch artifacts, and main-thread reporting. Use when the 3 AM supplier-availability onboarding schedule fires or when asked to run/review this daily cohort. (v1.2.0)
metadata:
  author: daisy
  version: "1.2.0"
---

# Daily supplier availability onboarding

Run this approved operational batch only from its dedicated coordinator thread,
`supplier-availability-onboarding`. It discovers availability channels; it does
not turn a lack of data into supplier contact or inventory claims.

## Boundaries and prerequisites

1. Read `knowledge/files/SCHEMA.md` before every SQL query, and read the current
   `supplier-onboarding`, `availability-ingestion`, `search-email`,
   `supplier-communications`, and `publish-artifact` skills before applying their
   owned steps. This skill coordinates; supplier-side writes belong exclusively to
   `supplier-onboarding`, inventory/source/alias writes exclusively to
   `availability-ingestion`.
2. Never send supplier email. A Gmail **draft** is not correspondence: do not add
   a `supplier_messages` row for it. Do add transcript rows only if actual
   correspondence ever occurs, following `supplier-communications`.
3. Use `workspace/threads/supplier-availability-onboarding/files/` for durable
   run state and reports. Keep temporary page conversions and email MIME work in
   `/tmp`. Use task threads for meaningful email/site batches; their briefs name
   the applicable skill, preserve the no-send rule, and report structured
   evidence back.
4. This is not a historical backfill. A usable public page reviewed today is a
   **manual/current-receipt** handoff only. It can be ingested only where supplier
   and location scope are unambiguous, and must retain the currentness/confirmation
   caveat required by `availability-ingestion`. Never infer that a static catalog
   is live availability.

## 1. Durable state and a deterministic cohort

State file: `workspace/threads/supplier-availability-onboarding/files/state.json`.
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

At the start, create `runs/<YYYY-MM-DD>.json` with status `running`, timestamp,
selected ids, and an empty per-supplier result map. If that run file is already
`completed`, do not repeat it: republish/return its recorded artifact URL. If it
is `running`, resume only suppliers without a final result; never create another
draft, signup, source, or ingest for a supplier whose result records that action
and evidence. Update a result immediately after each irreversible action.

Read-only discovery query: select **active** suppliers that have no active
`inventory` and no active `inventory_sources`, ordering first by those absent
from `reviewed_supplier_ids`, then by the least-recent reviewed timestamp held in
state, then `id`; select 100. The database is the eligibility authority; state
only supplies rotation. Do not assume null availability columns mean no data.
Record the exact query result IDs in the run file before any review. If fewer than
100 qualify, process the smaller set and say so.

After every final supplier result, update the run file. At successful completion,
advance `last_supplier_id`/review history and set `last_completed_run`; keep a
bounded recent history sufficient to avoid immediate re-cohorting (at least the
most recent full rotation). A crash must therefore be safely resumable and an
already-created Gmail draft must be discovered/recorded rather than recreated.

## 2. Per-supplier evidence loop

For each selected supplier, record supplier id/name, website, active contact
emails, and all evidence/URLs checked.

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
newly found, previously unprocessed current drop truly needs ingestion, hand it
through the ordinary `availability-drop-intake` / `availability-ingestion` path
with correct classification, not this coordinator's own SQL.

### B. Review only ordinary public website material

Open the normal public website (not credentials, guessing URL paths, or bypassing
gates). Look for availability, inventory, pricing, catalog/download, dealer or
newsletter pages. Record each exact URL and what it establishes.

A public file/page is usable only when it clearly represents live or current
supplier availability/pricing and its supplier/location scope is safe. Before
any ingest, cheaply compare URL/page timestamp, HTTP metadata or a content hash
against evidence already recorded in state/source records; skip unchanged data.
Dispatch an `availability-ingestion` task only for changed, usable data, with a
manual/current-receipt classification, retrieval timestamp, exact URL/file,
location evidence and confirmation-required caveat. The ingestion task owns all
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

## 3. Complete, publish, notify

Build a responsive, self-contained **private** artifact per `publish-artifact`,
using a stable slug such as `supplier-availability-onboarding-daily`. Include
as-of time and exact cohort IDs/count, with these sections:

- availability emailed in 2026 (message/thread/date/evidence; no replay claim);
- hosted data (URL, currentness/scope assessment, change check, ingest/source
  evidence or why held);
- precise unsent drafts eligible for Chris approval (supplier, recipient, draft
  id, subject, full body, and confirmation that none was sent);
- human-intervention URLs and blockers (CAPTCHA, verification, login, etc.);
- processed, skipped and errors, plus source/ingest evidence and counts.

Publish privately; record returned URL in the run state, mark it completed, then
send **only** that private URL plus a one-line batch summary through agent
messaging to `daisy` thread `main`. Never contact Telegram/Chris directly from
this thread. Update this thread's notes and the daily note with the batch result.

## Failure handling

- Gmail/browser/auth failure: record supplier-level error, continue the cohort,
  and report it; do not loop or claim a check occurred.
- Any uncertain supplier/location/currentness or write risk: hold it, report
  exact evidence and reason; do not ingest.
- If a task thread reports a blocker, retain its evidence in the run record and
  include it in the artifact. Do not substitute a guess or contact a supplier.
