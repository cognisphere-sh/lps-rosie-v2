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

**What belongs here: episodic events and facts** — what happened, what was
found, what is true. **Procedural guidance does not.** A rule about *how to do
something* goes in `system_prompts/1-agent.md` if it holds everywhere, or in the
skill for the procedure it governs if it only applies there. If you catch
yourself writing "always…" or "never…" into a memory, it belongs in one of those
two places instead.

-----$-----$-----$-----

name: telegram-contacts
lastUpdated: 2026-08-03 00:00:00
description: Telegram group chat `-1004330045748` is Nova's communication group
  with Bhoumik Shah and Chris. Bhoumik instructed Nova (2026-08-03) to use this
  group to reach both of them. The instruction to use it lives in `1-agent.md`
  (§Telegram communication); what is recorded here is who is in the group and
  who asked for it.

-----$-----$-----$-----

name: texas-sedge-jr82-pricing-reference
lastUpdated: 2026-09-25 19:12:06
description: For JR-82, Chris approved Austin Plant Supply's generic Sedge 1G
  $6.50 as a supplier- and size-specific pricing reference for Texas Sedge |
  Carex texensis 1G, not a botanical alias or evidence of offered stock. JR-82
  already uses $6.50 and the supplier's notes retain the decision. Daisy and
  Lily reported this on 2026-09-25. Lily's approved pricing-reference reuse
  assessment found saved APS notes plus Rosie's existing 1G reuse guidance
  sufficient, with source and recheck on list updates; no demonstrated future
  retrieval failure warrants new schema, UI or matching. Stable correspondence
  does not freeze future prices; AR automatic prefill would be a separate
  money/workflow decision for Bhoumik. Chris explicitly rejected the phrase
  “proxy pricing” in internal notes but wanted the provenance retained.
