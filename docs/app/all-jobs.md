# All jobs (`/requests`)

All jobs is the one Jobs list. Its query, filters and page are retained in tab-scoped state. The list defaults to Availability and Committed on mobile and desktop; Quote is a newly created job's default stage, not a default list filter. Quote work is visible after choosing Quote in Status, while a direct `/jobs?jr=<id>` opens an existing Quote job without relying on list filters. The server keeps the default order as parent `job_requests.updated_at DESC NULLS LAST`, then request `id DESC`; chat and line-item activity do not participate in that order. Created and Updated filters are rolling parent-request date windows, and the list remains server-paged.

Saved changes appear automatically through the existing authenticated event
stream: Rosie or another user creating a job, changing its stage, adding or
deleting lines, or updating supplier answers causes a background read. Bursts
are grouped for 200ms. Cards and editors stay mounted; filters, selection,
expansion choices and unsaved drafts are retained for surviving rows. Counts,
totals and open history update with the saved data. Reconnect, tab return and
a slow fallback poll recover missed changes. The publication setup is
`harness/agents/daisy/migrations/0091_job_realtime.sql`.

## Job workflow

New jobs start at Quote and use APS pricing. Quick quotes stop there. Chris
approves the next availability request. Customer confirmation creates an order at Committed. Supplier confirmation
advances the Order to Confirmed; the Job Request stays Committed. Closing Won or Lost closes shared availability requests
only when all associated jobs are closed. Reopening a linked job restores the
request's previous stage. Database hooks cover app and agent writes.
**Note for customer** is information for the customer (it is the selected
candidate's: LPS's override, else the supplier's reply); the customer's own additional requests go in the
**Internal note**, which never holds supplier, listing, price or answer facts —
those live on the line's candidates (below). Item notes, their
popover and job-level notes use the same Markdown rendering; editing preserves the raw
Markdown. AR and thread links open their existing workspace views. Simple pricing questions do not create jobs. A quick quote creates a Job
Request and its thread but no Availability Request. See [Rosie](../harness/agent-rosie.md) for thread
ownership and the sourcing procedure.

## Candidates

Price lists are indicative, not stock: a listed plant may be gone and an
unlisted one may be available. So each job line has **candidates**
(`candidates` table, migration 0119) — supplier, plant name, size, price,
note for/from supplier and answer. Every line has a **default candidate**:
the APS original request, which the database creates with the line (0130;
price 0 = no price found) and Rosie prices; she adds listed alternatives
beside it. The default is never hidden, binned or deleted while the line
exists, and is what the line falls back to. She selects an
exact match herself, or the candidate Chris's direction or a standing
selection rule picks (several requested sizes → the cheapest priced); anything
else waits for Chris. She never asks about substitutes.

The line table is its own scroll area (up to 75% of the screen height): its
header row stays put while it scrolls; no column is frozen, so the whole row
scrolls sideways together. Headers and values are centred except Plant Name
(left). Default widths are narrow so values sit close together; every column
resizes by dragging the divider at its header's right edge.

- **Candidates** column: a pill per candidate, grouped by supplier (supplier
  names are shown on hover only, for now). A pill shows only its
  **description** (what the candidate is, e.g. `5 G Shumard Oak`;
  `candidates.description`, else size and name) and its price or **No
  price**; the line's original request has a dot on its left. Its colour is
  the supplier's answer (Available green, Partial Qty yellow, Unavailable red,
  Can Order orange, Arriving Soon, Diff Sz/Sub) and grey until there is one;
  an asked candidate whose supplier offered a substitute reads Unavailable,
  and its hover names the substitute (the substitute itself reads Diff Sz/Sub)
  — No price reads from the
  price cell, not the pill. Its border is solid until the candidate's AR is
  sent (on no AR or an unsent draft), dotted while the AR is out with the
  supplier (New or Processing — answers they save recolour the pill, the
  border stays dotted), and solid again once they submit (or it is closed).
  Hovering shows the rest: supplier, plant name and size, price,
  status and AR, the customer note (LPS's override, marked *(ours)*, else the
  supplier's reply, e.g. `5 G NA, 3 G only`), notes for/from the supplier,
  original request. The Selected column shows the same pill.
  Candidates hidden from LPS (`hide_from_lps`, 0124) are left out; the eye
  in the Candidates header (desktop table) toggles listing them too, drawn
  faded with a crossed-out eye. Not remembered: each job page opens with
  them hidden.
- **Selected** column: drop a pill here to select it, replacing the current
  selection. The selected candidate shows only here (not in Candidates); with
  no other pick it is the default, so every line has one (0130). The line *is*
  its selected candidate's answer: `job_lines` reads the candidate's size,
  price (0 stays blank), available quantity (capped at demand; blank while
  availability is unchecked, 0 when Unavailable), status and customer note.
  Nothing is copied. Editing the line's status, avail, price or **Note for
  customer** writes the selected candidate (`update_job_line`); name, size,
  demand and internal note are the line's own. Status maps Pending ↔
  unanswered and Need to Order ↔ Can Order; Available sets avail to demand,
  Unavailable to 0. The line reads Diff Sz/Sub for a substitute or an
  Unavailable original offering one, else Partial Qty when avail is below
  demand. Diff Sz/Sub is refused on an original with no substitute. No edit
  makes a substitute the original request or moves an AR's status, and the
  edits work on a closed AR.
  The **Size** cell shows the selected candidate's size (what the quote
  prints) and edits the size the customer asked for (empty when they gave
  none); its hover says when the two differ. A **Note for customer** typed here is LPS's override (emptied,
  it is a deliberate blank); while there is one, **Use supplier's note** drops
  it and the supplier's reply shows again.
  When the candidate's AR is submitted, a selected candidate that is
  Unavailable offering a substitute hands the selection to that substitute,
  and that supplier's other candidates on the AR are hidden except the
  default, its originals, their substitutes and the selection (open
  Quote/Availability jobs, answers since the previous submission).
- Dragging the Selected pill back onto its line's **Candidates** cell
  unselects it (`unselect_candidate`): the line falls back to its default
  candidate. The default itself has nowhere to go back to, so it shows no
  drop zone.
- **On phones** a pill drags after a short press and hold (a quick swipe still
  scrolls): a copy of the pill follows the finger, the zone under it lights up,
  and holding near the top or bottom edge scrolls the page. Every drop target
  below works the same (`components/workspace/touch-drag.ts` replays the drag
  events with the same payload). The pill stops being `draggable` for the
  length of a touch, so the browser's own long-press drag can't take it over.
- While a pill other than the line's default is dragged a **Hide** zone
  (**Unhide** for a hidden pill) and a **Bin** appear in its line's Candidates
  cell. Hide sets `hide_from_lps` (the pill leaves the column unless hidden
  ones are shown). The bin deletes the candidate (soft) and removes it from
  its AR; a line that had it selected falls back to its default. A drop that moves the pill (to Selected and back, Hide,
  the bin) ends the drag even though the moved pill never gets its `dragend`.
- **Asking a supplier**: on the job page (`/jobs?jr=`) drop a pill on its
  supplier's AR tab; on an All Jobs card, on its supplier's link under
  **Job details & notes → Related** (the card header carries no supplier
  tablets). A job has one AR per supplier (migration 0128), so the pill joins
  that AR. Only a Draft or New AR takes it: on a submitted or processing one
  the app asks first, then reopens it as New and adds the pill in one step
  (**Reopen and add**); a closed one must be reopened first. Nothing reopens
  an AR by itself (0130). Only that supplier's pills are accepted, and only
  unasked ones: a pill already on an AR is refused before anything is
  reopened.
  New ARs start as **Drafts** (migration 0120), invisible to the supplier until
  published. Each Draft chip shows **Draft** and a **Publish** button; the
  drawer also offers Publish. Published requests can move to Draft through
  the request status picker, hiding them from suppliers and revoking the old
  public link. ARs are retained permanently and have no Delete action.
- Routes: `POST /api/requests/:id/items/:itemId/candidates/:candidateId` with
  `{ action: 'select' }`, `{ action: 'unselect' }`, `{ action: 'add', arId }`
  (with `reopen: true` it calls `reopen_availability_request` first, once the
  candidate is known to be unasked and that AR's supplier's),
  `{ action: 'hide' }` or `{ action: 'unhide' }`, and `DELETE` for the bin.
  Drag and drop is native HTML5, so it needs a mouse or trackpad.

The All Jobs **Send availability request** dialog asks each chosen line's
original request and sends right away: APS is asked the line's default (a
line whose default is already asked is skipped); another supplier its unasked
original for the line, else a copy of the default (name, size, description,
demand, note for supplier) priced from that supplier's catalogue. When the
supplier's AR for the job is submitted or processing, the dialog asks first
and reopens it as New only on confirm (`reopen: true`; the API answers `409`
without it); the toast says so. Lines from several jobs become one request
per job; if some fail, retrying skips the jobs already sent.

## Availability sidebar editing

The availability sidebar opened from a Job lets admins edit each line's plant
name, requested size, requested quantity and **note for supplier** (LPS's ask),
alongside answer status, available quantity, price and the **supplier reply**. These fields save
on blur (or Enter for a single-line input) on desktop and mobile.
Edits apply to that availability request's snapshot; the original Job line and
other suppliers' requests keep their own values. Plant names must be nonblank;
requested quantity can be cleared or set to a positive number. Closed requests
stay read-only until reopened. LPS edits keep the AR's status (0130):
reopening is the explicit **New** on its status pill. Edits to Draft stay
private. Draft
answer preparation uses the admin RPC; supplier/public routes reject Draft.
Supplier and public views keep requested plant
details read-only.

Only AR chips in the focused `/jobs?jr=<id>` Job header open the sidebar in the
supplier portal's drawing (`ARLineTable` `design="portal"`, the same table as
`/partner/:id/requests/:arId`): the answer-count **SummaryStrip** with subtotal,
then **Need · Avail qty · Size · Plant · Status · Price · Note for supplier** over
plain hairlines, tone-tinted rows, the portal's status listbox and the purple
needs-a-price accent, with no Line total column or subtotal footer. On top of
that drawing the admin keeps inline edits: plant name, size and requested
quantity (admin detail route), available quantity, status and price (answer
route), the line's `note_for_supplier` and its `note_from_supplier` reply, all borderless until hovered or
focused and saved on blur/Enter. Plant and Size wrap rather than clip; Notes is
the only truncated column (one line until focused). A clipped editor shows its
full text as a hover tooltip. The status listbox mounts inside the drawer's
modal host so the modal isolation doesn't make it inert. All jobs, customer
cards, chat AR links, other drawer entries and supplier profiles keep the
default drawing; any ordinary open, even of the same AR, resets to it.

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

Filters opens one body-portalled modal surface containing Status, Customer, Created and Updated. **Item status is absent from mobile DOM and accessibility tree.** Mobile always omits `itemStatus` from its query, result constraint, active-count badge and deviation state. A desktop Item status selection remains parked separately in page/session state while mobile is active, then returns unchanged on the next desktop render; mobile Clear all does not erase that parked desktop choice. The desktop toolbar and Item status behavior remain exact. Status starts with Quote, Availability, Committed, Won and Lost selected. Restoring `lps.requests.visit.v1` maps Active/New/Sourcing to Quote, Confirmed to Committed, Quoted/Quote Delivered to Quote and Closed Won/Lost to Won/Lost; In Progress expands to Quote and Availability before validation and deduplication, preserving explicit selections made with current labels. Archived remains legacy history, included when the status filter is cleared. The Filters active count is the number of filter groups that differ from that baseline; the five baseline status selections do not display as five active filters. While open, every body sibling is made inert and `aria-hidden` and body scrolling is locked, with each prior value restored exactly. Escape, pointer/touch backdrop and the explicit 44px Close control dismiss the surface; Tab and Shift+Tab stay inside. Each opening focuses Close once, while filter-state rerenders retain focus on the checkbox or radio just changed. Ordinary dismissal restores trigger focus. Crossing 899/900 unmounts the old surface/menu and its listeners and preserves selections. It transfers focus to the newly mounted Search only when the outgoing toolbar owned focus or its Filters surface was open; a connected control outside that toolbar or any other modal (Delete, availability and so on) keeps focus. Every transfer frame is cancelled or generation-invalidated by another crossing or unmount.

## Mobile request-card hierarchy and actions

Every resolved-mobile card keeps its identity/action rows and includes scheduling metadata inline in the header, wrapping when space is limited, regardless of desktop expansion state. Mobile has no inline expansion chevron and no replacement disclosure. Row 1 is **JR reference · full plain-language sales status · Company/Customer · Job name** with inline **Created on · EDD · Fulfillment** metadata. JR and status are intrinsic, while Company/Customer and Job name share the one `min-w-0 flex-1` canonical identity link and ellipsize as a unit. Identity values are trimmed first: nonblank company, then nonblank customer name, then **Unassigned customer**. A blank Job name is omitted here rather than repeating the already-visible JR fallback. Selecting the identity opens `/jobs?jr=<id>` for the complete focused Job.

The status control remains a minimum-44px accessible target and visibly spells **Quote**, **Availability**, **Committed**, **Won** or **Lost**—no abbreviations. Its picker uses those five stages; legacy Archived records remain readable. Row 2 is exact **Pending · Rosie Chat**: an intrinsic Pending dot/count pill at left and a visible named, minimum-44px canonical Rosie action at right, opening exact `jr-<id>` routing. The head uses 10px vertical padding and an exact 6px row gap; neither row reserves hidden height.

Compact **Created on**, **EDD** and **Fulfillment** metadata sits in the existing
header row on every card, including mobile and collapsed desktop cards, and in
the focused Job header on both breakpoints. **EDD** displays Expected install
date; the data field and editor retain the full name. Dates use zero-padded `MM-DD`.
Install dates preserve the saved calendar day; Created/Submitted timestamps use
`America/Chicago`. Missing values display `—` (an empty *editable* EDD or fulfillment pill reads **Set date** / **Set mode** in a dashed outline instead); Updated and free-text notes never
supply a missing install date or fulfillment method. Header contents wrap when
space is limited. Below 900px the card's second row wraps: the customer pill
sizes to its content, and the supplier links take their own full-width row
beneath it instead of being squeezed beside a fixed-width pill. Mobile list
cards still omit full counts, RequestBody, line actions and Delete; the
identity opens the complete focused Job.

Each AR segment under a job shows a bare **MM-DD** below the AR reference:
the saved submission date for current `submitted` requests and the creation
date for every other status, even when an older submission timestamp exists.
New and processing requests carry a yellow dot; submitted requests carry a
green dot. Closed and unknown stages have no dot. A missing timestamp displays
`—`. AR drawer and supplier/public headers
show Created on and the job's EDD/Fulfillment pair inline in the header. See
[Availability header metadata](availability-header-metadata.md).

A resolved expanded **desktop** card instead uses the focused-Job hierarchy. Its wrapping header keeps JR plus Sales status left, inline Created on / EDD / Fulfillment metadata, and one flexible, single-line ellipsizing `customers.company | job_requests.name | customers.name` identity. These are raw values separated by ` | `—never literal Company, Contractor, Job or Contact prefixes. Genuinely missing company, Job or contact components and their adjacent separators are omitted; shipping, dates, JR, billing and notes never fill a missing identity component. In the focused Job header, the Job/Site component alone is the inline control and edits only `job_requests.name`; a missing value exposes **Add Job name**, never company, contact or the combined identity as trigger text. The separate display identity remains exact stored nonblank `Company | Job/Site | Contact` values with missing segments and separators omitted. Enter or the visible 44px **Save** control trims and saves a nonblank changed value of at most 160 characters; the 44px **Cancel** control, Escape, blank input and unchanged input cancel without PATCH. The same 160-character bound is enforced by `/api/rows`. Success refetches both focused detail and the Active Jobs rail before parent-owned focus returns to the connected live edit trigger; failure stays in the editor, uses the established error toast and retains input focus. A switched or unmounted JR aborts/ignores stale completion.

**Focused Job header card (desktop and mobile).** `FocusedJobRecord` passes `stacked` to `RequestCardHeader`: no expand chevron, one grid (`data-job-card-mobile`) with two arrangements. Top row: `JR-n` link and status pill; at the right the customer's Rosie chat button, the icon-only Copy quote menu (dropdown chevron) and the vertical-dots ⋯ menu, spaced evenly. Name block: the job name — usually the address — as a 20px bold inline `EditableText` (no pencil) with the customer (company, else name; `Retail ` prefix for homeowners) as small muted text below, omitted when the job name already contains it. The calendar-icon date and truck-icon Pickup/Delivery sit beside the status in the top row from 900px up; on phones they stack, right-aligned, beside the name. Both use `tapToEdit` (`JobMetadata` / `EditableFulfillment`): a tap opens the native calendar / dropdown even on touch, where other date and mode fields still need a hold. Item count, total, the job-level Rosie chat and the latest-note pill are not in this header. All Jobs list cards keep their compact layout.

The old Request/Contact/Delivery/Billing overview boxes and top-level Last updated are absent, so the full truthful totals and plant table remain immediate. One closed, keyboard-visible 44px **Job details & notes** row follows the table and opens compact signature columns for exact stored Contact, editable billing, editable delivery address, Last updated and the three note audiences; stored customer routes remain under Related (All Jobs cards also list supplier routes there; the focused Job reaches its suppliers through AR tabs), followed by a focused-only 44px Change history disclosure. Shared editable and status primitives retain their established compact defaults everywhere else; focused/compact Job work opts into 44px targets explicitly. The same hierarchy is used by focused Jobs on desktop and mobile. The delivery details include Expected install date and Pickup / Delivery. Request items and Orders tabs separate demand from committed supplier orders; the focused Job adds one tab per supplier AR (below). Payment method, Gate code and Tax controls remain absent. Collapsed desktop cards keep their existing scan layout.

**Job page tabs and the AR tab.** Request items, Orders and one tab per supplier AR sit on a single row that scrolls sideways when they don't fit. An AR tab draws the supplier's own AR page (`/partner/:id/requests/:arId`) with the same components, on desktop and phones, minus the header card (`ARRequestHeader`) — the job card above already names the job, contact and delivery address: the counts strip, the line table with the centred Status column, the **Note for this request** card (`ARRequestNote`) and the wide centred submit bar (`ARSubmitBar`; Publish / Submit request / Submit again here, the button alone with no line under it). What differs is admin-only: one row on top holds the status picker, **Share** (icon-only on phones), a **Share customer info** tick box — whether the supplier sees the job's customer details (`shareCustomerDetails` on `PATCH /api/availability-requests/:id`; not on a closed request) — and **Print**, which prints the portal's AR sheet; and plant name, quantity, size, the per-line note for supplier and the request note are edited in place. The supplier's page shows them read-only.

The jobs tab's editable cells use the partner page's sizes at rest (phone cards: *Need · size* and the line note 12px; desktop: size 12px, line note 11.5px). A focused phone field grows to 16px so iOS doesn't zoom.

**Line cards share a plant name.** On phones, the job's item cards and every AR line card (jobs tab and partner/public pages) draw the plant name with one class, `lineCardName` (`lib/line-card.ts`): the job item's 12.5px semibold, wrapped in full rather than cut off. The job item card passes `wrap` to `EditableText` for this; the desktop item table still truncates. `LineCard` centres its first row, so `Qty × Size` sits level with the middle of a wrapped name, and the quantity never wraps (its slot grows from 36px to 64px).

**Date edits.** Every editable date — the job's date pill (All Jobs cards and the focused Job header), the date in Job details, and an order's fulfillment date (partner order cards and the order form) — spreads `datePickerProps` (`editable.tsx`) onto its `<input type="date">`. The date pill always reads `Day, MM/DD`: its native input is an invisible overlay, so a tap opens the calendar rather than the raw `mm/dd/yyyy` field. A click opens the native picker at once. A picked date leaves the field, which drops its highlight and saves without a tap elsewhere. A date typed on a keyboard keeps focus while it is typed segment by segment.

**Touch editing.** On a coarse pointer, inline fields (`EditableText`, `EditableTextarea`, availability `AnswerCell`, job name, EDD, Pickup/Delivery) open only after a ~0.45s press-and-hold (`components/workspace/long-press.ts`), so a scroll never opens one; mouse and keyboard keep click-to-edit.

**Focused Job on phones (<900px).** Copy quote and the ⋯ actions share the status row, so the job name gets the full width beneath it. The status counts use the wrapping grid (Total items and Subtotal on top, then the status counts in compact rows of four) instead of the 1040px sideways strip. Lines draw as one separate rounded card each, 16px apart (as are the AR and order line cards on phones), built from the same editable cells as the table: one row of `Qty × Size Plant name` (each part editable on its own) and delete on top; Status · Avail · Price · Total as one row of label-over-value fields; then one **More** / **Less** toggle, left-aligned, closed by default, that opens four rows: Note for customer, Selected (when the line has candidates), Candidates (when there are others) and Internal note. The sideways table (`data-request-line-table`) is desktop-only; phones render `data-request-line-cards`.

Desktop retains its existing inline expansion and compact trash action. Mobile cards have no expansion or Actions control. The focused Job's compact **Delete job** action opens the existing permanent-delete confirmation and uses the same `DELETE /api/requests/:id` path. Network rejection, HTTP/403 and malformed-success bodies stay in the dialog with a visible error and no navigation; repeated confirmation cannot issue a second request. Only a validated success closes and returns to All Jobs, and its existing toast reports the exact server-returned line and availability-request counts. Cancel/failure focus semantics and authorization remain intact. No Print, Copy or inactive utility is shown.
