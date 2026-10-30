# Agent: Daisy

Daisy finds and onboards suppliers, loads their availability into Supabase
from `chris.r@localplantsupply.com`, and handles supplier account contact
(sending as Chris, only with approval). Rosie owns every job, order and
customer conversation and the price rules.

## Threads

| Thread | Role |
|---|---|
| `main` | Chris and Bhoumik (Telegram + web chat). Lookups, urgent blockers, all Telegram sends. Passes supplier work to the supplier's thread and unknown mail/files to `router`. |
| `router` | Identifies unknown mail cheaply and forwards a pointer. Most supplier mail skips it through per-supplier Gmail routing rules. |
| `supplier-<slug>` | One per company (`suppliers.daisy_thread_id`), all locations: onboarding, lists, fixes, supplier email. Its web panel carries the contact transcript and minor approvals. |
| `photo-catalogue` | Photos added on the app's Photos page (camera and attach buttons). The app writes each `plant_photos` row on upload and sends the sender's required note (name, size, supplier…) with the row ids. The thread starts one task thread per photo (`photo-catalogue-§-[TASK]-§-photo-<id8>`, logged under `## Tasks` in its notes); each fills in its row from the note and the photo and asks Chris on Telegram, via `main`, for what is still missing (main forwards his answer back to that task thread). The thread replies once per message when the tasks have reported. Listed under General in Daisy's thread picker. |
| `daily-9am-checkin` | Daily summary (`daily-summary` skill), handed to `main` for Telegram. |
| `daily-supplier-availability-onboarding` | Daily cohort of up to 100 suppliers (paused). |
| `gws:main` | Gmail settings notices on each harness start; no action. |

Work happens in the thread that owns it (`1-agent.md` overrides the base
prompt's "delegate aggressively"). A list that needs parsing gets one task
thread per email; task threads never start task threads, finish all
bookkeeping themselves and send one silent report.

## Skills

| Work | Entry point |
|---|---|
| Lists, inventory rows, aliases, fixes, exports | [availability-ingestion](../../harness/agents/daisy/skills/agent/availability-ingestion/SKILL.md) |
| Suppliers, locations, contacts, enrichment | [supplier-onboarding](../../harness/agents/daisy/skills/agent/supplier-onboarding/SKILL.md) |
| Supplier email, panel transcript, where records go | [supplier-communications](../../harness/agents/daisy/skills/agent/supplier-communications/SKILL.md) |
| Router: identify, forward, labels, routing rules | [supplier-email-routing](../../harness/agents/daisy/skills/agent/supplier-email-routing/SKILL.md) |
| Plant and supplier lookups, substitutes | [plant-and-supplier-search](../../harness/agents/daisy/skills/agent/plant-and-supplier-search/SKILL.md) |
| Photo files, search, retirement | [plant-photo-catalogue](../../harness/agents/daisy/skills/agent/plant-photo-catalogue/SKILL.md) |
| 9 AM summary | [daily-summary](../../harness/agents/daisy/skills/agent/daily-summary/SKILL.md) |
| Daily onboarding cohort | [daily-supplier-availability-onboarding](../../harness/agents/daisy/skills/agent/daily-supplier-availability-onboarding/SKILL.md) |
| Schema, SQL rules, storage | [database-access](../../harness/agents/daisy/skills/agent/database-access/SKILL.md) |
| Feedback and skill changes | [create-skill](../../harness/agents/daisy/skills/agent/create-skill/SKILL.md) |

## Helpers

Paths relative to `harness/agents/daisy/`. Each has `--help`.

| Helper | Does |
|---|---|
| `skills/agent/availability-ingestion/scripts/ingest-context` | One read: company, locations, supplier notes, recent sources. |
| `…/match-candidates --plan` | Nearest existing rows per parsed entry, plus a decision file; every suggested insert is checked with `search_inventory` first. |
| `…/apply-plan` | Writes one location's decisions in one guarded transaction; dry run (rolled back) unless `--commit`; exact count checks. |
| `…/qa-check` | All mechanical ingest QA for the new source ids in one read. |
| `…/source-check` | Fingerprint check to skip an unchanged list; records only verified success. |
| `skills/agent/supplier-communications/scripts/daily-note`, `index-add` | Append to the daily note / workspace index without reading them (shared with Rosie). |
| `skills/agent/database-access/scripts/schema` | Selected schema sections; suggests names for unknown topics (shared with Rosie). |
| `run-state`, `prepare-photo`, `reclaim-orphans` | Daily cohort state; photo normalisation; storage sweeps (in their skills). |

Gmail labels are applied by name with `scripts/gws/email label`.

## Rules worth knowing

- Supabase is authoritative; the newest list wins for what it states,
  silence changes nothing, and ingestion retires nothing.
- Durable supplier facts live in `suppliers.notes`, contact history on the
  supplier panel, open items in thread notes.
- Chris's or Bhoumik's explicit feedback updates the relevant skill or prompt
  directly; inferred changes need Chris's yes
  ([prompt maintenance](prompt-maintenance.md#feedback-driven-updates)).

More: [configuration](daisy-setup.md), [knowledge and tools](daisy-data.md),
[migrations](daisy-migrations.md), [2026-09-29 audit](daisy-audit-2026-09-29.md).
