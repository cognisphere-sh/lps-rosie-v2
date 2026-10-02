# Give Chris a supported usable AR after draft failure

- Status: staged · temporary AR64 restore owner-verified complete; broader Bhoumik recovery/Draft-answer decision unresolved
- Route: bhoumik
- Raised: 2026-10-01 by Chris via Nova (JR98 web16)
- Updated: 2026-10-02 09:55:40 CDT

## Problem

Chris reports a status-update error on JR98 and explicitly repeats that he wants a NEW AR rather than more diagnostics. Existing Draft AR64 already binds the candidates, so ordinary new creation is blocked; deleting the old record is not an established recovery route. A supported replacement/recovery decision is needed so authorized work becomes usable without losing existing work or duplicating demand/asks.

## Evidence

- 2026-10-02 09:53:00 CDT — Rosie APS owner09:52:46 via parent: sole deleted JR98 APS AR identified as AR64; guarded inactive→active only. Verified active Draft, no submission timestamp, Job98 active Quoted/supplier1, prior state/bindings/evidence preserved. No create/rebind/send/publication. Owner informed jr98. 2026-10-02 09:55:40 CDT — Parent confirms actual Telegram CLI receipt363 replying to362: “AR64 is restored as an active Draft. Nothing was sent to the supplier.” Owner-verified temporary restoration, not editing/status-error/replacement fix or feature release. Feedback `rosie:aps-owner:2026-10-02T09:52:46:jr98-ar64-restore`.

- 2026-10-02 09:52:00 CDT — Direct Telegram362 at09:51:39, sender Pi, exact: “Undelete the deleted AR for now.” Parent relayed and routed supported undelete/current-target verification to Rosie jr98. AR64 is recent context, **not an assumed target**: Oct1 it was reported active Draft; latest deletion/identity unknown. Temporary restore only, owner result pending; not a new replacement/lifecycle/send approval. Feedback `telegram:main:362`.

- 2026-10-01 16:56:54 CDT — Nova16:56:31 via parent: Chris asks for new draft because AR64 “would not work”; owner reports existing Draft/bound candidates, unasked guard blocks creation, Rosie left records unchanged. Feedback `nova:main:2026-10-01T16:56:31:jr98-ar64-recovery`.
- 2026-10-01 17:00:08 CDT — Nova16:59:44 read-only source report HEAD eb7d963 via parent: soft deletion retains bindings; no supported replacement without rebind/copy-demand changes. Active Draft64 reuse/read-only Retry exists; modifications/send require explicit origin approval. Answer UI permits Draft while0124 answer RPC rejects it; footer Submit writes submitted directly rather than send RPC. No app Send for existing Draft found. Source-only evidence, not independent runtime verification/incident diagnosis. Feedback `nova:main:2026-10-01T16:59:44:jr98-ar64-source-watch`.
- 2026-10-01 17:01:40 CDT — Nova17:01:20 relays Chris JR98 web16 at17:00:47 repeating CREATE NEW AR instead of more diagnostics; preceding web14 reports status update errored. Attributed parent relay, not supplied verbatim transcript. Feedback `web:jr98:16`.
- 2026-10-01 17:01:49 CDT — Parent confirms Telegram361 delivered Bhoumik decision escalation; records unmodified, no authorized workaround/lifecycle/send. Nova informed FYI only, no build assignment.

- 2026-10-01 17:02:29 CDT — Nova17:02:18 exact source-path report via parent: Draft line controls enabled at drawer674 → updateARItem →0124 answer RPC53–64 rejects Draft with “This request is closed, deleted or unavailable”; API409, UI displays error verbatim. **Plausible status-error explanation, not confirmed incident/runtime cause.** Header Draft status picker hidden; footer Submit directly writes submitted, not send RPC. Feedback `nova:main:2026-10-01T17:02:18:jr98-draft-answer-source`.

## What it should do

**Temporary action complete, owner-verified:** Rosie identified the sole deleted JR98 APS AR as AR64 and restored only its active flag; it remains Draft with no submission timestamp, prior state/bindings/evidence retained and nothing sent/published. This is owner evidence, not Lily verification. The initial identity uncertainty is resolved by that current-record check, not by assuming yesterday’s state. This temporary restoration does not resolve or authorize broader replacement/recovery, Draft-answer semantics, publication or sending. Do not ask Chris again or route another build.

Provide an explicitly supported, authorized way to satisfy Chris’s JR98 new-usable-AR/recovery request. Bhoumik chooses the replacement or recovery operation and any required lifecycle disposition; this requirement specifies outcomes, not deletion, rebinding or demand-copy architecture. Clearly distinguish a proposed new AR from recovery of AR64 rather than silently treating them as the same result. Preserve the existing work and truthful history, and make the next permitted action clear without another diagnostic loop.

Bhoumik’s disposition must explicitly state the permitted Draft answer behavior and whether recovery retains that restriction or authorizes a policy change. Creating another Draft alone may reproduce the same answer rejection; replacement is not sufficient acceptance without this disposition. No additional diagnostic loop is required before the decision.

A record merely existing as Draft is not proof that answering, submitting or sending will work. The chosen path must respect current action/status policy or have an explicit Bhoumik decision for a necessary policy change. Draft preparation, answer submission, status transition, publication and supplier delivery must not be conflated.

## Acceptance criteria

- Temporary restore **met on owner confirmation2026-10-02 09:53:00 CDT**: Rosie reports verified AR64 restored active Draft with retained state/bindings/evidence and no create/rebind/send/publication. This closes only the temporary action; it does not mark the broader requirement shipped or prove that Draft answering/status editing now works.

- Bhoumik provides a supported JR98 disposition specifying new replacement versus existing-AR recovery, allowed operations, authority needed, **explicit Draft answer semantics** and which next action becomes usable. No undefined delete/recreate workaround is treated as approved.
- After the authorized owner executes that disposition, Chris can open the identified usable request and perform the specifically approved next action without the current bound-candidate/new-create obstacle or a predictable Draft answer restriction left unexplained. This is not a promise that all Draft actions become allowed.
- Existing answers (if any), candidate associations, original demand and historical/source evidence remain preserved or explicitly accounted for in the approved disposition; no orphaned bindings, fabricated answers/stock or silently lost work.
- Replacement/recovery does not create duplicate demand or repeated supplier asks; no supplier/customer contact, publication or send occurs without separate explicit origin approval.
- The result truthfully records Draft/preparation, answer/submission and actual authorized delivery separately; a direct Submit/status update is not reported as Send/delivery.
- Owner confirms the operation/result against the approved disposition before this requirement is marked shipped. Chris’s status-error root cause and separate UI source mismatches are not claimed resolved without evidence.

## Out of scope

- Lily choosing or executing deletion, deactivation, rebinding, copying demand, bypassing guards, retrying mutations, publishing links or sending.
- Nova implementation of DB/lifecycle/workflow changes; no build assignment from this handoff.
- Repeated diagnostics/screenshot questions to Chris, or treating more investigation as a prerequisite to Bhoumik’s recovery decision.
- Adding an app Send button, changing statuses/answer policy by default, or merging the source-only Draft-control mismatch into an asserted incident root cause.
- Global replacement lifecycle, other ARs/Jobs, or revival of held full-AR workspace work.

## Assumptions

- 2026-10-01 17:01:49 CDT — Chris’s repeated new-AR request establishes recovery need but does not approve any particular lifecycle operation or supplier send. Replacement versus recovery must be explicit in Bhoumik’s disposition.
- 2026-10-01 17:01:49 CDT — Owner-reported source findings are sufficient to stage this decision; exact runtime error/root cause remains unknown and is not asserted.

## Open questions


- 2026-10-01 17:02:29 CDT — Bhoumik owes supported replacement/recovery disposition, explicit Draft answer semantics and required authorization. Parent Telegram361 already asked; no duplicate question.

## Handoff log

- 2026-10-02 09:53:00 CDT — Rosie APS owner09:52:46 reports current-record AR64 identity verification and guarded active-only restoration complete; jr98 informed. Parent confirmed delivery receipt363 at2026-10-02 09:55:40 CDT, replying to Telegram362: “AR64 is restored as an active Draft. Nothing was sent to the supplier.” Temporary action complete only; broader requirement still staged, no feature release/workflow resolution claim or duplicate operation/reply.

- 2026-10-02 09:52:00 CDT — Telegram362 explicitly requests temporary undelete. Parent routed verification/supported action to Rosie jr98; current identity and result pending. Broader Bhoumik recovery/Draft-answer decision remains staged; no Lily DB writes, creation/rebind/copy/send/publication or Nova build route.

- 2026-10-01 17:02:29 CDT — Added exact owner-source rejection path and explicit Draft-answer decision/acceptance. Plausible cause remains unconfirmed; awaiting additional diagnostics is superseded as next action by Chris web16 insistence and Telegram361 staging. No extra question, source audit, operation or Nova build route.

- 2026-10-01 17:01:49 CDT — Staged for Bhoumik after Chris’s explicit repetition; parent reports successful Telegram361 notification and FYI to Nova only. No implementation/operation/send approved or performed; current records remain unchanged.
