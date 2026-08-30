# Feedback log

Every input from Chris about how the business or the software works — logged
as it arrives, whether or not it sounds like a request. Append-only, newest at
the bottom. The `feedback-loop` skill owns the format.

The arrow on each entry says where it went: a requirement slug,
`(watching)` (recorded, not yet acted on — the normal case), `(answered)`, or
`business/<file>` when it changed the picture rather than the backlog.

One remark is noise. Three is a requirement. Recording the first two is why
this file exists.

<!-- ## YYYY-MM-DD
- **short handle** — what he said, close to his words. _(via telegram)_
  → (watching) -->

## 2026-08-25

- **One-gallon sedge price** — “Basically any sedge can be mapped to a 1g sedge price. We just need the specifics for availability and when orders are created.” Clarified: “1g sedge variety has the same price.” Berkeley Sedge on JR-10 was available but had no exact APS price; use the generic 1 G sedge price, while retaining the exact variety for availability and fulfilment. _(via rosie)_
  → one-gallon-sedge-price-mapping

## 2026-08-26

- **Austin chat updates** — “allow Austin plant supply to NLP or respond in chat and update the response in data base.” Clarified through Rosie: Austin Plant Supply should be able to answer in natural language in the supplier chat; the system should update both availability responses and the related order data/workflow. _(via rosie)_
  → supplier-natural-language-replies

- **Supplier does not order** — Chris clarified: “They would not say place the order. They are the supplier. That would come from me or the buyer.” Supplier chat may inform availability and an existing order’s response, but only Chris or the buyer initiates an order. _(via rosie)_
  → supplier-natural-language-replies

- **Where to add catalog photos** — “Where should I add a photo for my catalog. Should there be an add button on that page or directly with Daisy or you?” The Photos page needs to be the clear primary place to add a catalog photo; Daisy chat remains a secondary way to hand a photo over conversationally. _(via nova handoff)_
  → catalog-photo-upload-page + catalog-photo-intake-review

- **Transparent Lily header** — Chris compared the native Telegram LPS:Lily header with the LPS app’s transparent Daisy chat header and asked whether Lily’s can change to transparent. Telegram’s native header is not ours to style; a matching header would mean reaching Lily in the LPS app’s agent chat. _(via nova handoff)_
  → (watching)

- **Header comparison corrected** — Nova corrected the screenshot reading: Chris wants the **LPS app mobile agent-chat header** transparent/translucent to match Telegram, not Lily exposed in the app. Nova is implementing the UI fix. _(via nova handoff)_
  → mobile-agent-chat-translucent-header

- **Job-request delete is easy to tap** — Chris says the trash control in `photo_220.jpg` is easy to fat-finger and he accidentally tapped it; he asked whether deletion should require a long hold. Nova’s screenshot audit identifies it as the collapsed mobile JR-19 “Oak Grove Rd. planting” card’s whole-request delete control beside the Rosie/avatar. _(via nova handoff)_
  → job-request-delete-safety

- **Dedicated request and order pages** — Chris wants to discuss giving Requests and Orders their own distinct detail pages with Bhoumik; he thinks that would use the mobile screen better. Nova has set a one-time reminder for their September 1 discussion. _(via nova handoff)_
  → (watching; Bhoumik discussion 2026-09-01)

- **Delete safety looks horrible** — After the mobile JR delete-safety UI shipped in `c90a8d3`, Chris said, “Aesthetically horrible. But we’ll get that sorted out!” The safety behavior is correct; the visual presentation of the Actions menu/card header needs later refinement, but he did not identify a specific visual problem. _(via nova handoff)_
  → (watching)

## 2026-08-27

- **LPS Ops job statuses** — Chris defined the exact LPS Ops Job Request status order and colors from `photo_234.jpg`: Active (green), Quote Delivered (blue), Confirmed (purple), Closed Won (teal/dark green), Closed Lost (red), Archived (gray). The screenshot showed Rosie's Recent Chats/JR picker and Urban Oasis marked Active. _(via nova handoff)_
  → lps-ops-job-request-statuses

- **No archived requests** — Chris says Archived “just takes up data”; bad/duplicate requests should be deleted, and every other request either becomes an order or does not: Closed Won or Closed Lost. He wants those completed requests in a Job Request Historical view for reports such as requests/dollars created in January and Closed Won last month. _(via telegram)_
  → lps-ops-job-request-statuses

- **Closed Lost reason required** — When selecting Closed Lost, Chris wants a required Reason dropdown saved with the record. Exact choices: Price, Different Vendor, Unable to Fulfill Request, No Response, NA. Screenshot `photo_27.jpg` shows the analogous Closed Lost reason and close-date fields. Chris then marked this low priority: retain it for a future update to the status/history flow, not as an immediate build item. _(via telegram)_
  → lps-ops-job-request-statuses (deferred follow-on)

## 2026-08-28

- **Bhoumik’s lifecycle proposal** — Bhoumik proposes New (no action yet) → In Progress (action/sourcing started) → Closed Won (customer confirmed and order ID created) or Closed Lost (no order). He also says every availability request for a job should close when the job moves to Closed. _(via bhoumik)_
  → lps-ops-job-request-statuses

- **Confirmed means committed** — Chris defined Confirmed: availability/quote work and back-and-forth are complete; the customer has been told what is available and its cost and has committed to buy. The request then becomes an order, for example through APS’s portal. _(via telegram)_
  → lps-ops-job-request-statuses

- **Closed Won means fulfilled** — Chris corrected the boundary: Closed Won is when the order was processed and plants were delivered or picked up — “The transaction took place.” It is not when the order ID is created; the order can exist/continue while the request remains Confirmed. _(via telegram)_
  → lps-ops-job-request-statuses

- **Quotes can recur** — Bhoumik says Quote Delivered cannot be a one-time irreversible status: customers may add/remove plants or accept substitutions after a first quote, requiring multiple quotes on the same Job Request. He recommends New/In Progress as current labels, with quote deliveries retained as history/milestones rather than a current status. _(via bhoumik)_
  → lps-ops-job-request-statuses

- **Quote Delivered stays** — Chris decisively chose a sales-pipeline model: Quote Delivered is a necessary distinct state that tells us the customer received pricing/availability. Customer changes return the request to Active; revised quote delivery returns it to Quote Delivered. He considered “Quote and Availability Delivered” but prefers the concise label; its description/help text should clarify that quote means the pricing-and-availability package. _(via telegram)_
  → lps-ops-job-request-statuses

- **Confirmed-order availability closure conflict** — Bhoumik now proposes that Confirmed creates Orders and closes all availability requests. This conflicts with Chris’s core post-quote use case: a nursery must be able to update/re-submit changed availability and have that change visible through a confirmed Order until fulfilment. _(via bhoumik handoff)_
  → lps-ops-job-request-statuses + availability-response-change-management

- **Availability last updated** — “On the Job Request Details for both the Nusery [Nursery] Portal and My view we will need data for the availability update. Last Updated: time and date.” _(via telegram)_
  → availability-last-updated-display + availability-last-updated-semantics

- **How nursery completion is known** — Chris urgently asked: “As it stands right now, what is the means by which I will know that a particular availability request has been completed by the nursery?” Current answer: the nursery presses Submit; the request becomes Submitted and shows its submission time in Chris’s request drawer. Processing only means at least one line has been saved. _(via telegram)_
  → availability-last-updated-semantics

- **Availability collaboration and master** — Chris asked: “How collaborative is the request? If they are updating and I know some items and update on my end, are those reflected on either side, is mine the master?” The current shared request-line values are last-save-wins, with no live cross-screen refresh, conflict warning, or master owner; the original job-request lines are snapshots and do not automatically reconcile with supplier answers. _(via telegram)_
  → availability-last-updated-semantics

- **Availability changes after quote** — Chris gave the core use case: availability sent to a customer may be accurate today but change four days later; the nursery may notify or re-submit. He wants those changed fields highlighted in both pre-confirmation/pre-order Requests and confirmed Orders, and Rosie able to message him. He sees the final back-and-forth to consensus as central value. _(via telegram)_
  → availability-response-change-management + availability-change-indicators

## 2026-08-28

- **Supplier qualification in Telegram** — Chris asked whether Telegram is efficient for jointly qualifying suppliers. The immediate manual review is in batches of 10, showing supplier/location/current Type, original-list provenance when available, Texas-service evidence, and a recommendation: pursue, retain later, or needs call. Longer term he wants an Onboarding Review section under Suppliers where decisions and reasons persist instead of getting lost in chat. Daisy reports Type/tag migration complete; among 91 Texas-service holds, 1 has confirmed original-group membership and 90 are unknown. _(via Daisy handoff)_
  → supplier-onboarding-review

- **Supplier type changes the work** — Chris wants to discuss with Bhoumik who handles supplier requests because availability-request and buying processes differ significantly between wholesale suppliers and growers. He has asked for a reminder date/time separately. _(via telegram)_
  → business/operations.md (watching)

- **Out-of-network availability path** — Suppliers outside the network, without a portal, need a critical path to receive a **formatted availability request by email** with a link to a dynamic, shared availability-and-request view, so LPS and prospective Texas wholesale nurseries can work through the process together. This is an important item for the Bhoumik supplier-workflow discussion, not an immediate implementation request. _(via telegram)_
  → business/operations.md (watching)

- **Human supplier availability asks** — In JR-21 testing, Chris said “No one knows what an LPS job is”; supplier availability outreach should sound “like a regular human, not a LLM output” — brief and informal/light. “Please confirm your availability” is a demand, not an ask. His model: “Morning, Have a project here in Austin looking for 200 x 7g Giant Green Thuja. Ya’ll have those available? If you have a photo handy I would love to take a look. Thanks in advance”. JR-21 was cancelled before any outreach. _(via rosie)_
  → supplier-outreach-human-tone

- **Chris voice playbook** — After the JR-21 outreach correction, Chris asked what tools would capture his voice and communicate authentically like him—only agent guidance, or something more. Current support is explicit guidance and durable per-supplier preferences; there is no dedicated Chris-reviewed voice profile or example library. He has heard the broad direction; future work should retain review controls. _(via rosie)_
  → approved-voice-playbook-governance + voice-playbook-review-screen

- **Approved edits teach, not automate** — Chris confirmed that emails he edits and approves should become good examples for later similar drafts. A one-off must not silently become permanent: capture recurring, intentional patterns in a reviewed voice playbook while preserving approval of every exact outgoing message. _(via rosie)_
  → approved-voice-playbook-governance + voice-playbook-review-screen

- **Confirmed carries supplier communication** — Chris resolved the availability-timing question: “Once confirmed changes occur regularly.” Confirming a Job Request gives the supplier a new **Order Details** inbox item carrying the request information and “all the same functionality”; communication and updates continue through fulfilment to streamline the final coordination. The accompanying Orders screenshot says “Confirmed orders will appear here.” _(via telegram)_
  → lps-ops-job-request-statuses + availability-response-change-management

- **Future quote versus live availability** — Chris says roughly 90% of requests are future projects: LPS may send pricing first and not check live availability until 7–10 days ahead. He proposes **Availability Updated** as a separate status: the nursery completed the availability update and LPS sent that data to the customer for review. This distinguishes the original price quote, current supplier availability, and the customer’s eventual response. _(via telegram)_
  → lps-ops-job-request-statuses + availability-response-change-management

- **Reviewed availability reaches customer workspace** — Chris decided that when a dynamic customer Job Request Details workspace exists, supplier availability updates can be pushed to it only after Chris reviews them. Supplier change → Chris notification/review → approved customer-workspace update; no unreviewed automatic customer exposure. _(via telegram)_
  → availability-response-change-management + customer-availability-update-workspace

- **Initial order dispatch and replies** — Chris’s initial order direction: send the supplier a plain-text, simply formatted email with the details. The supplier may respond by email or in the portal. A supplier-facing link to Order Details is a future enhancement, not a prerequisite. _(via telegram)_
  → order-dispatch-and-supplier-response

- **Order email workspace cue** — Chris answered the first-email-content question with `photo_111.jpg`: a compact job-details workspace with customer/job name, Demand & Availability subtotal/item count/state counts, and rows showing quantity, size/name, unit price and line total; its circled header includes email, message and document actions. _(via telegram image)_
  → order-dispatch-and-supplier-response

- **Customer details and order email are urgent** — Chris emphasized that sharing compact request/order details with the customer and sending order details to the supplier need to be available soon for the app to be useful, not treated as future polish. _(via telegram)_
  → customer-job-request-details-workspace + order-dispatch-and-supplier-response

- **Keep AR details in the drawer** — Bhoumik clarified that availability-request links already open the timestamped drawer; putting full timestamps on the Job Request card would crowd its scan view. The proposed card behavior is a compact attention signal only—Submitted, AR updated, or Needs review, optionally with changed count—with full dates and lines in the drawer. _(via bhoumik handoff)_
  → availability-last-updated-display + availability-change-indicators

- **Availability changes do not change the customer stage** — Chris resolved the re-submission edge: supplier re-submissions and availability updates are managed through notifications and a **Last updated** field in his request view. They do **not** automatically move a Job Request from Availability Updated back to Active; the JR status remains the customer-facing stage, while a supplier change is a separate dated, attributable event. _(via telegram)_
  → lps-ops-job-request-statuses + availability-response-change-management + availability-last-updated-semantics

- **Stage versus milestone model** — Bhoumik challenges Quote Delivered and Availability Updated as formal statuses because quote and availability cycles recur. His proposed objective lifecycle is New → In Progress → Committed → Closed Lost/Won, with durable mapped quote/availability sub-events, hyperlinks, filters and badges under In Progress. This conflicts with Chris’s explicit sales-pipeline need for status to show that a customer received pricing/availability; Chris must choose the primary model. _(via bhoumik)_
  → lps-ops-job-request-statuses

- **Quote before supplier verification** — Bhoumik flags a commercial control question: stored supplier price data can be stale, so a customer price quote sent before current supplier confirmation risks a price increase after the customer commits. If an updated price list exists, Rosie could quote without a live availability check; Chris must decide whether that may be an indicative quote and what supplier price/availability must be verified and re-communicated before commitment. _(via bhoumik)_
  → lps-ops-job-request-statuses

- **Budgeting quotes are allowed** — Chris resolved the commercial policy: LPS sends early budgeting quotes using available pricing so contractors can bid; plants are only part of the project and they need a placeholder. Contractors understand price and availability may change with install timing. A quote is a customer-facing milestone, as is later putting current availability **and price** in front of the customer; the later verified package is required before commitment. _(via telegram)_
  → lps-ops-job-request-statuses + availability-response-change-management

- **One stage cannot show two facts** — Bhoumik gives the concrete conflict: after a customer makes a minor change to a delivered quote, the Job Request is both “quote delivered” and “needs work”; one formal status hides the other. Lily’s revised recommendation is objective lifecycle (New/In Progress/Committed/Closed) plus prominent dated/filterable latest quote, latest verified availability, and customer-change-pending markers so Chris retains pipeline visibility without status churn. Chris has been asked whether that satisfies his sales-pipeline need. _(via bhoumik / Lily)_
  → lps-ops-job-request-statuses

- **Pricing then availability sales stages** — Chris rejects the simple objective lifecycle as the primary sales view. A **Pricing** stage remains while LPS and customer work through pricing, including quote revisions. Closer to planting or when availability is needed, the request enters **Availability**: LPS and customer work toward consensus on what is available and what the customer will buy. It is one step closer to sale. Quote deliveries and supplier submissions are events within those stages, not the stages themselves. _(via telegram)_
  → lps-ops-job-request-statuses + availability-response-change-management

- **Timing the availability stage** — Bhoumik asks how Rosie knows whether Pricing should lead directly to Availability or continue with an indicative quote. Chris’s stated usual timing is a live check 7–10 days before installation, but the current Job Request has no structured installation/delivery or availability-needed-by date—only free-text notes. Chris needs to choose the trigger date, default window, and manual override. _(via bhoumik / schema review)_
  → lps-ops-job-request-statuses

- **When catalog pricing supports a budget quote** — Bhoumik cautions that a database price cannot automatically support an indicative quote: it may be stale, missing, for a product no longer carried, or undeliverable. Chris must decide whether any dated/source-traceable catalog price is sufficient for a clearly contingent budget quote, or whether Rosie must seek supplier confirmation first; regardless, current supplier price and availability remain mandatory before Confirmed. _(via bhoumik / schema review)_
  → lps-ops-job-request-statuses

- **Quick quotes are not Job Requests** — Chris’s higher-volume workflow separates opportunities further: quick quote requests live in a dedicated Quote view and initially never enter Request Management. Chris can return a quote there. Only when the customer comes back to source plants or update the installation date do the quote details move into a **new** Request, which starts Request Management. This supersedes Pricing as the initial Job Request stage. _(via telegram)_
  → quote-opportunity-to-job-request-conversion + lps-ops-job-request-statuses

- **Quick quote needs no supplier check** — Bhoumik confirms the simplified rule: Rosie may generate a quick quote without checking availability. It stays a Quote opportunity until explicit conversion; it must be clearly indicative, and conversion—not quoting—begins supplier sourcing/availability work. _(via bhoumik)_
  → quote-opportunity-to-job-request-conversion

## 2026-08-29

- **App headers waste space** — “these headers across the app seem like space wasters.” The concern is the repeated, large title/subtitle band across the LPS app, not a one-off screen; reduce it consistently while retaining identity and needed actions. _(via nova handoff)_
  → app-wide-compact-headers

- **Keep list-row actions in the toolbar** — Before desktop list title rows disappear, Chris wants their New request and Notifications controls moved to the **right side of the existing filters/search toolbar**, not into a second utility bar. Keep behavior, visible labels/tooltips, 44px targets and responsive access; detail-page action headers stay as they are. _(via lily / nova handoff)_
  → app-wide-compact-headers

- **AR badge is too much** — After the AR Submitted badge release, Bhoumik said the full status is too much on the compact card: use a color-coded round dot and matching AR text color instead, while retaining accessible status meaning. Nova has already been routed for this UI refinement. _(via bhoumik)_
  → availability-last-updated-display

- **Desktop header is still there** — After Nova shipped the compact desktop header treatment, Chris says it is “still there.” Nova confirms the title/control row remains, now slim (40px/53px), and asks whether generic desktop list title rows should be removed entirely while keeping existing navigation/toolbars and detail identity/actions. This is dissatisfaction with the current outcome; Chris has not yet confirmed the intended end state. _(via nova handoff)_
  → app-wide-compact-headers (pending Chris confirmation)

- **Remove generic desktop list headers** — Chris confirmed that generic desktop list title rows should go entirely where the navigation and existing toolbar identify the page: “I already know I am in request.” Keep detail record identity, Back, essential actions and global controls; do not replace the removed band with another title strip or second toolbar. _(via lily / nova handoff)_
  → app-wide-compact-headers

- **Job inbox workflow** — Chris liked Nova’s inbox-style Job Request reference set (`photo_274.jpg`, `photo_275.jpg`, `photo_277.jpg`). Default Jobs should be a JR/thread list on the left, bubbled and ordered by new messages plus updates/status changes, with the selected JR open alongside; All jobs and filters stay as the alternate management view. _(via nova handoff)_
  → job-inbox-workspace + job-inbox-activity-semantics

- **New request starts in its thread** — Chris approved pressing New job request to create the new JR/thread, select it in the inbox rail, and open its blank Rosie chat so intake starts immediately; JR details should populate as the conversation progresses. _(via lily)
  → job-inbox-workspace + job-inbox-activity-semantics

- **Focused Rosie intake** — Chris refined New job request: open Rosie full-screen in a focused intake mode. Chat plus dropped text, data, files and screenshots populate Request details; when a usable JR exists, return to the normal inbox/detail workspace. The purpose-built intake header is explicitly separate from the app-wide compact-header work. _(via lily)
  → job-inbox-workspace + job-inbox-activity-semantics

- **Copy-ready quote output** — On JR-27, Chris called the quote format “terrible format, no utility.” He needs to copy, paste, send, and move on: each line must show quantity, size, plant, unit price and line total; subtotal last; no agent commentary. _(via rosie handoff)_
  → copy-ready-plain-text-quotes

- **One Suppliers filter surface** — Chris wants one compact Suppliers toolbar, not a duplicated toolbar plus table-header filters. Keep broad Search, a Filters affordance, selected-filter summary/chips, count/pager and Notifications compact; put strict Name contains, City, Type, State and LPS Partner in the advanced filter surface while retaining column labels and sorting. _(via nova handoff)_
  → supplier-filter-consolidation

- **Focused Jobs has one left rail** — Chris’s Jobs reference (`photo_312`, with `photo_314` added as a visual reference) shows the Job Request/thread list as the far-left rail in a focused workspace, not beside the app navigation. A 44px Back control at its top returns to the normal app navigation. The desired result is messaging-style job work with no two simultaneous left rails. _(via nova handoff)_
  → job-inbox-workspace

- **Account popover holds rail actions** — Chris approved moving the desktop rail’s standalone Know your Agents and Supplier view rows into the Chris / Austin Plant Supply account popover, above Log out. Keep the existing mobile More equivalents and existing supplier-view behavior; do not add an Account page. _(via nova handoff)_
  → account-popover-rail-actions

## 2026-08-30

- **Mobile Jobs Back control** — Approved UI direction: remove the mobile in-page Back to jobs control and rely on the browser/device Back action; retain the separate desktop focused-workspace Back behavior. _(via Bhoumik/Lily handoff)_
  → mobile-job-navigation-browser-back

- **Supplier filter refinements** — Approved UI direction: keep Supplier type and State visible on desktop and mobile; use an icon-only advanced trigger with accessible label/tooltip, 44px target and active count; keep Name, City and LPS Partner nested. Mobile advanced filters use a modal bottom sheet with handle/title, explicit 44px X/Close, secondary swipe/backdrop dismissal and sticky Clear all/Show results. Replace mobile’s top Page n of N with quiet bottom Load 50 more paging, while desktop paging and bounded API behavior remain. _(via Bhoumik/Lily handoff)_
  → supplier-filter-mobile-refinements

- **Cultivar selector toggle** — Approved UI direction: Plant Search’s existing Cultivar field/header and chevron should be a 44px open/closed multi-select toggle that preserves selections, exposes expanded state and returns focus on close; no Done step for this single dropdown. _(via Bhoumik/Lily handoff)_
  → plant-search-cultivar-toggle
