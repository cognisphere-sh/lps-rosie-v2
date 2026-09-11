# Distinguish homeowners from landscape professionals without changing pricing yet

- Status: shipped — minimal customer classification/storage contract; optional intake UI and commercial policy remain separate
- Route: bhoumik
- Raised: 2026-08-30 by Chris (via telegram image)
- Updated: 2026-09-11 05:33:52 CDT

## Problem

Chris nearly entered “Retail” as a customer’s company to identify a homeowner. Classification needs to remain separate from the real company and person. The minimal item records that classification; it does not implement the still-undefined retail versus contractor pricing or service policy.

## Evidence

- 2026-08-30 feedback log, **Homeowner or landscape professional**: Chris requested the distinction at intake, ultimately supporting retail versus traditional contractor treatment.
- 2026-09-11 05:18:33 CDT, **Customer type minimum first**: Lily recommended a single optional customer-level classification, Jobs using their linked customer’s current type, unknowns unset, no per-Job copies/snapshots or pricing changes. This was a recommendation, not authorization at that point.
- 2026-09-11 05:33:34 CDT, **Customer type reported done**: Bhoumik replies “Done” to that minimal recommendation (Telegram 288).
- Read-only review confirms migration 0090 adds a nullable classification with no default/backfill and leaves company separate. The implemented vocabulary is **Homeowner/Retail** and **Landscape Professional**; the homeowner label is not literal “Homeowner.”
- The migration application note records live application and all nine existing customers still unset. Lily could not independently repeat the live DB query because her environment lacks the connection configuration. Current source and the recorded deployment evidence support completion of the storage item, not a claim of fresh live end-to-end verification.

## Completed narrow behavior

A customer can have **Homeowner/Retail**, **Landscape Professional**, or no known type. Classification is separate from the real company and person. Omitted type stays unset; the migration does not infer or backfill existing customers.

A linked Job can obtain the customer’s current type through the existing customer relationship. No per-Job type copy, override, or snapshot was added. Jobs with no customer or no known customer type remain unclassified. Correcting a customer’s classification changes the current fact, not a historical type snapshot.

Classification alone changes no price, quote, payment term, status, sourcing, fulfillment, or communication policy. Existing work remains usable without a type.

## Acceptance criteria — storage item

- The customer classification is optional and separate from real company/person information.
- The two supported choices are Homeowner/Retail and Landscape Professional; omission or clearing leaves unknown/unset.
- Existing records are not automatically classified or rewritten by this migration.
- The linked customer remains the source of current type; a per-Job copy/snapshot is not required.
- Setting type does not activate automatic pricing or different operational workflows.

## Available surfaces and limits

- Customer list/detail read models and APIs include type in current source.
- Current source includes an editable Type column on desktop Customers, a Type/Not set display on mobile cards, and a customer-detail selector with an existing validated save path and clearing to unset.
- Database creation can supply type or omit it. No new customer-create form/API or focused new-job type control was added, and no type-specific Rosie intake change was found.
- The Job list/detail API does **not** yet embed type in its nested customer object. Type is reachable through the existing customer link and customer lookup; dedicated Job display/hydration is a separate UI convenience, not a missing storage prerequisite.
- Customer-related frontend changes were uncommitted source at inspection. Their production deployment, visual appearance and real save were not independently tested. No production insert/update was performed.

## Deferred — not blockers to this completion

- Optional focused-intake/Job type display: `new-job-intake-customer-type-choice` remains drafted, with the storage blocker removed. This task did not route it.
- Actual retail/contractor pricing, discounts, payment/tax/delivery and service policy: Chris must define the differences before Bhoumik authorizes behavior changes.
- Historical type/pricing snapshots, per-Job overrides and retrospective commercial reporting. Prior wording making them mandatory was speculative and remains superseded.
- Separate naming/date/fulfillment work; this completion does not reopen or imply those capabilities.

## Out of scope

- Inferring customer type from company, address, prior prices or notes, or cleaning company values automatically.
- Retail storefront/checkout, customer portal, supplier category, or order lifecycle changes.
- Claiming that a recorded classification is an implemented retail pricing policy.

## Open questions

- **Chris — future policy only:** What should differ in homeowner versus landscape-professional pricing and service? This no longer blocks the completed classification item.

## Handoff log

- 2026-08-30 — Staged as a broader customer-type/workflow/pricing proposal.
- 2026-08-31 / 2026-09-02 — Naming procedure and independent company/job/contact display work separated from the classification model.
- 2026-09-11 05:19:04 CDT — Narrowed to a conditional customer-level recommendation; removed per-Job copies/snapshots and pricing-policy completion as current prerequisites. No authorization was inferred from the recommendation.
- 2026-09-11 05:33:52 CDT — Bhoumik’s completion report plus migration/source review closes **minimal classification/storage**. Application note records nine customers still unset. Direct live DB re-check was unavailable; no production writes or implementation routing. Optional intake UI and commercial policy remain separate.

## Verification reference

`workspace/threads/main/tasks/customer-type-retail-vs-landscape/customer-type-verification-2026-09-11.md` — exact source paths, migration/app evidence, surfaces, and independent-verification limits.
