# Agent: rosie

**Customer success coordinator for Austin Plant Supply (APS).** Backs the web
app's supplier workspace (`app/` targets `rosie` exclusively).

## agent.json

- **name**: `rosie`
- **description**: "Customer success coordinator for Austin Plant Supply — one
  instance per customer thread, managing that customer's jobs, demand, and
  pricing."
- **model**: `openai-codex` / `gpt-5.5` / thinkingLevel `medium`
  (`subagentModel` same)
- **threadIdStrategy**: `single`
- **maxConcurrentSlots**: 5 · **maxAttempts**: 3 · **runtime**: `subprocess`
- **devAgent**: no · **secretsSchema**: none · **config**: none

## Purpose

Rosie is APS's in-house customer success coordinator. It serves this **one
supplier** and runs as **one instance per customer** — the customer whose id is
its `ThreadId` (landscapers/brokers/garden centres buying from APS). It manages
that customer's jobs, demand, and pricing: Chris relays the customer's requests
over the admin chat and marks real availability; Rosie files the paperwork
(`job.json`, `customer.json`, the shared inventory tables) but **Chris and the
ground team own the truth** — Rosie never invents a plant, price, or
availability, and asks Chris when ambiguous.

It is heavily **memory/workspace-driven** (context is compacted, so it writes
everything to `workspace/customers/<ThreadId>/` and keeps indexes current) and
**orchestrator-style**: it maintains one persistent sub-agent per job
(`sessions/<ThreadId>/subagents/<job-id>`), pushing context-heavy
parsing/search/writes to sub-agents. The `workspace/inventory/` price list and
`workspace/knowledge/` SOPs are supplier-wide (shared, not per-customer).

## Plugins

- **admin** — the admin chat channel. Chris talks to Rosie here; Rosie replies
  as visible text. (`admin/inbox/` holds sample inbound attachments — a PNG and
  two 2026 pricing PDFs.)
- **scheduler** — cron timers; `state/schedules.json` empty. Managed via
  `scripts/scheduler/scheduler-cli`.

No telegram / gws / agent-messaging.

## Knowledge

No agent-level `knowledge/` dir. The SOPs the persona references live in the
runtime **`workspace/knowledge/`** (shared, supplier-wide), not in the agent
config surface.

## Scripts & extensions

`scripts/agent/` (shared toolset) + `scripts/scheduler/scheduler-cli`.
Extensions: the two shared ones (`bash-guard`, `harness-bridge`).

## Migrations / skills

None.

## Workspace layout (what the app also reads/writes)

- `workspace/customers/<slug>/customer.json`, `profile.md`
- `workspace/customers/<slug>/jobs/<jobDir>/job.json`
- `workspace/customers/<slug>/jobs/<jobDir>/stock-check/<token>.json`
- `workspace/inventory/<category>.json` (shared price list)
- `workspace/knowledge/` (shared SOPs)

See [`../app/README.md`](../app/README.md) for the exact file schemas and the
HTTP seam.
