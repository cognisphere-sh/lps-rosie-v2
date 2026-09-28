# Reuse an approved price basis without asking again

- Status: supported existing path · owner guidance complete; observe future ordinary use
- Route: rosie · existing lookup guidance; no build proposed
- Raised: 2026-09-25 by Chris (JR-82 webchat54 via Rosie/Daisy)
- Updated: 2026-09-25 19:12:06 CDT

## Problem

Chris has already approved how to price an exact requested plant whose name differs from the supplier’s priced listing. He should not have to repeat that permission on the next equivalent request. Retaining it must not create a fake catalogue offering or imply that different plants are botanically identical or in stock.

The immediate case is **APS + Texas Sedge | Carex texensis + 1G**, using APS’s existing **generic Sedge1G** pricing. The approved current JR82 amount is **$6.50**. This request is about dependable reuse of the approved basis, not a new alias or taxonomy feature.

## Evidence

- Chris JR82 webchat54, September25 18:03:17, as relayed by Rosie/Daisy: “thats the texas sedge price, update the alias or add to the data base. never want to ask again”. Raw capture: **Keep Texas sedge price permission**. Original message not independently reopened by Lily.
- Daisy reports the explicit1G rule saved in APS supplier notes with the approval reference, dated APS list, original priced offering and no-other-size/no-identity/no-stock limits. Rosie reportedly already priced JR82 at $6.50.
- Current Rosie lookup guidance already records this case and future reuse without re-asking. Daisy states there is **no evidence of inability to retrieve the note**; existing notes plus guidance is the simplest current option. A future independent lookup has not been tested by this task.
- Same-case explicit wording feedback: Chris rejected **“proxy pricing” in internal notes**. Use plain factual wording such as “Texas Sedge1G priced from APS Sedge1G.” Daisy’s saved note already says “same-size pricing reference”; Rosie19:08:18 confirms the job-notes guidance already handles that phrase, and the search rule is now explicitly1G-only with the same factual wording. This is instruction verification, not a new JR note/database edit. Preserve the basis, not technical jargon or invented identity.
- Bhoumik rejects synthetic duplicate price-only rows. Daisy’s proposed structured supplier/same-size correspondence and fields are an **owner proposal**, not approved architecture. Bounded evidence: `workspace/threads/main/tasks/pricing-controls-audit/price-reference-2026-09-25.md`.

## What it should do

Retain and use each explicitly approved pricing reference within its stated supplier, requested identity, size and any form/grade limits. Keep the original requested plant, identify the real supplier listing used for pricing, and retain the approval/source context. For this case, future APS Texas Sedge1G pricing can reuse generic Sedge1G without another question about the already approved relationship.

Use the existing durable notes and completed owner guidance. This supports Chris’s approved outcome now; **no further Bhoumik/Chris approval, build or validation task is required**. Future ordinary work may supply independent reuse evidence. A structured representation or automatic-consumer extension is only a conditional Bhoumik-owned option if a real consumer gap emerges, not a current backlog item or blocker.

## Acceptance criteria

- A later in-scope APS Texas Sedge | Carex texensis1G lookup finds and uses the approved Sedge1G price basis without repeating the same approval question.
- The result preserves Texas Sedge | Carex texensis as requested and identifies the applicable supplier listing, size and approval/source evidence where material.
- No price-only inventory copy, increased apparent offering/count, botanical alias, stock claim or exact supplier-request mapping is created merely to retain the price permission.
- The rule does not spread to another supplier, another requested plant/cultivar, 4-inch or other sizes, or an unsupported form/grade.
- The current $6.50 JR82 instruction/accepted terms are preserved. Future use checks the applicable reference price; “permanent” is not silently converted to a frozen $6.50 for every later price-list update.
- A source-price gap/change/conflict is handled as such, not by re-asking the same approved identity-to-price permission or choosing an arbitrary cheapest alternative.
- Relevant internal notes state the pricing basis plainly and briefly, without the rejected phrase in this case or concealment of a material qualification.

## Current support and ordinary-use observation

Daisy has recorded the rule; Rosie’s relevant guidance and scoped wording are complete, and the current case is handled. No additional validation task is needed; future ordinary work may demonstrate reuse through the existing path. If a real consumer-specific retrieval failure is later demonstrated, Bhoumik can select a bounded change. The app’s separate automatic supplier-request price seeder does not currently interpret these note-based references; extending that consumer is a separate, unapproved workflow decision, not implied by the current case.

## Out of scope

- New tables, fields, APIs, taxonomy/equivalence engines, UI or automatic pricing-reference resolver chosen by Lily.
- Treating generic Sedge and Carex texensis as a genuine alias or the same supplier offering; adding synthetic duplicate rows.
- Other suppliers/plants/sizes, the existing Berkeley Sedge case, genuine-alias AR-prefill parity, or earlier size/grade/prefill proposals.
- Supplier/customer messages, current JR/AR/order edits, new stock assertions, blanket frozen prices or automatic repricing of accepted work.

## Assumptions and unresolved limits

- The verified approval scope supplied to this task is **1G only**. Broader “same size” shorthand in guidance must not expand that scope.
- Daisy’s saved note says recheck the reference if APS updates its list; no permanently fixed future dollar price or new freshness cadence was expressly established. This uncertainty does not block the present $6.50 instruction or require another Chris question.
- Current saved note/JR action are owner-reported; no live database, source re-ingestion, future lookup test or benchmark was performed by Lily.

## Ownership and remaining evidence limit

- **Rosie/Daisy:** the existing path and case-specific guidance are complete and usable; no same-permission or wording question remains. Future ordinary in-scope use can provide reuse evidence without a new validation job, live query or schedule from Lily.
- Independent future reuse has not yet been observed. That is an evidence limit, **not** a failed capability, approval gate or current engineering task.
- If a specific consumer gap later appears, any money/workflow or structured-representation extension belongs to **Bhoumik**, not Nova. No such build is currently proposed or requested.

## Handoff log

- 2026-09-25 19:06:17 CDT — Captured the approved persistent pricing outcome and same-case wording correction. Checked only existing note/guidance/storage and known price-seeder contracts; no proven agent retrieval failure. Staged this distinct business outcome for Bhoumik; structured design unapproved. Requested only owner scope/wording consistency, not operational edits. Parent handoff prepared; no external Telegram or build routing.
- 2026-09-25 19:08:18 CDT — Rosie confirms search guidance corrected to1G only, specific APS source reference and factual note wording; job-notes guidance already covered wording. No DB/quote/order/AR/customer action. Existing guidance plus notes remains the smallest supported solution; no architecture approval inferred.
- 2026-09-25 19:12:06 CDT — Corrected primary status per parent: supported existing path/owner guidance complete, not waiting for approval of Chris’s existing rule. Parent shared the evidence with Nova explicitly without a build request. No current feature backlog, new question or validation task; conditional extensions only if a real gap emerges.
