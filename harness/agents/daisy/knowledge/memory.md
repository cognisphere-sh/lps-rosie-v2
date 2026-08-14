# Memory

Cross-thread memory. One section per memory, separated by
`-----$-----$-----$-----`. Grep for what you need instead of reading the whole
file:

    grep -i -B2 -A10 '<term>' knowledge/memory.md

Format:

    name: <short-kebab-name>
    lastUpdated: YYYY-MM-DD HH:MM:SS
    description: What to remember, why it matters, where it came from, the
      reasoning behind it, and how long it stays relevant.

-----$-----$-----$-----

name: supplier-email-approval-policy
lastUpdated: 2026-07-14 00:00:00
description: Per Bhoumik Shah — do not respond to supplier availability emails
  unless Chris or Bhoumik explicitly asks. Read and ingest availability data
  silently. Never send a supplier email or ask a supplier a follow-up question
  without their approval. For any supplier email that is approved, draft the
  message first and obtain explicit Chris/Bhoumik review before sending; reply
  in the same Gmail thread (never start a new one) and recheck the latest email
  in the thread immediately before sending so the reply still fits the
  conversation. This is a standing operating rule with no expiry — it only
  changes if Chris or Bhoumik say so.

-----$-----$-----$-----

name: supplier-email-identity-and-signature
lastUpdated: 2026-07-25 00:00:00
description: All outbound supplier email is sent as Chris, using Chris's
  approved signature — never Daisy's name or signature (per Chris,
  2026-07-14). Per Bhoumik, do not append a Daisy routing reminder (e.g.
  "Please keep me in To") to any email. Per Chris (2026-07-25), the transparent
  LPS logo in the signature must be sized to roughly the rendered width of
  "Chris Runyon": use a 250px-wide inline image, not the earlier 175px
  half-size setting. Standing rule; revisit only if Chris changes the branding.

-----$-----$-----$-----

name: gws-supplier-routing-rules
lastUpdated: 2026-07-29 00:00:00
description: GWS routing rules for supplier correspondence must use
  `--gmail-thread-id` whenever they target one existing conversation. Never add
  a sender-only rule that routes all future email from a supplier into `main` —
  unrelated and future threads must keep following default Gmail thread
  routing. Remove the Gmail-thread-specific rule once the exchange is complete.
  Sender + exact subject is only a fallback for when no Gmail thread ID exists
  yet. The reasoning: a sender-wide rule silently swallows unrelated future
  mail from that supplier. Standing rule.

-----$-----$-----$-----

name: notification-threshold
lastUpdated: 2026-08-03 00:00:00
description: Per Bhoumik — do not send Telegram/webchat updates for every
  routine ingestion. Send an immediate message only when there is a blocker,
  needed input or approval, a failure or data risk, or something genuinely
  worth Chris's/Bhoumik's attention. Ordinary successful ingestion results go
  into the next daily summary instead. Standing rule.

-----$-----$-----$-----

name: processing-efficiency
lastUpdated: 2026-07-29 00:00:00
description: Chris emphasised that token/resource efficiency must be designed
  into supplier workflows. Do not repeatedly run expensive ingestion or website
  processing when a source rarely changes or is not a reliable live-availability
  feed. Prefer cheap change detection first — HTTP metadata, file hash,
  byte/text hash, source timestamp — and skip full parsing when unchanged.
  Broker-oriented placeholder catalogs may stay searchable for sourcing leads,
  with availability confirmed through the POC only when a project match arises.
  Standing design principle.

-----$-----$-----$-----

name: geographic-search-hq-vs-stock-location
lastUpdated: 2026-08-11 00:00:00
description: A geographic plant search must not filter only on
  `suppliers.state`: a company's headquarters and its fulfillment-stock
  location can differ. Everde is headquartered in Houston while a Francis Mason
  row is FARM=BNL / REGION=FL in Bunnell. Until inventory locations are
  structured, check both supplier geography and explicit farm/region/location
  evidence in the inventory row or source notes, state the basis in the answer,
  and never silently claim HQ state equals stock location. Relevant until
  inventory location becomes a structured column.

-----$-----$-----$-----

name: daily-notes-concurrent-write-safety
lastUpdated: 2026-08-11 00:00:00
description: Daily-note files are shared by every task thread of the same
  agent. Before logging completion, re-read the live
  `workspace/daily_notes/YYYY-MM-DD.md` and append through a targeted `edit`;
  never use a whole-file `write`, which can erase concurrent main/email/task
  entries. Include this safeguard explicitly in long-running task briefs.
  Standing rule for as long as daily notes are one file per day.

-----$-----$-----$-----

name: harness-upgrade-validation-2026-07-22
lastUpdated: 2026-07-22 00:00:00
description: Read-only validation after the 2026-07-22 harness upgrade.
  Confirmed working: Supabase queries and `lps` storage signing, Gmail auth for
  chris.r@localplantsupply.com, scheduler config and the daily 9 AM check-in,
  Telegram delivery and agent-to-agent handoffs, web search, browser
  automation, and the sub-agent runner. Supabase access survived the project
  migration to the Pro account. No access regressions or script failures were
  found. Scope caveat: no test email, database write, or storage upload was
  made, and no upgrade changelog or version diff was supplied, so no new
  feature or bug fix was independently verified. Historical record — superseded
  by later upgrades; keep only as evidence of what was checked that day.

-----$-----$-----$-----

name: harness-upgrade-validation-0.5.1
lastUpdated: 2026-07-24 00:00:00
description: Validation after the harness 0.4.2 → 0.5.1 upgrade (2026-07-24).
  Startup checks passed for Supabase database/storage signing, Gmail auth,
  scheduler, web search, browser automation, the sub-agent runner and
  `PI_THREAD_ID`; the agent-directory prompt was present and root
  `scripts/server.sh` exposed targeted `restart app` / `restart harness`. New
  capabilities that landed: an agent directory for discovering and messaging
  other named agents, agent messaging with harness-populated sender
  identity/thread and secret-authenticated requests, `PI_THREAD_ID` exposed to
  agent processes, fine-grained service restarts, developer-agent ownership of
  platform/app code changes with app-only deploys, and Telegram `/reset`. No
  regressions found. Historical record — superseded by later upgrades.
