# Report, publish, notify

Build one private artifact (`publish-artifact` skill, slug
`supplier-availability-onboarding-daily`) with the as-of time and exact cohort
ids/count:

- Texas gate results with reason and evidence type, counted separately:
  Growers, eligible Texas wholesale nurseries, `held-…-unverified`,
  `held-…-prior-qualified`, `retained-future-market`. For original-cohort
  evidence give the label, file/URL and date, and say it was not used as proof
  of availability, price or delivery. For associations give name, URL/date,
  geography and whether stronger evidence or Chris decided.
- Retained future-market suppliers (category/state evidence; confirm no
  research, signup, draft or contact happened).
- 2026 availability found by email (message, thread, date; no replay claim).
- Hosted lists (URL, currentness, change check, source ids, or why not loaded).
- Unsent drafts ready for Chris, and drafts held by the gate (supplier,
  recipient, draft id, subject, full body, reason; none sent).
- Human blockers with URLs (CAPTCHA, verification, login).
- Processed, skipped, errors, with counts.

Publish privately, record the URL in run state, complete the run, then send
only that URL plus a one-line summary to `daisy` thread `main` by agent
message. Never message Telegram or Chris from this thread. One daily-note line.

If a correction changes any result, regenerate the whole report from final
state (Bhoumik, 2026-08-20); never patch a stale one.

## Failures

- Gmail, browser or login failure: record it for that supplier, continue,
  report it; don't loop or claim a check happened.
- Unclear supplier, location, currentness, Texas service or write risk: hold
  it with the evidence; don't ingest.
- A task thread's blocker goes into the run record and the report. Never
  guess or contact a supplier instead.
