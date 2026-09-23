# Current notes and audience

Notes hold only additional information the audience needs, once at the narrowest
useful scope. Structured prices/statuses already speak for themselves. This is
Chris's 2026-09-17 simpler standard; it supersedes mandatory per-APS-row entries
and overall-summary/supplier boilerplate. History stays in changelog/transcripts.

| Field | Owns |
|---|---|
| `customer_notes` | Customer-origin constraints, requests, deadlines, phase membership and original demand/options displaced by the offered row; never Chris's internal choices or approval history. |
| Item `sourcing_notes` | Current additional internal decisions, unresolved constraints, necessary source/proxy/override evidence and meaningful supplier comparisons; NULL when redundant. |
| Job `sourcing_notes` | Job-wide decisions/constraints and admin-override provenance once, accessible with the job. |
| `external_notes` | Brief additional customer-useful exceptions/options under `quote-generation`; no phases, supplier names or pricing-basis commentary. |

## Eligibility

Answer supplier research in Chris's original chat first, even for an existing
job. Research alone creates no sourcing note, contact or AR. A sourcing entry
is eligible when an AR was actually delivered/sent, a concrete required supplier
action is pending, Chris explicitly asks for a note, or he makes a supplier/
plant-sourcing decision. Eligibility still doesn't require repeating a fact
visible in linked records. An unsent draft/public link is not delivery.

Research every requested line and 1–2 closest supported APS alternatives for
real gaps; report them in chat. Prefer the same plant/nearby size, then defensible
related plants. Do not invent options or widen supplier scope. Record only a
material pending decision, naming the plant/size and required action-specific
approval. Chris must approve quoting and/or requesting availability for a real
alternative before that action, including drafts and supplier-visible hints.
Quote and AR approvals are separate. Preserve requested demand and price until
authorized; don't fill notes with `Price unknown`/`No exact match` boilerplate.

`plant-and-supplier-search` owns naming equivalence and approved pricing proxies.
Retain a concise basis when identity remains qualified; routine spelling matches
need no note when source evidence is accessible. Pricing permission is not exact
AR identity or availability. Supplier selection exists only after Chris chooses;
first/cheapest/only response does not select one.

## Update or clean

1. Follow [write discipline](writes.md): current row, recent changes, evidence and
   Chris's latest decisions. Preserve customer conditions, final/current choices,
   approval scope and unresolved constraints. Never invent a fact to shorten notes.
2. Keep customer-origin text in `customer_notes`. Remove only internal decision
   text from mixed customer notes; retain phases/original options. Put Chris's
   final choice once in current sourcing, without intermediate exploration or
   superseded approvals. Pending decisions must remain pending.
3. Put job-wide override authority/scope once at accessible job level, explicitly
   **not supplier-confirmed**, with necessary delivery unknowns and publication/
   source evidence. If that context cannot be shown accessibly, keep the minimum
   row qualifier rather than lose provenance.
4. Keep meaningful comparisons distinct by supplier and preserve allocation scope.
   Never repeat a shared available total as each job's amount. An exact-match row
   can be NULL when selection and source/override evidence remain clear elsewhere;
   otherwise retain the minimum factual qualifier. No mandatory headings, prices,
   AR links or status summaries. Don't replace supplier evidence with a catalogue.
5. Guard note-only writes and verify exact changed fields. Cleanup authorizes no
   price, quantity, offering, availability, status, AR answer, order or history
   changes. Preserve meaningful shared notes; report the actual saved result.

Examples (format only): `Chris-approved Purple Pixie pricing basis; cultivar
unconfirmed.` / `APS selected; grower alternative excluded by Chris.` /
`APS 30 G alternative — Chris quote approval pending.`

Phases stay in customer context/output grouping. An approved pricing proxy keeps
requested identity and its basis internal. Actual offering differences use the
shortest necessary shared distinction (`5 G instead`, `12 instead of 10`) under
`quote-generation`; mere naming equivalence is not a substitution. Customer output
contains offered plants/sizes, selling prices and shared notes. Supplier/cost/
stock-list detail and internal handoffs stay internal unless Chris explicitly
asks to disclose those details.
