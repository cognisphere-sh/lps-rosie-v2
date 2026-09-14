# Make separate conversations easier to navigate on mobile

- Status: drafted · low priority; held for Bhoumik discussion/prioritization, not authorized for implementation
- Route: nova (future UI slice only; not handed off)
- Raised: 2026-09-11 13:54:23 CDT by Chris, via Nova’s relay of Telegram598
- Updated: 2026-09-11 13:54:51 CDT

## Problem

Chris sees the existing Conversations drawer as a possible better way to navigate multiple threads on mobile. This is a small future navigation idea, not a demonstrated missing capability or a request to combine conversations. The exact mobile surface to improve is not yet settled.

## Evidence

- **Mobile conversation navigation idea**, feedback log: “This may be a better navigation to multi threads. Ask Lily to remind @bshah42 address this on mobile. Not top.prioity”.
- Directly inspected reference: Nova’s `plugins/telegram/inbox/photo_597.jpg`; retained on Lily at `workspace/threads/main/files/mobile-conversation-navigation-reference-597.jpg`. It shows a Conversations drawer, close control, focused Search suppliers field with phone keyboard, General/Main and separate supplier cards. The screenshot is a navigation reference, not proof that mobile has no picker.
- Bounded current-source/docs check: `app/components/workspace/chat.tsx` already supplies a searchable categorized picker and mobile close control; `docs/app/README.md` describes Rosie’s General/Jobs/Suppliers/Customers and Daisy’s General/Suppliers categories. No live behavior or deployment was tested.
- Chris separately withdrew the focused Job Chat/avatar consolidation: “Nevermind they are different threads” (Telegram595, 13:51:33). This idea does not revive it.

## What it should do

When prioritized and scoped with Bhoumik, use the pictured conversation-list pattern as a reference for moving among existing separate mobile conversations, with the chosen destination clear. Retain existing thread identities, categories, controls and behavior. No exact layout or new feature set is approved yet.

## Acceptance criteria

Provisional checks for the future agreed UI slice, not present build instructions:

- Chris can identify and open the intended existing conversation on a phone without confusing it with another thread.
- The list/search and dismissal remain usable on the agreed mobile surface, including while the keyboard is open.
- Existing separate conversations and the focused Job Chat/avatar entry points continue to reach their original destinations; no content is merged and no existing control is removed by this item.

## Out of scope

- Reinstating the withdrawn Chat/avatar consolidation or merging conversations.
- Database, agent workflow, ownership, routing semantics, access, unread or message-state changes.
- Broad mobile audit/redesign, desktop redesign or immediate implementation.
- Timed reminder: no date/deadline was requested and no timer is needed.

## Assumptions

- “Not top.prioity” means retain for later discussion, behind active operational fixes; no urgency or deadline is inferred.
- Bhoumik is the discussion/prioritization recipient, not a second implementation route. Any later approved UI-only work goes to Nova under the standing rule.

## Open questions

- Bhoumik/Chris: when this is worth taking up, which mobile entry point should use or better expose the reference pattern? Held until their discussion; no clarification demanded now.

## Handoff log

- 2026-09-11 13:54:51 CDT — Parent reports the requested low-priority reminder already sent to Bhoumik on Telegram. Captured exact feedback, inspected/preserved reference and recorded future UI route. No implementation handoff, new timer or workflow authorization.
