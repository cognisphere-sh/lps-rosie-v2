# Keep empty Shared note cells quiet but easy to edit

- Status: routed — accepted separately by Nova; BLOCKED with serialized operator-baseline preservation, no implementation
- Route: nova
- Raised: 2026-09-17 by Chris (Telegram648/photo648, via Nova)
- Updated: 2026-09-17T12:49:16-05:00
- Related: `sourcing-note-disclosure` — separate internal-note behavior, not applied here

## Problem

Repeated “Add a shared note…” text clutters the Job table even when there is nothing to tell the customer. Chris wants an empty cell to look subtly editable without repeating those words on every row. Existing actual Shared notes must remain visible.

## Evidence

- Feedback **Quiet empty Shared note cells**: Chris648, verbatim via Nova12:38:19: “remove Add a shared note, just contract the cell to show you can click in an add note”.
- Directly inspected photo648 shows the empty placeholder repeated alongside a populated “5 gallon” note. Reference retained at `workspace/threads/main/files/shared-note-empty-cell-reference-648.jpg` on Lily.
- Existing operator-table audit for `sourcing-note-disclosure` already confirms a separate inline Shared note editor, reused in focused Jobs, expanded All Jobs and the operator's customer-detail request cards. Current uncommitted editor/table work must be preserved. No new broad audit or data query is needed for this slice.

## What it should do

1. Remove the repeated visible “Add a shared note…” placeholder from empty Shared note cells. Use a subtle, discoverable empty-cell affordance showing that it can be activated; blank must not look disabled or inaccessible.
2. Keep a meaningful accessible name such as “Add shared note for [plant]”, visible focus and deliberate mouse/touch/keyboard access. The active empty-cell target is at least44px; the visible decoration can stay quiet. Do not depend on hover alone.
3. Activation uses the existing inline note editor and existing save/cancel/error/refresh behavior, not the sourcing detail popup/history flow. Preserve customer visibility and existing write permissions. Opening without editing does not create or clear a note.
4. Populated Shared notes remain visible exactly as authored with their current editor behavior. Null/empty/whitespace-only content may present as empty without trimming or changing the stored value merely to render it. No note-content rewrite, audience change, move or automatic copy.
5. Apply the narrow empty-cell presentation consistently in the existing reused operator Request items table. Preserve selection, table order/resize/scroll, row context and neighboring editors. No blanket Orders/portal/public/customer-output change.

## Acceptance criteria

- Empty rows no longer repeat “Add a shared note…” onscreen, but a mouse, keyboard and touch user can discover and activate each empty cell. Accessible Add shared note identity and clear focus remain; target is at least44px.
- A populated example such as “5 gallon” remains visible and unchanged. Empty/null/whitespace cases render quietly without background data writes or false populated state.
- Existing inline add/edit/save/cancel/blur/Tab/error paths work and stay on the intended row. No sourcing icon, full-history interaction, hidden populated text, accidental selection/deletion or changed customer-sharing permission is introduced.
- Focused Jobs, expanded All Jobs and operator customer-detail request cards preserve current operator edits and saved layout choices. No width policy or global placeholder/editor redesign is inferred from this request.
- Review at320/390/480px and desktop includes empty, focused, editing/error and populated neighboring rows. Independent technical and rendered visual QA may share the isolated candidate/review session with sourcing disclosure but reports this slice separately. No clipped targets, new page overflow or loss of readability; fix/recheck failures before release.

## Out of scope

- Shared note icon-only conversion, hiding populated notes, sourcing/history behavior, column-width redesign, original customer evidence changes or global note-editor changes.
- Data/schema/API/workflow/permission changes, note cleanup/migration, customer/supplier contact or changed public output.
- Any delay or scope expansion of the separately approved sourcing-history UI; Nova may serialize the same-file changes without making this polish a new dependency.

## Separate workflow boundary

- 2026-09-17T12:49:16-05:00 — Chris657's proposed supplier-status/plant-note versus private-pricing routing is separately staged for Bhoumik by task `supplier-note-customer-routing`. It does not authorize automatic content copying/classification, change this empty-cell UI scope, or release its current baseline blocker. No data/skill/seed change is bundled here.

## Assumptions

- “contract the cell” may mean compact it or contrast it. The accompanying intent and Nova acknowledgment support a subtle clickable empty-cell cue, not a prescribed width reduction. Preserve current sizing/layout unless the quiet affordance itself needs ordinary fit adjustment; do not ask Chris another wording question.
- In the sourcing requirement, “Shared unchanged” means sourcing work leaves Shared content, populated rendering, audience and editing intact. This independently approved empty-placeholder polish is the only separate exception.

## Handoff log

- 2026-09-17T12:39:22-05:00 — Captured exact648 and inspected reference; reused the bounded existing source audit. Successfully delivered full requirement to Nova main, subject **Separate UI: quiet empty Shared note cell, populated notes unchanged**. Linked to but not a prerequisite for sourcing disclosure; no sourcing/history behavior applied to Shared. No Lily app/data/skill edits or Telegram.
- 2026-09-17T12:42:45-05:00 — Nova12:41:07 accepts this separate slice with the same serial owner, but current operator baseline is BLOCKED before implementation; Nova651 already requested preservation/commit, no duplicate ask. Parent Telegram346 communicated both scopes and not-live status to Chris. No tests, edits or deployment claimed.
