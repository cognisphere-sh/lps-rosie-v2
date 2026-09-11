# Make every pricing answer traceable and dependable

- Status: staged · audit reviewed; broad workflow proposal held
- Route: bhoumik
- Raised: 2026-09-09 by Chris (via Rosie escalation)
- Updated: 2026-09-11

## Problem

Chris reported pricing answers he cannot trust: “Uhh you’re not ready for showtime. Please escalate this. Your ability to pricing seems often error prone.” Bhoumik calls the false no-price an exception and asks whether current skills and search already cover the suggested safeguards.

The September 11 read-only audit finds that **most safeguards already exist**. The Palo Verde evidence was repeatedly overstated or confused, but it does not establish a systemic search defect or justify the earlier broad new data/workflow control proposal. That proposal is held, not routed for implementation or marked dropped.

## Evidence

- Feedback: **APS Palo Verde price missed**, subsequent correction handoffs, **Audit existing pricing controls first**, **Palo Verde assurance retracted**, and **Original photo is different evidence**.
- The September 10 worker did not inspect the original photo, complete visual source/row reconciliation, or freshly verify the PDF hash, and retracted its completion/QA assurance. Those checks were already required by its ingestion procedure.
- Lily independently inspected Chris’s original spreadsheet image and Bhoumik’s later app screenshot. They are different artifacts: the original contains a 48-inch line with a cropped price; the later screenshot shows four smaller catalogue rows. The earlier claim that the original photo was misread was therefore unsupported. Neither image establishes current supplier price authority or precedence. No price is treated here as settled or quote-ready.
- Current procedures already cover exact offering review, supplier scope, widened searches, source evidence, conflicting interpretation, ingestion QA, and price-list versus supplier-confirmed availability. A caveat retained in notes is not an enforced pricing hold.
- Independent local tests identified narrow automatic supplier-request prefill issues: equivalent size spellings can leave a price blank, and a literal name fragment can accept a different full identity when its price is unique. Ingestion candidate output also omits grade/form notes that can distinguish offerings. These are separate findings, **not proven causes of the Palo Verde incident**.
- Detailed current-file citations, historical deployment evidence, synthetic tests and limitations: Lily-relative `workspace/threads/main/tasks/pricing-controls-audit/evidence.md`.

## Evidence-based disposition

Do not add a general pricing record, automatic source-review workflow, freshness policy or new conflict-status model on this evidence alone. Use the existing source-verification and correction ownership for the incident.

If Bhoumik approves follow-up, keep it limited to the demonstrated issues: equivalent sizes should compare consistently in automatic prefill; a different plant/selection must not silently supply an exact price; and grade/form evidence must remain available when deciding whether two catalogue offerings are the same. Relevant owners would make their own approved changes. This audit authorizes none.

## Acceptance criteria for any approved narrow follow-up

- Equivalent stated container sizes do not lose an otherwise valid automatic price solely because one includes a space or alternate unit spelling.
- A partial-name match to a different selection does not automatically populate the requested offering’s price; uncertain matches stay unpriced or explicitly identified as alternatives.
- Two offerings that differ by a supplier-stated grade/form can be distinguished before one is updated as the other.
- Source reconciliation reports identify the artifacts actually inspected and the checks actually completed; relay evidence is not called direct verification, and notes are not called a quoting block.
- Existing supplier-confirmation, availability and customer-quote rules remain unchanged.

## Out of scope

- A general search rewrite, alias/equivalence engine, new provenance database or automated review/status workflow.
- Resolving source precedence or publishing either Palo Verde price as current; supplier/customer contact.
- The separately scoped APS Berkeley Sedge correction, focused-Job routing, or urgent-pricing workflow.

## Assumptions

- Broad and quoted search are discovery tools; exact offering review still matters. A search contract intentionally returning related rows is not itself a defect.
- One incident does not establish frequency or a systemic failure. Chris’s concern is retained without inventing a failure rate.

## Open questions

- **Bhoumik:** Retire the broad proposal, or authorize only the narrow verified helper/procedure fixes? No implementation has been routed.
- **Source owners:** Complete the original-evidence/provenance correction and establish any price authority through the existing approved process. Current price and source precedence remain unresolved.
- **Technical verification:** Historical search deployment is evidenced, but this audit did not execute the current live RPC or capture its current definition. Partial-drop retained-price lineage and numbered-cultivar key collisions remain bounded questions, not approved expansions.

## Handoff log

- 2026-09-09 — Initially staged a broad pricing-data/workflow reliability control; requested Rosie/Daisy owner review without authorizing skill edits.
- 2026-09-10 — Interim revisions repeated contradictory source interpretations and overstated reconciliation assurance. Those claims are superseded by the September 11 direct-image inspection and worker retraction.
- 2026-09-11 04:56:26 CDT — Read-only current-code/procedure audit completed. Most safeguards covered; no RPC defect reproduced; scoped helper/procedure issues documented separately from the incident. Broad proposal held for Bhoumik’s disposition. No code/skill/DB/config changes, implementation routing or external messages by the audit.
