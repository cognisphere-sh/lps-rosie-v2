# Make the availability-request view usable on a phone

- Status: routed
- Route: nova
- Priority: 3 — Bhoumik weekly priority (2026-09-01)
- Raised: 2026-09-01 by Bhoumik (via Lily handoff)
- Updated: 2026-09-01

## Problem

Chris needs to inspect and work an availability request from a phone without the request detail competing with the small screen. The current LPS Ops request opens in a right-hand drawer that becomes a full-width scrollable surface on mobile, but its header, status, supplier/job context, timestamps, editable lines and Save action have not been deliberately organized for phone scanning and completion.

## Evidence

- 2026-09-01 Bhoumik weekly priorities: optimize the availability-request view for mobile is priority 3.
- Current app audit: the existing LPS Ops availability-request drawer contains the status, job/supplier identity, Sent/Submitted facts, line table and Save action in one mobile-width surface.
- 2026-08-27 to 2026-08-29 availability-display feedback: full availability detail belongs in the request drawer/detail; compact Job Request cards should retain only an attention signal and link.

## What it should do

Refine the existing LPS Ops availability-request detail for phone use: keep the request identity, status, supplier, meaningful availability dates, line answers and completion action easy to find and operate without making the Job Request card carry duplicate detail. Preserve the existing request behavior and accurately show only data the current contract supplies.

The mobile view must leave room for the later, staged freshness/change details—Last updated, supplier-versus-LPS attribution and before/after review—without inventing them or changing their workflow.

## Acceptance criteria

- On a phone, Chris can immediately identify the request, supplier and current request state after opening it from a Job Request.
- Chris can scan and edit each availability line, including its status and existing response fields, without horizontal clipping or accidental interaction with adjacent controls.
- The request’s available Sent, Submitted and later defined Last updated facts are clearly distinguished rather than crowded or conflated.
- The Save/submit action remains visible or readily reachable while reviewing a long request and has an unambiguous result.
- The detail is usable by touch and keyboard/screen reader, including a clear close path and accessible labels.
- Compact Job Request cards remain compact links/attention signals; detailed timestamps and line answers remain in this view.

## Out of scope

- Changing availability statuses, stored response values, access control or request lifecycle.
- The out-of-network public/shared request experience.
- The Nursery Portal’s status-selector styling.
- Defining Last updated, attribution, change comparison or acknowledgement workflow.

## Assumptions

- This priority concerns the existing LPS Ops availability-request detail opened from a Job Request, not a new public supplier view.
- Nova can make layout and interaction improvements now, but any not-yet-defined freshness/change fields wait for Bhoumik’s staged contracts.

## Open questions

- None for the independent LPS Ops layout slice. If Bhoumik intended the priority to include the partner portal or the new public shared view, that is separate dependent scope.

## Handoff log

- 2026-09-01 — drafted as an independent Nova UI slice after Bhoumik named mobile availability-request optimization weekly priority 3. No external handoff sent by task instruction.
- 2026-09-01 — routed to Nova by Lily with the bounded LPS Ops mobile-detail scope; awaiting build confirmation.
