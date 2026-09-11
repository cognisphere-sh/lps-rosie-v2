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
| `mobile-agent-chat-translucent-header` | Make the mobile agent-chat header translucent | routed | nova |
| `job-request-delete-safety` | Make deleting a job request safe on mobile | shipped | nova |
| `lps-ops-job-request-statuses` | Use Chris’s LPS Ops Job Request sales lifecycle and history | staged · Sales vocabulary/migration implemented | bhoumik |
| `quote-opportunity-to-job-request-conversion` | Keep quick quote opportunities out of Request Management until sourcing starts | staged | bhoumik |
| `new-job-intake-customer-type-choice` | Let Chris identify a homeowner or landscape professional when a new job starts | drafted · ready after durable contract | nova |
| `customer-type-retail-landscape-workflow-pricing` | Work homeowners as retail customers and landscape professionals as contractors | staged | bhoumik |
| `availability-last-updated-display` | Show when availability was last updated | routed | nova |
| `availability-last-updated-semantics` | Define and retain the availability-update time | staged | bhoumik |
| `availability-response-change-management` | Keep availability changes visible after a nursery responds | staged | bhoumik |
| `availability-change-indicators` | Mark changed availability in Requests and Orders | drafted | nova |
| `customer-availability-update-workspace` | Show approved availability changes in customer job details | drafted · urgent dependency | nova |
| `customer-job-request-details-workspace` | Give customers a current job request details workspace | staged · urgent | bhoumik |
| `order-dispatch-and-supplier-response` | Send initial orders simply and receive supplier responses | staged · urgent | bhoumik |
| `supplier-onboarding-review` | Keep supplier-qualification decisions out of Telegram | staged | bhoumik |
| `supplier-outreach-human-tone` | Ask suppliers about availability like a person | shipped | rosie |
| `approved-voice-playbook-governance` | Keep a reviewed playbook for writing in Chris’s voice | drafted | bhoumik |
| `voice-playbook-review-screen` | Review Chris-voice guidance and examples in one place | drafted | nova |
| `app-wide-compact-headers` | Make app headers compact and purposeful | drafted · ready to route refinement | nova |
| `job-inbox-workspace` | Put active Job Requests in an inbox workspace | routed | nova |
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
| `out-of-network-public-availability-request` | Let an out-of-network supplier answer one live availability request | staged · partially shipped | bhoumik |
| `supplier-access-authentication` | Let nurseries answer one request easily without exposing LPS operations | staged · partially shipped | bhoumik |
| `supplier-email-identity-and-handoffs` | Keep supplier email identity clear while Daisy and Rosie hand work off safely | staged | bhoumik |
| `mobile-availability-request-view` | Make the availability-request view usable on a phone | routed · priority 3 | nova |
| `mobile-field-request-workflow` | Make mobile request work dependable in the field | staged | bhoumik |
| `mobile-request-update-response-workflow` | Define when a mobile request update has been received, worked or failed | staged | bhoumik |
| `mobile-request-update-response-state` | Show the current response state for a mobile request update | drafted · blocked by workflow | nova |
| `supplier-category-badge-width` | Keep Supplier Category badges clear of State | routed | nova |
| `mobile-all-jobs-toolbar` | Make All jobs toolbar and cards compact | routed | nova |
| `mobile-focused-job-header` | Make the focused mobile Job header scannable | routed | nova |
| `focused-job-details-tray` | Keep focused Job details in one compact tray | routed · serialized behind mobile AR deployment | nova |
| `focused-job-name-inline-edit` | Let Chris edit a focused Job name safely | routed · display composition separated | nova |
| `job-request-display-identity` | Show one exact Request identity from the stored company, job, and contact | routed | nova |
| `job-request-install-date-fulfillment` | Keep install, fulfillment, gate and payment facts on each Job Request | staged | bhoumik |
| `focused-job-chat-routing` | Keep a focused Job chat on the current request | shipped | nova |
| `urgent-pricing-update-workflow` | Make urgent pricing updates reach the right Job without delay | staged | bhoumik |
| `pricing-lookup-reliability` | Make every pricing answer traceable and dependable | staged | bhoumik |
| `visual-ui-qa-gate` | Gate UI releases on real visual review | shipped | nova |
| `plant-search-match-before-geography` | Find the exact plant and size before narrowing by geography | drafted | daisy |
| `plant-search-result-location-clarity` | Show where each Plant Search match is located | routed | nova |
| `customer-review-status-color` | Make approved customer-review availability statuses easy to scan in web chat | drafted · blocked by status model | nova |
| `app-accent-palette-tokens` | Give Rosie turquoise and reference blue reusable accent palettes | shipped | nova |
| `desktop-notification-rail-trigger` | Put desktop Notifications in their marked rail homes | routed · queued behind desktop-shell visual-QA/deployment gate | nova |
