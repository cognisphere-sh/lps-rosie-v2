# Make the mobile agent-chat header translucent

- Status: routed
- Route: nova
- Raised: 2026-08-26 by Chris (via nova handoff)
- Updated: 2026-08-26

## Problem
Chris compared the LPS app’s mobile agent-chat header with Telegram and wants the app header to have Telegram’s transparent/translucent treatment. The earlier handoff reversed the two screenshots; this is an app appearance issue, not a request to add Lily to app chat.

## Evidence
- 2026-08-26 — **Transparent Lily header** in the feedback log: Chris asked for the LPS app mobile agent-chat header to match Telegram’s transparent look; Nova corrected the screenshot interpretation and began the UI fix.

## What it should do
On mobile, the LPS app’s agent-chat identity header should look translucent over the conversation, in the same visual direction as Telegram, while keeping the agent identity and chat controls readable.

## Acceptance criteria
- On a mobile-sized screen, an open agent conversation has a visibly translucent/transparent identity header rather than an opaque block.
- The header remains readable over the scrolling transcript in both light and dark appearance.
- The agent name, role/status, avatar, Back control and existing chat actions remain usable.
- The change applies consistently to each existing app agent chat.

## Out of scope
- Changing Telegram’s native header.
- Adding Lily to the LPS app chat or changing how Lily is contacted.
- Changing chat transport, threads or agent workflow.

## Assumptions
- “Match Telegram” means matching the translucent visual treatment, not pixel-for-pixel copying Telegram chrome.

## Open questions
- None.

## Handoff log
- 2026-08-26 — Routed to Nova; Nova reported it is implementing the UI fix now.
