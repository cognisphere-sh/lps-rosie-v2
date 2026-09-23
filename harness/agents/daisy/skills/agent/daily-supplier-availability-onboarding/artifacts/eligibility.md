## 2. Texas-first read-only outreach-eligibility gate

Run this gate and record its terminal result **before** any Gmail availability
search, availability-page parsing/ingest handoff, POC lookup, newsletter attempt,
or new supplier-email draft.

1. Record the supplier's actual category and location evidence already held, but
   do not turn a state, city, ZIP, or the supplied Texas market names into a
   service-area conclusion. The Texas market names are business context only;
   never derive coverage from a guessed ZIP/city mapping.
2. Where an original Google Sheet/cohort artifact is available, check for
   **verified original-cohort provenance** before assigning a low-priority hold.
   Verification must bind this supplier/company (not merely a similar name) to an
   identifiable source row/list and preserve the exact original label, artifact or
   URL/path, and retrieval date. Record `original-cohort-verified` or
   `original-cohort-unverified` with the reason; a current app category, a guessed
   match, or an absent/uncertain artifact is never cohort membership. Verified
   membership is a prior-human-qualification signal only: it does not prove
   current availability, price, Texas delivery, current business type, or a right
   to contact the supplier.
3. An **out-of-state supplier classified `Wholesale Supplier`** is the one
   approved categorical exception: classify it `retained-future-market`, with
   the category/state evidence. Do no routine availability, POC, newsletter,
   signup, draft, or other contact effort in this run. Retain it in the cohort
   state and report it for future expansion; do not delete, retire, or mark it
   ineligible in the database.
4. For every other supplier, establish Texas service evidence from an explicit
   public delivery/service-area statement, sales terms, a documented direct
   business fact, or equivalent evidence. A Texas address alone is not proof of
   service. If evidence is absent or conflicting, classify
   `held-service-to-Texas-unverified`; do only the bounded read-only research
   needed to record that gap, then stop. Do not search availability, seek a POC,
   subscribe, create a draft, or dispatch ingestion. For an
   `original-cohort-verified` supplier, do not treat missing website shipping
   language **alone** as a low-priority reason to stop: record the same unresolved
   Texas-service fact as `held-service-to-Texas-unverified-prior-qualified`, give
   it focused bounded read-only review, and, if still unresolved, queue a direct
   availability-and-Texas-service question for a later, separately Chris-approved
   supplier-thread action. The signal neither authorizes that question nor permits
   a draft, send, availability search, POC lookup, newsletter signup, or ingest in
   this held run.
5. Review trade-association membership as a **supporting qualification signal**
   for market/service reach when it is current and attributable to the supplier:
   record the association name, supplier identity as listed, exact current public
   URL or other dated evidence, geography/market relevance, and retrieval date.
   For example, Texas Nursery & Landscape Association (TNLA) membership is direct
   Texas-market evidence for La Croix Nursery; an Alabama nursery/landscape
   association membership supports a Louisiana supplier's reach beyond Louisiana.
   Direct delivery/shipping/service-area statements and documented direct business
   facts take precedence. Membership alone is not a universal guarantee of service
   to Texas or another market; only classify it as dispositive where Chris has
   named that supplier/case or made that decision. Otherwise record it as
   supporting evidence and retain/hold according to the stronger evidence.
6. If explicit evidence supports serving Texas, classify
   `eligible-Texas-service` and proceed to [research](research.md). Growers are reviewed first;
   Texas wholesale nurseries are relevant regional prospects after that priority.
   This priority does not make their stock actionable until the same service
   evidence is recorded.
7. Existing drafts are audit records, not a workaround: never send, delete,
   duplicate, or revive one because of this gate. For a held or retained supplier,
   record its draft id, recipient, subject, and why it is `draft-held-market-gate`.
   Only a later eligible run plus Chris's separate authorization can move it
   toward correspondence.
8. **Respect placeholder holds.** A supplier Chris has designated a placeholder
   for special material (e.g. Devil Mountain, 2026-08-20 — big specimen trees
   only) gets no routine availability, POC or newsletter effort: record the
   hold and move on.
