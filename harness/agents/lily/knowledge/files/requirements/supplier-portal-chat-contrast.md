# Increase contrast in Supplier Portal Chat

- Status: shipped — Nova builder-confirmed LIVE exact9acca090696f8400b4e1982f01f0b3dc9704d9db; scoped contrast UI only, owner completion Telegram817 already delivered
- Route: nova
- Raised: 2026-10-22 by Chris via Telegram812, relayed/confirmed by Nova
- Updated: 2026-10-22 12:50:04 CDT

## Problem

In the supplier-facing chat with Local Plant Supply, dark bubbles, small reference/timestamp text and botanical wallpaper compete visually. Chris explicitly asks for more contrast so suppliers can read messages and distinguish who is speaking without losing the existing LPS look. His Telegram reference is a benchmark for legible chat, not permission for a wholesale redesign.

## Evidence

- `telegram:-1004330045748:812` in `../feedback.md`, 2026-10-22 11:48:56 CDT: “Can we increase the contrast in the Supplier Portal Chat? Telegram always the best place to look for best practices for chat UX/UI.” Exact source/wording confirmed by Nova main at11:50:05.
- Private screenshot: `../nova/plugins/telegram/inbox/photo_812.jpg` (relative to Lily agent root), inspected in place only. Shows incoming messages, timestamp/copy/reference metadata on dark botanical wallpaper; composer and enough outgoing states are not shown. Contains private business content; do not publish/reproduce conversation/contact details. This is a reference, not measured contrast or proof of current live source.
- Nova813's bubble separation/text/timestamp/composer/identity framing is proposed design direction supporting Chris's request, not additional verbatim Chris requirements. Objective QA criteria below operationalize the approved contrast intent, not new feature approvals.
- Bounded read-only source/docs baseline at `06b902ae545f0de405681a2d0a2ee103d974b61b`: actual portal chat across authenticated supplier pages, not internal Ops agent chat. Historical pre-change source and shared-consumer limits: `workspace/threads/main/tasks/supplier-chat-contrast/source-check-2026-10-22.md` on Lily.

## What it should do

Improve foreground/background contrast, bubble separation and existing attribution cues locally in Supplier Portal Chat. Keep LPS identity, botanical artwork and saved appearance choices. Learn from Telegram's clear message hierarchy and readable secondary information without copying its assets, branding or adding features. The result should make message text, links, sender/reference labels, timestamps and the existing composer/controls easy to read and operate on their actual backgrounds.

## Acceptance criteria

- A supplier opens chat from the portal on desktop or mobile and sees clearer incoming/own message separation and readable text/metadata against the botanical artwork. Retain existing speaker side, names/leaf/initials, sender-run rhythm, reference context and chronology; attribution remains understandable without color alone. Do not manufacture identity/labels or disclose internal team identities.
- On actual rendered backgrounds, normal/small text (including11px metadata, references, links, composer input/placeholder and relevant notices) meets WCAG AA4.5:1; qualifying large text3:1. Meaningful enabled control/icon boundaries and focus indicators meet applicable non-text3:1 against adjacent colors. Record actual component/state/color evidence, including transparency and wallpaper behind metadata; flat source tokens or screenshot guesses are not measured rendered results. Decorative bubble outlines need not individually meet non-text3:1 unless they convey essential identification/control information; bubble separation must still be visibly clear. Inactive/disabled controls are exempt from WCAG minimum contrast but remain recognizable as disabled, not presented as enabled.
- Review both incoming and own bubbles, plain/Markdown links, sender/reference/timestamp/copy cues, empty/loading/load-earlier/error views and enabled/hover/focus/disabled/busy composer states that already exist. Preserve existing attachment/audio/recording controls and notices. Assess the pictured dark botanical appearance plus supported light/dark and saved theme/wallpaper states affected by the change; no forced preference reset or global palette replacement.
- Keyboard focus is visible and not obscured on affected links, transcript controls, header/width controls and composer actions. Tab order, accessible names, existing hover/pressed/disabled behavior, touch targets and permission/readonly states are retained. Do not alter what the existing Online label means.
- At320px,390px,480px and a documented desktop viewport, independent real-browser QA compares the exact candidate with the private reference and records screenshots and pass/fail findings. Include mobile open/closed chat, existing floating header over long text/media/scroll states, multiline composer at its scroll limit, long messages/URLs/reference names and image/audio/document messages; desktop narrow280px dock and relevant wide/preset states. No clipping, page overflow, obscured controls/focus or new message/composer overlap; preserve current safe-area/global-navigation/scroll behavior.
- Scope is supplier-facing presentation only, on existing authenticated portal chat consumers. Internal Ops/general agent/customer/supplier party-chat presentations, shared Markdown consumers and saved appearance elsewhere do not inadvertently change. If a shared presentation file changes, independent technical/regression QA explicitly covers its other callers; this is not authorization for an app-wide chat restyle.
- Preserve existing filtered audience and redaction, private/internal boundaries, message destinations and reference hrefs, attachment scope/access, chronology/paging/unread logic, availability/permissions and all send/upload/record/copy/refresh behavior. Desktop Enter vs Shift+Enter and mobile multiline Enter behavior are unchanged. Existing caller-specific disabled/send gates, drafts and optimistic mutation behavior stay intact; no persistence redesign.
- Release requires separate independent technical and rendered visual QA against the exact fresh candidate/source identity, with required focused tests/build and retained evidence through Nova's established safe process. No release claim from source review alone. Report actual auth/access/resource/overlap blockers if found; no bypass, credential hunt, stale patch application or dirty-source deployment. This new UI approval does not waive any still-applicable operator hold or authorize unrelated releases.

## Out of scope

- Broad chat redesign, Telegram branding/assets clone, new reactions/replies/search/read receipts/notifications or other features.
- Database, status, pricing/money, workflow, content/source policy, audience filtering or account changes; supplier/customer communication or new operational sends.
- Message routing/send mutations, draft persistence/recovery changes or changes to attachment permission/availability behavior.
- Internal Ops/global agent-chat restyling, public availability UI or separate All Jobs filter proposal and Job-price UI releases. Do not bundle this approval with those items or older AR/workspace work.

## Assumptions

- Clearer existing surfaces and attribution cues are the smallest supported response; no further Chris approval question is needed for straightforward contrast work. If Nova discovers an actual workflow/data requirement, split it for Bhoumik rather than smuggling it into UI scope.
- The screenshot's active saved theme and exact computed colors are unknown. Preserve user choices and verify affected actual combinations rather than assuming the source defaults equal the pictured view.

## Closure and verification limits

- 2026-10-22 12:50:04 CDT — Parent relays Nova12:49:47 builder-confirmed SHIPPED/LIVE exact`9acca090696f8400b4e1982f01f0b3dc9704d9db`, base06b902a. App-only restart EXIT0, production build/TypeScript success and health verified; no harness restart. BuildID`LtiotVx9_PJCSBxUDkQus`, stamped/recomputed input`9256b8216fff80423c9eede25d0f75c96462c25c6f39f6c0e155e4e329876c5d`, local/public served CSS SHA`22719faf2c2353c6f2451199a146f1fdea4fba799350c242f0b68bd52c66b9c3` MATCH.26 focused tests/final type PASS, owner-reported.
- 2026-10-22 12:50:04 CDT — Same independent reviewer FIRST FAIL682 blank280px audio waveforms → portal-specific adaptive-gap/min-bar R1 correction → SECOND technical+visual PASS9acca; both review outcomes retained.19 NEW post-commit PNGs,1520bar rectangles positive/contained,2785contrast checks0fail(min text4.746:1/icon3.368:1), per builder. Earlier107/42-theme/682 coverage is historical evidence, not all9acca PASS. Browser preview closed, synthetic private evidence/no real business mutations; no physical mobile-keyboard test. These limits remain explicit, not an open release hold after builder confirmation.
- 2026-10-22 12:50:04 CDT — Nova already delivered human completion Telegram817 plus safe photo reference/reply812. No duplicate Telegram from Lily. No broader All Jobs/price UI/zero-workflow completion claim, fresh Lily audit, tests/browser/DB/app changes or physical-device/exhaustive final-theme claim. Closure receipt/details and owner artifact paths: `workspace/threads/main/tasks/supplier-chat-contrast/builder-closure-2026-10-22.md` on Lily; primary owner QA/deployment/build artifacts in `../nova/workspace/threads/main/files/visual-qa/9acca09-portal-waveform-r1/`, review `../nova/workspace/threads/main/tasks/review-supplier-portal-chat-contrast/files/review.md`.

## Handoff log

- 2026-10-22 12:50:04 CDT — SHIPPED on Nova12:49:47 exact9acca LIVE builder confirmation relayed by parent, which explicitly authorizes scoped closure. Recorded independent initial fail→R1 fix→second pass, final-release provenance/coverage limits and existing Telegram817 closure. No new audit or outward message; separate proposals/workflows unchanged.

- 2026-10-22 11:50:05 CDT — Captured source once after Nova confirmed exact original; private image and bounded current source/docs checked. Full focused approved UI requirement plus actual-surface/shared-scope/current-base caveats successfully delivered Nova main (`delivered to nova thread=main`, ok:true), the already-acknowledged owner. Status routed only; implementation, technical/rendered QA and release unverified. No parallel builder or task execution, app edits/tests/browser/DB/Telegram.
