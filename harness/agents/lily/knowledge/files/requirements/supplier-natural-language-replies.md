# Let Austin reply naturally and keep the work current

- Status: staged
- Route: bhoumik
- Raised: 2026-08-26 by Chris (via rosie)
- Updated: 2026-08-26

## Problem

Austin Plant Supply can already use the supplier-portal chat, but its free-form replies remain conversation text. To record availability today, the supplier must separately use the request line editor and Submit action; a chat reply does not update the availability response or any related order work.

Chris wants Austin to answer in the chat in its own words and have LPS keep the relevant availability and existing-order response workflow current. This is a workflow and data change, not merely a chat-screen change. There are no order records in the current app, so the future order-response behavior needs durable, auditable design.

## Evidence

- 2026-08-26, **Austin chat updates** and **Supplier does not order** in `feedback.md`: Chris asked to “allow Austin plant supply to NLP or respond in chat and update the response in data base,” clarified that this includes availability and order responses, and specified that only Chris or the buyer initiates an order — never the supplier in chat.
- The existing portal already has a supplier chat routed to Rosie's supplier thread, and separate structured availability requests. Its Orders page is deliberately empty because order records and conversion workflow do not yet exist.

## What it should do

When Austin replies in the supplier portal chat about an open request or an order, LPS should understand the reply in context and turn clear, supported information into the corresponding availability response and order-work updates.

LPS should show or tell Austin what it understood and ask for clarification rather than changing anything when the reply cannot be tied confidently to a particular request, line, quantity, price, timing, substitute, or order.

Availability information extracted from chat should have the same practical result as an answer entered on the availability request: the relevant lines and request reflect the supplier's response, and Rosie's order coordination can proceed from it.

Order-related information may update the response or status of an existing order only. A supplier chat message must never initiate, place, or create an order; that action belongs exclusively to Chris or the buyer.

## Acceptance criteria

- Austin can send a normal chat reply about an open availability request without separately completing every structured field.
- For a clear reply, the affected availability lines show the supplier's stated availability, quantity, price, timing, substitute or note as applicable, while unrelated lines and requests remain unchanged.
- The related request visibly reflects that Austin has responded, and Rosie's order-side work is notified or updated from that response.
- For a clear reply about an existing order, the defined order workflow reflects the supplier's update without changing a different job or supplier.
- If the system is uncertain, the message covers more than one plausible line, or a required detail is absent, it asks Austin to clarify and makes no availability or order change.
- A supplier chat message never initiates, places, or creates an order; only Chris or the buyer can do that.
- Chris can identify, from the request/order history, that a change came from Austin's chat reply and correct it when needed.

## Out of scope

- Replacing the existing structured availability-request editor.
- Treating every supplier chat message as an availability or order update.
- Giving Austin access to other suppliers' work or unrelated jobs.
- General supplier portal authentication work.

## Assumptions

- Austin Plant Supply is or will be an LPS Partner with access to the existing supplier portal and its company chat.
- The existing chat is the desired entry point; no new chat screen is required for this request.
- Natural-language interpretation may ask a follow-up when it cannot safely identify the record or value to change.

## Open questions

- Bhoumik: define the governed, auditable way a chat-derived availability or existing-order response is applied. Current order records are deferred; the design must preserve Chris's rule that only Chris or the buyer initiates an order.

## Handoff log

- 2026-08-26 — staged for Bhoumik because interpreting a chat reply into availability and existing-order responses changes operational workflow and will require durable, auditable data behavior. Chris clarified that supplier chat may never initiate an order; that action is exclusively Chris's or the buyer's. No Nova handoff: the supplier chat UI already exists.
