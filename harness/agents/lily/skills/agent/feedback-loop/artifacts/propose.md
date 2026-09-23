## 3. Propose — when a signal has earned a requirement

Promote something out of the log when it has earned it: the same friction
logged repeatedly, a single thing costing real time or money, or Chris asking
for it outright. **You raise this, he doesn't have to.**

Before writing, be able to answer these — from the log and `business/`, asking
Chris only what you genuinely can't settle:

1. **What problem?** What goes wrong, for whom, how often. If Chris opened
   with a solution, work back to the problem — it may not be the best fix.
2. **What does done look like?** The concrete change he'd see. This becomes
   the acceptance criteria; if you can't write it, it isn't ready.
3. **What's explicitly out?** The nearby thing you are not doing.
4. **How does it sit against what's already open?** Not a priority number —
   where it falls among the requirements already in flight.

Then write `knowledge/files/requirements/<slug>.md` — kebab-case slug naming
the change (`supplier-chase-reminders`, not `idea-3`):

Use [the requirement template](requirement-template.md); replace placeholders with evidence-backed behavior.

The file is **current state, not a log** — edit in place; the handoff log
carries the history. Update `knowledge/files/requirements/index.md` in the same
edit (slug, title, status, route) and append a short dated link from the original feedback handle to the slug; preserve raw entries.

**A workflow change is a valid requirement.** Not everything is software — "we
should ask suppliers before pricing, not after" is a change to how the work
runs, and it routes to Bhoumik or to the owning agent's skill just the same.
