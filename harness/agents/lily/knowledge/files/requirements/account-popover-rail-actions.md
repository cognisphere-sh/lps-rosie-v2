# Put account actions in the account popover

- Status: routed
- Route: nova
- Raised: 2026-08-29 by Chris (via nova handoff)
- Updated: 2026-08-29

## Problem

The desktop navigation rail gives two infrequent account actions — Know your Agents and Supplier view — their own rows, adding clutter to the workspace navigation. Chris approved putting them with the signed-in account instead, without changing what either action does.

## Evidence

- 2026-08-29 — Chris approved the account-popover treatment through Nova’s handoff.
- The current desktop rail has standalone Know your Agents and Supplier view rows, while the account popover has only the signed-in identity and Log out.

## What it should do

On desktop, remove only the standalone **Know your Agents** and **Supplier view** rows from the bottom of the navigation rail. Keep the existing signed-in account control in that rail and make it plainly an **Account** control, with its expanded/collapsed state exposed to assistive technology and an explicit relationship to its popover.

Open the Chris / Austin Plant Supply account popover from that control. Above **Log out**, it contains **Know your Agents** (which continues to open `/agents`) and **Supplier view**. Supplier view continues to load the authenticated partner list only when opened, presents the current temporary-view explanation, and opens a chosen public partner portal in a new tab. Launching an agent page or partner portal closes the account popover and any open Supplier view nested state.

The Account control receives visible active styling and current-state semantics while its popover is open; it is not a new Account destination or route. Continue to show the signed-in identity in the popover.

This is desktop rail cleanup only. Preserve Settings, Dark mode, and Install app or Reload in their existing rail order and behavior. Preserve the existing mobile More equivalents for Settings, Know your Agents, Supplier view (including its nested picker), account identity, and Log out.

Use ordinary labelled buttons/links rather than assigning `menu` roles unless the complete menu keyboard model is implemented. Every desktop account trigger and popover row has a 44px usable target, visible keyboard focus, and a clear accessible label. Escape closes the open account popover (and nested Supplier view state where applicable) and returns focus to the Account trigger.

## Acceptance criteria

- On desktop, the rail no longer shows standalone Know your Agents or Supplier view rows; no other rail footer action is removed or reordered.
- The desktop Account trigger has a visible Account label, at least a 44px target, visible focus, and exposes whether it is expanded and which popover it controls.
- Opening Account shows Chris / Austin Plant Supply, Know your Agents, Supplier view, and Log out, with the first two actions above Log out.
- Choosing Know your Agents opens `/agents`, and the Account trigger is closed and styled/current only while its popover is open; no Account route exists.
- Opening Supplier view fetches the authenticated partner list lazily; choosing a partner opens that existing public portal in a new tab and leaves neither the nested picker nor the account popover open.
- Settings, Dark mode, Install app or Reload, and their existing behavior remain available on the desktop rail.
- On mobile, More still provides the same Settings, Know your Agents, Supplier view and Log out capabilities, including the Supplier view picker.
- A keyboard user can visibly focus each Account trigger/popover action; Escape closes the popover and returns focus to the Account trigger.
- The implementation does not apply ARIA menu roles without implementing the corresponding full menu behavior.

## Out of scope

- A separate Account page or route.
- Changing supplier authentication, partner permissions, partner-portal content, or the public-new-tab behavior.
- Removing or redesigning the mobile More menu.
- Changing Settings, theme, installation, reload, or logout behavior.

## Assumptions

- The existing signed-in rail identity control is the Account trigger; naming it Account makes the purpose clearer without a new screen.
- “Current” means the trigger visibly and semantically reflects that its popover is presently open, not that Account becomes a navigable page.
- Supplier view remains a temporary authenticated operator tool until supplier sign-in exists.

## Handoff log

- 2026-08-29 — Routed to Nova following Chris’s approval and code inspection of the shared desktop rail, account popover, and mobile More implementation.
- 2026-08-29 — Nova accepted; implementation follows integration of the active Supplier filters change, then Nova will independently review/deploy and report back.
