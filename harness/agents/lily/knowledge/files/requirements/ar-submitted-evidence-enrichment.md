# Keep supplier submission truth clear when enriching an offered plant

- Status: staged · repeat AR77/JR111 incident and bounded genuine-history recovery assessment added; parent verified Bhoumik Telegram370 and recurrence escalation371; no policy/fix/recovery approved
- Route: bhoumik
- Raised: 2026-10-08 by Rosie via Nova (JR110/AR75)
- Updated: 2026-10-10 07:43:11 CDT

## Problem

The supplier has genuinely submitted an answer, but the agent's instructed follow-up enrichment can make the request appear New with no current submission time. LPS needs one consistent rule for enriching submitted evidence versus materially changing what was answered or asked, so the agent does not inadvertently invalidate completion or manufacture a replacement submission. The AR77 recurrence shows that the conflicting required follow-up remains disruptive; it also raises a bounded assessment of whether any authentic prior submission time can truthfully support the current completion state.

## Evidence

- 2026-10-10 07:43:11 CDT — **Recurrence:** Nova Oct10 07:42:44 relays Rosie jr11107:42:16: AR77/JR111 genuine Submit07:41:18 and initial Submitted snapshot; required guarded typed-offer enrichment of1598 Russian Sage3G/list21 and1600 Green Sotol15G/list150 (names/size/mapping/description/note/zero-price fills) followed by New/no current submission time, answers retained. Owner declined fake Submit/restore and asks fix plus safe genuine-timestamp audit recovery. Owner-reported recurrence, not Lily verification or new cause/deployed-parity proof. Filling zero prices can change commercial meaning; these edits are **not preclassified as faithful/cosmetic**. Reuse existing source collision evidence below; no duplicate audit or feature. Feedback `nova:main:2026-10-10T07:42:44-05:00:rosie-jr111-ar77-enrichment`.
- 2026-10-08 11:31:09 CDT — Nova11:30:50 relays Rosie JR11011:30:24: enriching APS typed offer1567, Prickly Pear5G/$32, followed by AR75 New/no current submission time; genuine11:29:04 submission remains in history. Supplier owner declined fabricated restoration/re-submission; no new scope/resend approved. Owner-reported incident, not Lily verification. Feedback `nova:main:2026-10-08T11:30:50-05:00:rosie-jr110-ar75-enrichment`.
- 2026-10-08 11:38:21 CDT — Nova11:38:04 read-only source audit at HEAD2af1653 establishes a contract collision: ordinary actual candidate changes—including name/size/description/customer-note alone—can reset a published request to New and clear its submission time; Rosie's current procedure directs post-submission typed-offer enrichment without further approval. Admin detail editing and direct agent updating meet the same reset rule. Actor labeling and old-value guarding do not distinguish enrichment intent. Later source migrations do not remove this behavior.
- The source explains the reported shape under its stated conditions, **not the actual executed incident SQL or deployed database parity**. Retained history is compatible with an invalidated current header; history retention is not current submission-time retention. Source report reused, no Lily audit/tests: `../nova/workspace/threads/main/tasks/ar75-enrichment-submission-audit/source-findings.md`. Feedback `nova:main:2026-10-08T11:38:04-05:00:ar75-source-findings`.

## What it should do

Bhoumik chooses one coherent policy for post-submission factual enrichment; none is currently approved:

1. **Narrow preservation:** allow validated normalization of facts already supplied in a specific submitted offer without invalidating its genuine submission. Material commercial answers, corrections, changed plant identity, demand, offer associations or scope retain the applicable invalidation/review rule. This is not an exception for all agent edits or all text fields.
2. **Keep broad invalidation:** treat the edited answer as no longer currently submitted; pause the conflicting post-submission row-enrichment instruction. Show the authentic prior event separately from current unsent work. Any continued correction follows an explicitly authorized, truthful supplier-review path—not a fabricated submit or automatic resend.
3. **Presentation-only normalization:** leave submitted source answers unchanged and normalize only presentation, with source and derived wording distinguishable. This does not supply missing commercial facts or grant customer publication.

Whichever policy is chosen, define what counts as faithful evidence normalization versus a material correction, including plant/size interpretation, customer-oriented wording and exact-size list-price filling. A copied/equal value, source label or unchanged displayed price alone does not prove unchanged meaning or scope. Preserve original supplier evidence, genuine submission time/history, latest unsent edits and actual author/source as distinct truths. Current header must accurately represent the chosen policy, not be cosmetically frozen as Submitted.

**Additional recovery assessment, not recovery authority (2026-10-10 07:43:11 CDT):** Bhoumik decides whether/how an authorized owner may assess genuine-history timestamp recovery for affected records. Establish the authentic source event and its time, the content actually submitted, relevant parity with current content under the chosen policy, any latest unsent/material edits and concurrent changes. Historical time alone, retained answers, copied data or a former Submitted snapshot do not establish current completion validity. If current content materially differs or evidence/version/mapping is uncertain, do not restore completion; preserve the authentic historical event and truthful current state, with an explicit reason or approved next review action. Any recovery requires Bhoumik's specific disposition and owner verification, never a new fabricated/backdated Submit or blind timestamp restoration. No recovery operation or architecture is selected here.

Keep original JR110 and JR111 authority and APS approval destinations. Submission validity is not stock confirmation, acceptance of a substitute, customer visibility, send approval or delivery. Align affected agent guidance and documentation through their owners **after** the decision; this requirement grants no procedural edit or Nova implementation authority.

## Acceptance criteria

- Bhoumik records the selected policy, the normalization/material-change boundary and permitted next action, including whether missing-price filling and plant/size/customer-wording corrections require invalidation or separate review.
- For a validated transformation of one specific submitted typed offer that adds no new answer, commercial meaning or scope, the result follows the selected branch: genuine completion retained only if approved; otherwise current unsent state remains truthful, or source answers remain unchanged for presentation-only work.
- Changed price, quantity, status, plant identity, demand, offer linkage/scope, material corrections or unsupported interpretations cannot inherit earlier submission authority through an enrichment label. Applicable invalidation/review remains effective; no blanket agent/text-field exemption.
- An unrelated or concurrent supplier edit, ambiguous submitted version or uncertain mapping stops preservation/normalization rather than silently authorizing latest unsent content. Earlier and later facts remain distinguishable; retrying unchanged work creates no fresh supplier event.
- In AR75 (Oct8 genuine11:29:04 event) and AR77 (Oct10 genuine07:41:18 event), authentic prior events/history are not erased, recreated or backdated; current New/no submission time remains truthfully described until an authorized disposition actually changes that state. No claim of incident repair without owner verification.
- Bhoumik provides a separate explicit recovery-assessment disposition. The authorized owner can establish authentic event/time, submitted-content version, policy-relevant current-content parity, latest unsent edits and concurrency before assessing whether completion can be recovered. The outcome may be ineligible/uncertain with reason—not a guaranteed restore. Zero-price fills21/150 and other materially changed commercial/identity/scope facts cannot inherit supplier-submission authority without the decided policy/review.
- Any specifically authorized recovery is confirmed against that disposition and preserves the genuine historical event/time without claiming a fresh submission, supplier delivery or approval of latest unsent content. Uncertain evidence or intervening changes block blind recovery.
- Relevant authorized app and agent edit routes obey the decided semantics; a different writer identity or optimistic old-value check alone does not confer preservation. No ad hoc bypass of legitimate operation boundaries.
- No automatic supplier/customer send, stock confirmation, substitute acceptance, customer publication, changed ask or repeated submission follows. Scope, source, approval destination and existing evidence remain intact.
- Before closure, the authorized owner confirms both the selected behavior and alignment of affected owner guidance/docs. Source readiness alone is not deployed/runtime verification or shipped status.

## Out of scope

- Lily audit/query/test/DB/code changes; choosing SQL, flags, triggers, storage models or repair operations.
- Executing recovery under this requirement without Bhoumik's specific disposition; blind restoration, fabricated/backdated submission, blanket header freeze or Rosie exemption, resending AR75/AR77, new stock/scope/customer authority.
- Separate Stemodia original1576 demand18 versus Job1274/offer1587 quantity36 source discrepancy: Nova already owns its delegated source audit. No audit/repair or causal bundling into this completion-reset requirement.
- Nova UI-only fix/build assignment, edits to other owners' skills/prompts/docs, or resumption of paused pipelines.
- Reopening `supplier-note-customer-routing`'s broader automatic-versus-review proposal or `draft-ar-authorized-recovery`'s AR64 recovery/Draft-answer decision. They remain independent; neither authorizes AR75 restoration.

## Assumptions

- 2026-10-08 11:38:21 CDT — Owner incident plus source contract collision supports a focused business decision without another question to Chris or duplicate audit. Actual incident path/runtime parity remains unproven.

## Open questions

- 2026-10-10 07:43:11 CDT — Bhoumik: which policy/material commercial/identity/scope boundary applies, and what bounded genuine-history recovery assessment/disposition is permitted? Parent verified actual Telegram371 recurrence/recovery-scope escalation alongside370; await decision, no duplicate ask or implied policy/fix/recovery authority.

## Handoff log

- 2026-10-10 07:43:11 CDT — Captured AR77 recurrence and added impact/evidence plus B-controlled genuine-history recovery assessment to this existing requirement. Parent verified actual Telegram CLI receipt371: recurrence and verified-history recovery scope delivered to Bhoumik. No option, fix, recovery, restore/resubmit or rule change approved; no repeated question, builder route, new audit/code/DB/test/SOP edit or pipeline resumption.
- 2026-10-08 11:31:09 CDT — Captured as watching while Nova's existing audit proceeded; no parallel investigation or repair.
- 2026-10-08 11:38:21 CDT — Reused completed owner source report; staged this focused requirement for Bhoumik. No option selected, implementation assigned, record changed, owner guidance/docs edited or supplier/customer action authorized.
- 2026-10-08 11:40:43 CDT — Parent reports actual Telegram CLI receipt370 verified: notified Bhoumik of factual-recording/current-completion reset versus retained history and source contract collision; asks validated preservation versus presentation-only/fresh truthful review, with material commercial boundary. Notification complete, not approval/repair. Await decision; no another ask, builder route, restore/resubmit or rule change.
