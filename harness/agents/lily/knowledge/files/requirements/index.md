# Requirements

What crystallizes out of the feedback log (`../feedback.md`) — one file per
change worth making, written and routed per the `feedback-loop` skill. This
index is the backlog: keep it in the same edit as the file it describes.

Status: `drafted` → `routed` (a builder has it) or `staged` (waiting on
Bhoumik) → `shipped` / `dropped`.
Route: `nova` (UI/UX, ships now) · `bhoumik` (DB and workflow changes) ·
`<agent-id>` (that agent's own skill or script).

A workflow change counts — not everything here is software.

| Slug | Title | Status | Route |
|---|---|---|---|
| `one-gallon-sedge-price-mapping` | Keep Berkeley Sedge 1 G priced on the APS price sheet | staged | bhoumik |
| `supplier-natural-language-replies` | Let Austin reply naturally and keep the work current | staged | bhoumik |
| `catalog-photo-upload-page` | Add catalog photos from the Photos page | staged | nova (blocked by bhoumik workflow) |
| `catalog-photo-intake-review` | Review submitted catalog photos before publishing | staged | bhoumik |
| `supplier-photo-cleanup` | Give Chris big-specimen photos for manual Pixel cleanup | staged · manual workaround agreed; automation/integration/media work parked | bhoumik (future automation only) |
| `mobile-agent-chat-translucent-header` | Make the mobile agent-chat header translucent | routed | nova |
| `job-request-delete-safety` | Make deleting a job request safe on mobile | shipped | nova |
| `lps-ops-job-request-statuses` | Use Chris’s LPS Ops Job Request sales lifecycle and history | staged · current five Job stages recorded; JR-59 example/history follow-through, no status build | bhoumik |
| `quote-opportunity-to-job-request-conversion` | Quick quote first, availability later, on the same Job Request | staged · same-JR quote path supported; direct-order gap linked separately, dashboard deferred | bhoumik |
| `new-job-intake-customer-type-choice` | Let Chris identify a homeowner or landscape professional when a new job starts | drafted · optional intake/Job display; storage complete | nova |
| `customer-type-retail-landscape-workflow-pricing` | Distinguish homeowners from landscape professionals without changing pricing yet | shipped · minimal customer storage; commercial policy open | bhoumik |
| `company-only-customer-intake` | Save a known customer company before a contact person is known | staged · JR-41 blocker; identity contract decision required | bhoumik |
| `availability-last-updated-display` | Show when availability was last updated | routed | nova |
| `availability-last-updated-semantics` | Define and retain the availability-update time | staged | bhoumik |
| `availability-response-change-management` | Keep supplier availability responses visible to LPS | staged | bhoumik |
| `availability-change-indicators` | Show supplier-response state without crowding requests | drafted | nova |
| `customer-availability-update-workspace` | Show LPS-published availability in customer job details | drafted · urgent dependency | nova |
| `customer-job-request-details-workspace` | Give customers a current job request details workspace | staged · urgent | bhoumik |
| `order-dispatch-and-supplier-response` | Send initial orders simply and receive supplier responses | staged · OPERATOR WORKING / RUNTIME FAILURE UNRESOLVED; direct function present but failing, Nova stopped by702, retries held | bhoumik |
| `supplier-onboarding-review` | Keep supplier-qualification decisions out of Telegram | staged | bhoumik |
| `supplier-outreach-human-tone` | Ask suppliers about availability like a person | shipped | rosie |
| `approved-voice-playbook-governance` | Keep a reviewed playbook for writing in Chris’s voice | drafted | bhoumik |
| `voice-playbook-review-screen` | Review Chris-voice guidance and examples in one place | drafted | nova |
| `app-wide-compact-headers` | Make app headers compact and purposeful | drafted · ready to route refinement | nova |
| `job-inbox-workspace` | Put active Job Requests in an inbox workspace | routed | nova |
| `ops-ar-main-workspace` | Open supplier availability work in the main Ops workspace | routed · 2026-09-20T19:21:10-05:00 MULTIPLE AR tabs correction delivered; IMPLEMENTATION HOLD: operator baseline686/auth/resource, source-only plan | nova |
| `ar-table-presentation` | Reorder the AR table and keep status context together | routed · current owner accepts opt-in new-workspace1–2 plan; independent check confirms item3 SOURCE/RUNTIME MAPPING HOLD, auth absent/no live test (2026-09-20T19:44:51-05:00) | nova |
| `focused-jobs-rail-collapse` | Collapse the focused Jobs rail when Chris needs the work width | routed | nova |
| `job-inbox-activity-semantics` | Define trustworthy Job Request inbox activity and unread meaning | staged | bhoumik |
| `copy-ready-plain-text-quotes` | Make plain-text quotes ready to copy and send | shipped | rosie |
| `supplier-filter-consolidation` | Put Supplier filters in one place | routed | nova |
| `account-popover-rail-actions` | Put account actions in the account popover | routed | nova |
| `mobile-job-navigation-browser-back` | Use the phone’s Back navigation for Jobs | routed | nova |
| `supplier-filter-mobile-refinements` | Keep essential Supplier filters visible and mobile paging quiet | routed | nova |
| `plant-search-cultivar-toggle` | Make the Plant Search Cultivar selector a clear toggle | routed | nova |
| `plant-search-toolbar-consolidation` | Put Plant Search filters in one compact toolbar | routed | nova |
| `plant-search-toolbar-visual-unity` | Make Plant Search controls read as one toolbar | routed | nova |
| `portal-availability-selector-dark-style` | Keep the Nursery Portal availability selector readable in the dark portal | routed | nova |
| `portal-request-work-buckets` | Keep wholesale availability requests in clear work buckets | routed | nova |
| `availability-status-model-parity` | Give Job Requests, Requests and Orders honest plant-status models | staged · priority 1 · partial; Request UI mapping blocked | bhoumik |
| `out-of-network-public-availability-request` | Let an out-of-network supplier answer one live availability request | shipped · core access; optional channel fit clarified Sep 11 | bhoumik |
| `supplier-access-authentication` | Let nurseries answer one request easily without exposing LPS operations | shipped · core access; optional channel fit clarified Sep 11 | bhoumik |
| `availability-request-created-feedback` | Say created, not sent, when an availability request is ready | routed · deployment unverified; release hold | nova |
| `supplier-email-identity-and-handoffs` | Keep supplier communication clear under the stated agent roles | staged · ownership clarified; setup held for Bhoumik–Chris discussion | bhoumik |
| `mobile-availability-request-view` | Make the availability-request view usable on a phone | routed · priority 3 | nova |
| `mobile-field-request-workflow` | Make mobile request work dependable in the field | staged · partial read-only verification; UI corrections unapproved | bhoumik |
| `mobile-request-update-response-workflow` | Optional durable response tracking for mobile updates | staged · optional/unapproved; deferred pending existing-path findings | bhoumik |
| `mobile-request-update-response-state` | Optional mobile request-response display | drafted · optional/unapproved; deferred pending existing-path findings | nova |
| `supplier-category-badge-width` | Keep Supplier Category badges clear of State | routed | nova |
| `mobile-all-jobs-toolbar` | Make All jobs toolbar and cards compact | routed | nova |
| `all-jobs-compact-filter-selectors` | Open compact mobile Job filters only when needed | routed · current-owner visual refresh; committed five-stage/two-default/none semantics preserved | nova |
| `mobile-focused-job-header` | Make the focused mobile Job header scannable | routed · top-line placement refined separately | nova |
| `focused-job-header-layout` | Mock up a two-row focused mobile Job header | drafted · private R3 delivered; awaiting Chris feedback; app implementation held | nova |
| `focused-jr-table-layout` | Make the focused Job plant table tighter and easier to scan | routed · QNTY/centering isolated IN PROGRESS on owner-reported safe f9a2ddb; gates/release pending; broader table/botanical work held | nova |
| `sourcing-note-disclosure` | Keep useful sourcing context compact and open all prior detail by click | routed · isolated work in progress on Nova-reported safe f9a2ddb; fresh review/release pending | nova |
| `shared-note-empty-cell` | Keep empty Shared note cells quiet but easy to edit | routed · isolated work in progress on safe committed f9a2ddb; distinct empty-cell scope, not released | nova |
| `supplier-note-customer-routing` | Pass useful supplier plant facts to the customer, not private buying discussion | staged · Bhoumik notified347; ONE decision automatic clear selected-source facts vs review-first option; no routing/all-cell approval policy (2026-09-17T12:55:37-05:00) | bhoumik |
| `focused-job-details-tray` | Keep focused Job details in one compact tray | routed · serialized behind mobile AR deployment | nova |
| `focused-job-name-inline-edit` | Let Chris edit a focused Job name safely | routed · display composition separated | nova |
| `job-request-display-identity` | Show one exact Request identity from the stored company, job, and contact | routed | nova |
| `job-request-install-date-fulfillment` | Keep fulfillment and private handling notes simple for now | staged · notes-first; future mobile date/mode capacity requested | bhoumik |
| `focused-job-chat-routing` | Keep a focused Job chat on the current request | shipped | nova |
| `mobile-conversation-navigation` | Make separate conversations easier to navigate on mobile | drafted · low priority; held for Bhoumik discussion, no build authorized | nova |
| `urgent-pricing-update-workflow` | Make urgent pricing updates reach the right Job without delay | staged | bhoumik |
| `pricing-lookup-reliability` | Make every pricing answer traceable and dependable | staged · audit reviewed; broad workflow proposal held | bhoumik |
| `visual-ui-qa-gate` | Gate UI releases on real visual review | shipped | nova |
| `plant-search-match-before-geography` | Find the exact plant and size before narrowing by geography | drafted | daisy |
| `plant-search-result-location-clarity` | Show where each Plant Search match is located | routed | nova |
| `customer-review-status-color` | Make approved customer-review availability statuses easy to scan in web chat | drafted · blocked by status model | nova |
| `app-accent-palette-tokens` | Give Rosie turquoise and reference blue reusable accent palettes | shipped | nova |
| `desktop-notification-rail-trigger` | Put desktop Notifications in their marked rail homes | routed · queued behind desktop-shell visual-QA/deployment gate | nova |
| `weekday-plant-news-page-ui` | Design-led daily brief and articles for prospects and the LPS team | routed · PROTOTYPE COMPLETE ONLY; private static preview, public release held | nova |
| `weekday-plant-news-publishing` | Curate weekday news for morning briefs and the inspiration page | staged · morning delivery option added; owner/channel/time approval pending, no schedule | bhoumik |
