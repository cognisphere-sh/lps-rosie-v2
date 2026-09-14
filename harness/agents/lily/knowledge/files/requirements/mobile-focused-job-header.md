# Make the focused mobile Job header scannable

- Status: routed
- Route: nova
- Raised: 2026-08-31 by Chris (via Nova handoff; Telegram message 439 / photo 438)
- Updated: 2026-09-13 17:09:01 CDT

## Latest mobile placement refinement

`focused-job-header-layout` now records Chris’s September13 **mockup-only** two-row proposal: top JR / Company / current Status / Total; below atomic Job / calendar + month-day estimated install date / Rosie. Await visual feedback; do not continue the September11 one-group implementation as latest approved design. Telegram615 now rejects repetition in the first preview: Company appears once, lower Job only when meaningfully distinct, supporting real person + customer Chat only. This local mockup rule supersedes older equal-value repeated display, not independent storage or global identity helpers. A suppressed duplicate Job remains present/editable; never show Add Job name unless truly missing. Separate customer Chat outside the compact group and the Rosie chooser remain; removal was withdrawn595. Sample total/date are not saved facts or permission for structural work; current contracts must be rechecked before any later build.

## Problem

The focused Job view on a phone uses too much of its limited header space for secondary identity and a text-labelled Rosie action. The Job Request reference, full job name, project timing, status and useful recent context need to be readable at a glance without making Chris scroll or lose the path to the existing Rosie conversation.

## Evidence

- 2026-08-31 — **Focused mobile Job header**: Chris's annotated reference (Telegram message 439 / photo 438, relayed by Nova) asks for a smaller JR reference, the full Job name to wrap naturally rather than truncate, a concise friendly project date from existing metadata, compact status, one icon-only Rosie chat bubble instead of the avatar plus “Chat with Rosie” text, and a concise/useful preview.

## What it should do

In the focused mobile Job detail header, give the full Job name the readable prominence: it may wrap naturally and must not be ellipsized or horizontally clipped. Make the JR reference visually secondary and compact.

When existing Job metadata supplies a project date, show it in a short, friendly form (for example, `EPD: 8/30/26`). When no project date is available, retain the present honest missing-date behavior; do not manufacture a date or add a new date-entry/workflow path.

Keep the current Job status visible but compact. Replace the separate Rosie avatar and visible “Chat with Rosie” label/bubble treatment with one 44px icon-only **Rosie avatar** trigger. Activating it opens a compact anchored dropdown/menu—not a merged conversation—with **Job chat · JR-<id>** first, routing to the selected Job Request’s existing canonical Rosie thread, followed by one deduplicated **Supplier chat · <supplier>** option for every linked supplier, each routing to its own existing supplier conversation. The dropdown only routes; it does not combine threads. It has no visible “Choose a chat” heading, oversized modal header, or Close control: outside-tap/click and Escape dismiss it. The trigger and invisible menu label/name remain screen-reader accessible; the trigger has no visible text or visual tooltip.

Keep a concise, useful preview of current Job context/activity without reintroducing a large header or duplicating the full detail content. Availability Requests remain available through their existing drawer, not this chooser.

## Acceptance criteria

- On a phone in a focused existing Job, Chris sees a smaller JR reference and the entire Job name; long names wrap naturally with no ellipsis, clipping or horizontal page scroll.
- When the existing Job metadata has a project date, the header displays it concisely and readably (such as `EPD: 8/30/26`); a Job without one remains truthful and does not show an invented date.
- The current Job status remains visible in a compact presentation.
- The old visible avatar plus “Chat with Rosie” treatment is replaced by one 44px icon-only Rosie avatar target, with a meaningful accessible name and no visible tooltip.
- Activating the avatar opens a compact anchored dropdown/menu whose first exact label is `Job chat · JR-<id>` and routes to that selected Job Request’s same canonical Rosie thread.
- The menu then lists every linked supplier once, using the exact label pattern `Supplier chat · <supplier>`; each option opens that supplier’s own existing conversation, and no menu action merges or substitutes threads.
- There is no visible “Choose a chat” heading, oversized modal header, or Close control. Outside-tap/click and Escape dismiss the menu.
- The menu is usable by touch and keyboard: it has an invisible accessible menu label/name, exact accessible option labels, predictable activation/dismissal/focus return, and appropriate menu semantics.
- Availability Requests remain in their existing drawer and are not added to the chooser.
- The header retains a concise, useful preview and stays comfortably scannable at phone widths.
- Desktop focused Jobs header behavior, global chat behavior, Job status/data semantics, and existing missing-date handling outside this display refinement do not change.

## Out of scope

- Creating, collecting, inferring or changing project-date data.
- Changing Job Request status vocabulary or lifecycle/workflow.
- Changing Rosie’s canonical Job Request thread, supplier conversation threads, chat permissions, routing, or global AgentChat behavior.
- Adding Availability Request navigation to chat or changing its drawer behavior.
- Desktop header redesign or All jobs card/toolbar work.

## Assumptions

- “Project date” is display-only use of metadata already available to the focused Job view; the existing absence behavior is retained where it is unavailable.
- “Preview” means the current compact Job-context/activity preview, refined for utility rather than a new activity/status model.
- The chooser uses only existing canonical Job and linked-supplier thread destinations; a Job with no linked suppliers still offers its Job chat option.
- This is a UI-only slice and therefore routes directly to Nova.

## Open questions

- None blocking the UI refinement.

## Handoff log

- 2026-08-31 — routed to Nova as a UI-only focused-mobile-header refinement. Asked Nova to keep the scope isolated while Plant/All-jobs shared-worktree changes remain uncommitted.
- 2026-08-31 — amended after Chris’s Telegram message 449: the one icon opens an accessible compact chooser for the canonical Job chat first and each linked supplier’s separate existing chat; Availability Requests stay in the drawer. Routing amendment sent to Nova.
- 2026-08-31 — amended after Chris’s Telegram message 468 / photo 467: the trigger is the Rosie avatar, and the choices are a compact anchored dropdown/menu directly, without a visible chooser heading, modal header, or Close control. Outside-tap/click and Escape dismiss; accessibility remains invisible but complete. Routing amendment sent to Nova.
