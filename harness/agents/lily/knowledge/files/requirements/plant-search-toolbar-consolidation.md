# Put Plant Search filters in one compact toolbar

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (approved via Nova)
- Updated: 2026-08-31

## Problem

Plant Search repeats filtering work between its toolbar and table headers, using space that should stay available for scanning plants. Chris’s final direction keeps the four routine selectors visible in a compact one-line row and moves every other refinement to one advanced surface.

## Evidence

- 2026-08-30 feedback log, **Plant Search toolbar consolidation**: Chris’s message 402 set the wide-desktop layout; message 422 / `photo_421.jpg` began responsive refinement; final message 428 / `photo_428.jpg` supersedes the compact mobile/constrained layout.
- App review, `/plants`: toolbar filters and table-header filters currently overlap; Cultivar’s toolbar selection shares state with the existing column filter.

## What it should do

Plant Search always keeps the broad **Plant Search** input visible. City is removed entirely. On wide desktop, its compact visible row is: **Plant Search**, **Size**, **Cultivar**, **Supplier type**, **State**, an icon-only advanced **Filters** control, the exact live result summary, and the existing Notifications/end action. The Search input tracks the **live** Company/supplier panel width, not a fixed 900px assumption or flex-filled width; the four selectors and Filters sit immediately after it. Reuse the live/shared width where practical so the two do not drift.

On mobile and whenever the actual desktop workspace container is constrained—including by expanded navigation, open chat, the current resizable Company panel width, or the current result-summary budget—the visible toolbar is exactly: **Plant Search**, **Size**, **Supplier type**, and the icon-only **Filters** control. Cultivar and State move inside Filters. They return to the wide-desktop row only when the actual available room returns. This mobile/constrained layout must fit a 390px viewport without wrapping, clipping, or horizontal toolbar/page scrolling.

Make visible Size and Supplier type controls compact and content-sized, reducing dead horizontal space without compromising readability or 44px usable targets. Do not create duplicate accessible Size or Supplier type controls: each is represented once in its current visible or folded location. Cultivar retains its approved clear open/closed multi-select toggle and shared selection behavior wherever it is rendered.

The icon-only Filters surface always contains Cultivar, State, and every other current table-header filter: company/name, stock, and dimension refinements (including Price, Height, Width, and Caliper). It offers **Clear all**. On wide desktop it must not duplicate Size, Cultivar, Supplier type, or State; on mobile/constrained layouts it must not duplicate the visible Size or Supplier type controls. Its controls and panels are content-sized rather than unnecessarily wide.

Table headers retain labels, sorting, and all existing table semantics, but no filtering control. The result summary is exactly `<Companies> Companies: <shown>/<total> Plants` — for example, `17 Companies: 47/47 Plants`. Preserve Plant Search query/filter meaning, result behavior, and API behavior except that City is no longer a Plant Search filter.

## Acceptance criteria

- On wide desktop, one responsive row contains Search · Size · Cultivar · Supplier type · State · icon-only advanced Filters · exact results summary · existing Notifications/end action, without a second toolbar row.
- The wide-desktop Search input tracks the live Company/supplier panel width rather than flex-filling or assuming a fixed desktop width; Size, Cultivar, Supplier type, State, and Filters begin immediately after it. Use the live/shared width where practical so these widths do not drift.
- The toolbar folds to the compact layout whenever its actual container, current Company-panel width, and current result-summary/action budget cannot fit the wide row; it does not force a wide layout at 900px, clip, or scroll horizontally. It automatically restores the wide row only when that live budget fits.
- On mobile and constrained desktop, the visible order is exactly Search · Size · Supplier type · icon-only Filters. Cultivar and State are inside Filters; City is absent and no longer affects results.
- The mobile/constrained toolbar fits a 390px viewport without wrapping, clipping, or horizontal toolbar/page scrolling. Cultivar and State automatically return to the wide-desktop row when room returns.
- Visible Size and Supplier type dropdowns are compact/content-sized, reduce dead horizontal space, and preserve readability and 44px usable interactive targets. Neither is duplicated as an accessible control inside Filters while visible.
- The icon-only Filters control has an accessible name, tooltip, useful expanded state, and a 44px usable target.
- Filters always contains Cultivar, State, every other current table-header refinement—including company/name, stock, Price, Height, Width, and Caliper—and Clear all. It does not duplicate Size or Supplier type while those remain visible, or duplicate Cultivar/State on wide desktop.
- Advanced panels and dropdowns size to their content and available viewport rather than using oversized fixed widths.
- Cultivar preserves selections, exposes open/closed state, returns focus on close, and adds no Done/Apply step; its existing query/filter behavior remains unchanged.
- Headers retain labels, sorting, and existing table semantics, but render no filter input, dropdown, or other filtering control.
- The live summary uses exactly `<Companies> Companies: <shown>/<total> Plants`; with 17 companies and all 47 matching plants shown it reads `17 Companies: 47/47 Plants`.
- Apart from City’s removal, existing query/filter meanings, matching, grouping, totals, pagination, results, sort behavior, and API behavior are unchanged. Clear all restores the unfiltered state for the remaining filters.

## Out of scope

- Changes to plant, supplier, or location data; City data itself; Plant Search API contracts; matching, grouping, sorting, pagination, or calculations.
- Adding new filters or changing broad Search or Cultivar semantics.
- Other screens.

## Assumptions

- On wide desktop, “every other” means every current Plant Search table-header refinement other than Size, Cultivar, Supplier type, and State. On mobile/constrained layouts, Cultivar and State are intentionally folded into the same advanced surface.
- City’s removal applies only to Plant Search.

## Open questions

- None.

## Handoff log

- 2026-08-30 — Drafted and routed after initial approved direction and `/plants` review.
- 2026-08-30 — Visual references `photo_393.jpg`, `photo_395.jpg`, and `photo_396.jpg` added; `photo_396.jpg` confirms compact, content-sized control chrome rather than a scope change.
- 2026-08-30 — Chris’s Telegram message 402 set wide desktop: Size, Cultivar, Supplier type, and State stay visible; every other header filter moves to advanced Filters.
- 2026-08-30 — Chris’s responsive decision (Telegram message 422 / `photo_421.jpg`) introduced folding at narrower widths.
- 2026-08-30 — Chris’s follow-up Telegram message 428 / `photo_428.jpg` supersedes that compact layout: mobile/constrained order is Search · Size · Supplier type · Filters; Cultivar and State are inside Filters with company/name, stock, and dimension filters. Routed to Nova after the Supplier Category commit/restart; awaiting build confirmation.
- 2026-08-31 — Chris’s Telegram message 441 / `photo_441.jpg`: wide-desktop Search matches the Company/supplier table-column width and does not flex-fill; its adjacent selectors/Filters begin immediately after it.
- 2026-08-31 — Nova implementation clarification: the Company panel is resizable (200–480px), and long summaries cannot reliably fit at a fixed desktop width. Search tracks the live panel width while the wide row fits; otherwise use compact layout. Correction routed to Nova; awaiting build confirmation.
