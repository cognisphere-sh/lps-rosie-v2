# Put customer-info sharing where its meaning is clear

- Status: routed · UI approved/source-only candidate; TWO interception failures, STOP ALL cycles/runtime/source/QA/deploy pending explicit Pi/Nova disposition; earlier possible disclosure write unresolved
- Route: nova (sole existing owner; no parallel builder)
- Raised: 2026-10-23 by Chris via Nova; Telegram831
- Updated: 2026-10-23 15:01:27 CDT

## Problem

The selected supplier Availability Request puts a long customer-info checkbox beside a different Share action. Chris wants a compact pressable control near customer information. The existing per-request privacy choice must remain visibly tied to the selected supplier and AR rather than appearing to apply to the whole Job or customer.

## Evidence and approval

- 2026-10-23 12:48:26 CDT — Nova confirms Chris Telegram831 at12:46:39, chat `-1004330045748`, exactly: “Should we move that up a section with the customer info, make it a share icon, <CI ( customer info) and make it a press, turns green if applied?” Raw capture `telegram:-1004330045748:831` in `../feedback.md`. Private photo831 inspected in place; no image/contact details copied. It shows active AR below Job identity/date/delivery and tabs, checkbox/public-link action/Print together; not proof of saved state or audience access.
- 2026-10-23 12:53:59 CDT — Parent confirms Telegram383 CI proposal+ONE approval question delivered: near customer context, selected supplier+AR explicit, saved green+check, neutral off, separate public-link action; today's disclosure scope including EXISTING public-link viewers, no link creation/send.
- **2026-10-23 14:41:34 CDT — APPROVED:** direct Chris Telegram384, chat `-1004474937526`, sender CR8666166668, at14:41:03 exactly **“yes”**, tied by parent to latest383. Approves this UI approach; not All Jobs381, AR print, Android, global sharing or DB/workflow changes. Capture `telegram:-1004474937526:384`. Earlier832 recommendation/design-pending status is superseded within this slice only.
- 2026-10-23 12:48:26 CDT — Historical bounded local-source check at `8c4de1eb3fd3`: admin-only per-AR choice, Closed blocked, exactly-one-Job structured customer name/company/email/phone and delivery address/city/state/postcode for supplier/public views; existing valid public-token holders receive the same allowed fields. Internal identity remains independent. This dated source snapshot is NOT a fresh clean operator base, running database-policy/live-record finding or exact served-build proof.

## What it should do — approved UI scope

Replace the existing long checkbox with a compact share-icon **CI** toggle near customer information, visibly and unambiguously associated with the **currently selected supplier and AR**. Green plus a check means authoritative **saved on**, not merely pressed, copied, sent, accepted or made public. Off is neutral and distinguishable without color alone. CI has a full accessible customer-info name and discoverable meaning.

Use the smallest valid placement near customer context: a clearly active-AR-scoped upper-header subrow **or** a customer-info-sharing group at the top of the selected AR panel. The selected supplier and AR must be visible in that group/context. Builder can choose the minimal safe fit without another question about pixels, unless the proposed outcome changes. No global Job/customer setting, no control on Request items/Orders and no guessed first supplier. Keep full identity/date/delivery and separate chat routes intact.

Preserve today's customer-disclosure fields, recipients and update permissions. Explain contact/delivery sharing and that an already-valid public link also exposes those fields to its holders. Keep the existing public-link action clearly separate. CI must never create/copy/revoke a public URL, publish/submit/reopen/send the request, auto-enable sharing or change defaults. Off is not a promise to anonymize independent names/notes or erase information already received.

## Acceptance criteria

### Placement, access and existing behavior

- Chris sees compact icon+CI near customer information, clearly labelled by the selected supplier and AR. No Job/customer-wide or all-supplier implication; no control on Items/Orders or while selected-AR scope is missing/unloaded/invalid.
- Switching AR/Job shows only that AR's own confirmed value; reopening reloads the authoritative persisted choice. No carried-over value, guessed supplier or automatic write/default change on mount, tab switch or refresh.
- Preserve full Job/customer identity, date/delivery, current edit access and separate customer/Job/supplier chat destinations. Do not clip useful context to make CI fit.
- Remove the old checkbox only when the replacement is fully functional, accessible and recoverable; no conflicting duplicate controls. Other admin drawer, All Jobs/customer and supplier/public shared-detail callers retain their existing behavior and permissions.
- CI has a full accessible customer-info name including selected supplier/AR scope, appropriate toggle semantics (`aria-pressed` or equivalent), keyboard activation, visible focus and a check/state cue independent of green. At least44px touch target; meaning is available without hover alone. Closed/read-only remains noneditable with an honest state/reason.
- Preserve existing admin-only writer, company/supplier/public-token gates, exactly-one-Job disclosure, same fields/defaults and status/submission/publication behavior. Draft preference does not appear published. No new permission, storage or workflow meaning.

### Authoritative state and recovery

- Green+check only reflects authoritative confirmed saved-on for the current AR, including a valid initial authoritative load, not an optimistic click or generic Submit-saving flag. Confirm save/refetch before presenting the newly requested state as applied.
- Pending is explicitly pending and cannot be mistaken for applied. Disabled/read-only/loading states are truthful; failures are visible/accessibly announced with a usable recovery path. Preserve last-confirmed state, and if write/read confirmation fails show uncertainty rather than assert off/revoked or on/applied. No automatic disclosure retry, re-enable or silent default change.
- Late reads/writes, rapid presses, refresh, newer unsaved intent and A→B→A AR/Job switching cannot overwrite newer state, apply an old result to a new editor session, or show another AR's success. Explicit retry/reconciliation operates on the correct current AR and does not silently discard newer local intent or repeat an unknown-outcome write.
- CI changes only its existing disclosure choice. Public-link state/button remains independent and distinguishable under existing conditions; CI never publishes/revokes/copies a token, sends anything, submits/reopens or changes status/history.
- Explanation accurately distinguishes structured contact/delivery sharing from blanket anonymity and authenticated supplier access from existing bearer-link access. No added customer export or promise that off hides names already present in independent request names/notes.

### Safe execution and evidence

- Before execution, Nova establishes a fresh operator-approved base, current scope/ownership and safe host execution conditions; respect unrelated/operator changes and serialize shared-file overlaps. The dated source report does not establish current cleanliness, authorization of unrelated work or deployed identity. No old patch application, unrelated adoption, production data changes or live disclosure toggles for QA.
- Technical checks cover current endpoint/Closed/permissions behavior, initial on/off, successful save/refetch, refusal, network/refetch uncertainty, explicit recovery, rapid changes/newer intent, live refresh and AR-switch/ABA isolation. Keep tests fixture-based and bounded; blocked/unrun checks are reported as such, never PASS.
- An independent technical **and rendered responsive visual** review verifies the final candidate at320/390/480px and narrow/wide desktop, including long Job/supplier names, on/off/pending/error/unknown/loading/Closed, keyboard/focus/screen-reader state and shared-caller regressions. No overflow, clipped identity, ambiguous sharing icons or unstable small-width layout. Private evidence must avoid real customer/contact/address data; static/source-only checks are not live rendered proof.
- Record exact candidate/base, checks actually run, independent findings/corrections, responsive private evidence and any deployment provenance/limitations. Keep status routed until builder confirmation; no implemented/shipped claim from a prepared patch, blocked QA or delivery alone.

## Out of scope

- Global Job/customer/all-AR switch, auto-enable, changed defaults, added customer fields/exports/permissions, persistent model or approval workflow.
- Identity/notes redaction, customer-record edits, status/submission/history changes, supplier/customer contact or automatic public URL creation/copy/revocation.
- All Jobs381, AR print concepts, Android band, other header redesigns, money/workflow changes or wide shared-component cleanup.
- New Lily code/tests/browser/DB/Telegram or parallel builder. Parent owns human communication; no further pixel-placement question unless the outcome changes.

## Assumptions

- 2026-10-23 14:41:34 CDT —384 approves the clearly scoped CI UI approach presented383, including today's public-link audience, not a new public sharing capability. Exact pixels are Nova's minimal safe layout choice within that approved outcome, not a blocking unanswered design question.
- 2026-10-23 14:41:34 CDT — This is UI-only because fields/recipients/permissions/defaults stay unchanged. If a new audience/disclosure/default/workflow meaning becomes necessary, stop that slice and stage it for Bhoumik rather than infer approval; no such structural change is currently required or authorized.

## Open items

- 2026-10-23 15:01:27 CDT — Parent relays Nova15:01:17 SECOND setup failure on LOCAL sentinel ONLY: accepted daemon abort+finite expected mock did not intercept; fixture GET+unexpected PATCH reached local sentinel418/count2. NO real app reopened or further actual app-backend traffic reported. Browser+sentinel CLOSED. Builder STOP ALL further cycles/runtime/source/QA/deploy after twice failure, superseding even local-test permission. Nova836 EDITED to include earlier real-backend write uncertainty, narrow read-only AR9084 audit request and QA-interception REPAIR AUTHORIZATION request. Await explicit Pi/Nova disposition; no tool-incapability/root-cause claim (semantics unknown), new framework or DB repair. Candidatea60d632 source-checked only, not visualPASS/live. Production expected unchanged is not remote-DB no-write assurance. No further Lily audit/test/probe/question/code/external message.

- 2026-10-23 15:00:54 CDT — Parent relays Nova15:00:40: **CANNOT categorically exclude an earlier disclosure write** to synthetic AR9084. PATCH409 body unavailable; setter can throw after an earlier update and GET404 is not complete no-write proof. Candidate `a60d632` source/typecheck/34 focused PASS only, not independently reviewed/deployed. Actual GET read noted. Five chat-parties404s have a proven pre-conversation-write guard **only for that limited path**, not for the disclosure PATCH.
- 2026-10-23 15:00:54 CDT — Browser/preview/CDP CLOSED; partial initial capture evidence excluded. Nova Telegram836 ALREADY asks Pi to review synthetic AR9084 audit at14:55:32 CDT or authorize a narrow read-only check. **NO app-backend operations, capture, deploy or repair until incident review.** The earlier local sentinel-test allowance was subsequently superseded by Nova15:01:17 STOP ALL further cycles/runtime/source/QA/deploy after a second local-only failure. No remaining local-cycle permission. UI approval stays valid, but privacy/authoritative/independent QA is PAUSED/source-only/not shipped. No no-write assurance, restoration, automatic disclosure retry, duplicate Pi question or Lily DB/read/audit/repair/Telegram.
- 2026-10-23 15:00:54 CDT — Owner receipts (not independently inspected by Lily): `../nova/workspace/threads/main/files/visual-qa/a60d6327cb14/incident/network.json`, `preview-receipts.txt`, `assessment.md`. Await existing owner/Pi incident review; no new framework/SOP route.

## Handoff log

- 2026-10-23 12:48:26 CDT — Captured831 once, inspected image in place and bounded local source/docs; design-only reports to parent/Nova delivered. Source facts/consumers/optimistic-save hazard/header ownership retained at `workspace/threads/main/tasks/ar-customer-info-toggle/source-check-2026-10-23.md` (Lily root), historical not a fresh baseline.
- 2026-10-23 12:53:59 CDT — Parent383 proposal+one approval question actually delivered; design proposed, not yet approved at that time.
- 2026-10-23 14:41:34 CDT — Chris384 exact yes captured and linked383; finalized approved UI behavior/safe criteria. Sole existing owner Nova main, no parallel builder. Full requirement sent in body to Nova main; delivery returned exit0/delivered. ROUTED; approval alone is not shipment.
- 2026-10-23 14:44:38 CDT — Parent confirms Nova14:43:55 ACCEPTED full handoff/assigned ONE builder `ar-customer-info-toggle`, with focused checks+one fresh independent technical/responsive QA before app-only release. No live disclosure toggles/other backlog. Owner acceptance/build assignment only, not implementation, QA or release completion.
- 2026-10-23 14:58:05 CDT — Captured parent-relayed Nova14:57:52 QA interception incident once (`nova:main:2026-10-23T14:57:52:ci-preview-interception-incident`). Candidatea60d632 source/typecheck/34 focused PASS only; mock cancellation let synthetic PATCH reach preview backend/refused409 and synthetic chat-parties POST404. No successful disclosure write owner-reported, not conclusively verified; receipts/pre-write guard proof pending with existing owner. Capture STOP/preview closing/partial evidence excluded; ONE safe local sentinel-fixture correction and guard-before-capture permitted, repeated leak/failure STOPPi. Privacy/independent QA pending, no deploy or Lily investigation.
- 2026-10-23 15:00:54 CDT — Nova15:00:40 qualification captured once (`nova:main:2026-10-23T15:00:40:ci-incident-possible-write-review-pause`): earlier disclosure write CANNOT be excluded/409 body unavailable/setter may throw after update/GET404 insufficient. Browser/preview/CDP closed;836 already requests Pi audit14:55:32 or narrow read-only authorization. ALL app-backend operations/captures/deploy/repair PAUSED pending incident review; only LOCAL sentinel fail-closed test without backend permitted, superseding prior capture-correction allowance. Five chat404 pre-conversation-write guard is limited-path evidence, not disclosure-write assurance.
- 2026-10-23 15:01:27 CDT — Nova15:01:17 second LOCAL-only failure captured once (`nova:main:2026-10-23T15:01:17:ci-second-local-sentinel-failure-stop`): local GET+PATCH418/count2; no real-app reopen/further app-backend traffic reported. Browser/sentinel closed. STOP ALL cycles/runtime/source/QA/deploy;836 edited requests incident audit+interception repair authorization, await explicit disposition. Earlier local allowance superseded; no root-cause/incapability or remote-DB no-write assurance.
