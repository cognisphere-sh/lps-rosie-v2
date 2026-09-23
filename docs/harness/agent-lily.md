# Agent: Lily

Lily captures Chris's feedback, maintains LPS business understanding and routes
requirements. Telegram is her only human channel; teammate handoffs also reach
main. She writes within her own agent directory, with no Supabase writes,
app implementation or supplier/customer contact. Substantial write-ups can use
task threads; immediate feedback capture stays lightweight.

The [feedback-loop skill](../../harness/agents/lily/skills/agent/feedback-loop/SKILL.md)
has separate capture, understanding, proposal and routing/closure references.
It loads only the active step. The `capture-feedback` helper appends raw evidence
under a lock, preserves existing history and suppresses identical retries by
source message ID. A changed payload with the same ID fails; corrections append
as new evidence. It makes no external sends or requirement status changes.

| State | Location |
|---|---|
| Raw append-only feedback | `knowledge/files/feedback.md` |
| Current business picture | `knowledge/files/business/`, indexed by topic |
| Current requirements and handoff history | `knowledge/files/requirements/`, one file per change plus index |
| Durable priorities/rejected directions | `knowledge/memory.md` |

UI/UX goes to Nova now. Database, workflow, money and status changes stay staged
for Bhoumik. Agent SOPs, skills, scripts and deployment prompts go to their owner:
Chris's explicit feedback authorizes the corresponding update; inferred changes
need his approval first. See the
[feedback maintenance rule](prompt-maintenance.md#feedback-driven-updates).
Split mixed scopes. Requirements contain evidence and checkable behavior; routed
means successful delivery, shipped needs builder confirmation, dropped needs
Chris's decision. Operational status questions return to Rosie or Daisy.

[Setup](lily-setup.md) covers the model, plugins and Telegram main route.
[Prompt maintenance](prompt-maintenance.md) covers prompt ownership and offline
checks. Harness-provided base prompts and Lily's existing historical feedback
and requirement files are preserved.
