# Make Plant Search controls read as one toolbar

- Status: routed
- Route: nova
- Raised: 2026-09-03 by Chris (via Nova handoff; message 548 / photo 548)
- Updated: 2026-09-03

## Problem

The visible Plant Search Size, Cultivar, Supplier type, and State controls, plus Filters, look awkward beside the Search field rather than like parts of one coherent toolbar. The existing responsive filter behavior is right; this is a visual correction so the controls scan and align as a single working surface.

## Evidence

- 2026-09-03 feedback log, **Plant Search toolbar visual unity**: Chris identified the Size, Cultivar, Supplier type, State dropdowns and Filters button as awkward beside Search in message 548 / photo 548.
- `plant-search-toolbar-consolidation` already defines the visible controls, their responsive content-aware folding, and their query/state behavior. This correction is limited to the shared visual treatment of that toolbar.

## What it should do

Make the visible Plant Search Search field, selectors, and Filters control look and sit as one coherent toolbar. Match their height, border treatment, corner radius, background, vertical alignment, internal spacing, gaps, and typography so adjacent controls have a deliberate, consistent rhythm.

Keep the existing wide and constrained layouts: wide desktop shows Search, Size, Cultivar, Supplier type, State, and Filters; constrained desktop and mobile fold without changing the established visible order or moving state/query logic. Preserve the live content-aware folding decision, saved layouts, result behavior, and all current control meanings.

Before deployment, pass a real-browser visual review of this correction at wide desktop, constrained desktop, and 320px, 390px, and 480px phone viewports. Review the toolbar both in its applicable folded and unfolded states and correct visual failures before release.

## Acceptance criteria

- On wide desktop, Search, Size, Cultivar, Supplier type, State, and Filters have a visibly shared control height, border weight/color, radius, background, vertical alignment, typography, and intentional spacing; none looks like a mismatched add-on.
- The same unified treatment holds in the constrained desktop and mobile toolbar layouts for the controls that remain visible.
- The toolbar remains one coherent row wherever the existing layout specifies one, with no new wrapping, clipping, overlap, or horizontal page/toolbar scrolling.
- Existing responsive, content-aware folding still occurs from the actual available toolbar/container budget; this correction does not introduce a fixed-width breakpoint or change which controls fold.
- Existing Search/filter query and selected state, Cultivar behavior, result summary, saved layouts, table behavior, and all filters’ meanings are unchanged.
- In a real browser, visual QA passes at wide desktop, constrained desktop, 320px, 390px, and 480px, covering each applicable folded/unfolded toolbar state and checking alignment, spacing, hierarchy, truncation, control placement, and usable targets.
- Visual QA evidence records the viewport/state and pass/fail findings; any visual failure is corrected and re-reviewed before deploy.

## Out of scope

- Changing Plant Search filters, options, filter/query semantics, results, saved layouts, table layout, data, or API behavior.
- Changing the established responsive folding rules or adding controls.
- A broader redesign of Plant Search or other pages.

## Assumptions

- “Match Search” means the adjacent visible selector and Filters chrome should read as one toolbar with the existing Search field, not that every control must have identical width.
- The requirement complements, rather than supersedes, `plant-search-toolbar-consolidation`.

## Open questions

- None.

## Handoff log

- 2026-09-03 — Routed to Nova as a UI-only visual correction. Require real-browser visual QA at wide/constrained desktop and 320px, 390px, and 480px before deployment.
- 2026-09-03 — Nova accepted: implementing as an isolated Plant toolbar-chrome correction with technical review plus the new real-browser visual gate before deployment.
