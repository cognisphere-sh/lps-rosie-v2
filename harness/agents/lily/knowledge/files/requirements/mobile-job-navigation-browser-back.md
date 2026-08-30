# Use the phone’s Back navigation for Jobs

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (approved UI direction via Bhoumik/Lily handoff)
- Updated: 2026-08-30

## Problem

On a phone, a selected Job currently adds an in-page **Back to active jobs** control above its details. That duplicates the browser/device Back behavior Chris expects and costs room in an already narrow work view.

## Evidence

- 2026-08-30 feedback log, **Mobile Jobs Back control**: the explicit approved direction is to remove the mobile control and rely on browser/device Back.
- App review, `/jobs`: the selected mobile detail currently renders a 44px **Back to active jobs** button; desktop has its separate focused-workspace **Back to Jobs** rail control.

## What it should do

Remove the in-page **Back to active jobs** control from the mobile selected-Job detail view. Phone navigation back to the active Jobs list should use the browser’s or device’s Back action and retain the established Jobs history behavior.

This is only the mobile drill-in control. The desktop focused-workspace Back control remains, as do purpose-built focused-intake exit controls and normal app navigation.

## Acceptance criteria

- On a phone, opening an existing Job from the Jobs list does not show an in-page **Back to active jobs** or replacement Back control above the selected details.
- Using the browser or device Back from that selected Job returns Chris to the Jobs list through the established history behavior, without selecting a different Job.
- The desktop focused Jobs rail still has its labelled 44px **Back to Jobs** control and retains its current behavior.
- Focused-intake exit/back/cancel controls and normal mobile app navigation remain available as they are.

## Out of scope

- Changing Jobs URLs, history semantics, Job Request records, Rosie chat/intake workflow, or desktop focused-workspace navigation.
- Adding a new mobile navigation pattern or replacement control.

## Assumptions

- The existing browser/device Back route restoration is the intended familiar mobile behavior; this UI slice does not add persistence beyond it.

## Open questions

- None.

## Handoff log

- 2026-08-30 — Drafted from Bhoumik’s released no-change hold and explicit approved UI direction; ready for Lily main to route to Nova.
- 2026-08-30 — Routed to Nova by Lily main; awaiting build confirmation.
