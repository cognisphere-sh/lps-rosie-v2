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
| `one-gallon-sedge-price-mapping` | Use one 1 G price for sedge varieties | staged | bhoumik |
| `supplier-natural-language-replies` | Let Austin reply naturally and keep the work current | staged | bhoumik |
| `catalog-photo-upload-page` | Add catalog photos from the Photos page | staged | nova (blocked by bhoumik workflow) |
| `catalog-photo-intake-review` | Review submitted catalog photos before publishing | staged | bhoumik |
| `mobile-agent-chat-translucent-header` | Make the mobile agent-chat header translucent | routed | nova |
| `job-request-delete-safety` | Make deleting a job request safe on mobile | shipped | nova |
| `lps-ops-job-request-statuses` | Use Chris’s LPS Ops job-request lifecycle and history | staged | bhoumik |
| `quote-opportunity-to-job-request-conversion` | Keep quick quote opportunities out of Request Management until sourcing starts | staged | bhoumik |
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
| `job-inbox-activity-semantics` | Define trustworthy Job Request inbox activity and unread meaning | staged | bhoumik |
| `copy-ready-plain-text-quotes` | Make plain-text quotes ready to copy and send | shipped | rosie |
| `supplier-filter-consolidation` | Put Supplier filters in one place | routed | nova |
| `account-popover-rail-actions` | Put account actions in the account popover | routed | nova |
