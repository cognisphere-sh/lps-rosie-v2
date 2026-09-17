# Make the focused Job plant table tighter and easier to scan

- Status: routed — BLOCKED on preserved/committed operator baseline; no candidate, code or tests started
- Route: nova
- Raised: 2026-09-16 by Chris (Telegram626/photo626, via Nova)
- Updated: 2026-09-16T09:35:07-05:00
- Scope: approved narrow operator Request items table UI; not the separate focused-header mockup

## Problem

Chris's JR-55 table spends width on Demand and the plant-name area while original-request text repeats beneath each plant. Shared note sits beyond the prices instead of beside the status it explains. He wants faster scanning without losing the original request, changing the offered plant, or making editing harder.

## Evidence

- Feedback **Make focused Job table tighter**, 2026-09-16, contains Chris's exact raw text. Canonical Telegram626 was recovered by Nova from ingestion2026-09-16T09:22:03.764-05:00; original sent time was not retained.
- Chris: “If the word Demand is cause the column to be wide Use \"Req\" for requested. In plant name the Common name - ' variety' should be the top and bold we can nest the scientific name below. The Requested: takes up space.  The hover over is sufficient we can  narrow that column 1/6 or a little. Shared note should come after status”.
- Directly reviewed photo626: JR-55 desktop Request items, with marked Demand label, Plant Name width and Shared note relocation. Reference retained at `workspace/threads/main/files/focused-jr-table-reference-626.jpg` on Lily; original `plugins/telegram/inbox/photo_626.jpg` on Nova. SHA256 `ba2b62e6dffcae2379caf39c3e3629fe7a2e15b6024d950abad1baf67973c3b8`.
- Current operator source and app/schema docs reviewed, including the shared Job table, row reader and focused record. The table is also reused by All Jobs and operator customer request cards. Existing Requested-looking text is read-only customer evidence, not a second editable plant identity. Current Job rows expose one saved plant name, not separate common/cultivar/scientific parts or an authoritative selected-catalogue identity. Inventory having those parts is not itself a valid association.
- Current app contains unrelated operator edits. This request does not authorize replacing them or restoring an older UI snapshot. Source review is not live production verification.

## What it should do

1. Label the requested-quantity column **Req**. Keep an accessible explanation that it means requested quantity. Reduce unnecessary label/padding width where the full number and existing editing/touch targets remain usable; requested and available remain different facts.
2. Make the plant's primary display bold. Where an already-supported authoritative identity supplies real parts for this exact row, show **common name — 'cultivar/variety'** on top and scientific name quietly below. Show only parts actually present; avoid dangling separators, guessed values or an invented variety. With only the current unsplit saved name, show that exact name boldly and omit an unsupported scientific sub-line. Do not parse a free-text name, original request or sourcing notes into botanical fields, borrow a likely supplier match, or silently change which plant is being displayed.
3. Remove the persistent Requested/customer-evidence sub-line from the compact plant cell, not its information. Preserve the complete original request/customer-note text, including constraints and differences from the current plant, in clearly identified read-only detail available by hover **and** keyboard focus/activation **and** deliberate touch. Do not make native title/desktop hover the only path. A meaningful compact affordance must let a phone or keyboard user discover, read and dismiss it without starting a plant-name edit. Full long text must be readable rather than clipped; Escape/close returns focus predictably. Do not conflate this evidence with the current plant or edit it through the name editor.
4. Modestly narrow the plant area based on rendered fit, not an arbitrary ratio. Avoid reclaiming width only to waste it elsewhere, crowd essential controls or create excessive row height. Retain readable primary identity and accessible full-name detail for any truncation. Horizontal table scrolling remains supported; no stacked-table redesign is requested.
5. Place **Shared note immediately after Status and before Unit price**, in both headings and row cells. Desired visible order: Req · Avail · Size · Plant Name · Status · Shared note · Unit price · Total · Sourcing note, with existing optional selection/deletion controls at their edges. This is presentation only: Shared note remains customer-facing; Sourcing note remains internal; original customer evidence remains read-only. No note content, audience, permissions or automatic note-copy change.
6. Preserve existing name/size/quantity/price/status/note editing, save/error/cancel behavior, computed totals and summary, row selection/deletion where available, tab/shift-tab progression in the new visible order, and current Job/list/scroll context. Evidence detail must not hijack blur-save, keyboard movement or touch editing. Keep Orders, headers, chat and unrelated operator work unchanged.

## Acceptance criteria

- JR-55-style rows show Req, aligned requested/available quantities and full editable numbers with their unchanged meanings, including unknown versus zero available and missing prices.
- Shared note follows Status in every affected header/row; totals, status choices/tints and both note editors retain existing behavior and visibility rules. Tab and Shift-Tab follow the new visible order without skipped/stranded editors or lost values.
- Real structured parts, if already authoritatively available for a row, produce the requested hierarchy. Missing common name, cultivar or scientific name is handled honestly; a current one-name-only row retains its exact saved identity in bold, with no synthetic classification. Original requested and currently offered plants cannot be mixed.
- No persistent Requested evidence sub-line remains in the compact cell. The complete unchanged evidence—including non-Requested constraints held in the same text—is readable by pointer, keyboard and touch. Detail dismissal restores focus; opening it never saves or changes data or intercepts the ordinary name-edit action.
- Before/after captures demonstrate a modest, useful width reduction in the marked plant area at a comparable desktop width, with no arbitrary one-sixth-table rule, lost identity, awkward excessive wrapping, clipped controls or dead-width replacement. Req also uses only the width its number/editor genuinely needs.
- At 320px, 390px, 480px and a representative desktop width, table scrolling, long names/notes, empty/missing-name-part cases, detail open/closed, note/status editors and active inline edits remain usable. No new page-level overflow, off-screen uncloseable popovers or keyboard traps; existing focused touch targets are not reduced and a new touch-detail target is at least 44px.
- Regression-check reused operator All Jobs/customer request tables, with and without selection/deletion controls. A shared-table change must not alter their permissions, disclose internal notes to another audience or disturb unrelated layouts. Supplier AR/order/print/customer-public surfaces are outside the requested redesign.
- Independent technical review verifies behavior, accessibility, unchanged data/write boundaries, edit regression tests, type/build health and preservation of current operator changes. Separate independent **rendered visual QA** at 320/390/480 + desktop compares photo626 and this scope, retains screenshots and a pass/fail report, and blocks release until findings are fixed and rechecked. A static mockup or technical pass alone is insufficient.
- Builder reports exact implemented scope, any unsatisfied structured-name hierarchy, release evidence and limitations. The safe presentation slice can ship with an honest saved-name fallback, but fallback must not be reported as full common/cultivar/scientific completion.

## Out of scope

- Focused-header R3 or any new header/date/chat design; this is not approval of those mockups.
- Data/schema migrations, plant enrichment, catalogue matching/search/ranking changes, parsing/backfilling names, supplier selection, changes to requested or offered plant facts, or a new identity-mapping workflow.
- Price calculations, quantities, statuses/lifecycle, AR/order workflows, note content/audiences/permissions, supplier/customer contact and business-data edits.
- Global table redesign, removal of horizontal scrolling, unrelated operator edits or new skills/scripts.

## Assumptions

- “1/6 or a little” and the red marks mean a conservative/modest plant-width reduction, not “set the plant column to one-sixth of the table.” No exact ratio is imposed; compare actual fit and escalate only if a usable reduction cannot be made.
- “Hover over is sufficient” approves removing repeated visible evidence, not excluding phone/keyboard users from it. An accessible compact on-demand detail is the equivalent behavior.
- The saved-name fallback is authorized as the non-fabricating safe UI slice. Nova has confirmed the latest staged/current row reader still lacks authoritative botanical parts. Full common/cultivar/scientific hierarchy is therefore held for a separate Bhoumik decision about its authoritative source/association; no new schema, identity-mapping or sourcing workflow is designed or authorized by this requirement, and no database work is handed to Nova.

## Blockers

- **Preserved operator baseline — Bhoumik:** Nova stopped before changes on 2026-09-16T09:34:34-05:00. The 57 staged operator paths include current editing, focused header/record, customer-chat, totals/filter and list-card behavior absent from committed HEAD. An exact-HEAD build would omit current operator work. Nova asked Bhoumik in Telegram633 to commit the preserved current baseline; implementation and its technical/visual gates wait for that baseline decision. No candidate/code/tests yet; this is not a QA failure or a shipped change.
- **Full structured-name hierarchy — separate Bhoumik decision:** Current JR rows carry only the saved name, not authoritative botanical parts. Exact bold saved-name fallback remains the safe UI scope once the baseline blocker clears. Full hierarchy cannot be claimed complete or enabled by parsing/search/enrichment; any new source/association decision remains outside this Nova UI handoff.

## Handoff log

- 2026-09-16T09:27:56-05:00 — Captured exact feedback, inspected reference and latest operator source/docs, and routed the full narrow UI requirement to Nova main (successful agent-message delivery). Explicitly called out absent JR identity parts, saved-name fallback, independent technical/rendered release gates, existing operator edits and separation from header R3. Await Nova's scope/disposition and eventual release evidence; nothing is marked shipped. No Lily app/data/skill changes or external Telegram.
- 2026-09-16T09:35:07-05:00 — Parent relayed Nova09:34:34 stop before implementation: 57 staged operator paths must be preserved/committed; Bhoumik633 already has the baseline ask. Nova also confirmed no authoritative name parts in the latest reader. Status now routed/blocked, with safe saved-name fallback distinct from the held full hierarchy. Parent told Chris in Telegram338 what is requested and not live. No repeat external send or new schema/workflow handoff.
