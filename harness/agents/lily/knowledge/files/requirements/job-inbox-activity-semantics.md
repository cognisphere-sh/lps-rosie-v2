# Define trustworthy Job Request inbox activity and unread meaning

- Status: staged
- Route: bhoumik
- Raised: 2026-08-29 by Chris (via nova)
- Updated: 2026-08-29

## Problem

An inbox should bring forward work that needs attention, but the current system has two different kinds of change: Job Request record edits and web-chat transcript messages. Its unread cursor is for the shared web panel, not an individual person, and many real Rosie/Chris exchanges occur on Telegram rather than in that transcript. Calling all of that “new messages” without a durable rule would mislead Chris about what he has actually seen or what needs response.

The existing canonical relation is sound but must be preserved: one Job Request maps to Rosie's `jr-<id>` thread, created with the Job Request; the database has a derived reference to the web-chat thread. It is not a customer thread or a supplier thread, and no second JR conversation should be invented.

## Evidence

- 2026-08-29, **Job inbox workflow**: Chris liked a Jobs inbox with JRs ordered/bubbled by new messages and updates/status changes, with details beside the list.
- 2026-08-29, **New request starts in its thread**: Chris expects New job request to create/select its JR/thread and start in blank Rosie chat, then populate details through intake. Today it reserves an id and opens Rosie; the record arrives only when Rosie writes it.
- 2026-08-29, **Focused Rosie intake**: Chris refined this to full-screen Rosie intake with text/data/files/screenshots feeding partial details, returning to normal workspace when usable. The UI slice uses first persisted active line item as its exact transition trigger; workflow must confirm this remains the right definition as intake evolves.
- Existing web-chat threads retain only web-panel messages and a shared team read cursor. Job Request threads close on current terminal statuses; status/lifecycle semantics are already under staged review in `lps-ops-job-request-statuses`.

## What it should do

- Establish a durable definition of an inbox activity event for a Job Request: which record changes, status transitions, availability events, agent messages, and human messages should appear; who/what caused it; when it occurred; and what event is shown as the compact latest preview.
- Preserve exactly one canonical Rosie coordination thread per Job Request (`jr-<id>`), linked when the Job Request is created. Decide the truthful atomicity of starting intake: either atomically create the minimum Job Request plus canonical thread before chat opens, or retain a formal pending-intake identity from reservation through record creation. In either model, recoverable failures must not create duplicate JRs/threads and abandoned reservations must remain distinguishable from a Job Request. Customer and supplier threads remain related conversations, not substitutes for or duplicates of the JR thread.
- Decide what “unread” means for Chris and the team. If the product claims a personal unread state, retain it per authenticated person and activity event; if it is a shared work-queue attention state, name and clear it as such. Do not present the current shared web-panel cursor as Chris's personal cross-channel read receipt.
- Decide whether, and how, Telegram and other agent-channel exchanges that materially concern a Job Request become activity in the inbox. The decision must avoid copying private/unrelated conversation content into the app merely because it shares an agent.
- Define precedence/order when a record edit, an activity event, and an inbound/outbound message occur close together, including how a closed/reopened Job Request enters or leaves the current inbox.
- Preserve enough history to explain why a Job Request was moved or marked as needing attention, without making a transient UI sort the only evidence.
- Align the definition with the final Job Request lifecycle and future Orders boundary: a confirmed job's ongoing supplier coordination must not disappear merely because it moved out of the starting queue, while closed work should remain discoverable in history rather than masquerading as active attention.

## Acceptance criteria

- For a sample JR, Chris can tell why it appears where it does in the inbox and what the latest attention item refers to.
- The product never labels a shared web-panel cursor as an individual person's read receipt.
- A Job Request has one documented canonical Rosie coordination thread; customer and supplier messages cannot create a second JR thread by accident.
- The chosen activity model specifies how a Job Request edit/status change, a web-chat message, a pending-intake start/failure, and a relevant Telegram/channel event affect ordering and attention state.
- The start-intake design states whether creation is atomic or pending, how an id/thread is recovered after a partial failure, what a copied URL does before/after the JR record exists, and whether the first persisted active line item is the approved durable threshold for leaving focused intake.
- Closing/reopening a Job Request has documented inbox and history behavior consistent with the agreed lifecycle.
- The decision states the privacy/visibility rule for any channel-derived activity preview before it is surfaced in the app.

## Out of scope

- The immediate desktop/mobile inbox layout and All jobs management view; that UI slice is `job-inbox-workspace`, routed to Nova.
- Replacing Rosie, Daisy, or customer/supplier communication procedures.
- Deciding the full Job Request lifecycle itself; this requirement consumes the result of `lps-ops-job-request-statuses`.

## Assumptions

- The current database-created `jr-<id>` mapping is the canonical base, not a proposed redesign.
- The UI may initially show only existing web-chat activity while this decision is staged; it must describe that limitation honestly.

## Open questions

- Is the intended unread mark personal to Chris, shared by the LPS team, or an operational “needs Chris review” state?
- Should New job request atomically create a minimal Job Request and its canonical thread, or should Bhoumik formalize the current reservation-to-Rosie-write pending state? This determines whether a copied new-intake URL can be durable before the conversation creates the record.
- Is one persisted active demand line the durable definition of a usable JR for automatic transition out of focused intake, including requests with a known customer/job but no lines yet?
- Which non-web channels, if any, should create a safe Job Request activity event, and who decides a message is relevant?
- Under the eventual sales lifecycle, should Confirmed jobs stay in the same inbox, move to an Orders inbox, or appear in both views with one canonical coordination record?

## Handoff log

- 2026-08-29 — staged for Bhoumik because trustworthy activity/unread behavior, channel correlation, and lifecycle boundaries are workflow/data decisions. UI-only presentation was independently routed to Nova in `job-inbox-workspace`.
