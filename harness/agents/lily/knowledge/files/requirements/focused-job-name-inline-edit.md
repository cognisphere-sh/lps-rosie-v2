# Let Chris edit a focused Job name safely

- Status: routed
- Route: nova
- Raised: 2026-09-02 by Chris (via Nova handoff; Telegram message 542 / photo 542)
- Updated: 2026-09-25 12:09:06 CDT

## Current contract caveat

2026-09-25 12:05:28 — The atomic Job/Site-only interpretation below is historical, not verified against current naming policy. Rosie intake §4 and app identity source now support full Company | Slug Job names; Rosie's September25 12:09:06 bounded lookup found later case-specific named-site composites, but no exact general storage/fallback approval behind changelog5.26.0. General policy remains unresolved, not proven SOP drift. Preserve historical approval and existing data/editor behavior while reconciling; no new UI rewrite, composite parsing, rename or backfill is authorized. See `job-request-display-identity` current caveat and `workspace/threads/main/tasks/job-name-policy-reconciliation/notes.md`.

## Problem

Chris sees an incorrect or unhelpful Job name in the focused desktop identity and needs to correct the displayed Job name without changing the Job Request’s identity or its related work. The current system already supports changing the durable Job name, but the focused work surface does not make that correction clear or safe enough.

## Evidence

- 2026-09-02 — **Values-only identity and editable Job name**: Chris rejected literal identity labels in the desktop/focused strip and asked whether Job name can be edited.
- 2026-09-02 — audit: the established internal Job Request update path permits `job_requests.name`, trims text and writes empty text as null; it stamps parent update time and creates immutable old/new history. A save changes All Jobs’ current parent-updated ordering/filter meaning and refreshes focused detail/rail through existing callbacks. It has no revision precondition or conflict response.
- 2026-09-02 — **Exact editable request identity** and **Contractor in job identity**: Chris specified JR-36 and JR-34 display identities as company | site | contact. Follow-up confirms those three values are already stored separately; this is a display-composition rule, not a request to save or edit a combined Job-name value. See `job-request-display-identity`.

## What it should do

In focused Job work, provide a clear inline edit for the stored **Job name** component only. On Save, trim the entered value and use the existing approved Job Request update path. The separately composed Request identity refreshes from the stored company, Job/Site, and contact values; this control never writes the combined identity. If the trimmed value is blank, cancel/abandon the edit without saving—matching the existing chat-rename behavior—rather than silently clearing/unnaming the Job Request.

After a successful save, refresh the focused detail and Active Jobs rail through the existing refresh path and truthfully allow the Job to move in All Jobs/rail order because its parent update time changed. Show the existing ordinary save failure treatment if the update cannot be saved.

This edit changes only the stored Job-name component. It never changes the immutable JR reference, URL/routes, canonical Rosie `jr-<id>` thread, lines, Availability Requests, history, or permissions. It must not edit company/contact or write a combined identity; the composed display is governed by `job-request-display-identity` and `focused-job-details-tray`.

## Acceptance criteria

- In focused Job work, Chris can intentionally start, edit, save, or cancel an inline Job-name edit.
- Save trims the entered text and changes only the existing stored Job-name component through the approved update path; the composed identity refreshes without writing a combined value such as `Outdoor Renovations | 803 Redbud | Kyle Stoutenger` into it.
- A blank/whitespace edit cancels without saving or clearing the existing Job name.
- After a successful save, the focused detail and Active Jobs rail refresh; the Job may move according to the existing parent-updated ordering, and All Jobs’ existing Updated-filter meaning remains unchanged.
- A failed save receives the app’s ordinary actionable error treatment and does not present unsaved text as durable.
- The edit does not change JR id/reference, routes, canonical Rosie thread, lines, Availability Requests, immutable history, or access permissions.
- The control is keyboard accessible with visible focus and a 44px minimum touch target; edit/save/cancel focus behavior is predictable.

## Out of scope

- Editing or parsing customer/company/contact identity, address, fulfillment, payment, tax, Gate, status, lines, or notes.
- A deliberate “Unname”/clear-Job-name action.
- Conflict prevention, revision/version checks, a 409 response, or a last-write-wins workflow change.
- Changing list ordering/filter semantics, history, routes, or chat/thread identity.

## Assumptions

- The existing internal session/authorization boundary and established name-update path are the intended permission boundary for this UI-only edit.
- Last-write-wins remains the current truthful behavior; a later protection decision belongs to Bhoumik.

## Open questions

- None blocking the UI-now edit. If Chris wants concurrent-edit protection or an explicit Unname action, stage that workflow/API contract for Bhoumik.

## Handoff log

- 2026-09-02 — routed to Nova after audit confirmed existing PATCH, audit history and focused refresh support. Nova must retain blank-as-cancel rather than exposing the generic API’s null-clearing behavior; concurrency protection remains out of scope.
- 2026-09-02 — JR-36/JR-34 follow-up corrects the earlier reading: the exact three-part identity is a display format from already separate stored values. Retain an atomic **Job name** edit and route display composition to Nova through `job-request-display-identity`; do not write or parse a combined value.
- 2026-09-02 — Nova accepted and added the UI to active focused implementation: name-only PATCH, values-only identity, trim/blank cancel, 44px keyboard/focus/error/refetch safeguards, immutable JR/thread/lines/AR preservation, and truthful updated_at/order change.
