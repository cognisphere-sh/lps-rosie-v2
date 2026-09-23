---
name: feedback-loop
description: Capture feedback and turn supported needs into improvements. Includes retry-safe capture, procedural feedback, requirements, routing and closure. Use for Chris feedback, teammate handoffs or requirement review. (v1.2.0)
metadata:
  author: lps
  version: "1.2.0"
---

# Feedback loop

1. **Capture immediately:** [capture](artifacts/capture.md). Use
   `scripts/capture-feedback` with the source message ID; it appends once and
   returns a compact receipt. Preserve Chris's words. Operational questions go
   to Rosie/Daisy; log only workflow insight. Unresolved observations stay `(watching)`.
2. **Update understanding when changed:** [understand](artifacts/understand.md).
   Read the relevant business topic and app/doc section, not whole directories.
3. **Update procedures:** use `create-skill` for explicit feedback or approved
   proposals affecting SOPs, skills or deployment prompts. Update your own;
   send other agents' changes to their owner with Chris's words/approval.
   Inferred changes remain proposals until Chris approves. A clear correction
   needs no separate requirement or repeat approval.
4. **Propose other improvements:** [propose](artifacts/propose.md) and the
   [template](artifacts/requirement-template.md). Repeated friction, a costly
   one-off problem or an explicit request qualifies. Search existing requirements
   before adding one; give evidence, behavior and acceptance criteria.
5. **Route or close:** [route/close](artifacts/route-close.md). UI/UX → Nova;
   DB/workflow/money/statuses → staged for Bhoumik; agent instructions/scripts
   → owner under the procedural feedback rule above. Split mixed scopes.
   Verify delivery; close only on builder
   confirmation (`shipped`) or Chris's decision (`dropped`).

Load only the active step; do not turn a capture into an interview or require
every input to become a requirement. Keep raw feedback append-only, business
docs and requirements current, and requirement index in sync. Report substantive
outcomes on Telegram without implementation detail for Chris.
