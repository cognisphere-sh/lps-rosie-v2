# Make app headers compact and purposeful

- Status: drafted — ready to route refinement
- Route: nova
- Raised: 2026-08-29 by Chris (via nova handoff)
- Updated: 2026-08-29

## Problem

Chris says the headers across the app “seem like space wasters.” The current shared desktop frame gives every screen a separate title-and-subtitle band, even when the rail, active page control, toolbar, or detail content already identifies where he is. On a working screen that costs vertical room before the rows, cards, and controls he came to use; on a phone the generic list headers are already omitted, demonstrating that the extra band is not always needed.

## Evidence

- 2026-08-29 feedback log, **App headers waste space**: Chris said, “these headers across the app seem like space wasters.”
- App/docs review: the shared `WorkspaceFrame` supplies the same title/subtitle header across the admin workspace and partner portal; Suppliers, Plant Search, Photos, Customers, Job Requests, and portal pages already suppress it on mobile, while supplier/customer detail pages retain identity and actions there.

## What it should do

Use one consistent compact-header hierarchy across the app rather than redesigning individual pages.

On desktop, remove the generic shared title/control row entirely from list/workspace screens where the active navigation destination and existing toolbar already identify the page. Chris’s test is: “I already know I am in request.” Do not replace that removed band with another title strip, duplicate controls, or a second toolbar. Keep contextual counts, search, filters, sorting, pagination, and list guidance in the existing toolbar or content area where they support the task.

Before removing that row, move the controls it carries to the **right side of the existing search/filter toolbar**: the New job request action where it is relevant, and Notifications wherever the desktop list currently exposes them. Apply this consistently to relevant desktop list pages; do not create a separate utility bar. Preserve their behavior, labels/tooltips, and usable touch target size, and let narrow desktop widths handle overflow without concealing an action.

Keep a compact desktop identity/action header on detail routes, where the named supplier, customer, request, availability request, or portal job needs a clear identity, Back/navigation path, or essential action. Do not move their actions into list toolbars or reinstate a generic title band. Do not repeat detail identity in the content.

On mobile, continue omitting generic list headers where the active bottom navigation and first toolbar/control already identify the screen. Retain only a compact, safe-area-aware identity/action header when removing it would hide a detail record's name, Back path, Save/Cancel, chat, or another necessary action. Existing mobile chat and other overlay headers remain purpose-built overlays, not part of this reduction.

## Acceptance criteria

- Remove the generic desktop list/control row on the desktop routes that already have a search/filter/view toolbar: Suppliers, Plant Search, Photos, Customers, All jobs / Job Requests, portal Availability Requests, and the new `/jobs` view switch.
- Retain the slim desktop row on Agents (no toolbar), Settings (tabs only), portal Closed Requests, and portal Orders (no toolbar) until each has a natural utility surface; this does not add a second bar.
- Detail-route headers remain unchanged.
- Removing a desktop list header does not add a replacement title strip, duplicated page action, or second toolbar.
- Before that row is removed, its New job request action (where applicable) and Notifications move to the right side of that page’s existing desktop search/filter/view toolbar; no separate utility bar is introduced.
- New job request still opens the same intake/agent-chat flow, and Notifications preserves its existing unread, open, and navigation behavior.
- Moved controls retain visible labels or tooltips, at least 44px usable targets, keyboard access, and an accessible narrow-desktop overflow treatment that never silently hides an action.
- Page-specific search, filters, result counts, pagination, sorting, and scan guidance remain available in the toolbar or content area and are not lost or duplicated in the header.
- Supplier, customer, job-request, and availability-request detail screens retain an immediately legible record identity, Back path where present, and their existing task-critical actions (including Save/Cancel while editing and available chat actions).
- On mobile, generic list headers remain absent; detail headers appear only when they preserve record identity or a necessary action, respect safe areas, and do not stack above a duplicate title in page content.
- Header controls remain touch-usable, keyboard-accessible, and readable in light and dark appearance; narrow desktop widths do not cause title/actions to overlap or hide without an accessible alternative.
- Existing desktop notification/agent-chat access, mobile bottom navigation, partner notification access, and mobile chat-overlay behavior continue to work.
- The change reduces visible header height on a normal desktop workspace screen without changing data, routing, permissions, agent threads, or workflow behavior.

## Out of scope

- Changing navigation destinations, bottom navigation, agent-chat transport, or notification behavior.
- Removing the identity/action header from mobile chat, confirmation, or other full-screen overlay experiences.
- Reworking individual page content, data fields, toolbars, or workflows solely because the header is smaller.
- Database, API, status, or supplier/customer workflow changes.

## Assumptions

- “Across the app” means the shared admin workspace and supplier portal frame, plus their detail routes, rather than Telegram's native UI.
- A smaller shared treatment is preferable to page-by-page exceptions; record-detail identity and actions take precedence where a header is genuinely useful.
- The referenced screenshot was not present in Lily's accessible Telegram inbox during review, so this requirement is based on Chris's direct wording and the implemented shared-frame behavior; Nova can compare the original image if it is available in their handoff context.

## Open questions

- None. Chris confirmed generic desktop list title rows should be removed where navigation and existing toolbar identify the page; detail identity, Back, essential actions, and global controls remain.

## Handoff log

- 2026-08-29 — Drafted after shared-frame, route, and current-header review. This task thread was instructed not to message externally.
- 2026-08-29 — Routed to Nova by Lily main with the full UI/UX requirement.
- 2026-08-29 — Nova shipped a slim 40px/53px desktop title/control row. Chris says it is “still there”; further build paused for confirmation.
- 2026-08-29 — Chris confirmed the refinement: remove generic desktop list title rows entirely where navigation and the existing toolbar identify the page; retain detail identity/Back/essential actions and global controls.
- 2026-08-29 — Chris refined the control placement: move New job request and Notifications from a removed desktop list row into the right side of that page’s existing search/filter toolbar, not a second utility bar.
- 2026-08-29 — Nova audit clarified scope: remove the row only where an existing desktop search/filter/view toolbar supplies a natural home (Suppliers, Plant Search, Photos, Customers, All jobs / Job Requests, portal Availability Requests, and new `/jobs`); retain the slim row on Agents, Settings, portal Closed Requests and portal Orders until they have one. Ready to route this UI-only refinement to Nova.
