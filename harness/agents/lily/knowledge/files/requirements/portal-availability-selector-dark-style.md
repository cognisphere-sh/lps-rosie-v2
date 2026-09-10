# Keep the Nursery Portal availability selector readable in the dark portal

- Status: routed — styling may proceed; vocabulary mapping awaits Bhoumik contract
- Route: nova
- Raised: 2026-08-30 by Chris (via nova handoff)
- Updated: 2026-09-01

## Problem

Chris says the Nursery Portal's plant-status choices are the correct set, but its selector opens as a bright native dropdown against the dark portal. It is visually jarring and harder to scan; the control should be compact and readable in the portal rather than looking like a browser default.

## Evidence

- 2026-08-30 feedback log, **Portal availability statuses** (via Nova handoff): Chris identified the portal's five choices as canonical and flagged the white/native selector.
- Current app audit: the portal's shared selector reads and writes the five `availability_request_items` answer values; its visible styled shell overlays a native `<select>`, whose opened menu is browser-white.

## What it should do

- Replace or style the interaction so the opened choice surface is compact, dark-portal readable, keyboard and touch usable, and clearly shows the current selection.
- Preserve current saved behavior until Bhoumik supplies the approved Request-status mapping. Chris’s 2026-09-01 authoritative Request vocabulary supersedes the prior five-label list, but its Pending/legacy-value migration and saved actions are structural work in `availability-status-model-parity`.
- Once that contract exists, render the exact approved Plant Status Request vocabulary and its specified order; do not independently rename or map saved values in this UI slice.
- Reuse the approved answer behavior attached to each choice, including any follow-up fields.

## Acceptance criteria

- A nursery user opening a line's status control sees a dark/readable, compact choice surface rather than a bright native browser menu.
- Before the structural contract lands, selecting a current choice produces the same existing saved result; the styling change does not rename or remap it.
- After Bhoumik’s contract lands, the visible Request choices, their order, saved action and accessible current-value meaning exactly match that approved mapping.
- The control can be operated by keyboard and touch, identifies its current value to assistive technology, and remains usable at mobile sizes.

## Out of scope

- Changing stored status values, availability-request workflow, supplier permissions, or follow-up answer fields.
- Defining or migrating the authoritative Plant Status Request vocabulary; that is staged for Bhoumik in `availability-status-model-parity`.
- Making LPS Ops job-line statuses claim to be these supplier answer statuses.

## Assumptions

- The 2026-08-30 Portal vocabulary is superseded where it conflicts with Chris’s 2026-09-01 authoritative Request set; Nova waits for Bhoumik’s saved-value mapping before changing labels.
- A custom accessible picker is acceptable if native option menus cannot be reliably themed across browsers.

## Open questions

- **Bhoumik:** Provide Nova the approved Request-status values, order, legacy mapping and permitted actions before any vocabulary change.

## Handoff log

- 2026-08-30 — routed to Nova: portal-only selector styling and then-current option/label preservation.
- 2026-09-01 — Chris’s later authoritative Request/Order vocabulary conflicts with the prior Portal labels. Styling remains a Nova slice; label/action mapping is held for Bhoumik’s structural contract.
