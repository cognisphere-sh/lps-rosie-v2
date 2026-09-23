---
name: daily-supplier-availability-onboarding
description: Coordinate the approved daily cohort of up to 100 suppliers. Includes durable run-state CLI, Texas eligibility, research and reporting. Use for scheduled runs, recovery or batch review. (v2.12.0)
metadata:
  author: lps
  version: "2.12.0"
---

# Daily supplier availability onboarding

Coordinator thread: `daily-supplier-availability-onboarding`. Discover channels;
never send supplier email. Drafts are unsent and are not contact records.
Texas eligibility is a read-only research gate, never outreach authorization.

1. Read [run state](artifacts/run-state.md) and use `skills/agent/daily-supplier-availability-onboarding/scripts/run-state` for
   status/recovery, frozen plans, worker evidence and merge. Recover pending
   transactions before dispatch. Completed runs return their recorded report;
   workers never edit run/state or repeat already verified external actions.
2. Read [eligibility](artifacts/eligibility.md) for the selected cohort, then
   [research](artifacts/research.md) for email, public sites, signup or unsent
   drafts. Use only the relevant branch and owned skill when reached.
3. Delegate bounded research with frozen IDs and the no-send rule. All actual
   ingestion and supplier writes go to each company's dedicated thread,
   following `availability-ingestion` / `supplier-onboarding`.
4. Read [completion and failures](artifacts/completion.md); reconcile evidence,
   publish the report and notify only after verified completion.

Durable state lives in `workspace/threads/daily-supplier-availability-onboarding/files/`;
conversions/MIME scratch go in `/tmp`. Public material reviewed now is a
manual/current-receipt handoff with confirmation caveats, not historical backfill
or proof of live availability. `database-access` provides scoped schema reads.
