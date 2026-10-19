# Check designated hosted supplier lists monthly, without duplicate work

- Status: routed — parent confirms Daisy main handoff succeeded; procedure/setup pending owner report and designated scope, not implemented/scheduled/verified
- Route: daisy — owned guidance/scheduling/ingestion; a genuinely new DB/workflow contract would be staged for Bhoumik
- Raised: 2026-10-16 by Chris via Daisy
- Updated: 2026-10-16 10:26:33 CDT

## Problem

Hosted supplier lists have onboarding/receipt handling but no active ongoing hosted-review routine, per Daisy's existing audit. Chris wants monthly, selective review so the team avoids unnecessary work.

## Evidence

- Chris Telegram -1003988082603 message1410, 2026-10-16 10:21:41 CDT: “monthly, not weekly. We should designate the ones that host so we dont do extra work”. Captured initial relay `daisy:main:2026-10-16T10:22:03-05:00:chris-telegram1410` and identity/owner clarification `telegram:-1003988082603:1410`.
- Daisy audit reused: daily summary is the only recurring schedule; onboarding/backfill paused; no monthly hosted review. 10:23:03 owner clarification: no approved designated set/URL manifest or first-run date/time; timezone America/Chicago. Ordinary verified enrichment/list ingestion need no extra approval. No demonstrated new-tool/schema gap; all-format execution is not validated.
- Bayou1177, thread supplier-bayou-garden-growers-llc, has no website/hosted URL/source type or inventory sources per Daisy. Screenshot supplies bayougarden.net/plantlist, not a full selection. Alexandria screenshot versus Cheneyville record is not stock-location-change authority.

## What it should do

**Approved:** Daisy owns monthly review of specifically designated hosted availability sources, avoiding unnecessary repeat work. Not weekly, blanket website crawling or automatic enrollment of every existing Hosted record.

**Recommended smallest realization, not blanket detail approval:** assess/reuse existing designation and verified URLs, scheduler, supplier-specific ingestion and successful source receipts. Inspect actual linked availability material, skip previously handled unchanged content, and avoid email/website duplication. An unchanged check does not renew stock confirmation. Daisy may apply explicit feedback in owned guidance through create-skill and resolve routine facts using existing authority; a genuinely new persistence/workflow meaning is Bhoumik's slice.

## Acceptance criteria

- Inclusion of each supplier and confirmed list URL is traceable; unselected/uncertain suppliers are not silently enrolled.
- Monthly run date/time, America/Chicago timezone and bounded load are recorded before activation. Supplier publication frequency is not repurposed as internal review cadence; paused onboarding/backfill stay paused.
- Changed linked PDFs/files are detected even if landing-page HTML/date is unchanged. Incidental HTML or retrieval-time changes alone do not establish changed availability or require duplicate ingestion.
- Unchanged successfully handled effective content is skipped with prior source evidence, including consideration of the same list already received by email. Different effective content/material body amendments are not falsely skipped. Failed/partial work is not recorded as success; retries/concurrent handling preserve existing deduplication/serialization controls.
- New/genuinely changed material follows existing supplier-thread ingestion, provenance, location mapping, QA, effective-date and permission rules. Check time is not supplier publication time or stock confirmation; static placeholders retain confirmation-needed caveats.
- Access/missing-link/company-location/ingestion failures remain genuine failures visible in existing owner/daily-summary reporting, not unchanged-success, zero stock or source retirement. No new progress-message routine.
- Owner completion report states actual guidance/schedule scope and verification limits; schedule creation alone is not a successful monthly ingest or all-format capability proof.

## Out of scope

New agent/schema/dashboard/crawler; global all-Hosted batching; new UI; source retirements or stock/location changes; supplier/customer contact or commercial/order permissions; resuming paused work; Lily fetching, ingesting, scheduling or editing Daisy's files. No Nova DB/workflow implementation assignment.

## Assumptions

Existing scheduler/metadata/ingestion are assessed first, not presumed insufficient. Bayou is the supplied example to verify, not already saved enrollment or a complete supplier set. Routine verified enrichment needs no repeat approval; chosen operating details are not already known and should be settled internally where authority permits, not with a multi-question Chris interview.

## Open questions

Daisy owns confirming the bounded selected supplier/URL set and inclusion evidence, settling day/time/load before activation, and checking chosen sources against existing tools. Unsupported formats or a true capability gap must be demonstrated, not assumed. Only a new DB/workflow meaning goes to Bhoumik; an isolated genuine tool/platform gap may go to Nova, without DB/workflow implementation authority.

## Handoff log

- 2026-10-16 10:22:27 CDT — Parent assigned bounded review; supplier fetch/live DB/ingestion/scheduling/builder routes excluded. Existing owner audit reused.
- 2026-10-16 10:23:03 CDT — Daisy source/authority clarifier delivered; draft prepared. Bounded capability evidence/limits: `workspace/threads/main/tasks/hosted-availability-review/notes.md` on Lily.
- 2026-10-16 10:26:33 CDT — Parent confirms handoff to Daisy main SUCCEEDED: owned create-skill monthly/selective correction and existing-tools/scheduler setup, with traceable verified designated suppliers/URLs before activation. Daisy may choose reasonable time/load under existing authority after valid scope; if business designation is needed, propose a small concrete set rather than a questionnaire. Guards and reference links sent. Routed procedure/setup only; designated scope/owner report pending, not implemented/scheduled/verified. No Nova/Bhoumik subsystem route or external Telegram.
