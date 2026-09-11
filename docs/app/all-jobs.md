# All jobs (`/requests`)

All jobs is the one Jobs list. Its query, filters and page are retained in tab-scoped state. The server keeps the default order as parent `job_requests.updated_at DESC NULLS LAST`, then request `id DESC`; chat and line-item activity do not participate in that order. Created and Updated filters are rolling parent-request date windows, and the list remains server-paged.

Saved changes appear automatically through the existing authenticated event
stream: Rosie or another user creating a job, changing its stage, adding or
deleting lines, or updating supplier answers causes a background read. Bursts
are grouped for 200ms. Cards and editors stay mounted; filters, selection,
expansion choices and unsaved drafts are retained for surviving rows. Counts,
totals and open history update with the saved data. Reconnect, tab return and
a slow fallback poll recover missed changes. The publication setup is
`harness/agents/daisy/migrations/0091_job_realtime.sql`.

## Job workflow

Active means no processing has happened. Pricing lookup or a shared quote
advances a job to Quote; an availability send advances Active/Quote to
Availability. Customer confirmation advances any of those working stages to
Confirmed. Closing Won or Lost closes every linked availability request and
prevents supplier edits. Reopening the job restores each availability request’s
previous stage. Database hooks cover app and agent writes. Sourcing
notes show one short row per supplier with its price and latest response;
multiple candidates remain visible together. Simple pricing questions do not create jobs. A quick quote creates a Job
Request and its thread but no Availability Request. See [Rosie](../harness/agent-rosie.md) for thread
ownership and the sourcing procedure.

## Availability request creation feedback

The All Jobs availability dialog reports record creation, not supplier/email
delivery: **Availability request created** for one successful request,
**N availability requests created** for multiple successes, and
**X of N created · F failed** for mixed or all-failed results. The same copy
applies to Partner and non-Partner suppliers without inspecting returned links.
The per-job payloads, error handling, selection, refresh and close behavior are
unchanged; creation feedback adds no sends or network calls. Confirmations for
separately verified sends elsewhere retain their delivery wording.

## Mobile toolbar

The page resolves one `<900px` media query and passes that result to the toolbar and cards. SSR and unresolved hydration render a neutral, noninteractive toolbar placeholder; once resolved, exactly one branch mounts. Below 900px, the first toolbar row is a shrinking Search field beside one 44px icon-only **Filters** button. The row is non-wrapping and bounded to the page column. Inline expansion is desktop-only, so mobile does not mount Expand all / Collapse all. At 900px and above, only the established shared desktop toolbar and chip menus mount, including one copy of the Shell-owned actions and its expansion control.

Filters opens one body-portalled modal surface containing Status, Customer, Created and Updated. **Item status is absent from mobile DOM and accessibility tree.** Mobile always omits `itemStatus` from its query, result constraint, active-count badge and deviation state. A desktop Item status selection remains parked separately in page/session state while mobile is active, then returns unchanged on the next desktop render; mobile Clear all does not erase that parked desktop choice. The desktop toolbar and Item status behavior remain exact. Status starts with Active, Quote, Availability, Confirmed, Won and Lost selected. Restoring `lps.requests.visit.v1` maps New/Sourcing to Active, Quoted/Quote Delivered to Quote and Closed Won/Lost to Won/Lost; In Progress expands to Quote and Availability before validation and deduplication, preserving explicit selections made with current labels. Archived remains legacy history, included when the status filter is cleared. The Filters active count is the number of filter groups that differ from that baseline; the six baseline status selections do not display as six active filters. While open, every body sibling is made inert and `aria-hidden` and body scrolling is locked, with each prior value restored exactly. Escape, pointer/touch backdrop and the explicit 44px Close control dismiss the surface; Tab and Shift+Tab stay inside. Each opening focuses Close once, while filter-state rerenders retain focus on the checkbox or radio just changed. Ordinary dismissal restores trigger focus. Crossing 899/900 unmounts the old surface/menu and its listeners and preserves selections. It transfers focus to the newly mounted Search only when the outgoing toolbar owned focus or its Filters surface was open; a connected control outside that toolbar or any other modal (Delete, availability and so on) keeps focus. Every transfer frame is cancelled or generation-invalidated by another crossing or unmount.

## Mobile request-card hierarchy and actions

Every resolved-mobile card has exactly two direct, tight, non-wrapping summary rows, regardless of desktop expansion state. Mobile has no inline expansion chevron and no replacement disclosure. Row 1 is **JR reference · full plain-language sales status · Company/Customer · Job name**. JR and status are intrinsic, while Company/Customer and Job name share the one `min-w-0 flex-1` canonical identity link and ellipsize as a unit. Identity values are trimmed first: nonblank company, then nonblank customer name, then **Unassigned customer**. A blank Job name is omitted here rather than repeating the already-visible JR fallback. Selecting the identity opens `/jobs?jr=<id>` for the complete focused Job.

The status control remains a minimum-44px accessible target and visibly spells **Active**, **Quote**, **Availability**, **Confirmed**, **Won** or **Lost**—no abbreviations. Its picker uses those six stages; legacy Archived records remain readable. Row 2 is exact **Pending · Rosie Chat**: an intrinsic Pending dot/count pill at left and a visible named, minimum-44px canonical Rosie action at right, opening exact `jr-<id>` routing. The head uses 10px vertical padding and an exact 6px row gap; neither row reserves hidden height.

Those two rows are the entire mobile card. It does not mount `RequestLinks`, note preview, full counts, RequestBody, nested details, line actions, Delete, dates, PO, Install Date or Delivery/Pickup fields. This is intentional navigation, not action loss: the identity opens the focused Job, which carries the full truthful totals and plant table, compact permanent Delete, the **Job details & notes** tray, related customer/supplier/AR routes and history. Future structured Install Date and fulfillment fields remain omitted completely—no placeholder, updated-date substitution or note inference. Rendered 320px, 390px and 480px evidence verifies that only the flexible identity yields while both rows and the named Rosie route remain visible.

A resolved expanded **desktop** card instead uses the focused-Job hierarchy. Its balanced head keeps JR plus Sales status left and one centered, single-line ellipsizing `customers.company | job_requests.name | customers.name` identity. These are raw values separated by ` | `—never literal Company, Contractor, Job or Contact prefixes. Genuinely missing company, Job or contact components and their adjacent separators are omitted; shipping, dates, JR, billing and notes never fill a missing identity component. In the focused Job header, the Job/Site component alone is the inline control and edits only `job_requests.name`; a missing value exposes **Add Job name**, never company, contact or the combined identity as trigger text. The separate display identity remains exact stored nonblank `Company | Job/Site | Contact` values with missing segments and separators omitted. Enter or the visible 44px **Save** control trims and saves a nonblank changed value of at most 160 characters; the 44px **Cancel** control, Escape, blank input and unchanged input cancel without PATCH. The same 160-character bound is enforced by `/api/rows`. Success refetches both focused detail and the Active Jobs rail before parent-owned focus returns to the connected live edit trigger; failure stays in the editor, uses the established error toast and retains input focus. A switched or unmounted JR aborts/ignores stale completion.

The old Request/Contact/Delivery/Billing overview boxes and top-level Last updated are absent, so the full truthful totals and plant table remain immediate. One closed, keyboard-visible 44px **Job details & notes** row follows the table and opens compact signature columns for exact stored Contact, editable billing, editable delivery address, Last updated and the three note audiences; stored customer/supplier routes remain under Related, followed by a focused-only 44px Change history disclosure. Shared editable and status primitives retain their established compact defaults everywhere else; focused/compact Job work opts into 44px targets explicitly. The same hierarchy is used by focused Jobs on desktop and mobile. There is no Install Date, Delivery/Pickup, payment method, Gate code or Tax control because those structured contracts do not exist. Collapsed desktop cards keep their existing scan layout.

Desktop retains its existing inline expansion and compact trash action. Mobile cards have no expansion or Actions control. The focused Job's compact **Delete job** action opens the existing permanent-delete confirmation and uses the same `DELETE /api/requests/:id` path. Network rejection, HTTP/403 and malformed-success bodies stay in the dialog with a visible error and no navigation; repeated confirmation cannot issue a second request. Only a validated success closes and returns to All Jobs, and its existing toast reports the exact server-returned line and availability-request counts. Cancel/failure focus semantics and authorization remain intact. No Print, Copy or inactive utility is shown.
