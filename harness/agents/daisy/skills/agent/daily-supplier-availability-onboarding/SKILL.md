---
name: daily-supplier-availability-onboarding
description: Run the daily cohort of up to 100 suppliers with no availability yet. Includes the run-state CLI (plan, worker evidence, merge, recovery), the Texas-first eligibility gate, email/website/newsletter research, unsent drafts and the private report. Use for the scheduled run (currently paused), its recovery, or a batch review. (v3.0.0)
metadata:
  author: lps
  version: "3.0.0"
---

# Daily supplier availability onboarding

Coordinator thread: `daily-supplier-availability-onboarding`. The 3 AM
schedule is **paused** until `main` clears it. Nothing in this run sends
supplier email; drafts stay unsent. Passing the Texas gate is research
permission only, never permission to contact.

1. **State.** [run-state](artifacts/run-state.md): check status, recover
   anything pending, pick the cohort, freeze the batch plan. A completed run
   just returns its recorded report.
2. **Gate each supplier.** [eligibility](artifacts/eligibility.md), before any
   search, signup or draft.
3. **Research eligible suppliers.** [research](artifacts/research.md): 2026
   email, public website lists, newsletter signup, else one unsent draft.
   Task threads get their frozen batch (slug + ids), this skill's name and the
   no-send rule; they never edit run state themselves. Actual ingestion and
   supplier-record writes go to each company's own thread
   (`availability-ingestion`, `supplier-onboarding`), not this coordinator.
4. **Finish.** [completion](artifacts/completion.md): merge, check, publish
   the private report, send its link to `main`.

State files live in `workspace/threads/daily-supplier-availability-onboarding/files/`;
scratch in `/tmp`.
