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

- **Human supplier availability asks** — In JR-21 testing, Chris said “No one knows what an LPS job is”; supplier availability outreach should sound “like a regular human, not a LLM output” — brief and informal/light. “Please confirm your availability” is a demand, not an ask. His model: “Morning, Have a project here in Austin looking for 200 x 7g Giant Green Thuja. Ya’ll have those available? If you have a photo handy I would love to take a look. Thanks in advance”. JR-21 was cancelled before any outreach. _(via rosie)_
  → supplier-outreach-human-tone

- **Chris voice playbook** — After the JR-21 outreach correction, Chris asked what tools would capture his voice and communicate authentically like him—only agent guidance, or something more. Current support is explicit guidance and durable per-supplier preferences; there is no dedicated Chris-reviewed voice profile or example library. He has heard the broad direction; future work should retain review controls. _(via rosie)_
  → approved-voice-playbook-governance + voice-playbook-review-screen

- **Approved edits teach, not automate** — Chris confirmed that emails he edits and approves should become good examples for later similar drafts. A one-off must not silently become permanent: capture recurring, intentional patterns in a reviewed voice playbook while preserving approval of every exact outgoing message. _(via rosie)_
  → approved-voice-playbook-governance + voice-playbook-review-screen
