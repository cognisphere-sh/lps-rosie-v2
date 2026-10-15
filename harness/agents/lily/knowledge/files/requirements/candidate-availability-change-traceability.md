# Explain who changed an offered availability value without guessing

- Status: staged — parent verified Bhoumik notification Telegram373; proposal unapproved
- Route: bhoumik (database/workflow observability); no Nova build assignment
- Raised: 2026-10-14 by Lily from Nova/Rosie incident evidence
- Updated: 2026-10-14 05:10:01 CDT

## Problem

Chris and Rosie cannot confidently explain or recover an offered quantity when its saved value changes after supplier submission without durable field-change evidence. AR88/JR116 has a documented submitted Stemodia quantity30 followed by saved0, but the available records do not establish the exact write, actor or intent. Answer/submission times remained unchanged, and an empty Job-line history does not account for candidate-only writes.

The operational blocker is now **owner-reported resolved through explicit Chris approval**, not reconstructed authorship: Rosie restored availability30 and created verified Order18. The earlier writer/payload remains unknown. This is a recovery/accountability evidence gap, not an accusation or a further stock-correction request. October10's separate JR111 history question also lacked durable candidate history; the incidents are not assumed to share a cause.

## Evidence

- `nova:main:2026-10-14T04:54:48-05:00:ar88-c2048-quantity-audit`: Nova's completed read-only owner report establishes snapshots30→0 for candidate2048/line1318, unchanged answer/submission times and two successful JR116 table PATCH requests09:25:51/56UTC. The second aligns with the saved update second; no request body/item identity/authenticated actor/intent was recovered. Matching times are not attribution.
- Owner report `../nova/workspace/threads/main/tasks/ar88-c2048-quantity-audit/notes.md`: installed/source selected-line editing can change the candidate without advancing answer/submission times; durable candidate field audit is absent. Empty scoped Job changelog does not identify or exonerate a writer. Possible status/quantity interactions are context, not actual recovered payloads or cause. Later0134 commit is after the incident and has no backfill; no deployed-cause or test-mutation claim.
- `nova:main:2026-10-10T07:47:36-05:00:jr111-stemodia-history`: separate18/36/36 ask/Job/offer history unresolved. Supplier ask can legitimately differ from current Job demand; original classification is mutable and a general update time is not field history. This supports the recurring evidence gap, not corruption or a common cause.
- Existing `availability-last-updated-semantics` owns freshness/overwrite meaning and explicitly excludes a timeline of every individual edit. `availability-response-change-management` owns factual responses/manual business decisions, not edit alerts. `ar-submitted-evidence-enrichment` owns submission/reset/enrichment policy. This slice asks only for the evidence needed to explain material availability writes; it changes none of those policies.

- `nova:main:2026-10-14T05:09:48-05:00:ar88-jr116-owner-resolution`: Nova relays Rosie05:09:40. Chris explicitly approved MCQ JR116 message14 at05:08:38CDT to restore submitted Stemodia30 and create the9-line/$975.75 Order. Rosie reports guarded candidate2048 availability30 restoration and verified Order18 New,9lines/65units/$975.75; JobCommitted. This resolves the operational case by human authority, not historical attribution or prior automatic restoration permission. Lily did not independently verify or operate. Exact past writer/payload remains unknown; prospective history proposal is unchanged/unapproved.

## What it should do — proposal, not approved behavior

For the minimal Bhoumik-approved scope of changes affecting an offered availability quantity/status, retain retrievable evidence of the affected offer/request/Job association, changed field, old/new values, time, and authenticated actor or process/source where genuinely known. Include edits reached through the selected Job line as well as direct offer edits; a candidate-only write must not disappear from accountable recovery merely because Job history is empty.

Keep the evidence of **a supplier answering/submitting at a time** distinct from **a later saved-field change**. Readers must not infer that an unchanged answer/submission time proves today's saved quantity is still the supplier's submitted fact. Source/provenance must be supported, with unavailable actor/intent/history explicitly unknown rather than guessed. Current supplier ask or original/selected classification alone must not be presented as immutable intake evidence.

Use only the necessary business values and attribution/provenance, within existing authorized internal access. No indiscriminate payload collection, authentication secrets or automatic broader disclosure. Bhoumik chooses the smallest viable scope and access/retention decision before implementation; this requirement does not invent a global audit model or retention period.

## Acceptance criteria

- For an owner-approved controlled material availability edit, an authorized reviewer can retrieve the actual old/new quantity or status, affected offer and relevant request/Job context, change time, and known actor/process plus originating source. An edit through the selected Job line is explainable even when it leaves supplier answer/submission times unchanged.
- If several material changes occur, the retained evidence associates each actual change with its own values/context; it does not misattribute a later edit to an earlier supplier submission or unrelated same-second request. Unknown attribution remains unknown, not an IP/update-time guess.
- The reviewer can distinguish genuine supplier answer/submission events from later LPS/system writes. No new answer/submission event, permission or completion guarantee is fabricated for a field edit.
- Existing historical gaps are clearly identified. No backfilled actor, reconstructed original ask/classification or guaranteed recovery of AR88/JR116 or JR111 is claimed without actual evidence.
- Evidence retention/access contains only the approved minimal business/attribution information; no tokens, credentials, full request bodies by default, or exposure of internal/private evidence to suppliers/customers.
- Capturing/retrieving the evidence causes no quantity repair, selection, supplier-request rewrite, answer/submission reset, stock assertion, notification, customer update, Order or Job-stage transition. Owner verification under approved scope is required before shipment; this proposal authorizes no live tests.

## Out of scope

- New request-payload hunt, source/DB/log audit, browser probes or incident tests; attribution/blame, test-cause/spurious-edit labels, automatic rollback or repair.
- A general every-field timeline, new alert/review/override queue, automatic conflict-resolution engine, specific logging architecture, immutable-original redesign or new global retention mandate.
- Freshness/submission/reset rules, quantity defaults, fulfilment-coverage semantics, supplier stock inference, customer publication or pipeline resumption.
- Nova implementation, Lily code/DB/SOP edits or new human diagnostic question. Rosie JR116 already owns the existing operator/Chris intent/evidence question before any correction.

## Assumptions

- Repeated missing history plus the current recovery block is sufficient to propose this focused need without a new explicit Chris feature request. It is not approval to implement.
- Start with material availability quantity/status writes; Bhoumik decides whether any additional ask/selection/original-provenance context is necessary, rather than extending automatically to all fields.

## Open decisions

- **Bhoumik:** approve or decline this distinct minimal observability need, choose its starting scope and necessary provenance/access/retention limits, and identify the implementation owner if approved. No particular audit schema, architecture or supplier-edit policy is selected.
- **Historical evidence limit:** exact prior AR88/JR116 writer, payload and intent remain unresolved despite owner-reported approved recovery/Order18 creation. No new diagnostic question or continued payload hunt is requested; proposed evidence improvements do not depend on an invented cause.

## Handoff log

- 2026-10-14 04:55:15 CDT — Staged unapproved proposal using Nova's completed owner report and October10 history-gap evidence; no duplicate audit, repair, builder route, SOP/code changes or external send. Parent notification was pending.
- 2026-10-14 04:59:24 CDT — Parent verifies actual Telegram373 receipt for Bhoumik's minimal material quantity/status history proposal. Remains staged and unapproved; notification is not diagnosis, actor/current-stock claim, restoration or history implementation. No additional questions/payload hunt or Nova assignment.
- 2026-10-14 05:10:01 CDT — Captured owner-reported explicit Chris approval and completed recovery/Order18 creation. Operational blocker resolved; exact historical writer/payload unknown, prospective audit need still staged B/unapproved. No cancellation, history shipment, global repair authority or Lily action inferred; Nova read-only task closed.
