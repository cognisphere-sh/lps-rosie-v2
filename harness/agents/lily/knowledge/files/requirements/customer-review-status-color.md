# Make approved customer-review availability statuses easy to scan in web chat

- Status: drafted · blocked by availability-status-model-parity
- Route: nova
- Raised: 2026-09-09 by Chris (via Rosie handoff)
- Updated: 2026-09-09

## Problem

While reviewing copy-ready availability/quote text in the LPS web chat, Chris cannot quickly scan line statuses because every status is rendered in the same neutral text. He asked to “use the color coding in the status font color.” The plant and Request/Job status domains are still not updated to Chris’s authoritative model, so a UI-only interpretation must not invent or freeze a mapping before the staged contract is approved.

## Evidence

- 2026-09-09 feedback log, **Customer-review status color**: Chris requested color coding in the customer-review status font.
- 2026-09-09 feedback log, **Awaiting confirmation correction**: Chris clarified that **Awaiting confirmation** is an internal note, not a status; it must not appear in customer-review status rendering or color mapping.
- `availability-status-model-parity` is the staged authoritative decision for the distinct Request and Order status domains. Current chat supports only basic Markdown and no font-color syntax.

## What it should do

After Bhoumik’s approved availability-status contract supplies the customer-review status meaning and mapping, render an explicit structured customer-review status field in LPS web chat with its matching semantic app color. Keep the full status label visible; color is a scan aid, not the only meaning.

The same message’s Copy action must remain ordinary, customer-ready plain text. It must include the explicit status label and must not rely on color, special markup, or an app-only visual cue to communicate availability.

Apply this only to an explicit structured status field in copy-ready customer-review output. Do not recolor ordinary occurrences of status words in chat conversation, internal notes, quotations, or URLs.

## Acceptance criteria

- The implementation consumes only an approved customer-review mapping derived from the authoritative availability-status contract; it does not reinterpret existing legacy/internal status values as customer-review facts.
- A recognized structured customer-review status field visibly uses its approved semantic color while retaining its full visible text and accessible text name.
- Copying the message produces plain text containing each status label, with no required color, HTML, or app-only marker.
- **Awaiting confirmation** is not treated as a status, displayed as a customer-review status, or included in a status color mapping.
- Unstructured conversational references to availability and internal notes remain normal text.
- Existing Markdown rendering, links, action buttons, and copy behavior remain intact.
- The treatment is verified in the real web chat at desktop and mobile widths under the visual QA gate.

## Out of scope

- Changing stored availability status values, transitions, supplier-facing vocabulary, or the Request/Order status model.
- Treating internal notes as statuses.
- Automatically exposing availability to a customer workspace or sending a customer message.
- Making color work in an external pasted message.

## Assumptions

- This applies to the in-app chat preview Chris is reviewing, not to the pasted plain-text message.
- A safe renderer can be designed after the approved status contract, but Nova must not select labels or colors that imply a currently missing durable model.

## Open questions

- **Bhoumik:** The staged `availability-status-model-parity` requirement must define the authoritative Request and Order status values, their presentation relationship to customer review, and the approved mapping before this UI is released.

## Handoff log

- 2026-09-09 — initially routed to Nova as a web-chat UI/accessibility and copy-preservation refinement.
- 2026-09-09 — Chris corrected the scope: Awaiting confirmation is an internal note, not a status. Nova must hold/revise the UI scope; no presentation mapping may paper over the still-unapproved status contract.
- 2026-09-09 — Nova confirmed implementation is stopped/held, Awaiting confirmation is removed from status treatment, and no color mapping will ship before Bhoumik’s authoritative status contract.
