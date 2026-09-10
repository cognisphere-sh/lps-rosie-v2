# Keep focused Job details in one compact tray

- Status: routed · serialized behind mobile AR deployment
- Route: nova
- Raised: 2026-08-31 by Chris (via Nova handoff; Telegram messages 452/454/456/458/461/464/485/498/500/502/504/506/519/542 and photos 452/454/463/498/500/519/542)
- Updated: 2026-09-02

## Problem

The focused Job detail view repeats secondary request information in four large boxed panels: Request, Contact, Delivery, and Billing & Payment. That pushes the status, totals, and plant table below information Chris does not need for the first scan, while the page already has a disclosure intended for supporting detail and notes.

## Evidence

- 2026-08-31 — **Focused Job details tray**: Chris's annotated references in Telegram messages 452/454 ask to remove the four redundant boxed panels, keep request identity/customer in the header, put status totals and the plant table immediately in view, and consolidate the existing information into one compact collapsed tray. `photo_463.jpg` identifies the current boxes to consolidate and adds no scope.
- 2026-08-31 — **Balanced focused Job header**: Chris's Telegram message 456 / photo 454 extends the same focused-Job direction: a balanced header places sales/status stage at left, the full Job name centered with secondary JR reference, and existing project/delivery date plus explicit Delivery or Pickup fulfillment value at right. It must be responsive without truncating the name and must not infer fulfillment from an address or notes.
- 2026-08-31 — **Same compact organization on mobile**: Chris's Telegram message 461 confirms this cleaner organization applies on mobile too: one collapsed-by-default tray contains Contact, Payment, Delivery, and Other; the primary mobile view remains concise header/status/table with no separate detail boxes. He says to ignore `photo_460.jpg` markup.
- 2026-09-01 — **Desktop Job hierarchy**: Chris's Telegram message 498 / photo 498 extends the same hierarchy to desktop All Jobs and focused Job work: JR plus Sales status at left; existing Contractor/Company · Job identity centered in one desktop line; future structured Install Date plus Delivery/Pickup at right; compact expanded signature columns for Contact, Payment Contact, Delivery, and Payment Method/Gate. Message 502 supersedes message 500's colon rule: centered order is `Contractor/Company Name | Job Name | Contact`, using only stored nonblank segments and omitting each missing segment and separator. Read-only JR-19 audit after message 506 confirms safe current values: name `Oak Grove Rd. planting`; customer company `Urban Landscape Group`; contact `Johnathan`; shipping street `16202 Oak Grove Rd.`; immutable created time; billing absent. PO, delivery date/mode, received-at/provenance and distinct contractor/project/site-name fields do not exist; customers.name is Contact—not a duplicate middle identity value.
- 2026-09-01 — **Focused Active Jobs rail identity**: Chris's message 519 / photo 519 says expanded desktop Active Jobs cards hide needed customer identity. Under each Job name, selected and unselected cards need one quiet single-line stored `Company/Customer · Contact` identity (JR-34: `Land Water Light · Dior Goodwin`), with honest nonblank fallbacks and ellipsis.

## What it should do

In focused Job work and the expanded desktop All Jobs detail, remove the separate boxed **Request**, Contact, Delivery, and Billing & Payment panels. The Request block is entirely redundant: JR, Sales status and Job identity live in the header strip, so neither the expanded details nor the secondary tray repeats Job/JR identity. Use a balanced desktop identity strip: JR reference plus Sales status at left; and, at right, the exact order **Estimated project install date**, then **Delivery/Pickup** immediately to its right. Center the one-line identity in this exact segment order: `Contractor/Company Name | Job Name | Contact`. Use only stored nonblank segments, omitting a missing outer segment and its adjacent separator. Center **values only**, never literal labels/prefixes such as Contractor, Company, Job, or Contact: `customers.company` is the outer value; `job_requests.name` is the Job value; and customers.name is the separate Contact value. The resulting display is, for example, `Urban Oasis | Job name | Contact`. Do not use the flattened inbox `company || name` value for this strip.

`job-request-display-identity` supersedes all older shipping, Created-date, JR, Unassigned, PO, and other identity fallback prose in this requirement. For contractor/Landscape identity, show only stored nonblank values in exact `Company | Job/Site | Contact` order; omit any absent component and adjacent separator. Never label, invent, parse, duplicate, or substitute a fallback. The Job-name control edits the stored Job/Site component only. Ellipsize the resulting centered identity as one line when necessary. This UI requirement may display those right-side values only after their durable structured data contract is confirmed. Until then Nova may preserve/reserve the placement but must not imply a date or fulfillment choice. On focused/narrow widths, the header may stack/reflow, but the full Job name must never truncate, clip, or force horizontal scrolling.

Until an audit confirms persisted structured values and an existing update path, do not add a fake, non-persisting, or inferred Delivery/Pickup selector. Show a date or fulfillment value only when the focused Job already has that exact structured value; do not derive fulfillment from a delivery address, notes, or other indirect text. If either field/selector needs a new durable contract, it is a separately staged Bhoumik workflow/data slice; Nova may reserve/describe the placement but cannot ship a selector ahead of that contract. Preserve current status actions, the canonical Job thread and all existing routes.

In the expanded desktop Active Jobs rail, use one primary line for selected and unselected cards: `JR-<id> · Company | Job/Site | Contact`. Apply `job-request-display-identity` stored-nonblank omission only, ellipsize within the existing 292px rail, and do not infer or substitute identity. Status, snippet and timestamp remain secondary below it.

Directly below that primary context, keep the current status, demand/availability totals, and plant table visible without first opening secondary details.

Reuse the existing **More details & notes** disclosure as the single compact, collapsed-by-default tray for secondary Job information and notes. Retain that name if it remains clear; rename it to **Job details & notes** only if the resulting content makes the existing name misleading. Its closed row is concise and truthful: it gives a compact summary or count only where existing stored information supports one, and does not claim a contact, delivery, payment, or note value that is absent.

When opened, the tray presents available information in compact vertical, email-signature-style blocks rather than boxed horizontal fields:

- **Contact:** label, person name, then phone and email together when present.
- **Payment contact / billing:** the same compact contact pattern, using only the existing stored payment or billing values.
- **Delivery details:** delivery contact where stored; address lines; city, state, and ZIP; delivery instructions where stored; and a dedicated Gate code only after its durable, access-controlled data contract is available.
- **Payment / Payment Contact:** the existing payment contact/billing information, plus a Payment method only after its durable constrained-value contract is available.
- **Other / notes:** existing remaining secondary facts and notes, including Last updated where useful, using the same compact honest treatment. Last updated belongs here, not in the primary header/date slot; do not repeat Job/JR identity.
- Existing edit actions remain available in this same disclosure/tray.

Use exact current stored values only. Where the current UI has an established honest missing-value treatment, retain it; otherwise omit an unavailable optional detail rather than inventing or guessing it. Do not add a fake/non-persisting Gate code or Payment method control. Gate-code visibility must follow a durable access-control contract and must not expose it to unintended supplier or customer surfaces. At desktop widths, use compact signature-style columns for Contact, Payment Contact, Delivery, and Payment Method/Gate where values are available; at phone widths, the same information stacks in a readable single column.

## Acceptance criteria

- In a focused Job or expanded desktop All Jobs detail, Chris sees no separate Request block and no repeated Job/JR identity in the secondary tray; the remaining Contact, Payment Contact, Delivery, notes and other useful secondary facts are consolidated.
- In focused Job work and expanded desktop All Jobs detail, the balanced desktop strip keeps JR reference plus Sales status at left and the right-side date/mode placement only when supported. Its centered one-line contractor/Landscape identity follows `job-request-display-identity`: stored nonblank values only in exact `Company | Job/Site | Contact` order, with missing components/separators omitted. It never adds labels, parses, duplicates, invents, or substitutes a fallback; it ellipsizes without fabricating values.
- On narrow/mobile widths, the header may stack or reflow without truncating, clipping, or horizontally scrolling the Job name.
- A date or Delivery/Pickup value appears only when that exact structured value is stored; Last updated, created time, addresses and notes are never substituted into the primary-header date slot. The UI never infers Delivery/Pickup from an address, notes, or other text, and never shows a fake/non-persisting selector.
- Existing status actions, canonical Job thread, and routes remain unchanged.
- In the expanded desktop Active Jobs rail, every selected and unselected card shows one primary line `JR-<id> · Company | Job/Site | Contact`, applies `job-request-display-identity` stored-nonblank omission only, ellipsizes within 292px, and leaves status/snippet/timestamp secondary below.
- Status, totals, and the plant table are visible before secondary details are expanded.
- One compact existing-details-and-notes disclosure is collapsed by default; its label remains **More details & notes** unless a rename to **Job details & notes** is necessary for clarity.
- Its closed row gives only a concise summary/count supported by the Job's actual stored data; missing information is not implied.
- Opening the tray shows available Contact, Payment contact/billing, Delivery details, and Request / Job details (including Last updated and notes) as compact vertical signature-style blocks, not boxed horizontal field panels.
- Contact blocks show the exact stored label/name and phone · email values where available. Delivery shows exact stored address lines, city/state/ZIP and instructions where available.
- Empty optional values follow existing honest missing-value conventions or are omitted; no name, phone, email, address, instruction, Gate code, payment method/detail, count, or placeholder is fabricated.
- A Gate code and Payment method display or editor appears only after an approved durable persistence/update/visibility contract exists; the Gate code is not exposed on unintended supplier or customer views.
- Existing detail/note editing actions still work and preserve the same data and workflows.
- On desktop, Contact, Payment Contact, Delivery, and Payment Method/Gate use compact signature-style columns where their actual values are available; on mobile, the same one collapsed-by-default Contact, Payment, Delivery and Other tray is used, with blocks stacked without clipping, horizontal scrolling, separate detail boxes, or loss of any existing detail/edit action.
- The disclosure and all controls remain keyboard-operable with visible focus, 44px minimum touch targets where interactive, accurate `aria-expanded`, predictable focus movement/return, and accessible labels.
- No Job Request data, status/totals/plant-table meaning, chat routing, navigation, or workflow changes.

## Out of scope

- Adding contact, delivery, billing, payment, Gate code, project-date, fulfillment, or notes fields; changing what is stored; or introducing a new missing-data workflow. Durable Estimated project install date / Delivery-Pickup, Gate code, and Payment method contracts, if absent, are separate staged Bhoumik work.
- Changing Job status, totals, plant data, availability semantics, customer/supplier communication, or Rosie routing.
- Changing mobile All Jobs card hierarchy beyond the already routed date-removal correction or the overall focused-Jobs shell. The centered-identity rule and Active Jobs rail identity are desktop/focused only; mobile v2 remains unchanged.

## Assumptions

- The tray and header layout are presentation-only and route to Nova. Structured Estimated project install date/Delivery-Pickup, Gate code, and Payment method are all known absent and staged separately for Bhoumik. Nova never creates a fake control, inferred value, or unintended Gate-code exposure.
- The existing disclosure is the appropriate home for notes and all secondary details; its current name is retained unless the combined content requires the clearer Job-details wording.
- This work is serialized with the active focused mobile-header refinement: the same responsive header principles apply at desktop and mobile, while the existing mobile-header requirement's chat chooser remains intact. Do not interleave conflicting work in the same focused Job context.

## Open questions

- None blocking the UI refinement.

## Handoff log

- 2026-08-31 — drafted from Nova's relay of Chris's Telegram messages 452/454. Route to Nova after the active focused-header work is safely integrated; do not overlap the two focused-Job UI changes.
- 2026-08-31 — amended from Chris's Telegram message 456 / photo 454: balanced sales/status-left, centered full-name, date-and-explicit-fulfillment-right header; responsive reflow is allowed, but no name truncation or inferred Delivery/Pickup.
- 2026-08-31 — Chris's Telegram message 458 makes the right-side order exact: Estimated project install date, then a Delivery/Pickup selector immediately right. Auditing current persistence/update contract before any selector is routed; Nova's UI scope must stay honest if it is absent.
- 2026-08-31 — Chris's Telegram message 461 confirms the same compact organization on mobile: one collapsed-by-default Contact, Payment, Delivery and Other tray; concise primary header/status/table; no separate boxes. `photo_460.jpg` markup is explicitly ignored.
- 2026-08-31 — Added `photo_463.jpg` as reference for the current boxes to consolidate only; no scope added.
- 2026-08-31 — Chris's Telegram message 464 adds a dedicated Delivery Gate code and constrained Payment method (Card on File, Terms, Call for Payment, Payment at Pickup). Audit persistence, edit/event and supplier/customer visibility before any Nova control; no fake control or Gate-code leakage.
- 2026-08-31 — Chris's Telegram message 485 moves Last updated into the expandable Request / Job details tray. The primary-header date slot is later only for optional structured install date with associated Pickup/Delivery; neither updated/created timestamps nor notes may substitute. Nova remains blocked from a date/mode UI until Bhoumik's contract lands.
- 2026-09-01 — Chris's Telegram message 498 / photo 498 extends the same compact hierarchy to desktop All Jobs expanded detail and focused work. Nova's safe UI-now scope is known JR/Sales status and compact existing detail blocks; structured Install Date, Delivery/Pickup, Payment Method and Gate remain blocked on the staged Bhoumik contract, with no inference.
- 2026-09-01 — Chris's Telegram message 500 / photo 500 supersedes the centered middle-dot identity with exact existing-field formatting and `Unassigned customer` fallback. It is desktop/focused strip only; mobile v2 is unchanged. Amendment delivered to Nova.
- 2026-09-01 — Chris's Telegram message 502 immediately supersedes the msg500 colon rule: stored nonblank segments are exactly `Contractor/Company Name | Job Name | Contact`, with missing segments and separators omitted and existing honest unassigned fallback. Amendment requested by Nova and applied to the queued requirement; mobile v2 and future-field blocks remain unchanged.
- 2026-09-01 — Chris's Telegram message 504 sets the missing-Job-Name middle fallback: exact `created_at` labelled `Created M/D/YY`; never updated time, notes, or an inferred Install Date. Invalid/missing created time retains existing honest JR fallback. Amendment applied to the queued requirement.
- 2026-09-01 — Chris's Telegram message 506 supersedes the simple Created fallback with structured priority PO → contractor customer/job name → street/address line → Created. Read-only JR-19 audit resolves current safe candidates to explicit Job Name, company, shipping request-site address, then Created; it excludes PO/distinct project fields (absent) and prevents customers.name/Contact duplication. Missing identity fields require Bhoumik contract, never fake.
- 2026-09-01 — Chris's Telegram message 519 / photo 519 adds the quiet Company/Customer · Contact line beneath every desktop expanded Active Jobs rail Job name. It preserves 292px rail fit, status/snippets/timestamps/navigation/order and 44px collapsed icon-only rail; queued after mobile AR.
- 2026-09-01 — Chris's Telegram message 521 supersedes that two-line rail reading: selected/unselected expanded cards use exact one-line `JR-<id> · Contractor Name | Job Name | Contact`; status/snippet/timestamp remain below. Mobile and collapsed rail remain unchanged.
- 2026-09-01 — Chris's Telegram message 523 / photo 523 confirms current Request detail block is redundant and removes it entirely. Header owns JR/status/Job identity; the compact tray is secondary Contact, Payment Contact, Delivery, notes and other useful facts only. Apply shared desktop/focused UI without creating a mobile duplicate.
- 2026-09-01 — Chris's Telegram message 527 defines future durable top-line and tray facts. UI-now remains existing-field-only: requested/estimated fulfillment date, Delivery/Pickup, Gate, Payment Method and Tax Status await Bhoumik's nullable contract; wholesale receives only approved top-line fulfillment facts, never payment/tax/gate/private contacts without explicit visibility approval.
- 2026-09-01 — Nova reports initial 14-path implementation passed 229 tests but is not final-safe and will not be partially deployed. Targeted remediation covers legacy focused mobile, table/tray order, street/date fallback truth, 900px centering, empty-tray summary, 44px/focus, and documentation accuracy.
- 2026-09-02 — Chris's message 542/photo 542 corrects identity rendering to values only (no Contractor/Company/Job/Contact prefixes). Auditing existing `job_requests.name` update contract before routing the requested editable Job-name UI; no current data mutation.
- 2026-09-01 — Nova accepted the exact identity amendment and queued the requirement. It is serialized behind mobile AR deployment; Nova confirmed the existing-field-only rule, JR/status-left placement, mobile isolation, and exclusion of unavailable structured fields.
- 2026-09-03 — Nova accepted reconciliation: later `job-request-display-identity` value-only stored-segment contract is authoritative for implementation and review.
