# Keep Supplier Category badges clear of State

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (via nova handoff, Telegram message 426 / photo 426)
- Updated: 2026-08-30

## Problem

On the desktop Suppliers table, the **Wholesale Supplier** Category badge is wider than its column allowance. It runs into the adjacent State column, making the row look broken and reducing scanability of both category and state.

## Evidence

- 2026-08-30 feedback log, **Supplier Category badge overlap**: Chris’s annotated desktop Suppliers screenshot (Telegram message 426 / photo 426) shows the Wholesale Supplier badge overflowing the Category column and colliding with State.
- App review: Suppliers presents Category immediately before State, and Category is displayed as a badge.

## What it should do

Make the desktop Suppliers Category column reliably accommodate the longest normal category badge at its normal font and padding. Category badges stay on one line and have a clear visual gap before the State column; they must not clip, overlap, or obscure State.

Shorter category badges should remain compact rather than being stretched to fill the available space. Preserve the table’s existing State/header alignment, saved column width/order behavior, column picker semantics, and responsive horizontal-table behavior.

## Acceptance criteria

- On desktop Suppliers, **Wholesale Supplier** displays as a complete one-line Category badge at its normal type and padding, without clipping, wrapping, or overlap.
- A clear gap remains between the Category badge and the State cell in every visible supplier row.
- State values and the State header remain aligned with each other and unobscured by Category content.
- Short Category badges retain compact, content-sized appearance; they do not expand merely to occupy column space.
- Existing saved column widths and order, column-picker behavior, sorting, filtering, and row actions continue to work.
- The Suppliers table retains its current responsive horizontal scrolling/overflow behavior on constrained widths; this correction does not introduce page-level clipping or a separate layout mode.

## Out of scope

- Changing supplier categories, Category filter meanings, supplier data, or State behavior.
- Redesigning the Supplier table, its toolbar, or column-management controls.
- Changing Category badge presentation in other tables unless the same shared visual correction is necessary to prevent this exact defect there.

## Assumptions

- **Wholesale Supplier** is the longest normal Category badge that the Suppliers desktop table must accommodate.
- This is a UI-only sizing and spacing defect; no data or workflow decision is involved.

## Open questions

- None.

## Handoff log

- 2026-08-30 — Captured and routed to Nova as a UI-only Supplier table defect.
