# Keep related Job lines together without changing the work

- Status: staged — awaiting Bhoumik's supported persistence/ordering decision; Telegram364 delivered by Lily main. No build or reorder performed.
- Route: bhoumik
- Raised: 2026-10-05 by Chris (via Nova, JR82 webchat81)
- Updated: 2026-10-05 12:07:20 CDT

## Problem

Chris wants two separately priced/requested Whale Tongue sizes next to each other at the existing smaller-size line's position. Current canonical Job line order follows stable item identity, and Nova's read-only audit finds no supported way to persist this specific move while preserving all identities and other line order. A display-only workaround would not provide durable ordering across reloads and readers.

## Evidence

- 2026-10-05 12:00:48 CDT — Chris JR82 webchat81, relayed by Nova12:02:17: existing line750, Whale Tongue 3×5G, and new line1137, 3×15G, should be adjacent at the existing5G position; move1137 immediately after750, preserve all other relative order/IDs/prices/quantities/data, no merge/recreate. Source handle `nova:chris:jr-82:webchat:81:2026-10-05T12:00:48-05:00` is explicitly a relayed summary.
- 2026-10-05 12:06:51 CDT — Nova completed the existing-owner read-only audit: canonical ID-ascending order, unchanged API/client mapping, no supported persistent line-order/move capability. Existing quote/snapshot readers also use ID order. Owner evidence: `../nova/workspace/threads/main/tasks/jr82-line-order-audit/notes.md`; raw handle `nova:main:2026-10-05T12:06:51-05:00:jr82-line-order-audit`. Lily has not independently queried/audited it. Current records remain unchanged.

## What it should do

Provide a Bhoumik-approved supported way to retain a specific relative placement within one Job without changing the work itself. Start from the existing canonical ID-ascending order, not plant-name sorting or a guessed visual order. For JR82, move only the existing15G Whale Tongue line immediately after the existing5G line at the latter's current position; all other lines retain their relative order.

Keep the two lines separate, with stable identities and all content, quantities, prices, candidate/supplier bindings and history intact. The resulting canonical order must survive reloads and API reads and safely coexist with other edits or appended lines. Changing position alone must not act as a quantity, sourcing-selection, availability/status, pricing, demand or customer-send event.

This stages the business outcome and necessary supported persistence path, not Nova's proposed architecture. No general drag/drop UI is requested or authorized by this case.

## Acceptance criteria

- Starting from JR82's existing canonical baseline, line750 remains at the5G position and line1137 appears immediately after it; removing1137 from before/after comparisons leaves every other line in exactly its prior relative order. The two Whale Tongue sizes remain separate lines.
- Reopening/reloading the Job and reading its canonical line list returns the approved new relative order, not a temporary local display workaround. Other Jobs and Jobs without an authorized move retain their existing baseline order.
- Before/after comparison confirms stable identities and unchanged plant/request evidence, size, quantities, prices, totals, notes, candidate bindings, stock/status values and prior history. No merge, recreation, deletion/reinsertion or ID substitution occurs.
- A position-only operation does not invoke business candidate/status synchronization, send a supplier/customer message, change demand or trigger a sourcing/pricing workflow.
- Concurrent line-content edits are preserved and concurrent moves/appends cannot silently lose/duplicate lines, discard edits or overwrite a later ordering decision. Any conflict has a clear safe outcome, rather than reporting success against a stale baseline. Append placement follows Bhoumik's explicit contract.
- Displayed user sorts are distinguished from canonical order; the scoped case move does not silently reset saved presentation preferences or replace canonical placement with alphabetical sorting. How an active user sort displays the moved lines is stated in the approved contract, not inferred.
- Bhoumik explicitly determines inactive-line handling, customer/quote ordering, existing versus future snapshot behavior, and position-change timestamp/audit semantics before implementation. Existing evidence/snapshots are not silently rewritten, and adopting line order does not accidentally redefine business activity/update-time meaning.
- The supported path and these checks are verified by the responsible owner before Rosie applies the origin-approved JR82 move. Neither staging nor source changes alone count as the completed reorder.

## Out of scope

- A generalized row drag/drop editor, new sorting controls, or broad table-preference feature.
- Reordering other Jobs, regrouping plants, moving the5G line to a new group/location, alphabetical fallback, whole-list reordering by inferred intent, or hardcoded JR82/line-ID behavior.
- New fields/values for money, quantities, statuses, stock, candidate selection or request evidence; changed send/customer-publication permissions.
- Identity replacement, merging, deletion/reinsertion, recreation, demand duplication, loss of bindings/history, or retroactive rewrite of quote/snapshot evidence.
- Approving Nova's architecture recommendation, schema design, migration or implementation; work remains Bhoumik-owned/staged.
- Reopening unrelated held table/header/AR UI work or treating saved column ordering as persisted row order.

## Assumptions

- This is one explicit relative move, not permission for general grouping or a new ordering workflow across all Jobs.
- The reported canonical ID-ascending order is the initial baseline; no Lily-created full-line sequence or guessed current-user sort is supplied.
- Chris approved the desired JR82 placement, not new DB/workflow design. Origin approval and case communications stay on jr82.

## Open questions

- **Bhoumik:** approve/define the minimal supported persistent-order path and its concurrency/append contract; decide inactive-line treatment, canonical versus active user-sort behavior, customer/quote/snapshot ordering, and timestamp/audit semantics. These are design/workflow gates, not another Chris diagnostic question.
- **Responsible owner after Bhoumik's decision:** verify the supported path and preservation criteria, then coordinate the already-approved case action on jr82. No Nova implementation or workaround is assigned by this requirement.

## Handoff log

- 2026-10-05 12:02:39 CDT — Specific desired outcome captured/watch pending Nova's existing investigation; no Lily duplicate audit/action or UI build route.
- 2026-10-05 12:07:12 CDT — Parent supplied Nova's12:06:51 completed finding; existing supported APIs cannot safely persist the desired move. Promoted to focused Bhoumik-staged requirement, no implementation design adopted.
- 2026-10-05 12:07:20 CDT — Lily main confirms Telegram364 delivered Bhoumik the staged decision: current ID ordering/no supported persistent move, records unchanged, no UI build. Requirement remains staged awaiting that decision; no second question, builder assignment or Lily task external send.
