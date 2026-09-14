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

- **Availability is supplier sourcing information** — Bhoumik rejects complex availability-change management as unnecessary. Authoritative direction: availability is a supplier response stored in sourcing notes, distinct from Job/Order status; one plant can have one or more supplier responses; Chris/Rosie decide customer communication. _(via bhoumik handoff)_
  → availability-response-change-management + availability-change-indicators + customer-availability-update-workspace

- **Rosie surfaces supplier changes** — Bhoumik resolved that Rosie should surface supplier changes/resubmissions to Chris; Chris decides the response. Supplier changes remain factual sourcing responses, not automatic Job/Order/customer transitions. _(via bhoumik handoff)_
  → availability-response-change-management

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

- **Plant Search toolbar consolidation** — Chris approved the Plant Search refinement shown in Telegram messages 393 and 395: remove City entirely; keep broad Plant Search visible; put Size, Cultivar, Supplier type, State, and Price & dimensions behind a compact icon-only filter control like Suppliers; keep Clear all inside that surface; remove table-header filter inputs while retaining sorting/table behavior; use the live summary `<Companies> Companies: <shown>/<total> Plants` (for example, `17 Companies: 47/47 Plants`); and keep the desktop top row responsive with its existing end action. Cultivar retains its approved toggle behavior and query/filter/results/API meaning stays the same. The second visual reference is part of this same scope, not a separate request. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Plant Search Supplier type placement** — Nova’s review of annotated `photo_396.jpg` initially appeared to mark Size, Cultivar, City, and State but not Supplier type, prompting a clarification. Chris/Nova clarified that the red marks indicate dead horizontal space within controls, **not** removal or keep scope: the original approved filter layout stands. The visual guidance is to content-size controls/panels and reduce wasted horizontal padding while retaining 44px hit targets and readability. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Plant Search final toolbar layout** — Chris’s final confirmation in Telegram message 402 supersedes the earlier Plant Search layout: the one visible row is Search · Size · Cultivar · Supplier type · State · icon-only advanced Filters · exact results summary · existing Notifications/end action. City is removed. Compact the visible dropdowns’ dead space while retaining 44px targets/readability. Every other current table-header filter moves to advanced Filters with Clear all; do not duplicate the four visible selectors. Preserve query/API behavior and Cultivar behavior. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Plant Search responsive filters** — Telegram message 422 / `photo_421.jpg` initially set mobile Search plus one icon and folding at constrained desktop. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Plant Search compact responsive layout** — Chris’s final Telegram message 428 / `photo_428.jpg` supersedes that compact layout: mobile and constrained toolbars are Search · Size · Supplier type · icon-only Filters. Cultivar and State live inside Filters with company/name, stock and dimension filters; Clear all is inside. Wide desktop retains Search · Size · Cultivar · Supplier type · State · icon. Preserve state/query/Cultivar behavior, the exact summary/action, 44px targets and no wrap/clip/horizontal scrolling at 390px. Route this correction after the Supplier Category commit/restart. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Homeowner or landscape professional** — Chris was about to save “Retail” as a customer’s company (screenshot `photo_177.jpg`). New request/job intake instead needs a clear choice: **Homeowner** or **Landscape Professional**, so LPS can work a homeowner as retail customer and a landscape professional through the traditional contractor experience, including pricing. _(via telegram image)_
  → new-job-intake-customer-type-choice + customer-type-retail-landscape-workflow-pricing

- **Customer-type request/order naming** — Chris defined naming and date display by customer type. Landscape Professional Requests/Orders: `Company Name | Job Name`, where job name may be the residence name, street number/name, or PO; it may start blank and be filled as details emerge. Retail: `Retail | Customer Name`. Both show an abbreviated estimated project date, for example `EPD: 8/30/26`. _(via telegram)_
  → new-job-intake-customer-type-choice + customer-type-retail-landscape-workflow-pricing

- **Portal availability statuses** — Chris says the Nursery Portal plant statuses are correct and LPS Ops does not match. The canonical visible Portal set is **Available; Can order; Diff Size/Qty/Sub; Arriving soon; Unavailable**. He also flagged the Portal selector’s white/native dropdown as needing a compact, dark-portal-readable treatment. _(via nova handoff)_
  → portal-availability-selector-dark-style + availability-status-model-parity

- **Focused Jobs rail collapse** — Chris’s Telegram message 407 / `photo_407` asks for the desktop focused-Jobs **Active jobs** rail to collapse fully, freeing the selected job’s detail width, with a visible edge control to expand it again. Keep the list, selection and job/chat work in place; mobile is unchanged. _(via nova handoff)_
  → focused-jobs-rail-collapse

- **Focused Jobs header Back** — Chris’s message 409 / `photo_409` refines the focused rail: remove the separate “Back to All jobs” text row. Put Back as an icon-only, accessible/tooltip-labelled 44px left-arrow in the **Active jobs** header, independent of the collapse control; retain its route/history behavior. _(via nova handoff)_
  → focused-jobs-rail-collapse

- **Focused Jobs Back has no tooltip** — Chris’s message 414 removes the visual tooltip from that icon-only Back control. Retain its 44px target and screen-reader accessible name/`aria-label`; do not change collapse/expand controls. _(via nova handoff)_
  → focused-jobs-rail-collapse

- **Supplier Category badge overlap** — Chris’s desktop Suppliers screenshot (Telegram message 426 / photo 426) shows the **Wholesale Supplier** Category badge overflowing its Category column and colliding with State. The longest normal badge needs its one-line space and a clear gap before State, while shorter badges stay compact and table column layout behavior remains intact. _(via nova handoff)_
  → supplier-category-badge-width

- **All jobs mobile filter space** — Chris’s Telegram messages 431–432 ask for a shorter **Search** on mobile All jobs / Requests and an explicitly **icon-only** Filters control beside it. The current visible controls—Status, Item status, Customer, Created and Updated—are candidates for that single filter surface; **Expand all** is an action, not a filter, and should remain separate. Chris also asked how the list is currently ordered (created versus last updated); Nova is auditing the source/API, so no ordering behavior is assumed or changed yet. _(via nova handoff)_
  → mobile-all-jobs-toolbar

- **All jobs delete action wastes space** — Chris’s Telegram message 435 / `photo_435` says the large mobile collapsed-card **Actions** control holds only Delete and wastes card-summary space. Remove that Actions control from the collapsed summary; place the working **Delete job** control in a compact utility/action area once the card is expanded, retaining the existing confirmation and permanent-delete safety. That area may later hold real Print or Copy plain text actions, but must not display placeholders or nonworking controls. Preserve chevron-only expansion, job name/ID navigation, status/Rosie/card state and deletion permissions/API/history. _(via nova handoff)_
  → mobile-all-jobs-toolbar

## 2026-08-31

- **Focused mobile Job header** — Chris’s annotated focused-Job reference asks for a smaller JR reference; a full Job name that wraps naturally rather than truncating; concise friendly project-date display from existing metadata; compact status; one accessible 44px icon-only Rosie chat bubble instead of the avatar plus “Chat with Rosie” text; and a concise, useful preview. Preserve the existing chat route/thread, status/data semantics, desktop behavior and missing-date handling. _(via nova handoff; Telegram message 439 / photo 438)_
  → mobile-focused-job-header

- **Job and supplier chats stay separate** — Chris resolved the mobile-header chat-control duplication: the one 44px chat icon opens a compact chooser, with `Job chat · JR-<id>` first for the canonical Rosie Job thread, then `Supplier chat · <supplier>` for each linked supplier’s separate existing thread. The chooser routes only; it does not merge conversations. Availability Requests stay in their drawer. It must work by touch/keyboard with clear accessible dialog/menu labels, focus and dismissal, and no icon tooltip. Mobile focused header only; desktop/global behavior stays unchanged. _(via nova handoff; Telegram message 449)_
  → mobile-focused-job-header

- **Rosie avatar opens direct chat menu** — Chris’s live focused-mobile reference changes the generic chat-bubble trigger to Rosie’s icon/avatar. It opens the existing Job/supplier choices directly as a compact anchored dropdown: no visible “Choose a chat” heading, oversized modal header, or Close control. Outside tap/click and Escape dismiss it; keep the invisible accessible menu label/name, 44px target, exact separate/deduplicated routes and keyboard/touch/focus behavior, with no tooltip. _(via nova handoff; Telegram message 468 / photo 467)_
  → mobile-focused-job-header

- **Plant Search desktop search width** — Chris’s Telegram message 441 / `photo_441.jpg`: on wide desktop, Plant Search must match the Search input width to the Company/supplier table column, not flex-fill it; Size, Cultivar, Supplier type, State and Filters sit immediately after. Reuse a shared width/token where practical so the widths do not drift. Compact/mobile Search · Size · Supplier type · icon behavior is unchanged. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Plant Search live toolbar budget** — Nova clarified that the Company panel is resizable from 200–480px and long summaries cannot reliably fit at a fixed 900px desktop threshold. Search tracks the live panel width while wide; if the actual container/panel/summary/action budget does not fit, fold compact rather than force wide, clip, or horizontally scroll. _(via nova handoff)_
  → plant-search-toolbar-consolidation

- **Focused Job details tray** — Chris’s Telegram messages 452/454 and annotated references remove the redundant boxed Request, Contact, Delivery, and Billing & Payment panels from focused Job details. Keep Job/customer identity in the header and status, totals, and plants immediately visible; reuse the existing More details & notes disclosure as one compact collapsed-by-default tray. Expanded details use exact stored Contact, Payment contact/billing and Delivery values in compact vertical signature-style blocks, not horizontal boxes; the closed row gives only a truthful concise summary/count. Existing edits/data, desktop/mobile behavior, touch/keyboard accessibility, and workflows remain intact. _(via nova handoff; Telegram messages 452/454 / photos 452/454)_
  → focused-job-details-tray

- **Focused Job header date and fulfillment** — Chris’s message 456/photo 454 balances focused Job header status/stage at left, a centered full Job name with secondary JR reference, and date plus fulfillment at right; narrow views may stack but must never truncate the name. Message 458 makes that right-side order exact: **Estimated project install date**, then a **Delivery/Pickup selector** immediately right. The selector/date must use persisted structured values and an actual update path; neither Delivery/Pickup nor any date may be inferred from an address or notes, and Nova must not ship a fake selector. Audit whether that contract already exists; if not, the durable data/workflow slice is staged for Bhoumik and Nova owns only the honest layout. Chris’s message 461 confirms the same clean mobile organization: a single collapsed-by-default **Contact, Payment, Delivery, Other** tray, with concise primary header/status/table and no separate boxes. Ignore `photo_460.jpg` markup. _(via nova handoff; Telegram messages 456/458/461 / photo 454)_
  → focused-job-details-tray + job-request-install-date-fulfillment

- **Gate code and payment method** — Chris’s message 464 adds two Job Request workflow facts: a dedicated **Gate code** under Delivery, and an exact Payment method choice ordered **Card on File, Terms, Call for Payment, Payment at Pickup**. Audit confirms neither has a schema/read/API/approved-write contract. The existing immutable Job Request changelog can audit approved fields once added. Neither currently leaks to supplier/customer paths, but the contract must make both internal-by-default: never auto-copy Gate code into supplier-visible LPS notes/portal or either value into customer external notes/quotes. Nova must not add non-persisting controls; the details tray only displays/edits after Bhoumik's contract exists. _(via nova handoff; Telegram message 464)_
  → focused-job-details-tray + job-request-install-date-fulfillment

- **Pricing update arrived on wrong job** — From the JR-31 page, Chris sent “Update pricing!!!” but it arrived on JR-30. He then said, “Can’t take 40 minutes.” The focused Job’s current request must be the direct destination for its chat action; correcting a price must receive immediate acknowledgement while any real source/availability check stays honest. _(via Rosie handoff)_
  → focused-job-chat-routing + urgent-pricing-update-workflow

- **Exact editable request identity** — On JR-36, Chris was frustrated—“jeeze, why is this so hard.”—when the site-only job-name convention did not produce the identity he wanted. He explicitly requested the displayed name `Outdoor Renovations | 803 Redbud | Kyle Stoutenger` (company | site | contact), and Rosie set it exactly. This conflicts with treating `job_requests.name` as only a job/site value plus automatically composed company/job presentation: Chris expects to correct the displayed Request identity directly. LPS must separate a durable job/site name, a composed display identity, and any explicit editable display override so later company/contact corrections do not silently duplicate or overwrite his requested title. _(via rosie handoff)_
  → job-request-display-identity + focused-job-name-inline-edit + customer-type-retail-landscape-workflow-pricing

- **Contractor in job identity** — On JR-34, Chris asked that the job name include the contractor: company **Land Water Light**, job/site **Ox Eye phase II**. This supports the normal composed presentation of company plus job/site, while JR-36 shows that Chris may also demand a direct exact composite identity. The current one-field model cannot distinguish these cases or support an editable combined title without risking duplicate company/contact text. _(via rosie handoff)_
  → job-request-display-identity + focused-job-name-inline-edit + customer-type-retail-landscape-workflow-pricing

- **Company then job name** — Chris clarified, on JR-32, that a displayed Landscape Professional job name is company first, then job: `Oviedo Land and Garden — Job #1`. This confirms the prior Landscape `Company Name | Job Name` direction but changes the displayed separator to an em dash. Rosie renamed JR-32 as directed. It does not by itself establish a new short-description fallback rule. _(via Rosie handoff)_
  → new-job-intake-customer-type-choice + customer-type-retail-landscape-workflow-pricing + rosie job-requests skill recommendation

- **All jobs card hierarchy** — Chris’s Telegram message 475 / `photo_474` makes the mobile All jobs card hierarchy explicit: primary information/actions are **Company/Customer name**, **Job name**, then **status** and the Rosie avatar. JR reference and date are secondary metadata and must not compete in the header. Preserve expanded-card behavior, canonical Rosie Job-thread routing, 44px avatar/control target and responsive no-overflow behavior. _(via nova handoff)_
  → mobile-all-jobs-toolbar

- **All jobs exact one-line hierarchy** — Chris’s message 476 supersedes the wrapping reading: the primary mobile All jobs row is exactly **Company/Customer · Job name · Status · Rosie avatar**. Company/Customer and Job name flex and truncate with one-line ellipses; Status and Rosie stay fixed accessible 44px targets. JR/date, if retained, belong in secondary metadata elsewhere. _(via nova handoff)_
  → mobile-all-jobs-toolbar

- **Collapsed All jobs shows Pending only** — Chris’s message 479 says a **collapsed mobile** All jobs card shows only the Pending plant-status count/indicator. Hide Available, Substituted and Unavailable there; keep the full statuses in expanded/details unless changed later. Preserve the exact existing Pending count and filtering semantics and leave desktop unchanged. _(via nova handoff)_
  → mobile-all-jobs-toolbar

- **Mobile All jobs date format** — Chris’s message 481 proposed the secondary mobile All jobs card date as exact `M/D/YY` with no leading zeros, for example `8/8/26`, rather than `Aug 8 2026`. Nova confirmed the currently shown date is **last updated**, not a structured Estimated Project Date (EPD); Chris immediately asked whether it was created or EPD. Message 485 resolved it: remove Last updated from the mobile summary; move it to expandable Request/Job details; use no fake blank or reformat. A later summary-header date can only be optional structured **Install Date** with structured Pickup/Delivery, blank until deliberately supplied/editable—never created, updated or note-parsed. _(via nova handoff; messages 481–482, 485)_
  → mobile-all-jobs-toolbar + job-request-install-date-fulfillment

- **Desktop All jobs card identity** — Chris’s message 496 / `photo_495` specifies a desktop card’s primary identity as **Contractor/Company · Job name** on one line, for example `Urban Landscape Group · Oak Grove Rd. planting`. Contact person is quieter secondary information. Fixed JR, status, date, action and supplier controls must not be displaced; long Unicode identity may ellipsize. This is desktop-only and preserves the shipped mobile two-row card, expanded behavior, filtering, ordering and API semantics. _(via nova handoff)_
  → mobile-all-jobs-toolbar

- **Mobile All Jobs excludes Item Status** — Chris’s message 558 / `photo_557` removes **Item Status** from the mobile Filters sheet. Mobile results include all item statuses: no hidden item-status selection may constrain its query/results or appear in its filter badge/deviation. Desktop is unchanged. Responsive switching and session restore must keep a desktop Item Status choice from silently affecting mobile, while preserving it truthfully for desktop when returning. _(via nova handoff)_
  → mobile-all-jobs-toolbar

## 2026-09-01

- **Shipped All Jobs card is terrible** — Chris called the just-shipped mobile All Jobs card “pretty terrible.” He approved superseding the prior one-line summary with an ultra-condensed collapsed two-row card: Row 1 has the sole chevron, flexible `Company/Customer · Job name`, then JR immediately left of compact sales status; Row 2 has Pending at left and Rosie Chat at right. Remove the full-width Pending bar and collapsed customer/contact/note detail; show those only expanded. Do not invent PO, install date, Pickup or Delivery facts from the visual reference. _(via nova handoff; Chris Telegram message 489/photo 489)_
  → mobile-all-jobs-toolbar

- **All Jobs exact row-one order** — Chris immediately refined the collapsed mobile All Jobs Row 1 to `JR-32 · QD · Company/Customer · Job name · Install date · Delivery/Pickup`, matching photo 489. Row 2 remains Pending · Rosie Chat. The sole accessible expansion control stays at the card edge without interrupting that data order. Install date and Delivery/Pickup are omitted now: both await the staged persisted contract and must never appear blank, fake or inferred. _(via nova handoff; Chris Telegram message 491)_
  → mobile-all-jobs-toolbar

- **Live All Jobs v2 is still poor** — Chris’s live message 533/photo 532 says the shipped two-row mobile cards are still visibly poor: they are excessively tall with dead vertical space; the Pending/Rosie row is unclear because the Rosie avatar floats unlabeled at the bottom right; `Src`/`QD` are cryptic; identity truncates early because of padding/fixed controls; and a blank job name repeats the separate JR reference (`Unassigned customer · JR-33`). Missing Install Date/Pickup is expected, not a defect—they remain absent until the persisted contract exists. Corrective direction: truly tight two rows, 10–12px outer vertical padding, 6px gap, labelled Pending and visible Rosie Chat, understandable compact status, no duplicate-JR fallback, and 44px accessible controls/no overflow. _(via lily handoff; Chris Telegram message 533/photo 532)_
  → mobile-all-jobs-toolbar

- **Remove All Jobs chevron** — Chris’s message 537/photo 532 supersedes the just-proposed edge-chevron correction: the mobile All Jobs arrow exists only for inline expansion and should be removed. Reclaim its space for the direct scan row: `JR · FULL sales status · Customer/Company · Job name`; no `Src`/`QD` abbreviations. Row 2 stays Pending · visible Rosie Chat. Job identity opens focused Job, which must retain secondary details, full plant status and safe confirmed Delete so no action becomes inaccessible. _(via nova handoff; Chris Telegram message 537/photo 532)_
  → mobile-all-jobs-toolbar

- **Bhoumik weekly availability priorities** — Bhoumik set this week’s order: **(1)** make Job Request and availability-request status meaning match; **(2)** provide an out-of-network supplier a public/live availability-request path and let LPS make an individual request; **(3)** optimize the availability-request view for mobile. Status parity remains a staged model/workflow decision; the public out-of-network and individual-request path is now staged; the mobile LPS Ops detail refinement is an independent Nova UI slice awaiting routing. _(via bhoumik handoff)_
  → availability-status-model-parity + out-of-network-public-availability-request + mobile-availability-request-view

- **Authoritative sales and plant statuses** — Chris set the exact separate vocabularies: Sales: **Active, Quote, Availability, Confirmed, Won, Lost**. Plant Status Request: **Available, Unavailable, Diff Sz/Qnty/Sub, Can Order, Arriving Soon, Pending**. Plant Status Orders: **Available, Unavailable, Different Sz/Qnty/Sub, Need to Order, Arriving Soon, Pending**. This supersedes the prior Portal five-label set and earlier sales labels where they conflict. Request and Order plant labels intentionally differ, so Bhoumik must define stored models, permitted actions and migration before Nova maps UI vocabulary. _(via Lily handoff)_
  → availability-status-model-parity + lps-ops-job-request-statuses + portal-availability-selector-dark-style

- **Desktop All Jobs / focused hierarchy** — Chris’s message 498 / `photo_498` extends the compact Job hierarchy to desktop All Jobs expanded details and focused Job work: JR plus Sales status left; future structured Install Date plus Delivery/Pickup at right. Expanded information is compact signature columns for Contact, Payment Contact, Delivery, and Payment Method/Gate. Chris’s message 502 immediately supersedes the prior centered identity rule: exact order is `Contractor/Company Name | Job Name | Contact`, using stored nonblank segments only and omitting every missing segment/separator, with the existing honest unassigned fallback; one-line ellipsis. Mobile v2 is unchanged. Chris’s message 504 adds the exact missing-Job-Name middle fallback: request `created_at`, labelled `Created M/D/YY` (for example, `Created 9/1/26`); never use updated time, notes or inferred Install Date, and use existing honest JR fallback if created time is invalid/missing. Chris’s message 506 supersedes that simple fallback with this structured priority when explicit Job Name is absent: stored PO labelled `PO: …` → contractor stored customer/job name → structured street/address line → Created date; do not parse notes, infer values, or duplicate outer Contact. Auditing schema/read/API to use only actual fields and stage any absent field for Bhoumik. Nova can safely arrange only known identity/status and existing values now; Install Date, Delivery/Pickup, Payment Method and Gate remain absent until Bhoumik’s staged durable contract, with no inference. _(via nova handoff)_
  → focused-job-details-tray + job-request-install-date-fulfillment + mobile-all-jobs-toolbar

- **Oak Grove intake extraction confirmed** — Chris’s messages 508/511 confirm the source-email example: **Urban Landscape Group | 16202 Oak Grove Rd. | Johnathan**. The explicit source Job line/address/contact can become structured intake facts; it is not permission to parse later generic notes. `3/5 gal` remains ambiguity, and “Delivery next Tuesday” may be normalized only as a confirmation-required candidate from `received_at` with provenance—Nova did not mutate data, contact anyone, or source plants. Current delivery date/mode remains absent and belongs in Bhoumik’s staged contract. _(via nova handoff; Chris messages 508/511)_
  → focused-job-details-tray + job-request-install-date-fulfillment

- **Relative delivery date must be intake fact** — Chris’s message 513 confirms that relative source language is resolved during intake and retained with traceability: an email received Tue Aug 18 2026 saying “Delivery next Tuesday” yields a confirmation-approved estimated date Tue Aug 25 2026. He calls it **estimated order date**, while earlier direction says Install Date; Bhoumik must resolve whether this is requested delivery, estimated order, estimated install, or separate durable facts before schema/UI. Never substitute created/updated time or infer later from notes; no existing record was mutated. _(via nova handoff; Chris message 513)_
  → job-request-install-date-fulfillment

- **Active Jobs rail customer identity** — Chris’s message 519/photo 519 says expanded desktop Active Jobs cards hide customer identity. Under every selected and unselected Job name, show quiet one-line stored **Company/Customer · Contact** (example: `Land Water Light · Dior Goodwin`), with only honest nonblank fallback/omission and ellipsis. Preserve 292px rail fit, existing status/snippets/timestamps/navigation/order, and the 44px collapsed icon-only rail; mobile is unchanged. _(via nova handoff)_
  → focused-job-details-tray

- **Durable Job top line and private facts** — Chris’s message 527 defines the future top line for LPS Ops and wholesale request views: Job status · Customer/Contractor · Job identifier · requested/estimated fulfillment date · Delivery/Pickup. The compact internal tray includes Contact, Payment Contact, Delivery address, delivery instructions/Gate, exact Payment Method **Over the Phone, On File, At Pick Up, Terms, Check**, and Tax Status **Exempt, Non Exempt**. All fields need Bhoumik’s nullable contract, API/create/edit validation/audit/permissions and visibility decision. Wholesale gets top-line fulfillment facts only; payment/tax/gate/private contacts stay hidden without Chris’s explicit approval. _(via nova handoff; Chris message 527)_
  → job-request-install-date-fulfillment + focused-job-details-tray

- **Values-only identity and editable Job name** — Chris’s message 542/photo 542 rejects literal Contractor/Company/Job/Contact display labels; show stored values only. He also asked to edit Job name. Audit confirms an existing internal Job-name update path, immutable old/new history and focused refresh; a safe Nova UI edit trims input, cancels blank rather than clearing the name, refreshes truthfully after save, and changes no JR/thread/line/AR/history identity. Concurrent last-write-wins protection or an explicit Unname action would need Bhoumik. _(via nova handoff)_
  → focused-job-details-tray + focused-job-name-inline-edit

## 2026-09-11

- **Fulfillment facts stay in notes** — Bhoumik recommends the current simple approach: keep fulfillment date/mode, gate, payment and tax handling in internal Job notes rather than add structured fields, API, selectors or automatic header/wholesale display. State known/estimated/confirmation-needed facts explicitly; do not leak Gate/payment/tax/private contacts into supplier/wholesale/customer-facing content. Reopen structured work only with a demonstrated need for filtering, reporting, automated header, controlled sharing, or workflow. Chris’s earlier header date/selector request is deferred under this notes-first decision. _(via bhoumik handoff)_
  → job-request-install-date-fulfillment + focused-job-details-tray

- **Visual QA before UI release** — Chris says the live mobile All Jobs card structurally passed but still looked poor and asked for a QA agent. He approved a dedicated independent visual QA gate before UI deploy: real-browser screenshots at 320/390/480px and desktop, reference-image comparison, review of spacing/hierarchy/truncation/labels/control placement/touch targets/expanded states, attached evidence, and authority to block release. Technical review remains for correctness, not visual approval. _(via telegram message 534 / photo 532)_
  → visual-ui-qa-gate

## 2026-09-03

- **Supplier access should match the work** — Chris’s access design: web access should be frictionless for a single availability request, while nursery power users can install/authenticate. LPS Ops or Nursery Ops can share a public link for one request; it expires when that request changes status. A nursery power user needs a fast way to share with their team for updates, and prospective nurseries must not be forced to authenticate. Authentication/device trust is for Nursery Ops’ aggregate sensitive data, not a prerequisite to a one-off request. _(via telegram / Lily task handoff)_
  → supplier-access-authentication + out-of-network-public-availability-request

## 2026-09-10

- **Public availability requests delivered** — Bhoumik reports that Share → Make public now creates a no-sign-in, single-request supplier URL for active LPS Partners; it supports the portal request layout, response, printing and submission, Copy/Copied confirmation, Make private revocation, agent-created public requests, and expiry when the Job status changes. Audit confirms that bounded active-Partner slice. It does **not** yet let a prospective out-of-network non-Partner receive the request; nor does it deliver the authenticated Nursery Ops/team/device/aggregate-access or access-audit contract Chris described. _(via Bhoumik / Lily task handoff)_
  → supplier-access-authentication + out-of-network-public-availability-request

- **Wholesale request work buckets** — Chris defined the portal/wholesale request buckets as **New**, **Processing**, **Completed**: New blue, Processing amber/orange, Completed green, with the same semantic treatment in filters/counts and rows/cards. Red is only error/blocked/destructive; labels/icons must not rely on color. He wants multi-select rather than one tab: New + Processing opens by default, Completed excluded; Select all gets all three; a completed request leaves the active selection immediately; counts and all-caught-up state must be truthful. The future date and Delivery/Pickup top line waits for Bhoumik’s persisted contract—no inference. _(via nova handoff)_
  → portal-request-work-buckets

- **Plant Search toolbar visual unity** — The Plant Search Size, Cultivar, Supplier type, and State dropdowns plus Filters button look awkward beside Search (message 548 / photo 548). Keep the responsive/content-aware toolbar behavior, but make the controls look like one coherent toolbar; require real-browser visual review at wide and constrained desktop plus 320px, 390px, and 480px before release. _(via nova handoff)_
  → plant-search-toolbar-visual-unity

- **Supplier email identity and handoffs** — Chris uses `chris.r@localplantsupply.com` to engage suppliers; Daisy has that access and Rosie does not. He suggested a `sourcing@` identity for Rosie but does not want suppliers confused by multiple sender names. For a live ask such as 4-inch live oaks from three suppliers, he sees Rosie handing the supplier work to Daisy through the established relationship and Daisy returning results for Rosie’s job/customer coordination. Supplier management/grower buying and order/customer management are different work; Daisy may eventually need supplier-specific workers. A credential was exposed in Telegram; its value is intentionally not retained. _(via telegram / Lily task handoff)_
  → supplier-email-identity-and-handoffs

- **Recurring APS sedge pricing match** — “this recurring plant-name matching issue keeps happening.” For JR-37/AR-19, Chris requested APS master-pricing correction: **Berkeley Sedge, 1 gallon** should use APS’s **1 G Sedge** price (not sage). He wants these recurring name/equivalence corrections to persist in APS pricing rather than be rediscovered on each Job Request. Daisy is correcting APS inventory; Rosie is separately correcting the current JR/AR. _(via daisy / rosie handoff)_
  → one-gallon-sedge-price-mapping

- **Simple APS Berkeley Sedge correction** — Chris clarified the desired solution now is simple: add **Berkeley Sedge, 1 gallon** as an APS price-sheet line at the APS **1 G Sedge** price. Do not imply or force a complex alias/equivalence mechanism; a broader systemic mechanism is only for future review if repeated cases warrant it. _(via Lily handoff)_
  → one-gallon-sedge-price-mapping

## 2026-09-04

- **Cherry laurel geography filter** — Chris asked “who has 6 foot cherry laurel in FL”; Daisy filtered Florida and answered none, leaving out Lake Tree Growers, GA’s exact **15 G, 6–7 foot Cherry Laurel ($73)**. Chris asked why it was not returned first. His rule: exact plant/size matches come first and supplier location must be clear; geography/delivery is a separate qualifier, not an early exclusion unless he explicitly says local-only/Florida-only. _(via Daisy handoff from Chris web chat)_
  → plant-search-match-before-geography + plant-search-result-location-clarity

## 2026-09-09

- **Customer-review status color** — While reviewing copy-ready availability/quote text in LPS web chat, Chris said, “use the color coding in the status font color.” He wants the customer-review status field to use the app’s visual status treatment for **Available, Unavailable, Alternative,** and **Awaiting confirmation**, rather than neutral text. _(via Rosie handoff)_
  → customer-review-status-color

- **Awaiting confirmation correction** — Chris corrected the proposed reading: **Awaiting confirmation is not a status**; it is an internal note and must not be included in customer-review status or color mapping. Plant and Request/Job statuses still have not been updated, so the UI must not paper over the missing authoritative contract. _(via Lily)_
  → customer-review-status-color + availability-status-model-parity

- **APS Palo Verde price missed** — Rosie initially said there was no APS 48-inch Palo Verde price. Chris supplied a photo of the APS spreadsheet showing **Palo Verde Desert Museum 48 inch Box** at **$2,395**; Rosie corrected it. Chris said, “Uhh you’re not ready for showtime. Please escalate this. Your ability to pricing seems often error prone.” _(via Rosie escalation)_
  → pricing-lookup-reliability + one-gallon-sedge-price-mapping

- **Palo Verde photo reading corrected** — Bhoumik challenged the claimed APS 48-inch/$2,395 row. Rosie’s read-only reconciliation found `photo_94` and live APS data agree: **15 G $195, 30 G $275, 24-inch box $395, 36-inch box $895**; there is no active or inactive 48-inch record. The $2,395 line was an agent photo misread/misattribution, not a missing/deleted source row. The escalation still demonstrates the need to verify an exact source row before making a price claim. _(via Rosie)_
  → pricing-lookup-reliability

- **Palo Verde source conflict clarified** — Daisy then confirmed the current APS PDF is unchanged and lists **48-inch Desert Museum Palo Verde at $2,499**. The manually evidenced **$2,395** was added as an exact inventory offering, explicitly flagged **confirmation-required** because it conflicts with the current PDF. Pricing must surface the conflict rather than call either price settled; neither price asserts current availability. _(via Rosie/Daisy)_
  → pricing-lookup-reliability

- **Rosie turquoise and CR blue** — Chris wants the bright turquoise used for Rosie and the distinct light blue used for “CR” and the left rail in message 562 / photo 562 added as reusable app palette accents. _(via Nova handoff)_
  → app-accent-palette-tokens

- **File-tree reference** — Chris sent photo 229 with no caption: a blue file-tree interface with a root `Daily` folder, a selected root `CLAUDE.md`, broad folders such as Team, Projects, Resources and Onboarding, and an expanded Context folder containing strategy, stakeholders, pain points, organization, operator, infrastructure, ICP and brand files. No LPS app screen or palette treatment is shown. _(via telegram image)_
  → (watching)

- **Mobile field request work** — Chris tried updating a request from his phone while walking the yard yesterday; “it was not great,” and easy/effective mobile request work is critical. The concern spans finding the right request, understanding it, making a safe change and knowing it landed while moving through the yard; he did not identify a discrete screen defect. _(via telegram)_
  → mobile-field-request-workflow

- **Old Rosie field patterns** — Chris adds that request UI must be easy to read/navigate, provide quick response and let him move through a request; old Rosie on Vercel had “many better UI/UX elements” despite time spent on the current app. Git history review found a concrete legacy response-state badge (Queued, Working, Done, Failed), but also legacy workspace-file optimistic writes, customer-order layout and item filtering that should not be restored. The supported gap is a truthful per-request response/outcome state, split into a staged workflow contract and dependent Nova display. _(via telegram)_
  → mobile-request-update-response-workflow + mobile-request-update-response-state

- **Future customer deal dashboard** — Chris shared `photo_250.jpg` as a future Customers-tab reference: a major CRM’s deals board grouped by stages/statuses (Project Details/Quote Requested, Quote Delivered, Order Confirmed, Closed Won, Closed Lost), with deal cards and stage totals. It is **not a priority today**, but is near-future direction. The reference is for a customer/deal view, not an instruction to copy that CRM or its exact stages. It may eventually need to distinguish early quick-quote opportunities from converted sourcing Requests, and reconcile with LPS’s separately staged Sales vocabulary (**Active, Quote, Availability, Confirmed, Won, Lost**). _(via telegram image)_
  → (watching)

- **Deal reference utility icons** — Chris added `photo_252.jpg` to call out the reference CRM’s compact left-rail icons as potentially useful. The image does not identify what each unlabeled icon does, nor ask LPS to add that navigation. Retain only the design principle: a future Customers/deal workspace may adopt compact icon actions only where each solves a specific, real LPS task; no icon, destination, or new navigation is inferred from this reference. _(via telegram image)_
  → (watching)

- **Desktop Notifications move to rail** — Chris’s marked Telegram message 565/photo 565 asks to move the desktop Notifications trigger from its floating top-right position to the lower-left navigation rail, immediately above Settings and the utility/account area. Keep one desktop control and its existing unread count, filters, Mark all read, click-through, scroll, keyboard and dismissal behavior; Mobile’s bottom-left Alerts stays unchanged. _(via nova handoff)_
  → desktop-notification-rail-trigger

- **Supplier Portal Notifications move to identity rail** — Chris’s marked Telegram message 568/photo 568 extends the desktop move to the Supplier Portal: place its top-right bell at the marked supplier identity/avatar spot in the left rail. Preserve the portal’s separate supplier request/chat unread count, panel, actions, routing, focus, keyboard, outside-click and scroll behavior; it must never reveal LPS Ops internal all-agent notifications. Remove the old portal trigger with no duplicates; mobile portal Alerts is unchanged. _(via nova handoff)_
  → desktop-notification-rail-trigger

- **Status model reported done** — Bhoumik reports weekly priority item 1 status model/migration is “Done.” Lily’s audit finds the exact Sales set and Job/Order plant wording implemented, with legacy migration/readability and distinct stored availability-request values; but Request/Portal UI still shows **Different Sz/Qnty/Sub** and **Need to Order**, not Chris’s authoritative **Diff Sz/Qnty/Sub** and **Can Order**. The item is partial, not shipped, until the Request UI mapping is corrected without changing its saved semantics. _(via bhoumik handoff / Lily audit)_
  → availability-status-model-parity + lps-ops-job-request-statuses

## 2026-09-11

- **Public out-of-network access done** — Bhoumik reports work-list item 5, Public/out-of-network availability access, is done. Re-audit requested against Chris’s core one-request/no-sign-in prospective-supplier and team-sharing needs, not optional audit/device safeguards Lily previously proposed. _(via Bhoumik, Telegram 276, 2026-09-11 04:51:20 CDT; Lily handoff)_
  → supplier-access-authentication + out-of-network-public-availability-request

- **Public access completion verified** — Current audit confirms the former non-Partner rejection is gone: active prospective suppliers receive a one-request public URL without a portal account, authenticated nursery users can share to unauthenticated teammates, and aggregate portal access stays gated. Won/Lost/legacy Archived or Job deactivation now expires links; working stages including Confirmed stay open. Rosie's supplier procedure covers approved HTML email with the URL. Marked core shipped; optional device/audit proposals are not blockers. Live verification was signed-out GET-only, not a real request/email test. _(via Lily audit, 2026-09-11 04:53:48 CDT)_
  → supplier-access-authentication + out-of-network-public-availability-request

## 2026-09-11

- **Audit existing pricing controls first** — Bhoumik says the false no-price was an exception and existing search RPC/skills cover the proposed safeguards; asks for an independent audit of current code and procedures before adding controls. Prior Palo Verde handoffs contradict one another and include a photo misread: prices and systemic-failure claims remain unverified pending evidence. _(via Lily main handoff, 2026-09-11 04:51:42 CDT)_
  → pricing-lookup-reliability (audit in progress; no implementation authorized)

- **Palo Verde assurance retracted** — Rosie/Daisy retract the September 10 completion assurance: the inserting worker never inspected the original photo, used a parent relay, did not freshly hash the PDF, did not complete visual row/source reconciliation, committed before limited post-write QA, and ran no grade/provenance regression tests. The reported 40-line gap was only an unverified regex count difference. The added offering was not source-verified or quote-ready; confirmation language was notes only, not a selection/quoting block. _(via Rosie/Daisy read-only correction, 2026-09-11 04:55:58 CDT)_
  → pricing-lookup-reliability (audit correction)

- **Original photo is different evidence** — Lily independently inspected Rosie inbox photo_90.jpg (Chris original, September 9 message 90) and photo_94.jpg (Bhoumik later database screenshot). The original does visibly contain a 48-inch Desert Museum Palo Verde spreadsheet row and a right-edge-cropped price; the later screenshot shows only four smaller catalogue offerings. Thus the earlier conclusion that the original photo was misread rested on the wrong artifact. The original crop shows no supplier/date authority or source precedence, so it still does not establish a current quote-ready price. _(direct read-only image inspection, 2026-09-11 04:55:58 CDT)_
  → pricing-lookup-reliability (evidence correction; no settled price claim)

- **Created is not sent** — The public-access audit found All Jobs says “Availability request sent” after an endpoint that creates a record/link, not an email. Lily main authorized the nonblocking UI-only correction: use created/link-ready success feedback, preserve all email dispatch and access behavior, and keep core item 5 complete. _(via Lily audit / main direction, 2026-09-11 05:01:02 CDT)_
  → availability-request-created-feedback

- **Pricing audit narrows follow-up** — Read-only audit finds most safeguards already present; no search RPC defect reproduced. Keep the broad pricing workflow proposal held. Separate the incident’s source/QA execution overclaims from narrow local helper issues (equivalent-size false blank, partial-identity automatic prefill, omitted grade evidence); do not claim those caused the incident. No implementation authorized. _(Lily audit for Bhoumik, 2026-09-11 04:56:53 CDT)_
  → pricing-lookup-reliability (audit reviewed; broad proposal held)

- **Customer type minimum first** — Reviewing item 6, Bhoumik asks whether the customer table needs a type column for now. Lily recommends, **if proceeding**, one nullable customer-level **Homeowner / Landscape Professional** type, separate from the real company; existing unknowns stay unset and Jobs use their linked customer’s type. Per-job copies/snapshots are not current prerequisites. Pricing and split workflows stay unchanged until Chris defines the policy. This is a recommendation to Bhoumik, **not authorization to implement**. _(via Bhoumik / Lily main, 2026-09-11 05:18:33 CDT; captured 05:19:04 CDT)_
  → customer-type-retail-landscape-workflow-pricing + new-job-intake-customer-type-choice (minimal scope recommended; policy open; not authorized)

- **Quote handoff manual first** — Lily’s item-7 recommendation to Bhoumik keeps the business goal: an early indicative quote without premature sourcing, then reuse customer/plant/quantity details in a sourcing Job Request when the customer returns. Start by evaluating existing Rosie quoting plus manual Request creation, retaining the original quote reference and reviewing changed requirements/current price/availability. A separate Quotes view, new quote database, conversion engine or dashboard is not a prerequisite. This is a recommendation, not implementation approval or a claim that today’s quote path works without a Job Request. _(via Lily main, 2026-09-11 05:25:29 CDT; recorded 05:27:41 CDT)_
  → quote-opportunity-to-job-request-conversion (manual-first recommendation; not authorized)

- **Customer type reported done** — Bhoumik replies “Done” to the minimal customer-level type recommendation. Verify the narrow classification/storage contract separately from optional intake UI and still-undefined pricing/workflow policy; do not reopen former per-Job snapshot or broader workflow prerequisites. _(via Bhoumik, Telegram 288, 2026-09-11 05:33:34 CDT; Lily main handoff 05:33:52 CDT)_
  → customer-type-retail-landscape-workflow-pricing (completion reported; read-only verification)

- **Customer storage completion scoped** — Read-only migration/source review supports closing item 6’s minimal storage contract: nullable **Homeowner/Retail** or **Landscape Professional**, no default/backfill, real company separate. The application note records all nine existing customers still unset; Lily’s direct live DB re-check could not connect because her environment lacks configuration. Customers read/edit controls exist in source; frontend deployment/real saves were not independently tested. Jobs retain customer-linked lookup access but their embedded customer response does not yet include type; focused intake UI remains optional. Pricing and workflows are unchanged in the inspected change, with commercial policy still open. _(via Lily read-only audit, 2026-09-11 05:33:52 CDT)_
  → customer-type-retail-landscape-workflow-pricing (shipped · minimal storage) + new-job-intake-customer-type-choice (optional follow-on)

- **One JR, quote without AR** — Bhoumik explicitly corrects item 7: create the Job Request from the beginning; asking Rosie for a quick quote generates the quote without an availability request, and when the customer returns Chris asks Rosie to send an AR on the same JR. He asks for current skills/status verification and says maybe update instructions/vocabulary; this is not permission to change them. Lily’s separate-opportunity/manual-new-JR recommendation is challenged, not a mandatory build. _(via Bhoumik, Telegram 289, 2026-09-11 05:38:08 CDT; Lily handoff 05:38:55 CDT)_
  → quote-opportunity-to-job-request-conversion (same-JR correction; read-only audit)

- **Current one-JR path verified in source** — Rosie’s current intake/quote/routing instructions already create/reuse the JR for an explicit quick quote, preserve quote_only context and skip AR/contact; later explicit sourcing uses the same job. Current six labels already match Active, Quote, Availability, Confirmed, Won, Lost. Quote is completed pricing work, not necessarily customer delivery; supplier input does not advance Sales status. Current confirmation rules allow direct confirmation from Quote/Active without an AR, unlike Lily’s older proposed verification gate. Nine local status tests passed; no live quote/AR/send or deployment verification was performed. Corrected the separate-record requirement; no implementation or skill edits authorized. _(via Lily audit and Rosie read-only clarification, 2026-09-11 05:40:53 CDT)_
  → quote-opportunity-to-job-request-conversion (current skills/source supported; no new build authorized)

- **Order management waits for sourcing** — Bhoumik decides item 8, order dispatch and supplier replies, should wait until the sourcing workflow is stabilised: do not get into order management yet. Retain Chris’s plain-text order-email, email/portal reply and future Order Details-link requirements for later review, but remove urgent/build-ready priority. This deferral does not alter working supplier availability requests, existing quoting/customer communication or implemented sourcing behavior. _(via Bhoumik, Telegram 293, 2026-09-11 05:54:49 CDT; Lily main handoff 05:55:18 CDT)_
  → order-dispatch-and-supplier-response (staged · deferred pending sourcing stabilisation)

- **Familiar supplier sender first** — Lily elaborated item 9 to Bhoumik: Chris’s core concern is a familiar supplier-facing sender and no duplicate or split outreach. Rosie-to-Daisy sourcing handoffs and Sales/Sourcing mailbox choices remain proposals, not approved ownership changes. The smallest recommended next step is to inspect existing access/routing before proposing changes, not create new subagents, mailboxes or workflows. Current scope is supplier sourcing only; grower purchasing/order management is deferred with item 8 until sourcing stabilises. No new audit or implementation is authorized by this clarification. _(via Lily main, explanation 2026-09-11 05:55:19 CDT; captured 05:56:16 CDT)_
  → supplier-email-identity-and-handoffs (staged · inspection-first recommendation; changes unapproved)

- **Daisy onboarding, Rosie coordination** — Bhoumik’s explicit responsibility clarification: Daisy handles **only supplier onboarding and receiving suppliers’ published availability data**; Rosie handles **all order coordination**. Lily removed the proposed Rosie-to-Daisy supplier-sourcing coordination handoff. Mailbox identity/access is a separate setup question; deferred purchasing implementation under item 8 does not transfer ownership to Daisy. _(via Bhoumik, Telegram 297, 2026-09-11 06:08:23 CDT; Lily main handoff)_
  → supplier-email-identity-and-handoffs (ownership clarified; no delegate-to-Daisy coordination workflow)

- **Discuss roles and setup with Chris** — Bhoumik immediately followed with “let me discuss this with Chris.” Record his stated responsibility boundary, but hold item 9 implementation/setup pending that discussion. No new coordination/mailbox/skill/config changes, audit or action handoffs are authorized; Lily told him changes are on hold. _(via Bhoumik, Telegram 298, 2026-09-11 06:08:37 CDT; Lily main handoff 06:09:23 CDT)_
  → supplier-email-identity-and-handoffs (staged · implementation/setup on hold for Bhoumik–Chris discussion)

- **Mobile journey before new states** — Lily’s item-10 explanation to Bhoumik retains Chris’s actual goal: readable, navigable, quick mobile request updates with context preserved. The recommended first step is QA of the existing end-to-end journey and save/send/error feedback, not a new status model or backend queue. Lily’s durable Queued/Working/Done proposal is optional and unapproved, not Chris’s settled requirement or a prerequisite. A sent/received message does not prove a request update completed. Prior work was source/docs/history review, not proof that every current path was tested. No new test, build or routing authorization was given. _(via Lily main, explanation 2026-09-11 06:08:46 CDT; captured 06:10:18 CDT)_
  → mobile-field-request-workflow + mobile-request-update-response-workflow + mobile-request-update-response-state (existing-path QA recommended; new design deferred)

- **Check improved request UI now** — Bhoumik says, “Made UI better for request, check now.” Lily’s bounded read-only live attempt at 390×844 reached the ordinary login screen only; no authenticated request reading/navigation, 320/480 views, save/send/error feedback or return context was verified. Result is blocked, not passed, and no request-screen defect is claimed. Parent is asking Nova to use existing approved reviewer access and supply evidence; no new credential searches, production writes or implementation routing. _(via Bhoumik, Telegram303, 2026-09-11 06:10:39 CDT; read-only result and parent direction 06:15:04 CDT)_
  → mobile-field-request-workflow (check authorized; blocked pending authenticated evidence)

- **Mobile review finds narrow fixes** — Nova’s authenticated live read-only review at 320/390/480 verifies the sampled All Jobs → JR-41 → AR-22 → Close path and bottom Jobs return. AR cards/wrapping/controls/footer are readable; remaining issues are early Job-name truncation, lost plant identity when sliding to prices/notes, a short AR target and floating-create overlap. Lily assessed seven representative captures and recommends small existing-UI corrections, preserving the horizontal slider—not a stacked-table replacement or new backend state model. SAVE/SEND/error outcomes, prior list-context restoration, chat/counts and physical-phone behavior remain untested; exact live source SHA is unknown. Parent has shared findings with Bhoumik; no implementation authorized. _(via Nova live evidence captured 2026-09-11 06:20–06:21 CDT; Lily assessment 06:24:49 CDT)_
  → mobile-field-request-workflow (partial read-only verification; corrections unapproved)

- **Authorized APS source correction** — Daisy reports a scoped correction committed after Bhoumik explicitly chose the PDF as source of truth (Telegram1201, 09:06:24): disputed catalogue pricing/source and the 36-inch Box specification corrected, with superseded provenance retained. Lily then directly inspected the supplied PDF page34 and independently checked its hash. This resolves catalogue-source precedence, not current stock or a new effective date, and does not retroactively validate the retracted September10 QA claims. No broader workflow or helper change was authorized by this event. _(via Daisy plus Lily local artifact verification, 2026-09-11 09:09:54 CDT)_
  → pricing-lookup-reliability (scoped source correction; broad proposal still held)

- **Mobile filters waste screen space** — “Can we optimize for screen space. Lets try making these drop downs with selection. Press to select. If multi like status select and deselect with highlights. At opening of jobs view preselect/ show only only open status. So closed won or lost should be hidden.” Chris’s mobile screenshots show long Status/Customer checkbox and Created/Updated radio lists. Current displayed labels are **Active, Quote, Availability, Confirmed, Won, Lost**. Compact mobile selection controls and the shared All Jobs open-stage default are UI/query changes, never status mutation or a forced reset of intentional selections. _(via Nova’s exact relay, Telegram 588–589 / photos 588–589, 2026-09-11 13:02:27 CDT)_
  → all-jobs-compact-filter-selectors

- **Company known, contact not known** — Chris repeatedly asked Rosie to put **Austin Outdoor Design** in the company field for JR-41; the supplied job is **Wilkinson**, with no real contact person identified. Rosie reports the customer remains unlinked and the existing title is exactly `Austin Outdoor Design:Wilkinson`. Nova’s read-only contract audit found no supported company-only customer: current intake requires a real person name, so using a fake contact or an empty-name loophole is not acceptable. This is a blocked operational request exposing a customer-identity contract gap, not a display-only correction. Preserve the supplied facts without asking Chris to repeat them; stage legitimate company-only intake for Bhoumik. _(via Nova handoff 2026-09-11 13:14:40 CDT and Rosie JR-41 confirmation 13:14:53; Lily main relay 13:15:26 CDT; latest Chris web request reported at 13:11)_
  → company-only-customer-intake (staged · Bhoumik; JR-41 changes remain Rosie’s)


- **Focused Job chat looks redundant** — “These seem redundant.” Chris marked a line between the small **Chat** pill beside **Ground and Garden · Rene Maldonado** and the Rosie avatar on focused mobile JR-51. The image flags competing chat entry points only—not repeated identity text. Nova acknowledged consolidation while checking whether the controls have different destinations; no duplicate-thread claim is established by the screenshot. _(via Nova handoff, Telegram photo591/message592 at 2026-09-11 13:49 CDT; handoff 13:50:13 CDT; Lily task 13:50:40 CDT)_
  → (withdrawn 2026-09-11; distinct thread destinations)

- **Chat redundancy concern withdrawn** — “Nevermind they are different threads.” Chris explicitly withdrew the JR-51 chat-control concern. Nova confirms both controls and routes stay unchanged; no implementation requested. Current source separately identifies the small Chat pill as the linked customer’s stored Rosie conversation and the mobile avatar as a chooser for the canonical Job conversation and linked supplier conversations. Similar-looking controls are not evidence of interchangeable context. _(via Chris Telegram595 at 2026-09-11 13:51:33 CDT, Nova confirmation and Lily main withdrawal at 13:51:57 CDT)_
  → (withdrawn; no requirement or implementation handoff)

- **Mobile conversation navigation idea** — “This may be a better navigation to multi threads. Ask Lily to remind @bshah42 address this on mobile. Not top.prioity”. Chris’s reference shows the existing Conversations drawer with Search suppliers, General/Main and a supplier-thread list; it suggests a future way to move among separate conversations on mobile, not combining their content. Lily main has sent the requested low-priority reminder to Bhoumik; no deadline or timer was requested. This is separate from the withdrawn focused Job Chat/avatar consolidation above: both controls and distinct threads stay. Hold the small UI idea for Bhoumik’s discussion/prioritization, with Nova as its eventual UI owner—not an implementation handoff or a schema/agent-workflow proposal. _(via Nova relay of Chris Telegram598 at 2026-09-11 13:54:23 CDT; reference Nova `photo_597.jpg`; Lily main delegation and capture 2026-09-11 13:54:51 CDT)_
  → mobile-conversation-navigation (drafted · low priority; held for Bhoumik discussion)

- **Status joins focused Job identity** — “Jr: Customer - Job , Status”. Chris’s annotated mobile JR-51 screenshot points from the separate **Availability** pill up toward the top identity. Nova acknowledged a compact `JR-51: Customer – Job · Status`, with status alongside identity rather than a standalone row; no code had started. The displayed Customer and Job can legitimately both be **Ground and Garden**: this is a header-layout request, not permission to deduplicate, parse or correct their separately stored values. Real customer/contact access, atomic Job editing and both distinct chat controls/routes stay unchanged; the earlier Chat/avatar removal was withdrawn in Telegram595. _(via Nova handoff 2026-09-11 13:58:18 CDT, Chris Telegram photo600/message601; Lily task capture 2026-09-11 13:58:45 CDT)_
  → focused-job-header-layout

- **Room for future fulfillment facts** — “We will need room for an estimated project install date. And Delivery or Prickup indicator” (Pickup intended). Chris adds responsive capacity for estimated install date and Delivery/Pickup alongside or below the focused mobile identity/status. This request for room does not itself reverse Bhoumik’s earlier same-day notes-first decision or authorize persistence, API or edit-workflow changes. Show only authoritative saved values if already supported; otherwise keep the layout adaptable without empty controls, notes parsing, date substitutes or inferred fulfillment. _(via Nova relay 2026-09-11 13:59:26 CDT, Chris Telegram603; Lily task relay 2026-09-11 13:59:48 CDT)_
  → focused-job-header-layout (UI capacity) · job-request-install-date-fulfillment (existing Bhoumik-staged contract)

- **Grower replies are usually simpler; whole-list nursery asks suit a link** — Chris/CR’s exact message:

  > @bshah42 for the grower workflow. There is massively less complexity than a whole plant list that comes from a wholesale Nursery. If you would like me to explain why I'm happy, but if you understand that growers have more limited offerings and have to comb through less data in order to give a response, that is why. This note is about sending a grower a link. The 90/10 experience would be them just responding to an email or a text message. The link to the availability is really meant for multiline items with many different inputs around availability and notes and pricing. Most growers request will be more simple and limited in probably can be handled within an email augmenting that email with a link if it was multiple. Could be kind of cool down the line but definitely not necessary at present. Sending to another wholesale Nursery. On the other hand, an entire list of plants does does lend itself to the digital link and collaborative workspace view?

  Growers’ narrower offerings and fewer inputs generally make an email/text reply sufficient in Chris’s estimated usual 90/10 experience; this is not a measured response rate or automatic classification rule. An optional link can help a more complex multi-item grower request, but grower-specific enhancements are not needed now. A whole-list wholesale-nursery request benefits from the existing collaborative line availability/notes/pricing view. General scoped public access stays shipped and reusable; no mandatory portal, new supplier types, SMS integration, automatic outreach or order-management build is authorized. Rosie/Daisy ownership, send approvals, item 9 setup hold and item 8 deferral remain unchanged. _(via direct Chris/CR, Telegram313 reply279, 2026-09-11 14:09:59 CDT; Lily main handoff/capture 2026-09-11 14:10:56 CDT; parent acknowledgement Telegram314)_
  → supplier-access-authentication + out-of-network-public-availability-request (channel/complexity clarification; core remains shipped)

## 2026-09-12

- **Weekday plant news page** — “I want to create a page with a collection of news articles on the latest in plants, landscape architecture, and nursery news with an editorial summary at the top, followed by news categories filterable and then top stories in a grid. Updated daily mon-fri.” _(via telegram, CR/Chris, message 315, 2026-09-12T11:04:15-05:00; captured 2026-09-12T11:05:04-05:00)_
  → weekday-plant-news-page-ui; weekday-plant-news-publishing

- **Inspiring design comes first** — “Inspiring landscape design is priority.” _(via telegram, CR/Chris, message 317, 2026-09-12T11:04:51-05:00; captured 2026-09-12T11:05:21-05:00)_
  → weekday-plant-news-page-ui; weekday-plant-news-publishing

- **Public and team audience** — “Both” _(via telegram, CR/Chris, message 318, 2026-09-12T11:04:58-05:00; answering public/customers versus internal team; captured 2026-09-12T11:05:44-05:00)_
  → weekday-plant-news-page-ui; weekday-plant-news-publishing

- **News serves lead generation** — “Lead gen and content.” _(via telegram, CR/Chris, message 319, 2026-09-12T11:05:06-05:00; captured 2026-09-12T11:06:20-05:00)_
  → weekday-plant-news-page-ui; weekday-plant-news-publishing

- **Daily brief and market discovery** — “And daily brief and then interesting articles.

  Good for me to discover what's happening in a market and who the relevant players with the best projects are.” _(via telegram, CR/Chris, message 322, 2026-09-12T11:08:44-05:00; captured 2026-09-12T11:09:14-05:00)_
  → weekday-plant-news-page-ui; weekday-plant-news-publishing

- **Private news prototype complete only** — Nova reported a private static presentation prototype complete: archive-labelled sample daily brief, filters and three stories, with unresolved contact text. Reported independent QA PASS across 45 screenshots at 320/390/480/1440 widths; Lily did not retest. The new artifact slug was reported private point-in-time, but the standard signed-in artifact reader can manually change visibility, so this is not publication/security-policy approval. No auth/app/publicflag/source/updater/schedule/lead-data changes reported. Chris already received the link and keep-private warning from Nova. _(via Nova 11:30:53, relayed by Lily parent at 2026-09-12T11:31:15-05:00)_
  → weekday-plant-news-page-ui (PROTOTYPE COMPLETE ONLY); weekday-plant-news-publishing (still staged, including public launch/control/contact destination)

- **Morning brief delivery option** — “Perhaps a sub agent that handles this sends me morning briefs and article links in telegram or on app?” _(via telegram, CR/Chris, message 325, 2026-09-12T11:58:42-05:00; captured 2026-09-12T11:59:25-05:00)_
  → weekday-plant-news-publishing (proposed lightweight ownership/delivery option, not approval for a new agent or schedule)


## 2026-09-13

- **Mock up two header rows** — “What is the layout.. can you do mock ups on the UI? JR, Company, status, total Below job name, install date ( 🗓️ icon month day), Rosie. Current view still not great.” Chris’s JR-51 screenshot still shows a tall stacked identity/status header; he wants to see faithful UI mockups before choosing the new presentation: top **JR / Company / current Status / Total**, below **atomic Job name / calendar icon with month-day install date / Rosie**. This supersedes the September11 one-group design, not identity storage, total/status meaning, customer/contact access or distinct customer/Job/supplier chat destinations. Nova is already preparing private 320/390/480 mockups with explicitly sample total/date and an honest absent-date variant. Await visual feedback; no implementation or schema/API/pricing/workflow change is approved. September11’s date-contract findings are historical and must be rechecked before any eventual build; the existing Bhoumik-staged fulfillment scope remains separate. _(via Chris Telegram photo607/message607 at 2026-09-13 16:42:38 CDT; Nova handoff16:43:17; Lily parent relay/capture16:43:54 CDT)_
  → focused-job-header-layout (mockups only · awaiting visual feedback)


- **Compact card as visual inspiration** — “Inspiration.” Chris added a full current JR-51 screenshot (photo609) and an inspiration card/list design (photo610, Telegram611 caption). The current screenshot shows Subtotal $1,526.00, Ground and Garden in separate Customer/Job roles and Rene Maldonado; the inspiration uses right-aligned totals, compact status/calendar metadata and Rosie cues. Its different sample contacts, totals and Quote due / Follow up / Site visit dates are design content, not facts to copy or new workflows. Keep the explicit Telegram607 two-row header order and estimated **install** date meaning; no All Jobs/list/navigation redesign. Nova’s existing mockup owner is applying visual cues only, privately and without implementation approval. _(via Nova handoff 2026-09-13 16:44:43 CDT; Lily parent relay/capture16:44:57 CDT; both images directly inspected)_
  → focused-job-header-layout (mockup reference only)


- **Private header mockup delivered** — Nova delivered the private two-group header preview to Chris at17:06:02 via Telegram613 image/614 link. Reports independent exact-SHA PASS `61c9b7a6de3fc233d0fb497a65b8c1ba4dd26968a37d737bf66082c28233de63` across320/390/480 sample/absent-date/long/equal/missingJob variants. These are two logical groups, not guaranteed two literal lines:390/480 shorter, embedded320 taller; tradeoff disclosed. Customer contact/Chat stays separate. Chris’s visual feedback is pending; earlier implementation remains held. No live API/data/app/date support or new implementation approval claimed, and Lily did not repeat review/tests or the external message. Preview: https://lps.cognisphere.sh/a/nova/private/artifacts/job-header-two-row-preview-20260913-61c9b7a . _(via Nova17:06:02 report, Lily parent relay/capture 2026-09-13 17:06:20 CDT)_
  → focused-job-header-layout (private mockups delivered only · feedback pending)


- **Repeated company wastes screen space** — “Ok is has Ground and Gared 3x. Do I really need to explain why that is terrible?” Chris rejects the delivered mockup’s repeated company name; he should not have to explain why repeating the same information wastes phone space. Nova accepted the mistake and is revising the existing private mockup: company once, Job name only when meaningfully distinct, and a supporting customer row containing the real PERSON name plus customer Chat only—not company again. This supersedes Lily’s earlier equal-value repeated-role display requirement for this focused-header mockup, not independent storage, global identity, status/total semantics or distinct chat contexts. A suppressed duplicate Job is still stored and must not turn into a fake Add Job name state. Prior exact-SHA test PASS was not Chris’s UX acceptance; the delivered preview is rejected on repetition and implementation remains held. _(via Chris Telegram615; Nova handoff2026-09-13 17:08:26 CDT, Lily parent relay/capture17:09:01 CDT)_
  → focused-job-header-layout (mockup revision required · repetition rejected)


- **List the header elements first** — Nova reports Chris Telegram617 asked only for the element/data-point list. Nova supplied JR, company, Job, status, total, estimated install date, prior Delivery/Pickup, Rosie, contact person and customer Chat in Telegram618. This is an inventory for prioritization, not a new request to display every element or permission to redesign. The existing mockup owner is now on HOLD awaiting Chris’s response; Nova confirms no revision HTML edits or republish occurred. Keep company-once correction recorded and prior preview rejected, but do not route further redesign or implementation. _(via Nova2026-09-13 17:12:34 CDT; exact Chris617 wording not supplied)_
  → focused-job-header-layout (hold · awaiting Chris prioritization)


- **Try the corrected mockup again** — “Can you try again”. Chris Telegram619 resumes private mockup revision2 with the existing Nova owner, applying company once, genuinely distinct Job only, and supporting real person + customer Chat. Nova is preparing a lead390 proposal and responsive variants; no app implementation, stored-data or date-contract approval is implied. The rejected prior artifact stays unchanged until the new review. _(via Nova2026-09-13 18:55:17 CDT; Chris Telegram619)_
  → focused-job-header-layout (private revision2 resumed · implementation held)


- **Company-once retry delivered privately** — Nova delivered R3 at19:30:19: company once, distinct Job only, real person + customer Chat, with actual-fit long-name fallback. Chris received a390 image in Telegram621 and private link622: https://lps.cognisphere.sh/a/nova/private/artifacts/job-header-company-once-r3-20260913-fdb7f677 . Nova reports independent25 measurements/44px/no-overflow PASS and point-in-time private exact-SHA verification `fdb7f677b0a576339d4cc6c769d15437b197625446f10946dfbf0ac229a997a0`. Narrow/long cases still wrap; no universal height-saving claim. This is mockup delivery/test evidence, not Chris’s UX acceptance or app/API/data/date-contract implementation. Prior rejected artifact remains unchanged; feedback pending. Lily performed no fresh audit or duplicate external send. _(via Nova19:30:19 report, Lily parent relay/capture2026-09-13 19:30:33 CDT)_
  → focused-job-header-layout (private R3 delivered · awaiting Chris feedback)
