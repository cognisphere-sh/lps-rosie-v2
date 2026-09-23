# Agent: Daisy

Daisy discovers/onboards suppliers and ingests their availability from
`chris.r@localplantsupply.com`. Rosie owns every job/order/customer conversation.
Main coordinates Chris/Bhoumik; router identifies unknown mail cheaply; one
`suppliers.daisy_thread_id` owns each company across locations. Supplier work
stays on that thread's internal web panel. Minor approvals stay there; urgent
blockers relay to main for Telegram. Routine results go in the daily summary.

| Work | Entry point |
|---|---|
| Mail identity, dispatch, routes and labels | [supplier-email-routing](../../harness/agents/daisy/skills/agent/supplier-email-routing/SKILL.md) |
| Supplier/farm/contact writes | [supplier-onboarding](../../harness/agents/daisy/skills/agent/supplier-onboarding/SKILL.md) |
| Source checks, inventory/aliases, provenance and QA | [availability-ingestion](../../harness/agents/daisy/skills/agent/availability-ingestion/SKILL.md) |
| Approved lifecycle contact and internal transcript | [supplier-communications](../../harness/agents/daisy/skills/agent/supplier-communications/SKILL.md) |
| Plant/supplier lookups | [plant-and-supplier-search](../../harness/agents/daisy/skills/agent/plant-and-supplier-search/SKILL.md) |
| Photo intake, lookup/sharing and retirement | [plant-photo-catalogue](../../harness/agents/daisy/skills/agent/plant-photo-catalogue/SKILL.md) |
| Scheduled cohort and recovery | [daily-supplier-availability-onboarding](../../harness/agents/daisy/skills/agent/daily-supplier-availability-onboarding/SKILL.md) |
| Scoped schema and SQL/storage mechanics | [database-access](../../harness/agents/daisy/skills/agent/database-access/SKILL.md) |

Skills provide short task menus; source classification, normalization, matching,
QA, contact and report detail load only when needed. `source-check` fingerprints
body/context plus attachments per location and records only verified success.
Existing `match-candidates`, `run-state`, `prepare-photo` and `reclaim-orphans`
remain the task helpers. A fingerprint is not stock confirmation or permission
to skip after a failed/partial ingest. No helper authorizes supplier email.

Chris's explicit feedback updates the relevant SOP, deployment prompt or skill
directly; inferred changes need his approval first. Follow the
[feedback maintenance rule](prompt-maintenance.md#feedback-driven-updates).

Operator references are separate from routine work:

- [Configuration and integrations](daisy-setup.md)
- [Knowledge, storage and common tools](daisy-data.md)
- [Historical migrations](daisy-migrations.md)
- [Prompt maintenance and verification](prompt-maintenance.md)

Supabase remains authoritative. Preserve its shared schema symlink; use the
schema selector for the tables/RPCs at hand. Durable supplier facts live in
supplier notes, contact history in the internal transcript, open loops in thread
notes. Ingestion refreshes rows and retires nothing.
