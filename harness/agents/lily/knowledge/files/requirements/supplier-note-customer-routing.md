# Pass useful supplier plant facts to the customer, not private buying discussion

- Status: broader September17 proposal remains staged · later narrow Rosie source authority recorded; generalized automatic-versus-review disposition not established
- Route: bhoumik
- Raised: 2026-09-17 by Chris (Telegram657, via Nova)
- Updated: 2026-09-24 23:22:31 CDT

## Problem

Chris wants a supplier’s plant-specific answer to reach the customer where it affects what they will receive. Raw supplier notes can mix those facts with wholesale prices, negotiation and internal discussion; copying the whole note could disclose private buying information or replace a useful Shared note. Conversely, labelling all pricing or supplier discussion private could hide a material shortage, condition problem or customer-price change.

## Evidence and authority

- Chris Telegram657 at12:46:35, exact via Nova12:47:06 and Lily main12:48:49: “if APS sets a status and notes should go to the shared note. Other communication can sit in the sourcing notes. Notes about specific plants need to be passed to the customer. In what case whould that be info that the customer should not see. Pricing updates or changes or conversation is one example”. Feedback: **Supplier plant facts belong with customer**.
- Nova658 already explained customer-useful plant facts versus internal wholesale costs/margins/negotiation, including the need to disclose material plant issues and customer selling-price changes appropriately. That explanation is not Chris/Bhoumik approval of an automatic publishing rule.
- Chris Telegram659 at12:50:20, exact via Nova12:50:36/Lily main12:51:13: “In the case this is one AR to one supplier yes. If multiple suppliers I would need to select which one. Likely part of a larger workflow decision tree.” This expressly requires supplier choice where alternatives compete; it is not blanket permission to publish a single-source answer. Feedback: **Select the supplier before sharing**.
- Historical September11 baseline used for this proposal: supplier responses are factual sourcing input; Rosie surfaces changes to Chris, who decides customer communication. Later scoped owner guidance now requires authority reconciliation; this dated baseline must not be asserted as a global current prohibition. The original proposal followed `availability-response-change-management`, not its rejected change/approval engine.
- Chris’s approved simpler note-writing default and JR-61-only cleanup are separate. They do not authorize this supplier-to-Shared workflow or further cleanup. Sources: **Simpler note standard approved/completed within scope** and `business/operations.md`.

## Current contract caveat — not a routing decision

- 2026-09-24 23:15:33 CDT — HEAD `3c4adca`/0115 replaces directional fields with merged customer/supplier audience fields; private internal notes stay separate. The September17 source map below is historical, not the current field contract. Merged supplier text includes requirements and replies, so field identity/submission does not establish authorship or confirmation. Current committed Rosie guidance independently instructs audience-separated handling of submitted actual facts and cites later narrow Chris availability authority; this audit did not adjudicate every cited approval and does not supersede that owner guidance. This specific staged automatic-clear-facts versus review-first proposal is **not resolved by the merge/integration permission alone**. Do not infer broad routing approval, impose Lily's review-first option as an all-cell rule, or revert owner guidance. Source/apply/runtime/policy distinctions and concrete overwrite/legacy-client risks: `workspace/threads/main/tasks/note-audience-contract-audit/source-check-2026-09-24.md`. No new workflow implementation or SOP change authorized here.

- 2026-09-24 23:22:31 CDT — **Owner source authority received, bounded:** Rosie23:21:34, relayed by parent, reports `supplier-coordination/artifacts/responses.md:17–30,52–69` and `job-requests/artifacts/supplier-responses.md:22–37` handle only explicitly submitted scoped facts by audience, preserve original customer-note content, and retain separate outbound customer-communication approval. The latter artifact`:3–6,68–110` cites **Chris JR72 web36, September24 01:49 CDT**, for **narrow first-APS-submission Job-update authority**—not blanket later-response handling or customer-send permission. This is an owner source report, not independently inspected human transcript or verified runtime execution. Under0115, preserving original customer content does not imply reinstating a removed separate origin field.
- 2026-09-24 23:22:31 CDT — Neither September17 staging nor0115 establishes global routing disablement or blanket approval. The scoped owner report does not resolve the broader automatic-clear-facts versus review-first proposal. No reversion, generalized auto-merge, new approval, Rosie edit or request that Chris repeat context. Review-first remains Lily’s historical option, not mandatory all-cell policy. The September17 map, proposal, criteria and neighboring release/hold statements below are dated context, not instructions to override current owner guidance. Source: feedback **Later supplier routing authority is scoped**; sibling0115 report above. No duplicate audit, implementation or Telegram.

## Historical September17 boundary — completed source map

Nova’s September17 source-only audit, recorded in `business/operations.md` and the `sourcing-note-disclosure` task, established at that time:

- Availability-request line Notes/Nursery notes save and display within that request before submission. A save, or a request already having Submitted status, is not a fresh handoff. Explicit **Submit/Re-submit** alone permits asynchronous relevant-agent handling; the whole-request Supplier note accompanies that event. It does not prove handling or customer delivery completed.
- Order cards display separate header Supplier note and line Nursery notes; the current Order line-note UI is read-only. Supplier chat remains at its conversation source. None of these automatically becomes customer Shared notes.
- Shared notes may already be customer-visible through existing surfaces. An empty cell is not a private draft area. Supplier association is not authorship: JR-61’s APS-linked AR38 contains Chris-admin answers, not supplier confirmation.

No fresh source/DB audit, deployed-path test or live-data verification was performed for this requirement. Its criteria describe the proposed behavior, not current functionality.

## Historical September17 behavior proposal — reconcile before any further routing

### First establish the selected source for this plant

Chris’s selection gate comes before routing competing answers into Shared. For a genuinely single-source case—one request to one supplier with no competing offers, pending alternative requests or contradictory existing selection—the relevant source may be clear. Merely having one response is not enough to establish that case.

Where suppliers/offers compete, Chris chooses the relevant **plant-row/offer** first; only facts from that selected offer may feed its Shared summary. Different rows in the same Job may select different suppliers. Never merge competing answers into one apparent offer, infer the winner from price/response order, or lock the whole Job to one supplier by default. Reuse a reliable existing selected-offer reference if present; do not guess selection from Sourcing prose or invent a new field. Missing/ambiguous selection is an internal decision for Chris, not a customer-ready blended answer.

Selection makes the source relevant; it is not customer send/Shared overwrite approval, acceptance of a substitution, or supplier confirmation. If the selection changes while a summary awaits approval, re-check the summary; an update from a no-longer-selected offer cannot overwrite the current offer’s facts. A problem with the selected offer still needs surfacing, not an automatic switch to a competing offer.

### Useful facts, honest audience

Give Chris/Rosie a concise customer-useful summary of relevant **submitted, selected-source** plant facts: offered size or substitution, quantity/shortfall, timing and its uncertainty, condition or care constraints, and the customer-relevant meaning of the supplier’s answer. Do not turn a supplier status into a confirmed customer promise or an automatic Job/Order status change.

Keep wholesale cost, margin, negotiating positions and internal discussion private. A mixed note must be separated by meaning, not copied in full or classified wholly public/private. Material defects, shortages, substitutions, delays and changes to what the customer pays still need truthful communication through the approved customer path; do not hide them because the source also discusses pricing. A supplier cost change alone does not establish a customer selling-price change.

Original customer-origin requests/constraints remain untouched. Sourcing notes remain concise current internal exceptions/decisions, not a dumping ground for every message. Full source conversations and available history retain their own homes.

### Smallest useful review/merge boundary

**Review-first option—Lily’s recommendation only, not adopted policy or an extra approval requirement beyond existing permissions:** Rosie presents the proposed customer wording and any affected existing Shared wording to Chris in the existing Job conversation. Chris approves the exact addition/replacement and its customer-visible destination before Shared text changes—even when Shared is empty. Where saving Shared itself exposes it to customers, that approval must cover the exposure, not merely drafting. Any separate customer message still follows its existing send approval. No new review screen, queue or schema is requested.

Preserve unrelated authored Shared text. Show which earlier fact a new response would supersede; a supplier’s new claim must not silently replace an authored decision or appear beside a contradictory old claim as if both were current. A conflict, unclear audience, uncertain source/plant mapping or changed Shared text since review requires a fresh decision, not an overwrite. Earlier facts remain distinguishable as superseded in existing available source/history; do not fabricate original authorship, dates or missing history.

Material customer-impacting issues must be surfaced to Chris explicitly for timely approved communication; they are not considered resolved simply because they were left in private Sourcing notes. This adds no automatic send or permission to withhold a material fact.

### Source, scope and repeat safety

- Associate the fact with the exact Job, plant row, originating request/response and recorded author/source, not plant name, row position or supplier company alone. Preserve unknown authorship as unknown; Chris-admin overrides remain Chris-admin overrides. Submitted is a handoff state, not proof that a supplier authored the content.
- Use the content actually submitted in that response. Later unsubmitted edits cannot inherit the authority of an earlier submission. If the submitted version or mapping cannot be established, stop and flag the limit rather than infer it or commission storage changes by default.
- Keep whole-request facts at their true scope. A header note about one plant is not job-wide; a genuine job-wide condition belongs once at an appropriate existing scope. Do not repeat it on every row or broaden a single-plant issue. Ambiguous scope needs clarification.
- An unchanged repeat/re-submit must not duplicate a summary, trigger repeated customer sends or erase authored text. A changed re-submit is a new proposed correction tied to the prior fact; a late older response must not roll a newer approved fact back. More than one supplier’s answer stays source-distinct and does not silently change the selected offer.
- Chat/email and Order-note evidence retain their existing handling and source homes. This proposal does not make chat a Submit event, unlock Order-line editing or add a new automatic channel-intake workflow.
- Summary preparation/approval changes no quote price, quantity, selected offer, availability/Job/Order status or order. Any such action requires its own existing evidence and authorization; note approval is not commercial-action approval.

## Illustrative examples — not approved templates or live facts

- **“Only 5-gallon, not 3-gallon; our cost is $22.”** Proposed customer wording: “5-gallon offered instead of 3-gallon.” Cost stays private; neither the substitution nor a new selling price is automatically accepted.
- **“8 of 10 available; remaining 2 may arrive Friday.”** Proposed wording preserves the shortage and uncertainty: “8 available; arrival of the remaining 2 is not confirmed.” Do not promise Friday.
- **“Discount because two plants have damaged branches.”** Wholesale negotiation stays private; the damage remains an explicit customer issue for approved disclosure before acceptance, not a detail to suppress.
- **“Our cost rose; can you accept it?”** Internal buying discussion unless LPS separately decides a customer-price change. If the customer’s price does change, communicate the approved price honestly through the existing commercial/customer path; do not infer it from the supplier cost.
- **APS-associated answer entered by Chris.** Describe it internally as Chris’s instruction/override, never “APS confirmed.” It supplies no new supplier-confirmation claim to copy into Shared.
- **APS offers eight; another nursery offers ten.** Chris chooses the relevant offer for that plant before a Shared summary is prepared; never combine them into “18 available.” If only APS has replied but the other request is pending, that is still not a proven single-source case. A different plant on the same Job can have a different selected supplier.

## Acceptance criteria

- With one genuinely unambiguous source, the source-selection branch can be clear without granting automatic publication. With competing or pending alternatives, Chris’s relevant row/offer selection is established before its facts feed Shared; reliable existing selection can satisfy this without asking again. Missing selection is not inferred from prose, first reply or lowest cost.
- In the eight-versus-ten example, only the selected offer’s facts are proposed for that plant, never a combined total. Another row can use a different supplier; a later update from a deselected offer cannot replace the current selection’s summary.
- A saved but unsubmitted supplier line, including an edit on a previously submitted request, causes no customer-note change under this proposal. A valid explicit submission can be considered asynchronously; submission alone is not publication or completion.
- Chris sees proposed customer wording with the exact affected Job/plant/source and actual supplier-versus-admin provenance. Unknown author, submitted version or mapping is flagged rather than guessed.
- In the mixed size/cost example, the useful size fact is proposed without wholesale cost, and existing unrelated Shared text survives. No customer-visible Shared write or message occurs without the applicable approval under the recommended review-first option.
- A newer timing/quantity claim shows the earlier affected fact and uncertainty for review; only the approved relevant wording is replaced. Conflicting or concurrently edited Shared content is not silently overwritten; old and current claims are distinguishable.
- A request-wide note is not sprayed across rows, and a note about one plant is not applied to the whole Job. Same-named plants and different suppliers remain distinguishable.
- An unchanged re-submit/retry produces no duplicate current note or customer send; a delayed older response cannot restore stale information over a newer approved summary.
- A material condition, quantity, substitution, timing or customer-price issue is explicitly raised for truthful approved customer communication, even when the original note also contains private buying discussion. An internal note alone is not recorded as customer disclosure.
- Original customer notes, source conversation/available history and concise current Sourcing context remain intact. Prices, quantities, selected offers, statuses and orders do not change as a side effect.

## Out of scope and relationship to other work

- No blanket retro-copy, other-job cleanup, JR-61 restoration or replay of historical supplier notes.
- No raw note mirroring, new customer publication permission, automatic customer messages, live supplier/customer projection, new queue, conflict engine, data model or history store by default.
- No implementation handoff to Nova, runtime/data/skill/script/prompt/seed/deployment edits, or new source audit under this capture.
- `sourcing-note-disclosure` and `shared-note-empty-cell` remain independent Nova UI work, accepted but blocked on the operator baseline. Their approval does not authorize this workflow and this staged item does not expand their scope.
- Rosie’s approved simpler note-writing default remains in force. Nova’s separate docs/seed-retention **HOLD** stays unchanged; do not bundle supplier routing into it. Any future approved owner guidance change goes to that agent separately.

## Assumptions

- Start with existing Rosie/Chris conversations and approvals; no additional review machinery is necessary by default. These are Lily’s proposed safeguards, not new standing approvals.
- “Status and notes should go to the shared note” means customer-useful consequences, not every status label or duplicate boilerplate; Bhoumik/Chris may refine this interpretation.
- Review-first is the smallest safe initial scope because Shared may already publish and can contain authored text. No automatic “clear fact” exception is assumed, even for empty notes.

## Current disposition — narrow authority recorded, broader decision not established

- 2026-09-24 23:22:31 CDT — Rosie’s source report supplies the later narrow submitted-fact/first-APS authority citation. It does **not** establish resolution of the broader September17 automatic-clear-facts versus review-first question. Keep that broader proposal staged without treating scoped owner handling as disabled, requiring a new blanket approval, or declaring generalized routing shipped. No new Chris question, owner edit, implementation route or audit is requested. Any future broader decision needs its own explicit evidence; outbound customer communication remains separately approved.

Historical Telegram347 question: for clear customer-useful facts from the selected supplier/offer, should routing be automatic within authorized limits, or should Rosie first propose wording for review? Selection, preservation of authored text, true provenance and mixed/private/conflicting-content/publication safeguards were the presented scope. This question was unresolved in Lily’s September17 record; that fact alone does not establish its current disposition. The field merge is not a decision on it either.

## Handoff log

- 2026-09-17T12:48:49-05:00 — Captured Chris657 and Nova658 interpretation via parent; staged this narrow workflow for Bhoumik. Parent will notify Bhoumik. Used the completed current-source map without repeating its audit. No implementation route, customer publication or skill/data change authorized.
- 2026-09-17T12:51:13-05:00 — Integrated Chris659’s explicit supplier-choice refinement in this same staged scope: per-row/offer selection before customer facts, no blended responses, sole response not sole source, existing reliable selection reused. Single-source agreement is not blanket publication/overwrite authority. No larger workflow engine or new build authorized.
- 2026-09-17T12:55:37-05:00 — Parent reports Bhoumik notified through Telegram347. Presented selection, customer-versus-private facts, authored-content preservation and provenance, then **one** undecided question: automatic clear selected-supplier facts versus Rosie’s proposed-wording review-first option. No all-cell review default adopted; existing permissions/approval friction unchanged. Mixed/private/conflicting content and actual publication effects need safeguards under either option. No routing enabled by this September17 handoff; further audits/routing were held pending Bhoumik’s decision.
- 2026-09-24 23:20:11 CDT — Parent supplied the sibling0115 report and requested historical/pending-owner-reconciliation status. Later scoped Rosie source exists; parent has already requested its human authority/current alignment. This record grants no new approval, global disablement or reversion. No duplicate audit, implementation or Telegram.
- 2026-09-24 23:22:31 CDT — Parent relayed Rosie23:21:34 source-backed authority boundaries, including the narrow Chris JR72 web36 citation and separate customer-send approval. Recorded scoped current owner guidance without generalizing or reverting it. The broader September17 decision remains unestablished by this evidence; no human transcript/runtime recheck or new approval.
