# Review Chris-voice guidance and examples in one place

- Status: drafted
- Route: nova
- Raised: 2026-08-28 by Chris (via Rosie/Lily discussion)
- Updated: 2026-08-28

## Problem

If LPS creates a reviewed voice playbook, Chris needs a simple place to read its guidance, see real example messages in context, and approve, revise, retire, or reject them. Leaving that review only in agent chats makes the approved source hard to find and easy to confuse with a one-off draft.

## Evidence

- 2026-08-28 — Chris asked how LPS can capture and communicate in his voice authentically, beyond general agent guidance.
- There is no dedicated reviewed voice profile or example library in the current app; supplier notes are for individual supplier preferences, not Chris’s general voice.

## What it should do

Provide a clear review view for the future voice playbook: Chris can see each principle or example, its intended message situation, its current review state, and its approval/review date. The view makes a Chris-edited approved message captured as a candidate visibly different from approved reusable material, so a one-off never silently becomes permanent. It supports Chris’s decision to approve, revise, retire, or reject it.

This screen is only the user-facing slice. It depends on the durable playbook and review-state behavior defined in `approved-voice-playbook-governance`.

## Acceptance criteria

- Chris can identify what applies to a supplier availability ask without reading an agent skill or chat history.
- Approved and unapproved/retired examples are visibly distinct.
- Chris can review the full wording and intended use before changing its state.
- A captured, Chris-approved draft is visibly a candidate until Chris explicitly preserves it as reusable guidance.
- The screen does not imply an approved example may be sent without the existing exact-draft approval.

## Out of scope

- Building the underlying voice-playbook storage, audit/review behavior, or approval rules.
- A generic template sender or automated external messaging.
- Editing supplier-specific preferences.

## Assumptions

- This UI should be considered only after Bhoumik agrees the durable playbook/review workflow is needed and defines its behavior.

## Open questions

- Should Chris be able to propose edits directly in the view, or only approve/reject drafts prepared by an agent?

## Handoff log

- 2026-08-28 — Drafted as the UI/UX slice; not routed or built, pending the workflow decision.
