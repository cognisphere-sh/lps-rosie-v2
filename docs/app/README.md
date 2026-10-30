# App documentation

> **Handbook:** a top-down, admin-only HTML handbook of the whole application
> (business workflows → system design → API/database/agent reference, with
> archify diagrams) is served from `app/public/docs/` at `/docs/index.html`;
> `/docs` redirects there (`next.config.ts`). `proxy.ts` gates the whole tree
> (second matcher entry `/docs/:path*`): signed out → `/login`, partner → portal.
> Only `/docs/onboarding/` stays public (`PUBLIC_DOCS`), for the page below.
> Diagram sources: [`handbook-diagram-sources/`](handbook-diagram-sources/).
> Update its pages when a change makes them wrong (§7).
>
> **Partner onboarding:** `/partner-onboarding` (public; a rewrite to
> `/docs/partner-onboarding.html`, exempt in `proxy.ts` as `PUBLIC_PAGES`) plays
> nine narrated videos of the supplier portal (files in `app/public/docs/onboarding/`). They are
> built by [`video/partner-onboarding/`](../../video/partner-onboarding/README.md);
> re-record the affected chapter when a portal screen changes.

The user-facing web app (`app/`). Owned by whoever changes the code — the
developer agent (`nova`) or a human — and updated **after every change** under
`app/` (see `CLAUDE.md` §7).

An AR has no delete flag or Delete action of its own; it is deleted only with its job (0139, 0141).
Drafts are clearly labelled on the supplier's link in Job details → Related, with **Publish** beside
the AR and in its drawer. Published requests can return to **Draft** through
the status picker or supplier profile, hiding them from supplier views and
revoking their public link while keeping answers and candidate associations.
LPS content edits return published requests to **New**; draft preparation
stays private. Supplier answers and submissions still advance Processing and
Completed. Deleting a job closes its ARs and retains their supplier snapshots.

## Job and plant statuses

Job Requests offer **Quote**, **Availability**, **Committed**, **Won**, **Lost**.
Stored values are `quoted`, `availability`, `committed`, `closed_won`, `closed_lost`. Migration 0092 replaces Active with
Quote and makes Quote the default **for newly created jobs**. The All jobs list separately defaults to Availability and Committed, so Quote jobs require a different status filter. Legacy Archived rows remain readable.
Active Jobs, customer totals and Rosie's job picker include all three working
stages. Migration 0093 removes the Job Request Confirmed stage, mapping saved
Confirmed jobs and filters to Committed. Supplier Orders use New → Processing → Order Ready after migration 0094, then Completed (0154). Persisted Active/New/Sourcing filters restore to Quote; previously
complete defaults include Committed. See [Orders](orders.md) for supplier order
creation (one order per job and supplier, one row per selected candidate; 0146) and confirmation.

Job plants offer **Available**, **Partial Qty**, **Unavailable**, **Diff
Sz/Sub**, **Can Order**, **Arriving Soon**, **Pending** (migration 0121).
Availability-request plants use the same order, including partner/public request
pages, answer dialogs, summaries, filters, status boards and print sheets.
The two row types retain their respective stored values (see the schema).
Availability Pending persists NULL, keeps quantities/prices/notes, and does
not count as an answer. Job Pending remains the saved `pending` default.
Quantity shortfalls retain the saved Available label and their coverage tint.
Selecting any status does not place an order or copy supplier answers into
job rows. Working sales-stage changes leave supplier requests open. Terminal sales stages
and deactivation close requests only when no linked job remains open.

The workflow is quote first, using APS's price list. An explicit quick quote
stops at Quote. Otherwise Rosie asks Chris before creating an availability
request for APS. Supplier responses change job-line availability only after
Chris approves. Customer confirmation creates an order and advances the job to
Committed. The Order starts at New; Acknowledge Received opens a dialog with
no inputs that moves it to Processing, then the supplier or Chris/admin can
mark it Order Ready; the supplier then marks it Completed (0154). An order's pickup/delivery and target date are its job's
(0149); Chris edits its Additional details (a JSON field list, 0151) on the job Orders tab.
The Job Request remains Committed. Quote/pricing events
never regress later stages or reopen closed jobs. Job creation creates its
`jr-<id>` thread; general pricing questions do not create job records.

Job details include editable Expected delivery / installation date (EDD) and Pickup / Delivery.
On `/requests`, job cards place Created on and EDD side by side and omit the
Fulfillment field. Focused headers stack Created on above EDD in a shared
two-column label/value grid so both dates start in exactly the same column,
including the editable EDD.
Focused Job headers show the full job status label on desktop and mobile,
with a Pickup or Delivery tag beside it when known. Rosie chat and Delete job
actions appear in the desktop top toolbar beside New job and notifications
(the mobile header retains its actions). Below the
header, the item-count/status/subtotal summary comes first, followed by the
AR/supplier tags. AR tags place the number and date side by side and use
compact 32px controls on the focused desktop page. Delete job has no separate
action row and retains its existing confirmation dialog. EDD is the display
label for the customer’s expected delivery or installation date, stored as
`expected_install_date`. AR headers show Created on and the linked job’s EDD and
Pickup/Delivery tag. Jobs, availability requests and orders share the job's
EDD; nothing has a separate fulfillment date (orders lost theirs in 0149).
Display dates use `MM-DD`. See
[Availability header metadata](availability-header-metadata.md).
The shared request body has Request items and Orders tabs. The availability
dialog defaults to APS; selected lines across jobs become one request per job
(migration 0119: `availability_requests.job_request_id`). A job has one AR
per supplier (0128): asking a supplier the job already has an AR with adds
the lines to that AR (publishing it if it is a Draft, keeping an existing
public link; reopening a submitted or processing one as New, which LPS
confirms) and refuses a closed one until it is reopened. Nothing reopens an AR
by itself (0130). Closing a job closes
its requests. Deleting a job deletes its ARs and the orders only it uses; an order shared with
another job loses just this job's lines (0141).

Supplier options for a line are **candidates**, shown as pills in the job
line table's Candidates column and dragged to Selected (and back, to fall
back to the line's **default candidate**), a supplier's AR, Hide or the bin
(see [All jobs](all-jobs.md#candidates)). Every line has a default — the APS
original request the database creates with it (0130) — and a selection, and
reads its price, status, availability and customer note from the selected
candidate through the `job_lines` view. Candidates with
`hide_from_lps` (0124: substitute options kept for the supplier's
Diff Sz/Sub dialog, or ones LPS dragged to Hide) are left out of the column
until a supplier picks one, which clears the flag; the eye in the Candidates
header lists them too. Internal notes hold the
customer's additional requests and other internal context, never suppliers or
prices; they stay out of customer messages and quotes. Note for customer is
information for the customer.

The Active Jobs sidebar has an instant search across job references and names,
customers, plant names and sizes, and job/item notes. It filters the complete
active list while retaining the selected job and live updates. See
[Active Jobs search](active-jobs-search.md).

## What it is

A **Next.js 16** app (App Router, React 19, Tailwind 4) implementing the
**Supplier Workspace** design: a dense, spreadsheet-style workspace over the
supplier and inventory catalogue in Supabase.

Data lives in Supabase project `xyeyiqchadfszewztnrf`. **The schema is
documented once, in [`docs/supabase-schema.md`](../supabase-schema.md)** — do
not restate table or column definitions here.

> Earlier versions of this app were a proxy shell over Rosie's workspace files
> and hosted a public `/stock-check/...` form. Both are gone.

## Design source

Two linked Claude Design projects:

- **Supplier Workspace** (`bc0a7bcf-551b-471d-9b0c-a7bae1bcedef`,
  `Supplier Workspace.dc.html`) — the screens and layout this app implements.
- **Local Plant Supply UI** (`17ff846c-…`, `lps-ui@0.1.0`) — the shadcn/ui
  (new-york) component set the design builds on.
- **Order Requests** (`ebbc6644-7e83-439a-8970-77f9fcaf74c9`,
  `Order Requests.dc.html`) — `/requests` is the one Jobs list; `/jobs?jr=<id>`
  is the focused Job page and Rosie intake route. It contributes the status **tones** now in `globals.css`
  (`--lps-tone-{green,lime,grey,amber,red,teal,yellow,orange,blue,purple}-{bg,fg,dot}`, each with a dark
  variant), read through `lib/job-requests.ts`. Partial Qty is yellow and Can
  Order orange (2026-09-30). **One status, one colour on both sides of the
  portal** (2026-10-19): an AR or order is blue at New, orange at Processing and
  green when done, Diff Sz/Sub is purple — the hues the supplier portal shows —
  and the portal's By item counts read the same tones (`arResponseTone`).
  A selected line row is tinted with the primary colour, never a status tone.
- **Type scale and contrast** (2026-10-19): text sizes are 11 / 12 / 13 / 14 /
  16 / 18 / 20px (print sheets keep their own paper sizes); 11px is for
  labels, badges and table headers, not running text. An uppercase label is
  always 11px bold with `tracking-[.05em]` (vertical collapsed-panel tabs keep
  `.08em`). Light-theme
  `--muted-foreground` (`#48594B`) and `--lps-dim` (`#607462`) clear 4.5:1 on
  every app surface, `--input` (`#7A8E7C`) gives form fields a 3:1 edge, and
  `--lps-warn-on-dot` is the text colour for amber count badges.
- **Motion** (2026-10-19): motion explains where a surface came from and
  that a state changed, nothing else. There is no page-load choreography,
  scroll reveal or list stagger. One arrival curve, `ease-lps`
  (`cubic-bezier(.16,1,.3,1)`, also `var(--ease-lps)`), and the classes in
  `globals.css`: every transient surface keeps the marker class `lps-pop`
  (tests use it to find open popovers) plus a modifier for its origin.
  `lps-pop-down` is a menu or popover opening below its trigger, `lps-pop-up`
  one opening above it (fixed menus that flip choose at runtime), and
  `lps-pop-dialog` a modal panel over an `lps-scrim` backdrop (a native
  `<dialog>`, like the order dialogs, fades its `::backdrop` with it). `lps-sheet`
  slides the AR drawer in from the right on a wrapper that doesn't remount when
  the drawer switches AR. Bare `lps-pop` (toasts, the selection bar) rises
  6px. Timing: 120ms press, 150–180ms state change or menu, 220ms dialog,
  300ms sheet. Exits are instant. State changes (status pills, tabs, toggles,
  chevrons) use `transition-colors` / `transition-transform` with `ease-lps`
  instead of snapping. Primary actions scale to .97 while pressed (Tailwind v4
  `scale-*` is the standalone `scale` property, so an arbitrary
  `transition-[…]` list must name `scale`, not just `transform`). In chat, only
  a message that arrives after the transcript mounts gets `lps-pop`. History,
  thread switches and load-earlier never animate. Under
  `prefers-reduced-motion` every overlay class becomes a 120ms fade, and
  decorative loops are `motion-safe:` only. The portal's submit
  acknowledgement (`.lps-received*`) and the search loader keep their own
  authored animations.
- **Route transitions** (2026-10-19): moving between places is a View
  Transition (`lib/view-transitions.ts`), so a move shows where the new view
  came from. It keeps the 300ms ceiling, delay included (the unfold and
  fold 300ms, lateral and swap slides 230/210ms after a 70ms hand-off). The
  one exception to instant exits: the old page hands off over 110–150ms,
  because an instant exit would flash a blank column before the new page
  arrives. It never runs on first load. Four kinds: **lateral**
  (another rail destination: the page column slides along the rail and the
  solid "you are here" mark glides), **deeper** (a list row opens its record,
  which unfolds from the row and its name or JR ref flies into the title),
  **back** (the record folds into its row) and **swap** (same level: another
  job, farm or tab; a short slide). Only `[data-vt-page]` or a tab panel
  moves; the rest of the frame stays put. `RouteTransitions`
  (`components/workspace/route-transitions.tsx`, mounted in the root layout)
  turns in-app link clicks inside the workspace into transitions; a link
  steers with `data-vt-kind` / `data-vt-subject`, names its subject with a
  `data-vt-key` inside it, slides within a `data-vt-tabs` group, or opts out
  with `data-vt="off"`. `/api`, `/a` and `/public` links, modified clicks and
  `_blank`/`download` links are left alone. Names are set for one transition
  only, except the solid marks (`lps-here`, `lps-here-tab`,
  `lps-history-tab`), which keep theirs. The stage CSS is injected at runtime
  because Turbopack drops `::view-transition-*` rules from `globals.css`.
  The old view is held at most 900ms for a route to land (no move if it
  doesn't), and up to ~400ms more for the subject's destination. Detail
  pages make that destination exist at once: supplier and customer titles
  show the row's name (`subjectSeed`) until the record loads, and `/jobs`
  draws its loading state in the record's own frame with the JR ref. Clicks
  pass through the transition overlay, and CSS transitions pause while one
  runs, so a tab's colour easing is never caught half-way. Tab switches go
  through `switchTab` (a `data-vt-tabs` bar followed by its `data-vt-panel`).
  Without the API it simply navigates; under reduced motion it is a 120ms
  crossfade.
- **Delight** (2026-10-19): personality lives at moments, in the search
  loader's seedling world, never on ordinary clicks. Empty states use
  `EmptyState` (`components/workspace/empty-state.tsx`) and pick their drawing
  by meaning: `seed` = nothing yet, `tag` (a blank plant tag) = nothing
  matches, `bloom` = all done; keep the page's own title and hint. Unknown
  routes and render failures land on `app/not-found.tsx` / `app/error.tsx`
  (`lost-row.tsx`). The one celebration in the workspace is a job saved as
  Won (`leaf-burst.tsx` on the job `StatusPill`), proportional to the
  milestone; the portal's submit acknowledgement is the supplier-side one.
  `::selection`, the caret and scrollbars take the palette (`globals.css`).
- **Confirmations** (2026-10-19): nothing calls `window.confirm`. An
  imperative "are you sure?" is `confirmDialog({ title, body, action,
  destructive })` (`components/workspace/confirm-dialog.tsx`), a native
  `<dialog>` in the `lps-pop-dialog` style that resolves `true`/`false`. The
  confirm button names the action ("Delete row", "Reopen and add");
  destructive ones are red and put first focus on Cancel. Flows that already
  confirm inline (Publish → "Send to …?", candidate Remove, job delete) keep
  their own.

The layout is followed as-is; only the **columns and fields** were remapped onto
the real schema. Two things the design owns that are easy to lose:

- **Tokens.** `lps-ui` only maps `--color-*` onto the semantic names; the values
  live in `app/app/globals.css`, which is the theme's source of truth. The
  Supplier Workspace design adds the `--lps-*` table-chrome tokens
  (`--lps-headrow`, `--lps-hair`, `--lps-edge`, `--lps-dim`, `--lps-tint`,
  `--lps-bubble`, `--lps-shadow`, `--lps-warn-*`). The default app accent is
  **Edge Teal** (`#087F8C` light / `#42C7C9` dark), with contrast-matched
  foregrounds; signed-in users can replace it in Settings without changing
  the per-agent chat colors.
- **Reusable visual accents.** Two hue-named, semantic-neutral families sampled
  from the Rosie / reference-rail artwork are available in both themes as
  `--lps-accent-{turquoise,light-blue}-{text,border,soft,solid,on-solid}` (and
  matching Tailwind `lps-accent-*` colors). `text` is for readable accent copy
  on normal card/page or `soft`; `border` is a restrained outline or rail;
  `solid` must be paired with `on-solid`. Fully opaque normal, hover and
  keyboard-focus treatments keep text at 4.5:1 or better and boundaries at
  3:1 or better against their actual card, hover-tint and matching soft
  surfaces. The solid hues remain at least 25° apart (about 30° in the source
  reference), so turquoise and light blue do not collapse into interchangeable
  cyans. These are color families, never status/selection/workflow meanings.
  The All Jobs Rosie label/avatar ring and written `JR-*` reference are
  representative identity and reference uses; their words/avatar retain the
  meaning without color.
  They do not change the saved App header & accent, agent chat themes,
  status/destructive palettes or mappings.
- **Dark-mode contrast.** Muted copy, empty states, borders, input outlines,
  header rows and table hairlines use brighter dark-mode tokens than the design
  mock so the dense search workspace remains legible on typical displays.
- **`--destructive-foreground`** ships equal to `--destructive` upstream, which
  makes destructive text invisible on a destructive surface. `globals.css` sets
  it to white, as the lps-ui README instructs.

Fonts: Inter (`font-sans`), Playfair Display (`font-serif`) via `next/font`.

**Where the brand speaks** (2026-10-19). The working screens stay quiet, so
the brand's few strong moves are kept for fixed places:

- **One solid mark for "you are here".** The active rail destination, the
  active mobile tab-bar pill and the active supplier/customer detail tab are
  solid `primary` on `primary-foreground`. Filter chips and other
  many-at-once selections keep the soft `secondary` + `border-primary` state.
- **The leaf mark** heads the rail in both apps: a solid `primary` disc
  (admin: links to `/`, with the Playfair wordmark when the rail is open;
  portal: the supplier's name).
- **Playfair at display strength** for page titles (the frame header, 20px
  mobile / 23px desktop, bold), detail section headings at 18px (supplier
  Address / Details; customer Who they are / Address / Notes, so a section
  never reads like one of its uppercase field labels), empty-state questions and the public pages' LPS wordmark. Inter
  stays the voice for everything that is worked.
- **The seedling row** (`SproutRow` in `search-loader.tsx`): the search
  loader's sprouts drawn still, growing in once (`.lps-sprout-once`, none
  under reduced motion). It appears on the sign-in field and the Plant search
  empty state.
- **Sign-in** (`components/auth-frame.tsx`, used by `/login` and
  `/change-password`): an Edge Teal field with branding and the seedling row
  beside the form, which becomes a band above the form on a phone. The
  source-only logo candidate opts `/login` into `signInLogo` in both its form
  and Suspense fallback; other callers, including `/change-password`, retain
  the original stacked text wordmark. `public/lps-sign-in-logo.png` is Chris's
  unchanged transparent RGBA 1600×533 artwork (SHA256
  `0a6a32c51631ad2f8e6669c8d77ca91a77d7eb3ddcbd5981e842e90a25af2ba5`).
  Its full-width, 800px-capped aspect-ratio box reserves space before load;
  the image is contained, never cropped, flattened, recolored or linked. A
  screen-reader heading supplies the single Local Plant Supply name even if
  the decorative image fails. No theme, form, auth or other branding changes.
  This candidate is **not deployed**. Typecheck and the 15 focused tests across
  `lib/sign-in-logo.test.tsx`, `lib/login-return.test.ts` and
  `lib/auth-client-isolation.test.ts` passed locally. Actual theme compositing,
  responsive legibility, load/failure behavior and independent rendered review
  remain pending; read-only, unauthenticated sign-in QA is authorized separately
  from the still-held CI/release work. No live login or business writes are
  needed to inspect this branding.
- Table column headers are `foreground`, not muted, on a slightly deeper
  `--lps-headrow`.

### Deliberate deviations

Everything below differs from the mock **on purpose**. If you are "restoring
fidelity", start here rather than reverting one of these by accident:

| Deviation | Why |
|---|---|
| Higher-contrast dark-mode muted text and table chrome | The mock's small labels, empty states, controls and dividers were difficult to distinguish on typical displays. |
| `--destructive-foreground` set to white | Upstream ships it equal to `--destructive`, making destructive text invisible. |
| `Job Requests` is a **live route** (`/requests`) | Was rendered disabled while it was out of scope; the Order Requests design is now implemented against the real `job_requests` tables. |
| Requests are **collapsed cards that expand**, not one always-open grouped table | Asked for directly: a request is scanned by its metadata and counts first, and opened only when its lines matter. The mock's left-hand merged "order" cell becomes the card head, which is also what makes the screen work on a narrow viewport. |
| Selection and the bulk action bar exist, but the bar's **actions are Set status and Availability request**, not the mock's Email quote / Text quote / Place order / PDF quote | The checkboxes and the bar are the design's; what they can do is bounded by what exists. The remaining mock actions are approval-gated flows with no implementation — Rosie has no mailbox and may not contact a customer unbidden (`docs/harness/agent-rosie.md`), and order placement is now available in each job’s Orders tab. **Send availability request** joined the bar with migration 0062: it writes a database row an LPS Partner reads in their own portal, not outreach. |
| Plant status choices across job and availability-request rows | **Available**, **Partial Qty**, **Unavailable**, **Diff Sz/Sub**, **Can Order**, **Arriving Soon**, **Pending**, in that order. Job lines use `need_to_order` where supplier answers use `can_order`; both use `partial_qty` and `diff_size_sub` (renamed from `diff_size_qty_sub` by 0130, which also retired the job-line `alternative_proposed`). Saved filters with the old "Diff Sz/Qnty/Sub" label map to Diff Sz/Sub. Supplier Pending saves NULL, retains quantity/price/notes, and does not count as answered. Portal listboxes, admin native selects, By item filters, status cards, summaries and print checklists share these labels. Portal selectors retain viewport clamping and keyboard support. |
| The portal's request list has **only three work buckets**, not an admin filter toolbar | The list was first simplified in 2026-08-26, then its single-choice All/New/Processing/Completed tabs became short-lived multi-select New/Processing/Completed buckets in 2026-09-03. A supplier starts on the real active queue (New + Processing), can toggle any bucket on or off (the separate Select all button was removed 2026-09-28), and gets global counts; search, job-status / item-status / customer chips, date range, sort and Expand all still cost more than they find here. The item-answer question has its own By item controls. **The server-side filters stay**, deliberately: nothing was removed from the API. |
| The portal's cards **navigate**, they don't expand | Also asked for directly (2026-08-26), and the opposite of the admin `/requests` card above it in this table — deliberately. The admin scans many jobs and dips into one; a supplier opens a request to *do* it, and the line editor, the answer dialogs and the Submit button are the page, not a disclosure inside a list item. It also gives the answer sheet the whole viewport on a phone, which is where suppliers actually answer. |
| The mock's one **Notes** column is two: **Note for customer** and **Internal note** | The mock's sample data has a single undifferentiated thread; the real schema has three audiences with three different rules. A single cell cannot honestly edit a field written for the customer *and* our own working sheet in the same control, so each gets its own column and its own popover. The customer's own words appear as a third thing — a read-only line under the item name, where the ask is read. |
| **No "new customer" form** on `/customers` | Customer creation is Rosie's find-or-create during intake: match on email, then phone, then name + company (`job-requests` skill, §1). A plain New button beside it is a second, blinder create path, and the failure it produces — two rows for one person, requests split across them — is exactly what that matching order exists to prevent. The page reads and edits; intake creates. |
| **Orders** | Job requests and the supplier portal have Orders tabs backed by migrations 0092–0096. Partners filter New, Processing, Order Ready and Completed orders and group by order, status or plant. Each order belongs to one job and opens its own page with a link to the supplier's AR for that job; Chris can create orders, confirm them, edit fulfillment details and notes, and mark them ready. Customer list order rollups remain outside these job/supplier screens. |
| The Job Requests **Status** chip opens with Archived unticked | Archived is a terminal status and there are only ever more of them; opening the page on them would bury the work. It is a **starting selection, not a rule** — the chip is an ordinary multi-select, ticking Archived brings them back, and *Clear all* returns to the same starting selection rather than to nothing. |
| No **Size** chip in the Job Requests toolbar | Removed at the owner's request. It reads poorly as a facet: unlike `inventory.size`, which is a graded vocabulary with a reviewed `size_std`, `job_request_items.size` is the customer's **verbatim ask** and migration 0055 deliberately gives it no standardized twin — "30 gal", "30 gal or larger" and "30g" are three dropdown options for one thing. **The server-side filter stays**, deliberately: `GET /api/requests?size=` still selects, and `?facets=1` still returns the option list, so the chip is a UI decision rather than a lost capability. |
| The line table has no **botanical name** sub-line | `job_request_items` records the plant as the customer asked for it (`name`, `size`) and nothing else — matching an ask to a botanical name is downstream sourcing work, not a column. The sub-line under the name carries the customer's note about that line instead. |
| Job line tables lead with **Demand · Avail · Size · Plant Name · Status** | The same horizontally scrolling `RequestBody` table serves `/jobs`, `/requests` and customer request cards. The operational ask and coverage stay first on narrow screens; Note for customer, Unit price, Total and Internal note retain their relative order after Status. Optional management selection and deletion columns remain at the outer edges. |
| Inline editing covers **fields the mock never made editable** (name, size, demand, avail, unit price, addresses, note for customer) as well as its status picker | Asked for directly. Writes go through the existing whitelisted `PATCH /api/rows`, so the server — not the dropdown — decides what may be written. A job line's status, avail, unit price and note for customer belong to its selected candidate (0130), so `PATCH /api/rows` sends those four to `update_job_line`, apart from the line's own name, size, demand and internal note. |
| "Partial" is **derived**, not a stored status | The mock lists it beside the others; in the schema it is a fact about two numbers (`available_quantity < demanded_quantity`), so `itemPill()` derives it. A stored value could disagree with the figures printed next to it. |
| Notes are grouped by **kind** (Shared / Internal), not by named author with avatars | The schema keeps two note columns rather than a thread table, so "who said it" is not recorded per entry. The kind is what actually governs disclosure, and it is what the popover shows. |
| The mock's own agent chat sidebar is not rebuilt | The Shell already carries the app's agent chat panel on every page; a second one on this page would be two chats side by side. |
| Chat lists three agents (Daisy, Rosie, Nova) | All three are chattable — each has the harness `webchat` plugin on its `main` thread. Lily is a fourth agent but has no `webchat` plugin, so she is listed on `/agents` and in settings and stays disabled in the chat surfaces (`reachOn: 'Telegram'`). `lib/agents.ts` also carries `upcoming` for agents added ahead of their plugin; nothing sets it today. |
| No agent dropdown in the chat header — size presets, plus the other agents as avatars | The mock's dropdown was removed at the owner's request. The avatars replace it: the same switch the collapsed rail offers, without having to close the panel to reach it. |
| A **Know your Agents** page (`/agents`) added to the rail's bottom section (above the user entry) and the mobile ⋯ menu | Not in the mock; shows each agent's profile banner from `public/*_profile.png` with an Active / "Coming soon" / "On Telegram" badge. |
| Chat composer adds attach / voice / paste; panel has a ⋯ → Clear conversation | The mock's composer was a text box and a send button; a real agent channel needs to carry files and be resettable. |
| No "list is 7+ days old" staleness flag anywhere | Removed at the owner's request, along with the panel tint that went with it. |
| Signed-in user read from `/api/auth/me` | The mock hardcoded a name and initials into the markup. |
| **Notes** edits in place; supplier profile fields require explicit edit mode | Tap-anywhere field editing is unsafe on touch screens; profile changes are staged and saved together. **Type** is shown explicitly in that grid and uses only the schema vocabulary (Grower / Wholesale Supplier / Retail / Broker/Platform, or unset); it is never inferred from the supplier name. (The mock-era **Communications** tab existed until 2026-08-19, when migration 0063 replaced the supplier log with the Conversation transcript.) |
| Suppliers, Plant search and the profile present **one company**, not one `suppliers` row | A company with several sites is several rows in the database (`head_branch_id`), and the mock draws one row per row — so Everde filled fifteen lines of a fifty-line page and a buyer had to reconcile them by eye. Asked for directly. The farm is never lost: it expands under the company row, names itself in the plant table's **Branch** column, and tags every entry on the profile. See *Companies and farms*. |
| Profile inventory is paginated | The mock had a fixed list; real suppliers carry thousands of rows. |
| Column reorder is direction-aware | The mock's algorithm makes an adjacent rightward drag a no-op. See *Column layout*. |
| Source/website cells are links; supplier sources show latest + history count | The mock rendered them as plain text. |

## Shell and responsive behaviour

**One frame, two apps.** `components/workspace/frame.tsx` (`WorkspaceFrame`)
is the layout itself — the fixed visual-viewport container, an optional compact
single-row identity/action/global-control header, the collapsible nav rail with its
shared footer (Dark mode · Install app · Reload),
the page column with pull-to-refresh and toasts, the mobile ⋯ More menu and the
bottom tab bar. It takes what a role adds through slots: `nav`/`activeId`,
`railIdentity`, `railTop`/`railBottom` and `moreTop`/`moreBottom` (rows around
the shared footer actions, in the rail's order), `headerExtras`,
`mobileBarLeft`/`mobileBarRight` (the bar's pinned edges), `pageOverlays`,
`rightColumn`, and a `mobileOverlay` describing a view a role opens over the
page column so the bar's highlight and taps unwind it the same way everywhere.
Slots are render props receiving `FrameState` (`isMobile`, `navOpen`,
`keyboardOpen`, `moreMenuOpen`, `closeMoreMenu`, `showToast`, `railBtn`).
**Toasts have two tones** (2026-10-19): `toast(message)` confirms — a dark pill
with a check, in an always-mounted `aria-live="polite"` region, gone after 4s;
`toast(message, 'error')` is a failure — a red `role="alert"` card with an
alert icon that stays until dismissed or replaced, so a write that did not land
never reads as one that did. Raw server errors pass through `errorCopy`
(`lib/error-copy.ts`), which keeps sentences written for people and turns
connection drops, lock/statement timeouts, constraint and PostgREST errors into
the caller's "Could not …" plus what to do next. The frame also renders a
**Skip to content** link, wraps the page in `<main id="main-content">`, gives
a page whose header is hidden a visually hidden `<h1>` of its title, and marks
the active rail and tab-bar destination `aria-current="page"`.
The caller owns `useTheme()` and passes it in, since it sits above the frame.
`useToast`, `useTheme` and `useIsMobile` live here; `shell.tsx` re-exports
them so pages import as before. Shared components (editable fields, copy menus,
the job card) import `useToast` from `frame.tsx` itself: importing it from
`shell.tsx` pulls the whole admin Shell, agent chat and AR drawer into every
bundle that uses them, the public order page and supplier portal included. Added 2026-08-26, replacing a `Shell` and a
`PartnerFrame` that were two copies of the same layout and drifted.

**One Shell for the whole admin workspace (2026-10-20).** The admin routes
(`agents`, `customers`, `jobs`, `photos`, `plants`, `requests`, `settings`,
`suppliers`) live in the `app/(workspace)/` route group, whose `layout.tsx`
renders `WorkspaceShell` once. A page move swaps only the page: the rail, the
agent chat (thread, scroll, draft, live connection), the bell and the AR drawer
stay mounted, so they are not re-fetched or re-wired on every page. Pages still
write `<Shell page title toolbar …>`. Inside the layout that component is a
registrar. It hands its chrome (title, header action, focus modes, callbacks)
to the persistent Shell from a layout effect on every render, before paint,
and draws only its toolbar (a `flex-none` row at the top of `<main>`, so it is
in the server HTML) and its content. Until a page registers, `routeChrome`
supplies each route's page id, title and header flags, so the server render
and the first paint match. Rendered outside the layout (tests), `<Shell>` is
the whole Shell as before. The things a remount used to reset now reset on a
pathname change instead: Full/peek chat, the account menus, the ⋯ menu
(`frame.tsx`), the AR drawer (keyed by pathname), and the mobile Agents/chat
view (`useHistoryView(pathname)` re-reads `history.state`). Pages calling
`useToast()` in their own body now sit inside the toast provider. Before this
they got the no-op default.

`components/workspace/shell.tsx` (`Shell`) is the admin app's fill-in of that
frame: the operator's destinations, Settings above and the signed-in **Account**
disclosure below the shared footer, the agent chat as `rightColumn` and the
mobile Agents list + sheet as `pageOverlays`, the
notification bell, and the chat-appearance / accent contexts. The shared header
renders only where an identity row is still useful: details, Agents, Settings,
portal Closed Requests and portal Orders. On desktop, Suppliers, Plant search,
Photos, Customers, `/requests`, `/jobs` and portal Availability Requests set
`hideHeaderOnDesktop`; their existing toolbar is a render slot that receives the
same Shell- or PartnerFrame-owned notification/New-job controls, so behavior is
not reimplemented and there is no replacement utility strip. Shared `Toolbar`
places those 44px controls in its trailing cluster: a full-width, right-aligned
wrap line at 900–1023px, then inline at 1024px when space permits. Descriptive
subtitles are not a frame slot, and counts, ordering, filters, pagination and
guidance stay in their existing toolbar or content block. The optional
`headerAction` slot lets detail routes keep a compact identity/action row without
repeating the title in content. `hideHeaderOnMobile` continues to remove generic
titles from list/workspace routes, including Agents and Settings, where active
navigation or the first toolbar/tab/content identifies the page.

The Shell's **LPS Ops availability-request drawer**
(`components/workspace/ar-drawer.tsx`; loaded lazily — prefetched when the
browser is idle, mounted on the first open, which it replays) remains the one detail opened by an AR
link on a Job card or an `ar:` chat action. Below 900px it renders only a stacked
phone branch: full width, `visualViewport` height, `max(12px, safe-area)` on both
horizontal edges plus the top Close row and bottom completion footer, and one
independently scrolling body between them. Each line is a wrapping card with a
44px status target and separately labelled 44px available-quantity/price/notes
inputs — no line total — then the subtotal. At 900px the cards unmount and the horizontal
table renders (1,090px default minimum; 960px for the focused-Job portal drawing below). The summary names request state, supplier and
Job, then separately labels stored **Sent** and optional **Submitted**; it renders
no Last updated, actor, provenance or inferred change/freshness.

The **focused `/jobs?jr=<id>` Job** has no supplier/AR pills in its header.
Its tab bar adds one tab per supplier AR after Request items and Orders —
status dot coloured by `arStatusTone`, AR name, supplier name; most recently
engaged supplier first — and each tab is a drop target for that supplier's
candidate pills. The selected tab edits the AR in place
(`SupplierARPanel`, `components/workspace/supplier-ar-panel.tsx`, which
`job-request.tsx` loads lazily with `next/dynamic` when a supplier tab first
opens, as it does `JobOrders` for the Orders tab), using the same editor as the drawer
(`components/workspace/ar-editor.tsx`: `useAREditor` owns load, live refresh
and the serialized write queue; `AREditorBody` / `AREditorFooter` render it;
the tab passes `summaryCard={false}`, dropping the supplier/job card and keeping
the status picker row)
in the supplier portal's drawing — the same `SummaryStrip` and
`ARLineTable design="portal"` as `/partner/:id/requests/:arId`: **Need · Avail
qty · Size · Plant · Status · Note · Unit price · Line total**, no subtotal
footer (the strip carries the subtotal). `SummaryStrip` keeps every
status count, Total Items and the subtotal on one row from 900 px (one column
per cell); phones keep the three-column wrap. The admin's inline edits stay:
name, size and requested quantity through `onPatchDetails`, available quantity,
status and price through `onPatch`, and the line note — rendered as the
portal's borderless cells. The portal tracks are
`64px 80px 110px minmax(240px,2fr) 150px 90px minmax(160px,1fr)`: Plant and
Size wrap (`AnswerCell wrap`, a one-row auto-growing textarea that still saves
on Enter), and only Notes truncates (`AnswerCell clamp`: one line until
focused). `AnswerCell` sets an editor's `title` to its full text on hover only
when the text is clipped. In the drawer the portal status listbox is
portalled into the `[data-ar-drawer-host]` rather than `document.body`, which
the modal stack makes inert. The drawer still accepts the `focused-job`
presentation (`openAvailabilityRequest(id, 'focused-job')`), though no app
surface opens it that way now. Each drawer opening remounts its editor per
generation; any ordinary open, even the same AR, resets to the default.
Customer/other Job cards, chat links and the supplier profile keep the default
drawing.

The drawer is portalled into its own body host through
`components/workspace/body-modal-portal.tsx`. All instances register with one
document-level modal stack: it captures one exact baseline for body overflow and
each non-host body child, observes dynamically added children, and recomputes
isolation after every registration or removal. Only the top host is exposed;
when the stack empties it restores inert property presence/value first, exact
inert/`aria-hidden` attribute bytes last, overflow value/priority, then drops its
observer and retained state before removing the final host. This remains correct
for nested whole-tree cleanup in either effect-disposal order. A drawer
line-answer modal opts into the second host; portal/profile/By-item answer
dialogs retain their prior non-isolating behavior and sizes.
Both drawer-only modal levels trap focus and contain Escape; parent close/switch,
breakpoint teardown, missing openers/triggers, reopen races and unmount cancel
queued focus work and restore a connected visible logical target. Request
sessions carry an AR id plus monotonically increasing generation; initial/Retry
loads and serialized line/status/submit writes have abort controllers and
operation sequences, so reverse stale completions cannot paint another AR,
error or success. Submit is synchronously single-flight, announces only an exact
success, and says **Submit again** only when stored `submitted_at` exists—not
from current status. Loading, Retry/error, empty and closed states stay inside
the closeable modal. The compact Job card remains only its existing AR
link/attention signal with a bare `MM-DD` caption: the submission date for
submitted requests and creation date for other stages. Full AR tags use yellow
backgrounds/text and dots for new and processing requests, green for submitted,
and gray without a dot for closed or unknown stages. Supplier
answers remain in the drawer.

**New job request** starts from the All jobs toolbar at `/requests`. After a JR
is selected, the focused work pane owns one action row with labelled 44px **New
job** and Notifications controls. On mobile the action remains floating while
ordinary Jobs chrome is visible.

**It writes no job row.** `POST /api/requests/reserve` takes the *id* the request
will have — `reserve_job_request_id()`, `nextval` on the identity sequence and
nothing else. The client records `{id, returnUrl}` in tab-scoped session state,
navigates to `/jobs?jr=<id>`, and opens the standard focused Job workspace with
Rosie's desktop chat sidebar on canonical `jr-<id>`. The active-jobs rail and
work pane stay visible, even if chat was previously fullscreen. Until Rosie
creates the record, the work pane shows a pending request with **Open Rosie**;
saved details replace it through the usual live job updates. Reopening a
same-tab reservation uses this same route without allocating another id.
Text, paste, voice, picker files and dropped plain text/files all use the existing send/upload
transport. A pre-record identity is recoverable only in the same tab;
copied pre-record URLs cannot prove a reservation and show **Job unavailable**.
Durable cross-device pending recovery remains deferred. Older explicit
`&intake=1` URLs with an exact same-tab reservation still support the legacy
fullscreen intake and its Saved so far panel; New job request no longer enters
that view.

On desktop a focused Job opens its Rosie chat in the docked panel, and leaving
the Job page for any other route closes that panel, whichever conversation it
was on. The Shell persists across routes, so this follows the `focusedJob`
prop going away rather than a remount. Moving to another Job keeps the panel
open on the new Job's thread.

On an existing focused Job, the header's **Chat with Rosie** action
synchronously binds the panel to
that Job's existing canonical `jr-<id>` conversation before the composer can
send. The visible panel identity always includes `JR-<id>` (plus its name when
present); supplier choices stay on their separately stored threads. Page title
and path still accompany a message as context, but never choose or repair its
destination. Every explicit switch carries a new routing revision. Layout-phase
reset prevents a new identity from painting over the former transcript, and
late poll, history, reset or send work cannot populate or clear the new
lifecycle. Drafts and staged file/voice attachments are revision-owned too: a
switch clears them, aborts each client upload request, releases that recording's
tracks and ignores any stale completion; the existing server upload contract is
unchanged. Canonical ids are deduplicated when poll and send race. A reset lock follows
its exact agent/thread across same-route and away/back binds, waits bounded
already-issued sends, and blocks new sends there while other destinations stay
usable. The app proxy authenticates first and serializes send/reset upstream per
canonical conversation. It accepts only primitive, already-trimmed/lowercase/NFC
thread ids in the user-facing forms `main`, positive `jr-<id>` (no leading zero),
`supplier-<slug>` and `customer-<slug>` (letter/number segments separated by
`.`, `_` or `-`); C0/C1 controls are forbidden and limits are 160 Unicode code
points and 256 UTF-8 bytes. Queue keys are framed JSON tuples. Capacity is 8
operations per conversation, 64 active conversations and 128 total operations,
with a 25-second upstream timeout: non-admin authentication is 403, unknown
agent/action is 404, invalid input is 400, saturation is 429, transport failure
is 502 and timeout is 504; actual upstream status, body, content type and content
disposition are preserved. Every terminal path deletes counters; unrelated
actions and different conversations remain parallel. Client failures unlock and reload. Reset failure is a separate canonical,
assertively announced retry alert even if it completes while the user is
elsewhere; it dominates poll, history and send outcomes until reset retry
starts, a failed retry restores it, and only a successful retry leaves it
cleared. Reverse network completion cannot rewind
newer state. Recording setup installs teardown before a possibly pending
AudioContext resume and releases its stream, graph, interval, recorder and
context on every constructor/setup/start/stop failure, stale permission/resume
completion, bind or unmount, so retry starts cleanly. The global picker remains free to select another
Job, supplier, customer or Main conversation, and its exact destination is
visible before send.

- **Desktop** (≥900px): a collapsible left nav rail (196px ↔ 56px) that
  **starts collapsed and stays where you put it**, an existing list toolbar as
  the top row on qualifying workspaces (with its 44px global controls at right),
  or a compact 40px/53px identity/action row on retained and detail routes, and
  the agent chat on the right — a resizable docked panel, or a
  46px rail when hidden. Only the rail's own chevron changes its width, and the
  choice is stored per device under `lps.nav.open` — a reload, and each
  supplier-portal page (which still renders its own frame), would otherwise
  spring the rail back open.
  Nothing stored means collapsed, so the default costs no expand-then-collapse
  flash on first paint. Entering **Full** chat still force-collapses the rail,
  but deliberately does not save that — an automatic collapse is not a
  preference, so leaving Full restores whatever the rail was set to. The
  labelled, 44px **Account** disclosure is the only desktop footer entry for
  identity, Know your Agents and the temporary Supplier view: its compact
  collapsed form still visibly says Account, and only an open disclosure gets
  active/current state (the nested link marks `/agents` current). It closes
  itself plus the lazy supplier picker on action, outside click, either
  breakpoint transition or Escape (which restores trigger focus). Supplier-list
  request failures stay distinct from a genuine empty list and offer Retry.
  Choosing **Full** hides both the
  left navigation and workspace so chat uses the complete width. A centered
  pull handle on chat's left edge reveals/hides a 240px supplier/search peek
  pane without restoring the menu. Saved Full state restores the same layout;
  choosing 50%/30%, hiding chat, or manually resizing exits Full. Full state is
  desktop-only and is explicitly cleared at the mobile breakpoint, including
  during initial media-query hydration and device rotation.
- **Tablets and touch** (2026-10-19): a tablet held upright (600–899px) gets
  the mobile layout, but card lists use the width: job line cards, availability
  request line cards (portal and public pages), and the Customers and
  Suppliers cards are two up from 640px. A touch tablet held sideways gets the
  desktop layout, so its dense controls — table sort arrows, row and order
  chevrons, the rail chevron, small avatar chat buttons, the ellipsis on
  truncated text, photo delete, the supplier tab chips and the chat panel's
  icon and size buttons — keep their drawn size but gain an invisible hit area
  of about 44px on coarse pointers (`pointer-coarse:after:absolute
  pointer-coarse:after:-inset-*`, the idiom the chat copy button started).
  The `/requests` toolbar wraps instead of clipping New job request and the
  bell when the page is narrow (1024px, or a laptop with chat open). Phone
  line cards never break money mid-figure: the card's Total track grows to its
  figure.
- **Mobile** (<900px, the design's own breakpoint): the left rail is replaced by
  a bottom bar with **Alerts fixed left**, **Agents fixed right**, and an
  independently scrollable middle strip sized to show three page destinations
  at a time on a phone; from 600px (a tablet held upright) every destination
  and More share the strip evenly and nothing scrolls. The active route automatically centers in that strip (measured against the strip itself, so its neighbours show whole rather than clipped by the pinned Alerts width). The page set
  remains Jobs, Customers, Plant search, Photos and Suppliers; **⋯
  More** travels with it and mirrors the desktop rail's bottom actions in the
  same order: Settings, the app theme toggle, **Install app**, Know your Agents,
  Supplier view, and the signed-in user with log out. Alerts is the
  same unread agent-chat notification list and click-through formerly shown in
  the mobile page header. One **Agents** tab opens a channel list for the same
  existing agent conversations; chattable rows open the current chat sheet,
  and the conversation's Back control returns to the Agents list. Both are
  **pages, not overlays**: opening either pushes a history entry (same URL —
  `useHistoryView` in `lib/history-view.ts`), so the device Back button pops
  one view at a time — conversation → Agents list → the page it was opened
  over — instead of leaving the route. A conversation opened from a card
  (`openChat`) pushes **one** entry, not two, so Back out of it returns to the
  card it was opened from; the view records that it came from a card
  (`MobileView.from`), which is what makes its Back control read *Back* rather
  than *Back to Agents* and what makes the **Agents** tab open the channel list
  from there rather than walking out of the conversation. (It used to push the
  Agents list underneath as well, so leaving a chat opened from a customer or
  supplier card landed on a list the reader had never been on.)
  What is open is read back out of `history.state`, so returning to an entry
  after navigating away restores the view it was opened on. While one is open
  it owns the bottom bar's highlight — the page underneath is not what you are
  looking at — and tapping a page tab returns to that page: the tab you are
  already on unwinds the views in place (no route change to make), any other
  navigates. This is
  navigation-only — transport, routing, threads, models and APIs are unchanged.
  Data-list pages swap their tables for cards where applicable. All generic
  list/workspace routes — Suppliers, Plant search, Photos, Customers, Job
  Requests, Know your Agents and Settings — omit the shared header on mobile.
  The chat sheet overlays page content inside the main column, above the tab bar, so
  global navigation remains visible while chatting. Its Telegram-style identity
  header floats over the transcript as an inset rounded pill with a 20%
  translucent, lightly blurred surface, a prominent agent avatar and a two-line
  name / role-and-live-status treatment. Wallpaper remains visibly legible
  beneath the glass and continues behind the iOS status bar; safe-area-aware
  positioning keeps the 44px Back and Conversations targets below system chrome;
  the conversation picker, Agents list and full-height availability-request
  drawer headers also consume that inset, with 44px mobile Close targets. A
  matching transcript inset keeps the first
  message readable while later messages scroll beneath the glass. It replaces
  the underlying page header
  rather than stacking a second header.
  The fixed Shell height follows `window.visualViewport.height` (with
  `window.innerHeight` as its ceiling), keeping the tab bar above Android PWA
  system chrome even when standalone mode misreports `100dvh`; it also follows
  `visualViewport.offsetTop` when Android pans to the on-screen keyboard.
  Workspace pages lock document-level overflow via `data-workspace-shell`; only
  their designated content panes scroll, so the header and bottom bar cannot be
  swiped off-screen. Pulling down from the top of a mobile page pane dispatches
  `lps:refresh` and refreshes the route; Suppliers and Plant Search rerun their
  active query without clearing its current term or filters. While a mobile text
  field is focused, the app bottom nav is
  hidden and the composer/control row sits directly above the keyboard.
  The More popover
  renders outside the overflow-clipped bar. Settings is a normal
  `/settings` route rather than an overlay, so any bottom-nav selection
  navigates immediately without requiring a Back control. Its two route
  entries also take the mobile chat sheet off the screen as they navigate —
  that sheet overlays the same wrapper the popover sits in, and the outgoing
  page stays mounted until the new route commits, so leaving it up hides the
  destination. They leave its history entry alone, so Back still returns to
  the conversation.

The rail runs Jobs, Customers, Plant search, Photos, Suppliers (`NAV` in
`shell.tsx`) — Jobs first, where the installed app opens. Every entry is live. Settings is enabled
in the desktop rail and through mobile More.

## Routes

| URL | Kind | Purpose |
|---|---|---|
| `/` | server | Redirects to `/requests` (the Jobs list), which is also where staff land after signing in or changing their password. Partners still land on `/partner/<id>`. |
| `/login` | client | Harness sign-in → `/api/auth/login`, then `/suppliers`. On the shared `AuthFrame` (Edge Teal brand field + form). |
| `/suppliers` | client | Supplier Search, **one row per company** — see *Companies and farms*. The row is the head office's own record; only `# Items` and the ingestion columns speak for the whole company. A leading chevron expands the farms that answered the query beneath it, as full rows with their own profile links. The toolbar keeps broad typo-tolerant Search plus touch-sized **Supplier type** and **State** multiselects visible at every width. Its 44px icon-only **Advanced filters** trigger carries an accessible label, tooltip and nested active count, and opens strict **Name contains**, searchable **City** and the exclusive **LPS Partner** choice (*LPS Partners* / *Not partners*, over `suppliers.is_lps_partner`) without duplicating Type or State. On desktop this is an anchored popover beside `shown/total Companies`, pagination and Notifications. On mobile it is a modal bottom sheet with a handle, title, explicit close, backdrop/swipe dismissal and sticky **Clear all** / **Show results** actions; it is portalled outside the app, makes the background inert/hidden, locks body scroll, traps Tab/Shift+Tab and restores trigger focus. Clear all clears broad Search and every criterion. Mobile omits the top pager and appends each next bounded 50-company server page behind a quiet **Load 50 more** action; HTTP/network failure keeps the committed page and loaded companies in place and offers an explicit retry of that same page. Changing or clearing filters resets that progressive list to page one, including Clear all when nothing is selected. The narrow-screen State menu aligns inward rather than clipping off the viewport. Desktop pagination is unchanged. Table headers keep labels, sort, resize/reorder and the column picker but render no duplicate filter widgets. Filters still run on locations before grouping, so a company can appear because one farm matched and its expander reads `2 of 5 farms`. Company pagination is 50 results at a time. Rows retain the column picker, sort, resize, inline edit and view-only hiding; compact non-shrinking cards serve mobile and the card column owns the page’s result scrolling. A company row carries **Rosie** and **Daisy** buttons — in the sticky actions column beside its hide button on desktop, at the card's bottom-right on mobile — opening the company's two agent threads. The nested farm rows carry none: the threads belong to the company, and a farm's row would only reopen the same two. Beside them a **heart** marks the company a favourite (`suppliers.is_favorite` on the head row, migration 0153, written through `PATCH /api/rows`; one flag for the whole team). **Favourite companies always list first** — across every page, ahead of relevance and any header sort — and a newly hearted company moves to the top of the current page at once. |
| `/suppliers/:id` | client | Profile — **one page per company** on a head-branch id, one farm on a farm id (*Companies and farms*). One compact Shell header carries the supplier name; category/farm/inactive context remains in the profile content, and on desktop the header also carries explicit, touch-sized **Chat with Rosie** and **Chat with Daisy** actions opening this company's stored per-agent threads (`rosie_thread_id` / `daisy_thread_id`, the same slug under two agents) in the docked panel. A missing stored id omits its action rather than guessing a thread. On mobile those same avatar actions move into the compact **Supplier details** quick-action group beside call/email/web/map, avoiding a duplicate set in the header; the details are collapsed by default; expanding it reveals separate **Address** and **Details** grids and its bottom-right pencil, making expand → edit an intentional safety gate. Address always shows the stored street, city, state and ZIP as four independent values (including partial/blank records), and the same staged Save/Cancel edit updates those fields without composing or inferring them. Save/Cancel move into the Shell header during editing. Inventory opens by default, followed by Contacts / **Farms** / **Availability requests** / Notes / Files / **Portal access** (the old Communications tab is gone — migration 0063 folded its log into a transcript that was itself dropped 2026-08-23, migration 0066); on a company page every one of them covers all the company's locations and **tags each entry with the farm it belongs to**. The tab row scrolls sideways inside its own width on a narrow screen — seven labelled, counted tabs are wider than a phone, and they would otherwise drag the whole page into horizontal scroll. Opening Contacts performs a no-store profile read, so active links added by Daisy while the page is mounted appear without a browser refresh. **Farms** lists each location as a card with the same editable Address and Details grids the header has — including street/city/state/ZIP and the **Type** dropdown (Grower / Wholesale Supplier / Retail / Broker/Platform / unset) — plus a link to that farm's own page, and is offered only where there is more than one location (`?tab=farms` on a single-site supplier falls back to Inventory). **Availability requests** lists every request sent to the company's locations and opens one inline (deep-linkable as `?tab=requests&ar=<id>`): the same line table the portal shows, read-only, with a **Portal view** link and a Close/Reopen button; there is no per-request chat. The profile field grid shows **LPS Partner** (`suppliers.is_lps_partner`, migrations 0062/0074) **read-only** — it is derived from the company's portal logins (migration 0084) and moves only from the Portal access tab, and an LPS Partner shows the **LPS tag** beside its breadcrumb and on the Suppliers list. **Portal access** (`?tab=access`) is where that company's portal logins are made, reset and deleted (*Portal access*). Inventory height (ft), width (in) and caliper (in) ranges are sent to the server before its 100-row pagination; desktop uses column headers and mobile shows the same three controls under the supplier-list search. Mobile inventory cards also show the supplier's raw caliper text when present. Desktop keeps details expanded, its back link visible and its pencil in the header. |
| `/plants` | client | Plant search, **one card per company**, with every matching row from every one of its farms beside it and a **Branch** column naming the farm each row is at. Every plant retains its original `supplier_id` and source; the card links to the company page. Each visible inventory match now carries an always-on, wrapping **Stock location** cue built from that exact inventory row’s supplier/farm record (branch name plus city/state where recorded). If no row-specific location evidence exists it says **Supplier location** with the company city/state; if neither exists it says **Location not recorded**. A branch match distinct from the company head shows both Stock location and Supplier location, so an Athens, GA match remains explicit under a Tampa, FL company card without implying headquarters is the farm. Mobile keeps the full cue in the plant row before and after its detail disclosure, while the collapsed company header shows the first three distinct normalized match localities in deterministic inventory order and an exact `+N more locations` remainder. Case, Unicode-normalization and whitespace variants deduplicate without changing the first-seen cleaned spelling. Each collapsed cue is bounded by grapheme clusters and UTF-8 bytes through `Intl.Segmenter`; where that API is unavailable, the conservative fallback keeps only complete whitespace-delimited tokens that fit both code-point and byte caps, or only an ellipsis when the first token cannot fit. It never slices a token or claims partial Unicode grapheme segmentation. Desktop gives every row a full-width cue independent of saved columns. Full expanded-row long and Unicode names wrap rather than truncate or create horizontal overflow. No source/file-name, delivery territory, distance or freight fact is inferred, and location display never auto-applies State or changes broad relevance, grouping, totals, pagination, filters or API query semantics. The generic Shell title is hidden on mobile. Its toolbar is one no-wrap row governed by the **actual page-column width**, live Company-panel width and exact summary text, not the browser viewport. Wide mode (base 1024px, then only when the full row fits) reads broad Search, touch-sized **Size**, **Cultivar**, **Supplier type** and **State**, 44px **More filters**, the exact `<companies> companies: <shown>/<total> plants` summary and the Shell-owned action. Search follows the live 200–480px resizable Company/supplier panel (292px default) from the same shared width owner after every drag; the toolbar’s 16px inset plus 1px offset matches the result card’s `mx-4` plus border, aligning both Search edges with that Company track. Collision-safe 82/107/102/87px quick tracks start immediately after it. Search, all four selectors and More filters share one 44px height, one-pixel input border, medium radius, field background, 11px medium labels on the filter buttons (the search box reads at 14px like every other search, with a short `Search plant name…` placeholder; the quoted-phrase hint lives in the empty state), aligned centres, 4px outer rhythm and 8px inner padding, trimmed to 6px only on the four wide-row selectors where the fit budget cannot afford 8px; active primary colour remains a state cue rather than different chrome. A conservative fit budget reserves nonshrinking summary width from its exact text (6.5px per character, above measured Inter 11px summaries even when digit-heavy): default panel/summary is wide at 1024px, while 900px, long-digit summaries, or a 480px panel at 1024px stay compact; 1280px re-expands even the maximum panel with larger digits. Below that resolved boundary — every mobile layout, or desktop narrowed by expanded nav/open chat or content pressure — the same single Size and Supplier type controls remain visible after Search, followed by More filters; Cultivar and State alone fold into its surface and return automatically when space does. A selected control renders its concise label beside a separate rounded, tabular count token—not one collision-prone `Label · N` phrase—while its accessible name remains the full `Label, N selected`; the nonshrinking wide tracks reserve the real label/token/chevron budget through two-digit Size/Type/State and realistic three-digit Cultivar counts. The compact single-row Size and Type tracks are 94px and 106px (8px padding), holding three-digit counts and the unselected **Supplier type** label a 900px+ container shows. Below a 600px toolbar container (phones) the row wraps once: Search takes its own full-width row with 16px text (no iOS focus zoom), and Size and Type share the second row equally beside the 44px Filters button. From 600px up the row stays single-line as before, with Toolbar omitting the otherwise empty trailing summary/action flex item, without clipping, overlap or horizontal scrolling. The no-padding outer toolbar owns both CSS container and ResizeObserver content-box measurement, making outer 390px equal `390cqw`. CSS supplies the safe compact-first/base-1024 branch from first paint; the observed width plus live panel and summary synchronously adds an overflow-risk CSS-class override, so panel drags and rapid container changes fold before wrap/clip/x-scroll while focus and Cultivar ownership consume the same resolved mode. Exactly one of Cultivar’s wide/compact copies owns `open` at a time, so a crossing atomically transfers the one menu and its outside/Escape listeners rather than running a hidden second instance. Transfer/close focus uses one tracked generation-aware animation frame: any later mode, owner or open-state change cancels it, and the callback revalidates the current generation before focusing. Pending/requested intent is cleared as soon as committed mode/owner/dialog state is neither its source nor destination, so even one outside pointer-down closing both the carried-wide Cultivar and More filters cannot leave a dormant More-focus intent that revives when Cultivar reopens; rapid committed crossings, close-before-flush and unmount likewise cannot run stale focus work. The exact summary keeps its existing mobile hiding and also waits for a safe 700px actual container on desktop; the trailing action keeps its existing visibility. Multi-page results use the same previous/next behavior in a compact footer below the results. City is deliberately not a Plant Search filter. More filters always owns **Company**, **Full Name**, **Common name**, **Botanical name**, **Price**, **Quantity**, **Height**, **Width**, **Caliper**, **Notes** and **Internal notes**, plus **Clear all**; in compact mode it additionally owns Cultivar and State, while wide mode omits all four visible quick-filter concepts and compact mode never duplicates its visible Size or Supplier type controls. Its surface is bounded to the toolbar container (`100cqw - 1rem`, capped at 498px), has no field minimum that can force overflow, and uses container thresholds for one column at 390px, two at 514px and three at 658px/wide. Every nested multiselect menu is exactly cell-relative (`w-full min-w-0 max-w-full`), including right-column controls, and long option labels wrap inside that cell instead of using viewport/max-content width or forcing horizontal scroll/clipping. Cultivar’s selection **and open state** are shared between the two CSS-switched copies: an open menu stays open and focus moves to the newly visible Cultivar in either direction, while Escape closes only that nested menu and restores its trigger. It still has no Done/Apply step. Table heads keep labels, sorting, resizing/reordering and the column picker but no filter inputs or dropdowns. Results remain paginated through the whole match set 300 plants at a time. **Favourite companies' plants come first** across the whole match set (any header sort orders within favourites, then within the rest), their cards keep the top through the company panel's own sort, and a filled heart beside the company name says why. Desktop keeps the resizable company panel and plant columns; mobile starts each company collapsed and lets each plant expose its branch, notes, dates and source inline. A long mobile plant name scrolls horizontally inside its own row value (touch/trackpad or ←/→, Home/End while the disclosure is focused), preserving the price/action column and preventing page-level sideways overflow. |
| `/photos` | client | Photo catalogue: a responsive thumbnail grid (2 up on mobile, to 5 on a wide screen) over `plant_photos`, with the same search toolbar shape as Plant search — one query box plus searchable multiselects for supplier, size, **cultivar** and tag. **50 photos at a time behind a Load more button**, which appends rather than flipping pages — a wall of photos is scanned downwards, and a pager loses everything already looked at. The button carries the remaining count so it isn't a mystery box. Each card carries a **delete** control in its top corner (always visible, not hover-only — this grid is used on touch screens): it confirms, then soft-deletes through `DELETE /api/rows`, and says plainly that the image file itself is kept in storage. **A blank query browses**, newest first, rather than showing an empty prompt: browsing is the normal way to use a photo catalogue. The existing toolbar summary says **Newest first** or **Ranked by match** beside its result count; ordering is not duplicated in the compact header. Each card shows plant name, supplier, size/dimension line and the captured (or received) date. Tapping one opens an in-page lightbox — full image, ←/→ and Esc, every identity/size/tag/provenance field, and a link to the supplier — so closing it returns to the same search, filters and page with no refetch. The lightbox's pencil turns that panel into a **form**: the three name parts, size, height/width/caliper, tags (comma separated) and caption/notes, staged locally and written as one atomic update on Save, exactly as the supplier profile does. While editing, Esc backs out of the form rather than closing the lightbox and the arrows belong to the text fields, so a draft can't be lost by reaching for the next photo. Two round buttons sit at the bottom right: **camera** (`capture="environment"`; a file picker on desktop) and **attach** (gallery, several at once). The picked photos upload one by one through `/api/chat/daisy/upload` (one at a time because the inbox names files `<ms>-<name>` and phones call every capture `image.jpg`), then go as one attachment-only message to Daisy's **`photo-catalogue`** thread (`PHOTO_CATALOGUE_THREAD` in `lib/chat-request.ts`, the only non-entity thread besides `main` the chat proxy accepts). Daisy catalogues them and replies there; the thread is under General in Daisy's thread picker. The grid shows the photos once she has written the rows (no live refresh). |
| `/customers` | client | **Customers** — a table, one row per person, in the same shape Suppliers uses: sticky header with per-column sort, filter, resize and drag-to-reorder, a column picker at the right edge, and the layout persisted per table. Columns are Name (opens their page), Company, Email, Phone, **Active requests**, **Active request value**, **Orders**, **Total order value**, City, State, Street, ZIP, Notes, Added, Last updated — Street, ZIP, Notes and Added hidden by default. The two request figures are summed **in the browser** from the rollup each customer already carries (`quoted` + `availability` + `committed`); the two customer-wide order figures are not yet connected; orders are managed through each job’s Orders tab. Every cell but the four figures and the two dates is **edited in place** through `PATCH /api/rows`. Search matches name, company, email or phone; a **State** chip and a **With requests · N** toggle narrow further, both server-side. The **column header's** sort and filters run over the page in view rather than the whole table — two of the columns are summed in the browser and have no database column to order on. Each row also carries a **Rosie** button — in the actions column at the right edge on desktop, at the card's bottom-right on mobile — opening that customer's conversation. On mobile the table gives way to one card per customer, opening the same page. Cards no longer expand here: everything the old drawer held moved to `/customers/:id`. **No create form, deliberately** — see the deviations table. |
| `/customers/:id` | client | **One customer.** A details card — the contact routes, a four-figure summary (Active requests, Active request value, Orders, Total order value, the last two reading `—` because customer-wide order rollups are not yet connected), **Who they are** and **Address** as editable field grids, **Notes** edited in place (the append-only **Contact log** beside it went with `customers.communication_notes` on 2026-08-25, migration 0073) — and under it two tabs. The header carries an explicit, touch-sized **Chat with Rosie** action opening the customer's stored `rosie_thread_id` conversation, which is the contact history now; when that id has not been minted, the action is omitted rather than deriving a slug that could create a duplicate thread. The live environment currently has no customer rows to backfill; before rolling this policy into another environment with legacy customers, audit null-id web transcripts and reconcile them to stored canonical ids rather than deriving new ones in the UI. **Requests** lists their active requests with status pill, line count, total and date, and each line **opens** into the same body the Job Requests page draws (compact request/contact/delivery/billing-payment summary, status strip, editable line-item table, secondary details-and-notes drawer, Change history), minus the line checkboxes and the delete column: this page has no selection bar to act on them, and a customer's page lists their jobs rather than administering them — deleting one is done where requests are managed. The opened request is fetched on its own from `GET /api/requests/:id` and re-fetched after any write. **Orders** directs users to each job’s Orders tab. Nothing is behind a second chevron here — this is where a customer is corrected, not scanned. |
| `/jobs` | client | **Focused Job page and Rosie intake route.** Bare `/jobs` redirects precisely to the one list at `/requests`; there is no separate Inbox tab or landing. `/jobs?jr=<id>` keeps the established job URL and opens any extant request status, including closed and archived work reached from All jobs. On desktop a 292px contextual rail of active Quote, Availability and Committed jobs replaces the normal app rail. With no saved choice it starts expanded from 1280px wide and collapsed below that (`FOCUSED_JOBS_RAIL_ROOM` in `lib/job-inbox.ts`), where the rail, the Job and the docked chat cannot all fit; a saved choice wins at any width. Its compact header keeps an icon-only 44px **Back to All jobs** action beside an independent 44px collapse control; collapsing leaves a non-overlapping 44px edge control and releases the remaining rail width to the work pane. The choice persists per device under `lps.jobs.rail.open.v1`, separately from the ordinary navigation rail. SSR/hydration keeps the contextual rail neutral and hidden until a before-paint browser layout read resolves that preference, so a saved collapse never flashes a known-wrong 292px rail, including on remount. Toggling makes the still-mounted hidden list inert as well as `aria-hidden`, so its ordering, unread state, scroll, selection, detail/drawers and global Rosie chat stay intact without leaving hidden controls focusable. The work pane shows the job head, `RequestBody`, and Shell-owned New job/Notifications actions. On desktop and mobile its truthful totals and plant table precede one collapsed **Job details & notes** signature tray; Contact, editable billing/delivery addresses, Last updated, notes and stored customer/supplier routes live there without the old Request/Contact/Delivery/Billing overview boxes. Expected delivery / installation date and Pickup/Delivery remain editable in Job details; unsupported payment method, Gate and Tax fields remain omitted. Mobile retains its shared `RequestLinks` preview, then uses that same compact focused hierarchy and the working compact permanent Delete action rather than the superseded All Jobs inline body. Below 900px, a resolved focused detail gives the full Job name its own naturally wrapping, overflow-safe line under a compact JR reference, keeps the existing status pill and a focused-mobile `RequestLinks` context preview, and replaces the labelled Rosie/avatar treatment with one 44px icon-only Rosie avatar, with an accessible name and no tooltip. The preview is width-bounded at phone sizes: long supplier names and every AR segment wrap within the supplier pill instead of being clipped or creating page-level horizontal scroll; supplier chat segments are not duplicated there, while ordinary card and desktop `RequestLinks` keep their established one-row pills. The header's Rosie avatar opens the Job's own `jr-<id>` conversation directly; a supplier's conversation opens from the final segment of that supplier's pill. Desktop/global chat is unchanged. The focused header shows Created on, EDD and Fulfillment inline. EDD reads the saved `job_requests.expected_install_date`, preserving its calendar day; creation timestamps use America/Chicago. Dates use `MM-DD`, and missing values show `—` without substituting update timestamps or free-text notes. The data field remains `expected_install_date`; the editor labels it Expected delivery / installation date. The focused header is `RequestCardHeader stacked`: `JR-<id>` with the working Sales-status control, then EDD and Pickup/Delivery, then the Rosie action and Job actions at the right, all on one row once the header itself is 560px wide (a container query, not the viewport, so the rail and chat column beside it on a 1024px screen cannot squeeze EDD and Pickup/Delivery under the actions), with the 20px Job name on the row below (narrower — phones, or a squeezed desktop pane — the name takes the second row at full width and EDD and Pickup/Delivery move to a third). The customer follows the name when the name does not already include it. The Job name is the inline `EditableText` editor; a missing or whitespace-only name shows **Add job name**. Renaming is described in [All jobs](all-jobs.md). Genuinely missing company, Job or contact components and their adjacent separators are omitted; shipping, Created/Updated, JR, billing and notes never fill a missing identity component. It never reads the flattened inbox customer value. Mobile otherwise keeps the ordinary shell/bottom nav and relies on browser/device Back; it has no contextual-rail toggle. The expanded 292px contextual rail has a search field covering every active job’s name/JR, customer, plants/sizes and job/item notes. Each result shows its JR reference, job name, customer identity and sales status, with a small unread web-chat dot and a footer showing Created and EDD in `MM-DD`. The EDD comes from the saved expected install date; missing dates show `—`. Cards omit chat preview text, unread badge prose and activity timestamp lines; accessible names include their dates and unread state. Job names wrap within the fixed rail width, and absent customer identity shows Unassigned customer. See [Active jobs sidebar search](active-jobs-search.md) for complete search and refresh behavior. The 44px collapsed rail is unchanged. The contextual rail orders active jobs by the maximum of canonical Rosie web-thread activity and request update/create time, preserves shared team-web unread state, and retains its bounded poll/SSE reconciliation; it is not a second navigation destination. Detail validity comes from `GET /api/requests/:id`, so a failed detail read is retryable and a 404 alone is unavailable. A bare/copied `&intake=1` on an existing job—including zero-line jobs—remains normal selected detail unless this tab holds its exact reservation marker; markerless no-row URLs are unavailable and intake never auto-exits. New and same-tab reservation recovery use `/jobs?jr=<id>` with the standard work pane and Rosie sidebar; saved details appear through live updates. Explicit legacy `&intake=1` links retain the manual-exit intake described above. |
| `/requests` | client | **All jobs management and the one Jobs list**, from the Order Requests design comp. The Jobs rail and bottom-nav destination point here; validated query, filters and page remain in tab-scoped state. Below 900px, its resolved (neutral during hydration) toolbar owns exactly one interactive branch: a shrinking Search beside one 44px icon-only **Filters** trigger. The one portalled, background-isolating modal contains Status, Customer, Created and Updated; Item status is omitted entirely from mobile DOM/AT, query, results constraint and badge/deviation. Desktop Item status remains parked separately across mobile and session restore, returns unchanged at 900px, and is never cleared by mobile Clear all. The active count compares Status with the starting four selections that exclude Archived instead of calling those four active filters. Restoring `lps.requests.visit.v1` maps only legacy **Quoted** to canonical **Quote**, deduplicates mixed old/new copies, keeps the underlying `quoted` filter and re-saves the current label. Expand all / Collapse all is desktop-only because mobile cards navigate to focused Jobs and never disclose inline. At 900px and above, the established shared desktop Search/chips/actions toolbar remains the sole branch. See [`all-jobs.md`](all-jobs.md) for responsive, focus and API invariants. On desktop, one **collapsed card per request** carries everything it is judged on without opening it — `JR-<id>`, **the job's name** (`job_requests.name`; desktop pairs it with `JR-<id>` in one labelled 44px link to `/jobs?jr=<id>`), status pill, customer/company, contact name, ship-to city/state, inline header metadata **Created on · EDD · Fulfillment** (dates in `MM-DD`), plus a **one-line demand strip** — every line status with its count, then item count and subtotal, zeros included but dimmed, so "nothing is unavailable" and "nobody has looked yet" cannot render alike — and **the newest note on the request, truncated to one line** and tagged with its audience. A resolved-mobile card keeps its identity/action rows with Created on / EDD / Fulfillment inline in the header, wrapping when space is limited, and never expands inline. Row 1 is **JR · full plain-language sales status · Company/Customer · Job name** with no chevron: JR and status stay intrinsic, while one canonical `/jobs?jr=<id>` identity link owns the full trimmed values and the sole `min-w-0 flex-1` ellipsis region. The visible status is **Active**, **Quote**, **Closed won**, **Closed lost** or **Archived**, never an abbreviation. Blank Job names are omitted rather than repeating the already-visible JR fallback. Row 2 is a labelled intrinsic Pending dot/count at left and a visible named, minimum-44px **Rosie Chat** action at right on canonical `jr-<id>`. The head has 10px vertical padding, an exact 6px row gap and no dead reserved height. Mobile cards show their saved Created on / EDD / Fulfillment metadata inline in the header; no `RequestLinks`, note preview, full counts, RequestBody, PO, nested details, lines or Delete are mounted. Selecting the identity opens the complete focused Job, where full counts, lines, the compact safe Delete, **Job details & notes**, related routes and history remain available. Dates use `MM-DD` and missing metadata displays `—`, without Updated or note-derived substitutions. Desktop keeps its full collapsed strip and inline expansion. The head is deliberately spare: the customer's email and phone belong to the customer and are a click away on their card; both breakpoints show the same compact creation and install metadata. The card head carries **no checkbox**: selection is per line, in the table the card opens. On desktop, only the separate 44px chevron expands or collapses the card in place (with labelled `aria-expanded`/`aria-controls` state). Mobile has no chevron; its identity link opens the focused Job. An expanded desktop card removes the four-block Request/Contact/Delivery/Billing summary and instead uses the same inline JR/status, structured identity and Created on / EDD / Fulfillment metadata as focused Jobs. The full-width status/count/item/subtotal strip and line-item table remain immediate, followed by the **Change history** drawer at the foot. Mobile has no expanded All Jobs overview; the focused Job carries that work. Unsupported PO and payment-method data are never fabricated; the saved customer EDD and Pickup/Delivery fields supply scheduling metadata. The compact **Job details & notes** drawer is **shut by default** on expanded desktop/focused Jobs. Its truthful count summary opens compact signature columns for exact stored Contact, editable payment-contact/billing address, editable Delivery address, **Last updated**, both note audiences and stored related routes; it repeats no Request/JR/Job identity and offers no nonexistent payment method, Gate or Tax field. Customer request bodies retain their established compact editor treatment; focused/compact Job work explicitly opts shared editable and status controls plus Change history into 44px targets without changing those defaults. Last updated is absent until this nested drawer opens and says **Not recorded** when missing. It is never replaced with Created or a note-derived date: nullable customer EDD and Pickup/Delivery are edited in Job details and displayed as EDD and Fulfillment inline in card and focused headers. The **internal note** block is an ordinary editable field there, like the note for customer: it is free text kept current, not a log that grows without bound. Order particulars are read when a request is being actioned, not when it is being scanned, while the head shows the destination city/state and saved install/fulfillment metadata. The table is Select / Demand / Avail / Size / Plant Name / Status / Note for customer / Unit price / Total / Internal note, plus a trailing unlabelled **delete** column, colour-keyed by status down a left edge. **Selected** and **Candidates** columns (immediately left of Internal note by default; saved layouts move the old Suppliers column's place and width to Candidates, and the focused `/jobs?jr=<id>` page renders this same table and layout) show the line's candidates as draggable pills, one sub-row per supplier: drop one on Selected to fill the line (`select_candidate`; `job_lines` then reads its size, price ($0 shows $0.00; only an unpriced candidate is blank, 0143), quantity capped at demand (blank while unchecked), mapped status — Can Order → `need_to_order`, a substitute → `diff_size_sub`, unanswered → `pending` — and its customer note), back on Candidates to fall back to the line's default (`unselect_candidate`), on its supplier's AR target to ask it, or on the bin to delete it (never the default); see [All jobs](all-jobs.md#candidates). Each line's merged customer sourcing note appears once in the **Note for customer** column; plant names carry no separate note. **The counts on a collapsed card always describe the whole request**, never the filtered subset the expanded table draws — so a card can honestly read `4 lines` while showing one. A search or an item-level filter auto-expands the cards it matched, since the question was about lines. **Expand all / Collapse all** in the toolbar; its existing result summary also keeps the line-item count that no longer lives in the compact header. Selecting lines offers **Availability request** in the selection bar: a dialog with the LPS Partner dropdown and a share-customer-details checkbox that creates one `availability_requests` row per job involved, snapshotting the selected lines and **prefilling each line's price** where our own catalogue answers it for that supplier at that size (exact identity match, one agreed price, or the box goes out blank). Everything the job opens hangs off the customer line, in the empty half of a row the card already draws — with a compact date caption beneath each AR link. The customer's end sits with the customer's name: a **Chat** chip opening only their stored `rosie_thread_id` conversation; no chip is drawn for a missing/blank id, because the Job Request card must not guess Rosie's collision-safe slug. Right-aligned opposite it, **one segmented pill per engaged supplier**, most recently engaged first: the rail's supplier mark and the name written once, then a segment for **every availability request this job has with them** (`AR-<id>`, newest first, opening the request as a drawer); new AR tags are blue and processing ones orange (the AR status tones), each with a matching dot; submitted AR tags use green backgrounds/text and a matching dot, with **Submitted** in their accessible name. Closed and unknown stages use gray backgrounds/text and no dot. The indicator follows current status rather than retained `submitted_at`, so reopened requests show yellow and closed requests have no dot. Each segment shows a bare **MM-DD**: the submission date for current `submitted` requests and the creation date otherwise (missing dates are `—`). A successful drawer write signals its re-read status and submission timestamp back into only the matching mounted link (no page/facet refetch), and the drawer remains the only detail view. One final segment opens **their conversation**. A job can have several suppliers and several requests with each, so the supplier is the unit — a flat run of `AR-<id>` chips would be the same links in an order nobody can scan. **Below `md` the supplier pills are drawn only on an expanded card**, and take a full-width line of their own rather than hanging off the right edge: a narrow card has no empty half for them to ride, and who a job's suppliers are is what the card is opened to find out. On mobile those details live only in the focused Job and are not duplicated into the compact list summary. These live on the card and not under the internal notes, where they used to be: a note is free text, so a link in it can only be built from the job's actual engagement anyway, and that engagement belongs to the job rather than to a sentence about it. The denser line table scrolls sideways below ~1050px rather than crushing its columns, and each card is `flex-none` so the card list scrolls vertically instead of the card being shrunk and clipping its own contents. **Fields are edited inline**: click a line's name, size, demand, avail or unit price to edit it (Enter or blur commits, Esc abandons, an unchanged value is never written), pick a status from the pill's dropdown, and edit the ship-to/bill-to parts and both note fields in the More details & notes drawer. Every write goes through `PATCH /api/rows`, and the page refetches afterwards because `total` and every count are derived. **Change history** is the request's whole audit trail — every edit to it or its lines, by this app *and* by the agents, since `job_request_changelog` is trigger-written and neither write path has to cooperate. Each entry names the actor in words (`service_role` → "This app", `postgres` → "An agent script"), says whether it was a create or a change and what it was about, and lists each column as `old → new`. It is fetched only when opened, and re-fetched after any write, so an edit you just made shows up in the history you are looking at. Nothing in it is editable — the rows are immutable by design. **Whole-request deletion is mobile-safe.** Desktop keeps the established compact whole-request trash control. A mobile All Jobs card has no Actions or delete control. Its identity opens the focused Job, whose labelled, minimum-44px **Delete job** action uses the same confirmation and return behavior. Choosing it opens the same accessible confirmation naming the JR and job, stating that deletion is permanent, and giving the authoritative line count plus a nonnumeric warning that the job’s lines, change history, Rosie chat and exclusively owned orders/ARs will be removed; records shared with other jobs are kept; Cancel, Escape or dismiss leaves it unchanged. Each line keeps its existing permanent-delete control and confirmation at the right end of the line table. The toast afterwards reports what the server actually removed. **Not editable, deliberately:** `total` (generated) — see *Row tinting and selection* and *Job requests* below. |
| `/partner/:id` | client | **Supplier portal home** — the outward-facing app an LPS Partner uses (see *Supplier portal*). **One row per availability request, and the row is a link**: it opens the request's own page (`/partner/:id/requests/:arId`) rather than expanding in place, because answering a request is the work and a list is only how you pick one. **Three multi-select work buckets and no stored filter preference**: New · Processing · Completed (the `submitted` status, labelled for suppliers), centred in one card-toned strip pinned under the header (no All / Select all button since 2026-09-28). Every fresh portal visit selects New + Processing and excludes Completed; each bucket can then be toggled independently for that visit. Counts always describe the complete open workload rather than the filtered rows. Written labels, check marks and `aria-pressed` state carry selection without relying on color. New is blue, Processing amber/orange and Completed green in both its control and matching request row; red remains reserved for errors/destructive states. Search, job-status / item-status / customer chips, date range, sort and Expand all remain absent, because a supplier's list is short enough that they cost more than they found. **`closed` requests are not on this page at all** (2026-08-26), even with every bucket selected: closing is ours, and a closed request is finished work rather than a fourth thing to triage, so it has its own rail destination instead of a tab. **The card is one row, the `/requests` job card's** (2026-10-21, `RecordRow` in `record-row.tsx`, shared with the order cards): status pill, request name, EDD, Pickup/Delivery, item count and subtotal (`arSubtotal`) in the job card's columns on a neutral card; a request spanning jobs stacks one EDD and one mode per job in those cells. On phones it wraps as the job card does: status, then the name, then EDD · mode · items · total. No customer and no note; the whole card is a stretched link to the request page. *2026-10-07 to 2026-10-21:* two rows (`PartnerListCard`) — status pill and job name, then the EDD pill(s) · item count · customer, on a status-coloured edge. *Before 2026-10-07:* **The row** (redrawn 2026-08-30 to the Figma comp): a written status pill and matching colored edge at the left (New blue, Processing amber/orange, Completed green), the job name (falling back to *Availability request*; supplier-facing request IDs are deliberately omitted) over **our job-level note to the supplier** (`noteForSupplier`, wrapping to show the full note, omitted when blank), and the item count and the request's subtotal at the right, `·`-separated (the subtotal is omitted until a line is priced *and* counted, and the Pickup/Delivery tag until one is set — 2026-10-07). On phones the job name takes its own line and wraps to two lines rather than truncating. A New row carries a blue edge. Created and each linked job’s EDD appear with a Pickup/Delivery tag. Combined requests keep separate anonymized schedules for each job. The count/subtotal strip the card used to draw is gone from the list; the request page still has it. The generic desktop frame header is absent; the tab strip carries the PartnerFrame-owned bell at its right, and the old `X new jobs · Y rows pending` stats line is gone. **By request / By item** is a floating three-icon toggle (rows · stacked layers · grid) pinned to the bottom centre of the page column, over the list; under By item the strip's tabs become the answer statuses (see *By item*), and under **By status** the strip is empty — the board's cards are the cut (see *By status*). **Gated** — a partner sees only their own company, an admin sees all; see *Auth*. 404-styled message for a supplier that is missing, not an LPS Partner, or not theirs. |
| `/partner/:id/closed` | client | **Closed requests** — the fourth and last entry in the portal's nav rail (`Closed`, an archive mark), and the only place a `closed` request appears. One list, newest first, no tabs and no filters: a closed request is something you look up, not something you triage between. Its count sits quietly above the cards in content rather than in the compact header. The cards are the requests page's own `PartnerRequestCard`, and still open the request, which reads closed and read-only when it gets there. |
| `/partner/:id/requests/:arId` | client | **One availability request**, and everything needed to answer it — redrawn 2026-08-30 to the Figma comp. No desktop header: the toolbar is **one row at every width** (2026-10-07), starting with an icon-only **←** back button named *Customer Requests* (*Closed requests* on a closed one, since that is the list it was reached from and belongs to — the rail's highlight follows it the same way; 44px minimum target), `N lines · M pending`, and at the right actions — **Share** (opens Make public / Make private and Copy public URL options, scoped to this supplier’s request) and **print** (`window.print()` over the **print sheet** — `ar-print-sheet.tsx`, a `<body>` portal shown only under `@media print`, laid out as the availability-request PDF LPS emails, densely enough that a dozen lines fit one page: title, **`Request #: AR-<id>`** — the portal never shows the AR number on screen, but a filled sheet comes back as an upload and the number is how the agent knows which request the answers belong to, so it heads the sheet, repeats in a table footer on every page and opens the disclaimer — the job name at the right, a bordered table of Qty · Size · Name · Status (the six full plant labels as a checklist, one per line, including Pending) · Avail. Qty · Price · Note for supplier (narrow), an Additional Comments box, a Submitted by line and the quotation disclaimer; `globals.css` hides everything else on paper, since the app's fixed frame would print clipped, and fixes the page to letter portrait) — and the PartnerFrame bell. Then a **header card**: a strip with the status pill (`submitted` reads *Completed*), the job name centred in the row (equal side columns, `PartnerDetailHeader`) and the requested date as `Wednesday | 08/26/2026`; under it the customer contact (name, phone, email) and the delivery address where the request shares them, and a shared sourcing note editor below the lines. Then the **summary strip** — Pending · Available · Partial Qty · Unavailable · Diff Sz/Sub · Can Order · Arriving Soon · Total Items (line count) · Subtotal — each count in its own accent, a dash for zero. Then the line table in its **portal drawing** (`ARLineTable design="portal"`): Need · Avail qty · Size · Plant · Status · Note · Unit price · Line total, hairlines with the answer's tone bar and tint and no subtotal footer (the strip has it); the placeholders read `—`, `-` and `Add note…`. Picking a status behaves per answer (see *Supplier portal*); per-cell saves on blur go through the scoped portal PATCH, which also moves the request to `processing`. The **Submit availability** bar is pinned under the table (**Re-Submit availability** once `submitted_at` exists — including after we added a line and the trigger put the request back to `new`); it stamps the request `submitted` and wakes rosie; re-submitting re-notifies. A successful submit plays a short **received** acknowledgement over the page — drawn by the shared `AvailabilityRequestView`, so the public link plays the same one (`submit-received.tsx`, keyframes `.lps-received*` in `globals.css`): a ring and check draw in, a seedling sprouts from the check and leaves burst outward, captioned *Availability received* (*Update received* on a re-submit); it dismisses itself after ~3s or on click / Escape, and reduced-motion users get the static badge. A notice under the table says so while the request is `new` and carries prefilled prices. It loads the home list's payload (`GET /api/partner/:id`, lines embedded) rather than the single-request route, so one fetch feeds the request, the supplier's name and the bell. **The chat is a second way to answer it** (2026-08-29): a supplier can say what they have and rosie writes it into the lines herself; the page reloads on every reply from Local Plant Supply (`PartnerFrame`'s `onAgentReply`). A closed request is read-only, with no submit bar. The mock's mail / chat / PDF actions, PO number, payment contact and payment method are not drawn: none of them exist on a request. |
| `/partner/:id/settings` | client | The portal's **Settings** — one card, the supplier's own password, on the shared `ChangePasswordForm`. Reached from the rail's foot and mobile More (not the nav strip); it names who is signed in from `/api/auth/me`, since the portal payload knows the company and not the login. |
| `/partner/:id/orders` | client | Availability-style order cards and status/grouping controls; each detail page shows the job's mode and EDD, the Additional details, notes, plant summary, print and acknowledge/ready actions. See [Orders](orders.md). |
| `/change-password` | client | **Set your own password** — where the gate holds an account still on the generated one it was handed (`must_change_password`; see *Auth*). The `/login` frame (`AuthFrame`) again, and the only page such a session may reach. Visiting it with an ordinary session simply changes your password. |
| `/agents` | client | Know your Agents: the generic shared header is omitted on mobile, where the highlighted Agents action and cards identify the workspace; desktop keeps the compact title row. One card per entry in `lib/agents.ts` — avatar, role, an Active / "Coming soon" / "On Telegram" badge (`chatBlockedReason`), and the full profile banner image. Only `upcoming` fades its banner; an agent reached on another channel is live. |
| `/settings` | client | The generic shared header is omitted on mobile, where More and the first tab strip identify the workspace; desktop keeps the compact title row. Tabbed: **Global** (the harness's OpenAI Codex login and model allowlist, then the app header/accent palette and Reset all) and one tab per agent (that agent's chat colour and wallpaper with a live preview, model + thinking level, Google account, scheduled tasks). The tab is in `?tab=`. Available from desktop Settings and mobile More. See *Settings*. |
| `/a/:agent/private/artifacts/:slug` | server | An agent-published page, for signed-in users, with the public/private toggle above it. See *Agent artifacts*. |
| `/a/:agent/public/artifacts/:slug` | route | The same page for anyone with the link, and **the app's only ungated path besides `/login`** — served only while the artifact is flagged public. |

| API route | Purpose |
|---|---|
| `GET /api/suppliers?q=&page=` | Runs the location-level `search_suppliers` result and filters first, attaches each location's `head_branch_id`, groups before pagination — favourite companies (`is_favorite`, 0153) first — and returns `companies` (50 per page). Each carries the **`head` row** — read from `suppliers`, so it is present whether or not it matched — the matching farms under it, `matchedCount`, `locationCount` and `locationIds`. The head row's source list is the whole company's, newest first, so its **Last ingestion** is the company's. `total`/`pageCount` are company counts. Postgres-incompatible NUL parameter names/values and non-boolean `s.lps_partner` values fail closed with a fixed, non-reflecting JSON `400` rather than becoming database `500`s; valid parameters are unchanged. `?counts=1&ids=` is still the per-location active-item second pass, now asked for **every** location id so the company row's `# Items` is the company's. |
| `POST /api/auth/login` | Sign in. `{username, password}` → sets the signed `app_sid` cookie and answers `{next}` — the path for that role, or `/change-password` while the account is still on a generated password. A bad username and a bad password fail identically (401); a 502 means the sign-in service is down, not a typo. |
| `POST /api/auth/logout` | Sign out — drops the cookie. The token is stateless, so that is the whole of it. |
| `POST /api/auth/password` | Change **your own** password. `{currentPassword, newPassword}` → verifies the current one, writes the new one (6 characters minimum), clears `must_change_password` and **re-mints the cookie** so the forced-change gate lets you through. The account is the caller's own from the signed cookie, never from the body. Either role. |
| `GET /api/auth/me` | `{user, role, supplierId}`, or `{user: null}`. What the nav rail's avatar reads. 200 either way — the rail asks on pages where signed-out is fine. |
| `/api/suppliers/:id/partner-account` | **Admin only.** The Portal access panel. `GET` lists the company's logins and the id its portal URL is built from; `POST {username}` adds one (and marks the company an LPS Partner); `PATCH {accountId}` resets one password; `DELETE {accountId}` removes one for good (the `auth.users` delete cascades the `app_users` row). The two password writes answer with the generated password **once** — it is a hash after that. |
| `GET /api/suppliers/:id` | The whole profile as one payload (`getSupplierProfile`): `subjectId`, `company` (`{id, name, locationCount}`) and `locations` — head branch first, each with its own row, contacts, active sources and item count. On a head-branch id that is every active location of the company; on a farm id it is that farm alone. |
| `GET /api/plants?q=&page=` | Plant search is still paged at inventory-row grain (300), then grouped into **company** `groups`: `companyId`, `companyName`, the head-office `company` row carrying the aggregates, `locationCount`, `matchedLocations` and the plants themselves, each with `values.branch` naming its farm. Plant and location filters — including city/state — run before the page and the grouping. `sort=&dir=` orders the whole inventory match set ahead of relevance. Favourite companies' farms lead it all: the page is a window over their matches, then everyone else's (`favouritesFirstPage`, `lib/favourites.ts`; page 1 reads both at once, later pages count the favourites first because PostgREST refuses an offset past a result's end). `?supplierId=&page=` is the profile's inventory and takes a **comma-separated set** of farm ids — the profile's whole scope — so a company page pages through its farms as one list. |
| `GET /api/photos?q=&offset=` | Photo catalogue, 50 per batch, with the match `total`. **An `offset`, not a page number** — the grid appends, so it asks for "the next batch after what I hold", which stays correct after a photo is deleted out of the middle; a page number would skip the row that moved up. An offset past the end returns an **empty batch with the true total**, not an error. `p.supplier` / `p.size` / `p.cultivar` / `p.tag` filter in SQL over the result (or over the table when `q` is blank). `?facets=1&q=` returns the option lists — sizes, tags, cultivar display names and `{id,name,city,state}` suppliers — for that search without its filters. |
| `GET /api/photos/:id/image` | Redirects to a 1-hour signed URL for one photo. Takes a **photo id**, never a storage path: the path is read from the row, so this cannot be used to sign arbitrary objects in the private bucket. |
| `GET /api/customers?q=&page=` | Customers, 25 per page, each with its active job requests and the rollup over them (`openCount`, summed `lineTotal`) and its parsed contact log. `q` matches name, company, email or phone — the `,` and `)` characters are stripped from it because PostgREST's `or()` grammar has no parameter binding and they would break out of it. `state` and `requests=1` (has at least one active request) filter. `?facets=1` returns the state option list plus the header totals. |
| `GET /api/customers/:id` | One customer, whole — the same shape the list returns, with their active requests and the rollup over them. For their own page, which lists nothing else. 404 when the id is not an active customer. |
| `GET /api/job-inbox` | Complete signed-in active inbox metadata. It reads active `quoted`, `availability` and `committed` requests in 250-row pages through a 5,000-row ceiling plus sentinel, returning an explicit over-cap error instead of truncating. It batch-loads their customers, exact canonical `agent=rosie` `jr-<id>` open-thread metadata, and active job items; item reads use bounded job-ID batches and page past the 1,000-row response cap. Each result includes separate stored customer company/contact and atomic Job name, Created and Expected install dates, and complete `searchText` covering JR/name, customer, plant names/sizes and all three job/item note fields. Thread metadata still drives activity ordering and shared unread state, but sidebar cards omit chat previews and activity timestamp lines. Shipping address/city/state/ZIP are not selected or returned; the legacy flattened customer display value is not used to build identity. No portal route, transcript search, pre-join pagination or per-row query. |
| `GET /api/requests/:id` | One request, whole — every active line, the per-status counts and `lineTotal`, in the same shape the list returns. Nothing filters it: it is for the pages that show a request without listing them, and a customer's card opens its requests one at a time. 404 when the id is not an active request. |
| `GET /api/requests/:id/changelog` | One request's whole `job_request_changelog` trail, newest first, with each entry's line item resolved to its name (including retired ones — a retired line still has a history). Its own endpoint rather than a field on the request: the list is unbounded and only wanted when the history drawer opens, so paying for it on every card would be paying for it in vain almost always. |
| `DELETE /api/requests/:id` | Permanently delete the job, demand lines, change history, Rosie chat and exclusive orders. Exclusive ARs are soft-deleted with their saved headers and lines retained; shared records remain. Answers `{ deleted }` with affected counts, including the number of ARs retired. 404 when there is no such job. |
| `DELETE /api/requests/:id/items/:itemId` | Delete one line **permanently**. The request id is part of the lookup, not decoration: it is what stops a wrong id from reaching a line of another job (404). The line's unasked candidates are deleted with it; ones asked on an AR stay on that AR, unlinked from the line (0130). The count of asked ones comes back as `deleted.availabilityRequestItems`. |
| `POST·DELETE /api/requests/:id/items/:itemId/candidates/:candidateId` | Act on one of the line's candidates: POST `{action: 'select'}` (`select_candidate`, which also unhides a hidden candidate, 0152), `{action: 'unselect'}` (`unselect_candidate`: back to the line's default), `{action: 'hide'}` / `{action: 'unhide'}` or `{action: 'add', arId}` (`add_candidates_to_availability_request`, which takes only a Draft or New AR; `reopen: true` first calls `reopen_availability_request` on a submitted or processing one); DELETE soft-deletes it (`delete_candidate`). The line's default can't be hidden or deleted. A candidate of another line or job answers 404. |
| `POST /api/requests/reserve` | Reserves the id of a job request that does not exist yet — the **New job request** button. No body, and **no row**: it calls `reserve_job_request_id()` (migration 0072) and answers `{ id }`, which is what names the `jr-<id>` thread the button then opens. Rosie writes the row from that conversation. |
| `GET /api/requests?q=&page=` | Job requests, 25 per page, each with **all** of its active line items, its per-status counts and `lineTotal`. `lineTotal` is the Copy Quote subtotal (`quoteSubtotal` in `lib/job-request-html-quote.ts`) over every active line — unavailable lines count zero (priced or not), otherwise available quantity (falling back to demand) × unit price, unpriced lines zero — not the sum of `job_lines.total`, so the job page's Subtotal matches what Copy Quote prints. The footer totals' `subtotal` (over the visible lines of every result page) uses the same per-line rule. `q` matches a plant name on the request, the customer's name/company/email, or the request id (`7` or `JR-7`) — a plant match narrows the lines returned, a customer or id match keeps them all. `status` / `itemStatus` are whitelisted against the CHECK vocabularies (an unknown value is dropped, not an error); `size`, `customer` and `created`/`updated` (days back) filter too — `size` is still served though the toolbar no longer offers it as a chip (see the deviations table). `?facets=1` returns the size and customer option lists plus the header totals. |
| `GET /api/file?path=` | Redirects to a 1-hour signed URL for a source file. |
| `GET /api/auth/*` | Not ours — rewritten to the harness (`login`, `logout`, `me`). |
| `GET·POST /api/chat/:agent/:action` | Pass-through to that agent's `webchat` plugin inbox (`messages`, `send`, `upload`, `file`, `reset`, `threads`, `read`). See *Agent chat*. `send` carries `page` (`lib/chat-page.ts`: current path + `document.title`) so the agent knows which screen the message came from. |
| `GET /api/chat/threads` | The bell's sweep: every chattable agent's open threads with a transcript, straight from the `threads` table (closed ones excluded), keyed by agent in the plugin's `api/threads` row shape. |
| `GET /api/chat/events` | **Server-sent events** — `thread` events for chat changes and data-free `jobs` invalidations for job, line, availability, customer and supplier changes. Internal sessions only. The app server's single Supabase Realtime subscription is relayed by `lib/chat-realtime.ts`; job views batch background reads through `lib/use-job-updates.ts`. See *Agent chat*. |
| `GET /api/partner/:id/events` | **Server-sent events** — data-free `jobs` invalidations for supplier request/item/order changes. Requires the usual session and company/branch access gate, independent of chat availability. Portal views share the connection through `lib/use-partner-updates.ts` and re-read supplier-scoped APIs. |
| `GET /api/chat-directory?agent=<rosie\|daisy>` | The chat panel's thread picker, by category, merged client-side with the plugin's `api/threads` transcript list. **rosie** (the default): active job requests (`jr-<id>`, titled by `job_requests.name`, renamable from the card), LPS Partners and engaged suppliers (`rosie_thread_id`), active customers. **daisy**: supplier companies only (`daisy_thread_id`, the head branch's row) — bounded to the ones she works, every LPS Partner plus everyone with an active `inventory_sources` row, since all 1,300-odd suppliers carry a thread id. |
| `GET /a/:agent/private/artifacts/:slug/raw` | The artifact HTML for the page's iframe, fetched from the harness with the shared secret. |
| `POST /a/:agent/private/artifacts/:slug/share` | `{"public":bool}` — flips which of the artifact's two links works. |
| `GET /api/availability-requests?supplier=1,2&job=` | Availability-request summaries for a supplier's locations or one job request — the supplier profile's Requests tab and anything else that lists them. |
| `POST /api/availability-requests` | Create one from a job request's selected lines (`{jobRequestId, supplierId, shareCustomerDetails, itemIds}`), or add them to the job's existing AR with that supplier; answers `{id, reopened, publicPath}`, where `reopened` says a submitted or processing AR was reopened as New first — only with `reopen: true` (LPS confirmed); without it the answer is `409` with `reopen: {id, status}`. Requires an active supplier; non-partners receive a public URL for HTML email outreach. Snapshots the lines' name/size/quantity at share time and prefills each line's `unit_price` where our catalogue answers it for that supplier at that size. It does **not** write `mapped_inventory_id` (migration 0077) — the price look-up takes a number when every surviving row agrees on one, which is not the same as one row mapping. Rosie's supplier thread is the column's only writer for now, so a priced line with no mapping is a request made here. |
| `GET·PATCH /api/availability-requests/:id` | Admin view and writes: `{status}`, `{noteForSupplier}`, `{shareCustomerDetails}` (boolean; refused on a closed request), `{itemId, details}` or `{itemId, changes}`. Draft → New uses `send_availability_request` (Publish), validating an active job/supplier and at least one active candidate; non-partners get a fresh public link. Other states can return to Draft, which revokes the link. Draft answer preparation uses the service-only `edit_availability_request`; supplier answer routes remain draft-blocked. LPS ask/answer edits keep the request's status (0130). `{status: 'new'}` on a submitted, processing or closed request goes through `reopen_availability_request` (a closed one only while its job is open), which keeps `submitted_at` as history; closed ARs remain read-only until then. |
| `DELETE /api/availability-requests/:id` | Unsupported (405). ARs cannot be deleted, including through database DELETE or TRUNCATE. Use Draft to withdraw supplier access. |
| `GET /api/availability-requests/suppliers` | All active suppliers, including non-partners, with `is_lps_partner`. The nav rail filters this list to partners for valid portal shortcuts. |
| `GET /api/partner/:id` | Portal home payload — the supplier plus every availability request **with its lines embedded** (customer/delivery only where shared), so cards expand, search and filter without a fetch per card. Refuses (404) any supplier that is missing, inactive or not an LPS Partner, which is the scoping rule every portal route starts with. |
| `GET /api/partner/:id/items` | Every line of this supplier's **open** requests, flat — what the portal's **By item** view groups by plant (`listPortalItemLines`). Three batched reads; carries `mapped_inventory_id` and the mapped row's name/size. Nothing about the job behind a request beyond the name the home page already prints, and the customer only where `share_customer_details` says so — a request without it is never even queried for one. |
| `GET·PATCH /api/partner/:id/requests/:arId` | One request as the supplier may see it, and their per-line answer — writable columns are exactly `status`/`available_quantity`/`unit_price`/`note_from_supplier`/`offered_candidate_id`/`offer_description` (validated by `answer_availability_request`; `size` is refused since 0121, and `offer_unit_price`/`offer_quantity` are ignored since 0130); the ask columns (including LPS's `note_for_supplier`) are refused. Available sets the quantity to the demand; Unavailable sets it to 0 and keeps the price (0122); Diff Sz/Sub (`diff_size_sub`) must name a substitute — a tag (another of this supplier's candidates on the line, from the line's `alternatives`) or a typed one. Once a row has a substitute, its price, quantity and reply edits are written to the substitute. A `{itemId, mappedInventoryId}` body instead writes that line's catalogue mapping (`setARItemMapping`, migration 0077) — the key's *presence* selects the branch, so `null` unmaps; it never travels through the `changes` whitelist, which still refuses `mapped_inventory_id`. A request belonging to another supplier answers 404, not 403. An answer PATCH atomically moves the request to `processing`, including admin-entered supplier replies; mappings alone leave the response stage unchanged. (The home GET embeds every request with its lines, so the pages themselves only PATCH here.) |
| `POST /api/partner/:id/requests/:arId/submit` | The request page's **Submit** / **Re-Submit**: stamps `submitted`/`submitted_at`, then wakes rosie best-effort via the `supplier-events` webhook (`lib/notify-supplier-events.ts`), passing the supplier's `rosie_thread_id` |
| `GET /api/partner/:id/chat/events` | The portal's push signal: a content-free `{type:'ping'}` whenever the supplier's rosie thread changes — no preview, because the newest message may be internal. The portal re-fetches through the route below, which filters. |
| `GET·POST /api/partner/:id/chat` | The portal's chat with Local Plant Supply — server-to-server against rosie's four app-secret webchat endpoints (`app-upload`/`app-send`/`app-messages`/`app-file`, `WEBCHAT_APP_SECRET`), always deriving the supplier's `rosie_thread_id` server-side. GET polls the portal-visible transcript or streams one transcript-scoped attachment (including byte ranges for audio); POST stages an allowlisted raw file or sends text/ticketed attachments. A send also forwards the supplier's `page` (path + title of the portal screen they were on), which the plugin appends to the agent-facing message as `Additional context` — on the request page that path names the request, which is how rosie knows which one a chat-given answer is about (`supplier-coordination` §3.6). 404 when the supplier isn't an active Partner, has no thread id, or the secret isn't wired. |
| `PATCH /api/rows` | One inline cell edit, or a whitelisted set of changed fields in one row update. |
| `DELETE /api/rows` | Soft delete (`is_active = false`). `inventory_sources` cascades to the rows it sourced and returns `retired`. |

Pages are client components that fetch from these routes — the workspace is
interaction-heavy (column layout, filters, editing), so there is one data path
rather than a server-rendered one and a client one that drift apart.

## Portal access

How a supplier gets a login. `components/workspace/partner-access.tsx` over
`/api/suppliers/:id/partner-account`.

It lives on the supplier page's **Portal access** tab (`?tab=access`, last in
the strip — account admin is occasional work, not something you triage
between), and that tab is the only surface for it. A header button and a
mobile quick action that opened the same panel in a modal were dropped on
2026-08-30: two entry points to one panel is one more than the thing needs.

**Accounts belong to the company, never to a farm.** Opened from any branch
page it shows and edits the *head branch's* accounts, and the URL it hands you
is that company's portal. The rule is enforced three deep: `partnerScopeId()`
resolves the id before every read and write, and the `app_users_parent_supplier`
trigger (migration 0083) rejects a branch id outright.

A company may have **several** logins — an owner and a yard manager answering
the same requests — so the dialog is a list with an add form, not a single
button. Usernames are globally unique and case-insensitive; the admin types
one, defaulted to the supplier's primary contact email. It is a *handle*, not
an address: Supabase Auth needs an email, so one is derived
(`<username>@AUTH_EMAIL_DOMAIN`, an `.invalid` domain) and never written to.

**`is_lps_partner` follows the logins.** Since 2026-08-30 the flag is derived,
not hand-set: true exactly while the company has at least one portal account,
maintained by a database trigger (migration 0084). Creating a company's first
login turns it on, deleting its last turns it off, and nothing else moves it —
it is out of `WRITABLE.suppliers` and read-only on the profile grid, where it
was a Yes/No dropdown until then. The two were previously independent, so a
company could be marked an LPS Partner with nobody able to sign in, and
availability requests could be sent to a portal no one could open.

The flag lives on the head branch **alone**: that is the row the
availability-request picker offers and the row the shared URL names, so a
company answers on one portal rather than one per farm.

**The password is shown once.** Supabase stores a hash and nothing can read it
back, so the reply to the call that made it is the only sighting. The panel
prints it with the portal URL and the username, and offers *Copy message* — the
whole hand-over text, ready to send — and *Copy link*. After that the only
remedy is **Reset password**, per account, which rolls it and shows the new one
the same way.

**It is not the password they end up with.** A generated one is a hand-over,
not a secret — it went down a phone or through an email — so the account is
held on `/change-password` until its owner replaces it, and a reset arms that
again (*Auth — Choosing your own password*). What the supplier signs in with
after that is theirs, unreadable here, and changed from the portal's own
Settings page.

**Delete** removes a login for good, per account, behind a confirm that names
it. Deleting the Supabase Auth user is the whole of it — `app_users.id` is an
FK to it `ON DELETE CASCADE`, so the app-side row goes too and the username is
free again. It is scoped by company like the reset, so one supplier's page
cannot delete another's login by id. Deleting a company's **last** login clears
`is_lps_partner`, which removes their portal shortcut. They remain eligible for
availability requests delivered by HTML email with a public request link.

## Supplier portal

The open supplier chat merges live reads and earlier history by server message ID, keeping server order even when requests overlap or arrive out of order. Send confirmations reconcile optimistic bubbles with any already-received server row; only transcript reads advance the polling cursor so sends cannot skip unseen replies.

`/partner/<id>` is the **outward-facing supplier app** (migration 0062):
an LPS Partner answers availability requests and talks to the broker
there. Same tokens, same components, same product as the admin app — but its
own fill-in of the shared chrome (`components/workspace/partner.tsx`): a
supplier gets their identity and three destinations, not the operator's pages
or agent chat.

The chrome is **the admin Shell's frame itself** — `PartnerFrame` renders the
same `WorkspaceFrame` (`components/workspace/frame.tsx`, see *Shell and
responsive behaviour*) the admin `Shell` does, since 2026-08-26 (it had been a
separate copy of the layout since 2026-08-24). So it holds itself in the same
**fixed visual-viewport frame** — anchored to `visualViewport.offsetTop`, so
an Android PWA keyboard pans without clipping, the document scroll-locked, the
mobile bottom bar hidden while a field has focus — and gains whatever the
frame gains (pull-to-refresh, toasts, Install app, the Reload row) without a
second implementation. Its slots, top to bottom and left to right:

- **The page header, on desktop only** — the Shell's exact compact row: a
  truncated 17px page/record name, an optional action slot, then the bell. It
  spans the full width above the rail, as the admin's does. `PartnerFrame`
  takes `title`, `headerAction` and `toolbar`; portal counts and status context
  live in that existing toolbar or page content, never as a persistent header
  subtitle. **On mobile there is no header on any portal page**
  (2026-08-26): the frame starts at the page's own toolbar, exactly as the
  Shell's `hideHeaderOnMobile` pages do, and the bell moves to the bottom bar.
  The rule is the frame's, not a per-page option — every portal page follows
  it. The one page a highlighted tab does not identify is the request page, so
  it puts the job name in its own toolbar row on mobile.
- **The notification bell** (`PartnerNotificationBell`) — in that header on
  desktop, and **pinned to the left of the bottom bar as *Alerts* on mobile**,
  where it takes the Shell's own second shape: icon over label in a 52px slot,
  popover opening upward from the left edge. Two sources: availability requests
  still at `new` — the page passes them as `alerts`, and clicking one opens
  that request's page; alert rows show the job name (or *Availability request*)
  without the internal availability-request ID — and a reply from Local Plant Supply the supplier hasn't
  opened the chat on. The frame fetches `?since=0&limit=1` for the latter —
  on load, whenever `/api/partner/:id/chat/events` pings, and on a 60s
  fallback (a flat 20s poll before 2026-08-26; the open chat's own fetch runs
  the same way with a 15s fallback) — and compares against the `readId` the plugin returns (its `portal`
  cursor — read state is server-side since 2026-08-24, same as the admin
  side). That peek poll deliberately omits `read=1`, because it runs while the
  chat is *closed*; the open panel's own poll carries it, so opening the panel
  is still what marks the conversation read. The chat rail and mobile Chat tab
  carry the same warn dot. There is no "mark all read": both kinds clear by being acted
  on. The bottom bar is now the Shell's shape exactly (2026-08-26, replacing a
  header-bell arrangement the portal had kept on both breakpoints): **Alerts
  pinned left, Chat pinned right**, and between them the independently
  scrollable strip of destinations sized to a third of the viewport each — so
  Requests / Orders / Closed show and ⋯ More scrolls in. On mobile the chat
  is a **page, not an overlay**: opening it pushes a history entry (the Shell's
  `useHistoryView`), so Back closes it and returns to the requests underneath.
  Its bottom-bar tabs behave as the Shell's do — the open chat holds the
  highlight, and tapping Requests or Orders returns to that page.
  The remembered open/closed state in `lps.portal.chat.v1` is therefore the
  *desktop* panel's — the mobile chat always opens closed and is navigated to.
- **The nav rail** on desktop (Availability Requests / Orders / Closed
  Requests, supplier identity at its head, then the frame's Dark mode /
  Install app / Reload and the portal's Settings / Log out at its
  foot). **Closed sits last**, added 2026-08-26: it is where work goes to
  rest, not somewhere a supplier starts. On mobile it joins the bottom bar's
  scrollable strip as *Closed*, which is what that strip was built to absorb —
  with three destinations plus ⋯ between the two pinned edges, three show at a
  time and More scrolls into view rather than being dropped.
  It opens **collapsed to icons**, as the admin Shell's rail does — the
  requests beside it are what a supplier came for — and the chevron at its
  foot expands it to labels; the choice is the frame's `lps.nav.open`, shared
  with the admin app on the same device. The rail is desktop-only; its three destinations
  are the bottom bar's scrollable strip on mobile.
- **The toolbar slot**, pinned under the header, then the page's own scroller
  — the frame hands children a fixed `overflow-hidden` box exactly as the
  Shell does, so each portal page owns its `min-h-0 flex-1 overflow-auto`
  container.
- **The chat column** docked right (see below).

**Log out** is real on both surfaces since sign-in landed (2026-08-30); it
drops `app_sid` and returns to `/login`. **Settings** went live the same day and
holds one thing — the supplier's own password (`/partner/:id/settings`). That is
the only portal setting they own: the username, which company the login sees and
whether it exists at all are ours, and live on the supplier page's Portal access
tab. It is reached from the rail's foot and mobile More rather than the nav, so
it is a `PartnerTab` that draws no destination of its own.

Three things to keep straight:

- **The portal is behind auth** (2026-08-30). It was deliberately open from
  2026-08-19, when suppliers were not app users and could not be; they have
  their own logins now (*Auth*, *Portal access*). A supplier signs in and sees
  **their own company** — the head branch their account hangs off, and every
  branch of it — and 404s on anyone else's, decided per request by
  `requirePartnerAccess` in `lib/partner-auth.ts`. The old scoping all still
  stands on top of it: `partnerSupplier()` refuses any supplier that is
  missing, inactive or not an LPS Partner; customer details cross only when the
  request was created with `share_customer_details`; and the portal PATCH can
  write exactly the four answer columns. The nav rail's **Supplier view**
  picker survives the change — an `admin` passes the check for every company,
  so it is now how the team looks at a portal without the supplier's password.
- **The ask is a snapshot.** A portal request's lines carry the name/size/
  quantity copied at share time — editing the job request afterwards does not
  rewrite the question the supplier is answering.
- **The portal has a chat with Local Plant Supply again** (2026-08-23; the
  first incarnation died with `supplier_messages`). It lives where the admin
  app's agent panel does: a column docked on the **right**, a 46px rail
  carrying the Local Plant Supply mark that opens the panel (fixed Chat action
  on mobile) — `PartnerChat` in `components/workspace/partner.tsx` — that polls
  `GET /api/partner/:id/chat` and posts the supplier's messages to
  rosie's supplier conversation (`Channel: portal`, sender `<Supplier> (portal)`),
  where they wake her thread of the same id (`supplier-<slug>`) to be routed
  to a job or main. It is **one conversation across all jobs** (2026-10-19): the supplier's
  own messages sit on the right, and everything from LPS — Chris or Rosie —
  on the left as *Local Plant Supply* with the leaf mark (the route strips team
  names and internal thread ids, `partnerChatMessages` in `lib/partner-chat.ts`).
  A message about a job carries **Ref Order: <job name>** linking the job's
  order with this company once one is placed, else **Ref AR: <job name>**
  linking its availability request (never a draft), else **Ref Job: <job
  name>** unlinked; a message not about a job carries none.
  Only its **transport** is portal-specific: the bubbles, transcript and
  composer are literally the agent panel's, shared through
  `components/workspace/chat-kit.tsx` (2026-08-24), so the two chats gain a
  feature at once. At render time, a portal-only text transform replaces
  internal request-reference variants in prose, link/action labels and code
  with *availability request* while preserving Markdown structure, hrefs and
  `ar:` targets; copied portal text is serialized token-by-token so safe URLs
  remain intact while action targets and unsafe destinations are omitted. The
  bell's unread-chat preview uses the same reference transform. Stored messages
  and the admin transcript remain unchanged.
  The supplier therefore gets the whole panel — markdown bubbles, the seekable voice-note player with its waveform, live recording
  meter and timer, specific microphone errors, paste-to-attach, optimistic
  sends, pull-to-refresh, **Load earlier messages** paging, starter
  suggestions, and top/latest jump controls — plus the panel's own chrome: a
  drag handle, **Full / 50% / 30%** width presets (Full is the viewport minus
  the nav rail) and the chevron that folds it back to the rail, with open
  state and width remembered in `lps.portal.chat.v1`. Saved Rosie colors and
  wallpapers remain intact. Portal-only contrast rules in `app/partner-chat.css`
  apply under `data-partner-chat` on the mobile overlay and desktop dock, not
  internal/party chats or other Markdown callers. Small sender/reference/time
  labels have solid card backings over artwork; incoming bubbles have a clearer
  neutral tint, dark-mode reference/action links use a lightened saved accent,
  and inputs/actions have explicit visible focus. Portal voice-note waveforms
  use proportional capped gaps and a 1px minimum bar width so all 40 seek bars
  stay visible beside Play/time at the 280px dock. The floating mobile identity
  pill keeps its position and shape with a solid readable card surface. Shared
  chat-kit data attributes are presentation hooks only; transport, audience,
  attribution, keyboard/send gates and appearance persistence are unchanged. The
  panel has no ⋯ menu: the supplier cannot clear a thread the team also reads.
  The paperclip stages allowlisted files and the mic records browser-
  native voice notes (`webm` on Chrome/Firefox, `m4a` on Safari); both remain
  chips until the supplier presses Send, and portal-visible image/audio/document replies render
  in place. Upload tickets are HMAC-bound to the supplier thread and file, and
  downloads require that exact file on a portal-visible transcript row.
  Unreferenced staging expires after an hour under a 20-file/100MB pending cap;
  one message is capped at 10 files/50MB. **Audience is enforced by the plugin**: the portal sees only portal-visible
  messages — what the supplier typed, and replies rosie sent with
  `webchat-cli --portal` — never the team's internal traffic on the same
  thread, which the admin panel does see (labeled by sender).
- **A portal Submit wakes rosie.** The submit route posts to her
  `supplier-events` webhook (`lib/notify-supplier-events.ts`), best-effort —
  the database write has already committed, so a down harness costs freshness,
  not data. The event lands on the job's `jr-<id>` thread (since 2026-10-19;
  the supplier's thread before). Recreated 2026-08-23 for
  rosie's restructure; the daisy-era `supplier_message` / `instruction` event
  kinds are gone with the portal chat.

Internal request references are also removed from the portal's LPS request
note and each line's LPS note (including its hover title) through the same
portal-only transform; shared admin `ARLineTable` callers leave that transform
unset and retain the original text. Portal search does not index the hidden
request ID.

The supplier's answer vocabulary (`available` / `partial_qty` / `can_order` /
`diff_size_sub` / `arriving_soon` / `unavailable`, NULL = unanswered) is
`lib/availability.ts`, reconciled with the design tones the same way
`lib/job-requests.ts` does for job requests. It grew from four on 2026-08-26
(migrations 0075/0076): `arriving_soon` was added, and `substitute` was renamed
**value and all** to `diff_size_qty_sub`, because the answer always covered a
different size or quantity as well as a different plant and the stored word
named a third of it. Neither addition brought a new colour: Diff Sz/Sub kept the `teal`
`substitute` had (purple since 2026-10-19, matching the portal), and `arriving_soon` takes `lime` — the one of the design's
six tones nothing else was using. Migration 0121 (2026-09-30) split
**Partial Qty** (`partial_qty`, yellow) out of Diff Sz/Qnty/Sub, relabelled
the rest **Diff Sz/Sub**, and moved Can Order to orange. A candidate is now one
fixed plant and size: Diff Sz/Sub names a substitute (`offered_candidate_id`
or `offer_description`) instead of rewriting the line's size and price. Since
0123 that happens on save: the asked line is stored Unavailable and the
substitute becomes Available (typed ones are created); the job line of a
selected original with a substitute on offer read Diff Sz/Sub (until 0137;
it now reads its candidate's Unavailable). Since
2026-09-30 the pickers no longer offer Diff Sz/Sub: it is **Unavailable/Sub**
plus a substitute (`AR_ANSWER_OPTIONS`), and an Unavailable line naming a
substitute *reads* Diff Sz/Sub (`arShownStatus`: pill, row tone, summary
strip). Since 2026-10-05 the pickers offer **Unavailable** and **Diff Sz/Sub**
as separate options again; the asked line is still stored as Unavailable
naming a substitute, and a line reading Diff Sz/Sub sits under that option
(`arAnswerOption`). Migration 0130 (2026-10-14) renamed the value
`diff_size_qty_sub` → `diff_size_sub` everywhere: the substitute itself is
stored Diff Sz/Sub (no longer Available), and the asked row **shows the
substitute's** status, quantity, price and reply (`withSubstituteAnswers` in
`lib/availability-queries.ts`), so counts, buckets and totals read the
substitute's answer. Since 2026-10-01 Can Order and Arriving Soon are one picker option,
**Can Order/Arriving Soon**, and the dialog asks which; both answers are
stored and shown as before. Picker order (2026-10-05): Available,
Unavailable, Diff Sz/Sub, Can Order/Arriving Soon, Partial Qty, Pending. Price cells
read as money (`$12.50`) until focused, then show the bare number to type, like the job
line price (`AnswerCell` `format`, 2026-10-21). The substitute stays linked to the request
(orders need it) but is not listed as its own row in any AR view
(`withoutSubstituteRows` in `lib/availability-queries.ts`, also in the line
counts). Buckets, filters and status cards still list Diff Sz/Sub for these
and older answers.

**What picking a status does** is per answer, and is the picker's whole
behaviour:

| Answer | On picking it |
|---|---|
| `available` | **No dialog.** Writes straight through; the database sets `available_quantity` to the demand — "all of it, as asked" needs nothing typed |
| `can_order` / `arriving_soon` (**Can Order/Arriving Soon**) | One picker option (2026-10-01). Dialog "Can Order / Arriving Soon": a **Can Order** / **Arriving Soon** radio choice (opens on the stored one, else Can Order), then a note — the ETA for Can Order; when it lands, and how many, for Arriving Soon. The trigger and pill still read the stored answer. Re-picking the option reopens the dialog, so a supplier can switch between the two |
| `partial_qty` | Dialog: the quantity you have (opens focused) and an optional note |
| `unavailable` (**Unavailable**) | **The Diff Sz / Sub dialog** (2026-10-07; it saved with no dialog from 2026-10-05). Picking Unavailable opens the same substitute pop-up as Diff Sz/Sub, on desktop and phone, and reopens it even when the line is already Unavailable. Its red **No Sub** saves plain Unavailable — quantity 0, price kept (0122), any earlier substitute and the supplier note cleared; choosing a substitute saves Diff Sz/Sub as below. |
| **Diff Sz/Sub** (`diff_size_sub`; the asked row stored `unavailable` + substitute) | Dialog "Diff Sz / Sub": only substitute radio options — no price, quantity or separate note field. One option per substitute (this supplier's other **priced** candidates on the line, `description · $price`, including ones hidden from LPS, `hide_from_lps`), plus **Something else** with a text field and a hint (typing selects it); its text is both the typed substitute and the supplier's note. A picked candidate writes a customer-ready note (`30 G NA, 45 G Live Oak only`). The first option is a red **No Sub** button (focused on open; the `--lps-tone-red-dot` red, since the dark theme's `--destructive` is brown-orange) that saves plain Unavailable at once — quantity 0, price kept, clearing any earlier substitute and note. **Submit** is disabled until a substitute is chosen. On save (0123/0124, 0130) the line is stored **Unavailable** and reads **Diff Sz/Sub**; the substitute is **Diff Sz/Sub** for the demand at its own candidate price and carries the note — a ticked one is that candidate (a hidden one becomes visible to LPS); a typed one is created on the spot, named with what was typed and unpriced, and Rosie tidies it after submission (price included). The row then shows the substitute's answer. Changing the substitute resets the earlier tag (and takes it off the request) or retires the earlier typed row. Re-picking Diff Sz/Sub reopens the dialog. A candidate already asked on the request can't be picked unless it is this row's substitute |

**The three supply answers take a price** (2026-08-30): saying you can order it
or that it is arriving is an offer, and an offer has a price, so the dialog
asks for it rather than sending the supplier back to the Price cell afterwards.
It is prefilled from whatever we already have on file for the line, and an
emptied box clears the column exactly as that cell does. `available` still asks
nothing, and `unavailable` is not an offer, so neither takes one. The dialog follows the browser's `visualViewport` and
scrolls internally, keeping the notes field and its buttons above mobile
keyboards. The wide editable line grid remains intentionally horizontal on
narrow screens.

The vocabulary is deliberately **not** the job-request item vocabulary: what a
supplier says about their stock and what we decide about a customer's line are
different judgments, joined only through `note_internal` by rosie.

**The request lifecycle** uses stored `new` → `processing` → `submitted` →
`closed`, displayed as New → Processing → Completed → Closed. The portal's
request work buckets represent the three open stages:

- **`new`** — waiting on the supplier. Publishing a Draft sets it, and so
  does LPS **reopening** a submitted or processing request
  (`reopen_availability_request`: the status pill's New, **Reopen and add** on
  the job page, or the All Jobs send dialog). Since 0130 nothing re-sets it
  automatically: adding lines needs a Draft or New request, so asking more of
  a supplier who has answered is that explicit reopen. `submitted_at` is left
  alone, so the button on it still reads *Re-Submit*.
- **`processing`** — they have written at least one answer since. Set by
  `updateARItem` on any line write **that came from the portal, public link, admin or Rosie recording a supplier reply**.
  The write and transition are atomic. Editing Completed returns Processing
  until another explicit submission.
- **`submitted` (Completed)** — they pressed Submit. Stamps `submitted_at`
  and wakes Rosie. Saving the final cell alone does not submit.
- **`closed`** — supplier edits are blocked. It leaves the working request
  buckets for `/partner/:id/closed`. Reopening the job leaves its ARs closed;
  an admin or Rosie must explicitly reopen each AR.

The three open states are multi-select work buckets on **By request**. Every
fresh visit starts with New + Processing selected and Completed excluded; the
choice stays only in mounted page state. There is no All button; selecting
all three buckets shows every open request, while their counts remain global as rows are filtered. Empty copy separately
names no open requests, no selected buckets, no matches in the selected
buckets, and a genuinely empty New/Processing queue. New, Processing and
Completed read the shared blue, orange and green tones (`--lps-tone-*`), as
order statuses do in `orders.tsx`: text, checks and borders are the tone's
`-fg`, which meets 4.5:1 against both the card and the tone's tint in both
themes (the test reads the values from `globals.css`). A refreshed `submitted` request therefore leaves the default
active view immediately and is visible when Completed is selected; a
reopened `new` request returns to the active view without any
status/API change.

The portal request page applies Submit/Re-Submit optimistically: its status
changes to Completed and its New-request notification disappears immediately.
Submission waits for queued line saves, disables further edits and duplicate
submits while pending, and keeps the optimistic status over concurrent Realtime
reads. A rejected write restores the latest saved request and keeps the typed
request note for retry. An accepted POST commits the local submitted state and
plays the received acknowledgement immediately; the canonical reload runs in
the background, so a slow or failed read cannot undo an accepted submission.
Navigation discards pending presentation updates from the previous request.

The home page's one exact `GET /api/partner/:id` loader feeds request rows,
global counts and alerts. Each read aborts the previous controller and carries
a monotonic generation guard, so a late response cannot overwrite a newer
submitted/reopened snapshot or a newer error state even if its fetch ignores
abort. Supplier changes and unmount abort and invalidate the active read. An
initial failure keeps the established unavailable-page behavior; a later
agent-reply or line-edit refresh failure keeps the last truthful snapshot and
shows a non-destructive **Retry** banner until one current refresh succeeds.

`components/workspace/partner.tsx` exports the card both lists draw
(`PartnerRequestCard`) along with `partnerRequestName` (defined in
`lib/partner-display.ts`, so the public availability page needn't bundle the
portal) / `partnerCustomerLabel`,
so the open list, the Closed page and the request page's own title cannot drift
apart.

## Request and order detail pages — shared layout (2026-10-07)

`/partner/:id/requests/:arId` and `/partner/:id/orders/:orderId` share one drawing:

- **Toolbar**: one row — icon-only back button (named for its destination, 44px), the line count, then Share / Print (requests) or Print (orders) and the bell. No Refresh button: both pages reload on live updates.
- **Details card** (`PartnerDetailHeader`, requests; an order's page uses its list card's one row instead, 2026-10-21): a two-row header — the name with the status pill at its right, then the mode (Pickup / Delivery / *Mode to be confirmed*) at the left and the date at the right, one such row per linked job on a combined request. Under it, three labelled rows: **Contact**, **Delivery address**, and **Note for supplier** where there is one (orders; a request's shared note is the editable *Note for this request* field below its lines, so it is not repeated here).
- **Counts strip** (`SummaryStrip` → the shared `DemandSummary`, also the job page's strip; Total items and Subtotal on top, status cells below, same on every breakpoint): each cell is equal-height, number centred with the status name centred below it; each cell toggles a highlighted status filter on the lines below (job Request items, AR editor, supplier AR page; not orders). Several cells can be on at once — the lines show any selected status — and turning the last one off shows every line again. Seven answers laid out 4 per row, 7 in one row from a 760px container.
- **Lines**: one bordered table with hairline rows, the answer's tone as a left bar and tint, and **our per-line note for supplier under the plant name** in smaller text (no Note-for-supplier column). The Note column is the supplier's own reply and the last column is **Line total** (both pages since 2026-10-21; on an order Qty and Unit price are read-only). On phones, the same card as the job request's (`LineCard` with `EditableText` cells and the job's tinted status pill): `Qty × Size Plant name`, then Status / Avail / Price in one row (no line total on any phone line card — AR, job item or order), values as formatted text (a price reads `$12.50`) that open into a field on a tap or click, with the ask note full-width under the plant row and the supplier reply below the cells, both text that opens an `EditableTextarea` on a tap (no More toggle). On the supplier portal qty, size, plant name and the ask are read-only; Avail and Price open the same way, and blur or Enter saves (2026-10-23 — they were always-open inputs from 2026-10-19). The job item and order item phone cards are the same `LineCard`; an order card's cells are Status / Price, as an order has no Avail (2026-10-27, see [Orders](orders.md)). The admin (LPS Ops) AR table keeps both notes in its notes column; the admin Job page's focused AR tab uses the portal drawing, so the ask is edited under the plant there.
- **Footer**: a centred, full-width (max 384px) primary button in the app's theme colour (`bg-primary`) — *Submit availability* / *Re-Submit availability*, or the order's *Acknowledge Received* / *Mark as Ready* / *Mark as Completed* / *Save N status changes*. With lines still unanswered, the first press names them ("3 lines still have no answer…") and the button becomes **Submit anyway**; that answer holds for a retry until the count changes. **Mark as Ready** likewise asks once (**Confirm: ready for <date>**) before it writes.
- **Print** (requests): the line's note for supplier prints under the plant name; the last column is **Notes**, carrying the supplier's reply and room to write one.

## By item — the portal's requests, grouped by plant

The portal home (`/partner/:id`) carries a **By request / By item** switch,
floating at the bottom centre of the page. Both draw the same open workload;
they differ in what a row is.

**By request** is one row per availability request under independently selectable New /
Processing / Completed work buckets (New + Processing selected on a fresh
visit). **By item** (redrawn 2026-08-30 to the Figma comp) is **one flat table,
one row per plant** — Demand · Size · Name · Date · Status · Avail. Qty · Your
Notes — the question the per-request list can't answer, because a plant is
spread across every request that wanted it. **Below 900px the table becomes
cards** (`ItemGroupCard`, 2026-10-07): the plant name over `Need N · size · M
requests`, a tap opening one block per request — its name, date and customer,
then labelled Status, Available qty and Supplier reply fields at full touch
size, the same shape as the request page's phone cards. Phones get no drag
(touch browsers fire no HTML5 drag events), so mapping a line to a catalogue
row stays a desktop action.

On phones the controls strip is compact: the three buckets share its width,
By item's answer tabs become a sideways-scrolling chip row, and under By status
the strip is not drawn at all. The view switch's buttons are 44px there.

**Each view has its own controls** in the same strip. By request uses its
multi-select request-lifecycle buckets. By item keeps single-choice tabs over
the **line's answer**: All ·
Available · Partial Qty · Unavailable · Diff Sz/Sub · Can Order · Arriving Soon · Pending, each
count in its accent, over lines rather than plants (a plant whose requests were
answered differently appears under each). Closed requests are absent from both,
as they are from the whole home page — they live at `./closed`.

A group is one of two things, and the difference is the point:

| Group | Keyed by | What it means |
|---|---|---|
| **Mapped** | `mapped_inventory_id` (`inv:<uuid>`) | A real row of this supplier's catalogue. Every line in it is the same offering at the same size, whatever each request typed. Headed by the **row's** name and size — the lines disagree, and none of them wins |
| **Unmapped** | the item name, lowercased with inner whitespace collapsed (`name:<key>`) | A shared spelling and nothing more. Its "size" is the distinct sizes actually asked (`15 G · 30 G`) — several sizes is the tell that the group is a spelling, not an offering |

**Mapped groups sort first**, then unmapped, each side alphabetical — they are
the drop targets, and interleaving them with the names they exist to absorb
would scatter the targets through the list. The old *your catalogue* /
*unmatched* tags and the per-plant answer strip are no longer drawn.

**Every plant row opens** — the chevron on the demand cell — into one sub-row
per request that asked for it, one or six alike: the request's name (a link to
its page, with our per-line note in italics beneath it), its date, the status picker, the available quantity and the
supplier's note. The plant row itself is a summary — summed demand, size, name
(with our per-line note under it when every ask carries the same one) and the
request count — and is never edited directly, so a supplier working plant by
plant reads and answers a single ask exactly as they do a sixth.

### The cells *are* the request page's cells

Not a look-alike: `LineStatusPicker` (the status pill, its answer dialog and
the Available/clear write-through rules) and `AnswerCell` (its own module,
`answer-cell.tsx`, so the public order page's price cell does not bundle the
whole table) are exported from `availability.tsx` and used by both the request page's `ARLineTable` and this
table. **A line is answered here exactly as it is answered on its own request's
page.** Price is not offered here — it belongs on the request page.

The leading column here is **Job**: the request's name (already redacted by
`redactPartnerRequestRefs`) with its **request status** pill beside it, and the
**customer** underneath. The customer is present only where that request
carries `share_customer_details` — `listPortalItemLines` doesn't even query a
customer for a request without it, so the disclosure rule holds at the read,
not just at the render. The name is a link to
`/partner/:id/requests/:arId`.

Each row belongs to a **different request**, so a write names its own: the
view's `onPatch` takes the whole line and PATCHes
`/api/partner/:id/requests/:arId`. Answering refetches both lists — the
group's counts and subtotal here, and the request cards behind the switch,
because the answer also moves that request to `processing`, which the Job
cell's own pill shows.

### Dragging a line onto a catalogue row

**The drag handle is the Job cell, not the whole row** — the rest of the row is
the request's editable cells, and a drag that started inside a text input would
fight selecting the text in it.

Dragging an ask by its job name onto a mapped group sets that line's
`mapped_inventory_id` to the group's row — `PATCH /api/partner/:id/requests/:arId` with
`{itemId, mappedInventoryId}`, then a refetch, because both the group it leaves
and the group it lands in are derived from the mapping. The receiving group is
kept open, so the line is visible where it landed.

Three rules, each with a reason:

- **Only a mapped group takes a drop.** An unmapped group has no key to write.
- **A group never takes a line it already holds** — that write is a no-op
  dressed as a change.
- **The catalogue row must belong to the same company** as the request's
  supplier, checked server-side through `head_branch_id`. A company's farms are
  one catalogue from the portal's point of view, so a cross-farm mapping within
  the company is a real answer; a mapping to somebody else's row is refused.

The write goes through `setARItemMapping()`, **not** `updateARItem()`'s
`changes` whitelist. Keeping them apart is what stops a mapping riding in on an
answer write or the reverse — `{"changes": {"mapped_inventory_id": …}}` is
still refused, as it always was.

**A supplier with nothing mapped has no drop targets** and cannot bootstrap the
view: mappings are otherwise seeded by rosie's supplier thread at share time
(`supplier-coordination` §2), and the app's own Availability request dialog
does not write them. Until one line is mapped, By item is a read-only
regrouping of the asks by name.

The read behind it is `listPortalItemLines()` →
`GET /api/partner/:id/items`, fetched only once By item is asked for. It
is deliberately **not** `AR_ITEM_COLUMNS`: that list is shared with the portal's
other reads, and the mapping rides on its own.

## By status — the portal's lines as a board

The home page's third view (2026-08-30, `supplier-status-board.tsx`), over
the same `GET /api/partner/:id/items` lines By item reads. **One card per
line status**, in picker order: Available · Partial Qty · Unavailable · Diff Sz/Sub ·
Can Order (`can_order`) · Arriving Soon · Pending. Pending includes lines
nobody has answered yet (`status` NULL). The comp's *Missing Price* card is not
drawn: it is not a status a line carries. Each card's top edge, dot and total take
the answer's accent; the total is the **quantity asked**, summed, as the comp's
numbers add up (106 = 28 + 25 + 23 + 12 + 10 + 8), not a line count.

From two columns up (`md`) a card is a fixed height and its plant list
scrolls inside it, so the grid's rows stay level however many plants one
answer holds. In one column (phones) a card is as tall as its plants — no
scroll inside the page's scroll — and an empty answer is just its header.

Inside a card the lines are grouped by plant exactly as By item groups them
(`groupSupplierItems`): total quantity, size, name — our per-line note in
italics under it when every ask carries the same one, else under each chip —
then **one chip per request** that asked — its name, as the portal prints it, and `×qty`. The
comp's `JR-6 ×2` chips name the job by its admin ref; the portal deliberately
never shows those, so the chip carries the request name instead.

**A status is set from the card**: each request's chip carries the line's
own `LineStatusPicker` — the same pill and the same answer dialog (price
included) the request page and By item use — and its **unit price** cell (`AnswerCell`, saved on blur), both
writing through the same scoped PATCH; the page re-reads, so the line moves to
the card its new answer names. Quantity and notes stay on the request page and
By item. The comp's *confirmed* mark and the italic
botanical names are not drawn; neither exists on a line.

## Companies and farms

**A company that operates at several sites is several `suppliers` rows, one per
location, tied together by `head_branch_id`** (schema doc). The database keeps
it that way and nothing here changes that: stock, prices and pickup are per
site, so `inventory`, `inventory_sources` and every contact link hang off the
*farm*. What changed is the **unit the app presents**, which is now the company
everywhere a supplier is listed:

| Surface | Unit | Where the farm still shows |
|---|---|---|
| `/suppliers` | One row per company, the head office's own record | Chevron expands the matching farms as full rows |
| `/plants` | One card per company | The **Branch** column on every plant row |
| `/suppliers/:id` on a head id | One page for the company | Tabs tag each entry with its farm; **Farms** edits them |
| `/suppliers/:id` on a farm id | That farm alone | It *is* the farm — with a link up to the company |

Three consequences are worth holding on to:

- **The head office is a row, not a rollup.** Its name, contacts, website and
  address on the Suppliers table are its own. Only `# Items` and the ingestion
  columns are company-wide, because a corporate office holds no stock and a row
  reading `0 items` would understate the company it stands for. Everde's head
  (supplier 32, the Houston office) therefore reports its 15 farms' 4,814 items
  and their latest drop, beside its own Houston address.
- **A company appears whenever any of its farms matched.** The head office is
  read from `suppliers` rather than picked out of the match set, so searching
  `bunnell` still presents *Everde Growers* — with `1 of 15 farms` on the
  expander and only EVERDE GROWERS - BUNNELL beneath it. The corollary: a
  city filter can leave a row whose own City column is not the city you picked.
- **Farms keep their own page.** Links from search point at the company, but
  every farm is still `/suppliers/<farm-id>`, reachable from the Farms tab, and
  that page is the same component with a scope of one.

`getSupplierProfile` is where the two cases meet. `head_branch_id` is never null
and never chains, so one equality on it is the whole company and a single-site
supplier is its own head — which makes "every location of this company" and
"this one farm" the same code path with a different id list, and makes the
1,313 single-site suppliers render exactly as they did before.

## Search

Every search box is **debounced** (`useDebouncedSearch` in
`lib/use-debounced.ts`, 300ms) before it hits `search_suppliers` /
`search_inventory` — the pgroonga RPCs are far too expensive to fire per
keystroke. The typed question and the serialized filter state debounce as one
value, so a keystroke and a filter click landing in the same window settle
together into a single request rather than on two independent timers. The page
number resets to 1 during render rather than in an effect, so a search started
from page 3 doesn't fetch the stale page before the reset lands. In-flight
responses are discarded if a newer query has started, so a slow early request
can't overwrite a later result.
Both list-page toolbars also expose searchable OR-within-field multiselects for
supplier type, city and state; fields combine with AND. They filter the rows in
the current server result set and share state with the corresponding table or
mobile filters, so clearing either surface clears the same constraint.

While a search is ongoing, the results area dims under an animated sprouting-
seedlings loader (`components/workspace/search-loader.tsx`; keyframes in
`globals.css`). The "searching" state starts on the first keystroke — it covers
the debounce window as well as the fetch — and each page anchors the overlay so
it never covers its search box: the list pages use the Shell content slot
(below the toolbar), the supplier profile a wrapper around the Inventory tab's
plant list. The caption under the seedlings rotates every 1.6s through a quirky
set per search flavour (`PLANT_SEARCH_LABELS` for the two plant searches,
`SUPPLIER_SEARCH_LABELS` for the suppliers list, `PHOTO_SEARCH_LABELS` for the
photo catalogue), all defined in `search-loader.tsx`.

The photo catalogue runs the same **unquoted discovery machinery** against
`search_plant_photos`, over a photo's name, size, caption, tags and notes — so
everything below about broad ranking, aliases and typed sizes applies there too,
and a search for `Chusan Palm` finds a photo catalogued as *Trachycarpus
fortunei*. Quoted literal mode belongs only to `search_inventory`; the photo
RPC does not implement it. The photo page also differs in one way that matters:
a blank query
**browses** `plant_photos` newest-first instead of showing a prompt, because a
photo catalogue with nothing typed into it is still something you want to look
at.

`search_inventory` returns nothing for an empty search (it has nothing to rank),
so browsing reads `inventory` directly — one filtered, ordered, `count: 'exact'`
paginated read, ordered by `updated_at` with `name` and `id` as tie-breakers so
paging cannot repeat or skip a row. A blank `q` therefore shows the catalogue
rather than an empty prompt, and its header count and page controls carry the
same meaning they do for a search.

The current Plant Search term is mirrored into the URL's `q` parameter and
saved in `localStorage` under `lps.plant-search.query.v1`. Returning to the page
restores the URL term first, then the saved term; results are fetched again so
the saved state cannot serve stale inventory. Clearing the search removes both
the URL parameter and saved term. Browser Back/Forward changes are restored via
`popstate`.

Wrapping the entire Plant Search term in straight double quotes switches the
same API to **literal substring mode**: `"Italian Cypress"` looks for those two
words, together and in that order, case-insensitively in the composed name,
common name, botanical name, or cultivar/variety/trade name. Size and notes do
not qualify a row in quoted mode. It does not normalize punctuation or spacing,
expand aliases, split terms,
accept partial tokens/spelling variations, or run fuzzy matching. `%`, `_` and
`\\` inside the quotes are literal characters rather than SQL pattern syntax;
apostrophes and inner double quotes are literal too. Outer whitespace and
whitespace just inside the pair are trimmed, but internal whitespace is
preserved. Empty/whitespace-only quoted terms return no rows. A one-sided quote
is not quoted mode and follows the unchanged broad-search path. All quoted hits
have equal relevance; Plant Search's normal caller ordering therefore shows the
newest first. Quotes are preserved in the URL and local storage. Use the
existing Size selector to constrain an identity-only quoted search by size.

Plant Search treats size as part of the natural question without showing a
permanent filter form. A query such as `15g Agave Americana` is parsed into the
plant-name query (`Agave Americana`) and an independent 15-gallon constraint, so
alias matching cannot silently ignore the size token. Explicit gallon spellings
(`15 G`, `15G`, `15 gallon`) and explicit box notation are normalized; the
supplier's original size text remains unchanged.

### How unquoted results are ranked

Unquoted `search_inventory` matches **names, size and notes** and ranks by
**IDF-weighted term coverage**: the query is split into groups (longest span
first, so `live oak` is one concept), each group is weighted by how rare it is
in the catalogue, and a row's `relevance` is the sum over the groups it matched,
each scaled by how well it matched (migration 0118): a whole word in the name or
size counts 1.0, a typo up to 0.6 by closeness, a word start (three letters or
more) or a long word inside another (`myrtle` in `Crapemyrtle`) 0.45, and a
whole word found only in the notes 0.4. Rare terms therefore dominate, and a
name match outranks a notes mention.

Matching is **typo tolerant** (`Mexican Sycamoer` finds the same top row as the
correct spelling) and **partial** (`sycamor` finds `sycamore`; a mid-word match
needs five letters, so `ash` no longer finds `Washington`). Word breaks are
forgiven for typed words of six letters or more (`feathergrass` finds "Mexican
Feather Grass"). Query terms are **expanded through aliases** before any of
this, so `Paperbark Maple` and `Acer griseum` return the same rows; an alias
counts only as its whole phrase.

**A size typed into the query ranks rather than filters.** `15g Live Oak` puts
15 G live oaks on top and keeps every other size below them; all of `15g`,
`15 gal` and `15 gallon` behave identically, as does `24 inch box`. The browser
does nothing for this — there is no longer a size chip, no `parseSizeQuery`, and
no client-side size test. Filtering by size is still the Size multiselect's job.

Retrieval is OR across groups, then trimmed: only rows scoring at least **half
the best row's relevance** come back, so a row matching just the size (`1 g`),
just a note, or just a word start when whole words matched elsewhere drops out.
`salvia greggii 1 g` returns ~100 rows, not 46,761. The count and the facets
therefore describe real matches. The app pages 300 at a time in relevance order, and orders
explicitly on the returned `relevance` column rather than relying on the
function's own `ORDER BY` surviving PostgREST's outer query.

### The plant identity is three columns

Since migration 0040 a row carries `common_name`, `botanical_name` and
`cultivar_variety_trade_name` separately, each holding only what the supplier's
source printed, and `inventory.name` is composed by the database as the
non-empty parts joined by ` - ` (`Forest Pansy Redbud - Cercis canadensis -
Forest Pansy`). The **Plant** column shows that composition and
is **read-only**; the three parts are the editable columns, and `WRITABLE.inventory`
in `lib/queries.ts` deliberately no longer lists `name` — a write there would be
overwritten by the database trigger. Common name and botanical name are in
`PLANT_HIDDEN` (the Full Name column already shows both), **Cultivar** is visible.

`cultivar_variety_trade_name` is the residual — everything the printed name
carries that the other two don't — so one cell can name a cultivar *and* a trade
name, comma-separated. The Cultivar column is therefore `multiValue`: its
multiselect offers **one option per name** rather than one per combination, and
a row matches if any of its names is selected, mirroring the database's
`cultivar_keys` array match.

Aliases live in `plant_aliases`. Any contiguous run of query words that names
an edge is expanded with the other side of it before matching, so
`Live oak Boardwalk` resolves through the `Live Oak` ↔ `Quercus virginiana`
edge. Edges are untyped and nothing restricts what a pair can reach, so a bad
pair is a data problem to retire rather than something the schema will contain.

Editing a part has to move the read-only Full Name column with it, or the table
shows an identity the database no longer holds until the next fetch, so
`plantEditPatch()` in `lib/columns.ts` recomposes it optimistically. It is a
mirror of the database's `compose_plant_name()` and the **database stays
authoritative** — the value is replaced by the real one on the next load. Both
save paths (Plant search and the profile's Inventory tab) go through it.

Beside it sits a **Cultivar: Any** selector, the same checkbox multiselect over
the individual cultivar and trade names the matched rows carry. Its labelled
field and chevron are one 44px open/closed toggle (`aria-expanded`); choosing
values applies immediately and leaves the list open for more choices, while the
trigger, outside dismissal and Escape close it and return focus to the trigger.
There is no Done/Apply step. It writes the `plants` table's own `cultivar`
column filter, so the toolbar control and the column header's filter are one
piece of state — set either and both show it.

When no size is typed, results add one compact **Size: Any** selector — a
checkbox-style multiselect (with its own search box) listing the **standardized
containers** (`inventory.size_std`) the matched rows carry: `15G`, `24" Box`,
`Trays`, `Field Grown`, `other`. One checkbox per real container, so `15 G`,
`15G`, `15 gal` and a 17" pot all answer the same box. The **Size column still
shows the supplier's own text** — the standard selects, the printed value is
what you read.

Options appear in the standard's own order (`lib/size-std.ts`), smallest
container to largest: the word grades `Bare Root`, `Liners`, `Plug`, `Trays`;
then pots, gallons and boxes each ascending **by number, not alphabetically** —
`4" Pot` before `8" Pot`, `2G` before `15G` before `100G`; then the field-dug
grades `B&B`, `Field Grown`, `Grow Bags`, `Root Pruned`; then `other` last.
Sorting the Size column follows the same order, which is why Size is one of the
few columns whose sort still runs in the browser — see *Where a sort runs*. All
three numbered families are open sets, so a bucket the database has never seen
before needs no app change.

The earlier scheme listed raw `size` text, which made every spelling its own
checkbox (2,783 supplier/size variants across the catalogue); the one before
that inferred gallon/box/caliper categories and silently dropped what it did not
recognize. The standard keeps the first version's honesty — nothing is dropped,
and an unbucketable container says `other` rather than being forced into a
neighbour — with one checkbox per container.

Selected sizes use OR logic (a row matching any selected size remains), are
mirrored as repeated URL `size` parameters, and are saved as a JSON array under
`lps.plant-search.size-choice.v3`. The two earlier keys are deleted on load —
their stored raw-text selections mean nothing against the buckets. Selections
that no longer exist in the current matches are dropped once results load. Size
filtering runs in SQL over the whole `search_inventory` result set, not over the
300-row page — the paragraph that said otherwise predated *Where a filter runs*
and was wrong from the day that moved.

Height, width and caliper retain the supplier's human-readable strings for
cells/cards and editing. Caliper is visible by default in both desktop plant
tables and remains the labelled **Cal** value on mobile Plant Search cards;
mobile supplier Inventory cards show the same raw value when present. Hidden numeric row values power range filters:
height is standardized in feet; width and caliper in inches. The header controls
show their units and accept inclusive min/max decimal bounds. These six bounds
are validated by `/api/plants` and passed into `search_inventory` before its
300-row page; supplier-profile bounds likewise run before 100-row pagination.
Null standardized values mean unknown/ambiguous and do not satisfy an active
range. Editing a human-readable dimension clears its numeric companion rather
than leaving a stale filter value; ingestion/review must repopulate the pair.
On mobile, price and dimension controls use a compact disclosure inside the
primary toolbar rather than a second results-summary filter card.

Mobile Plant search results arrive as a collapsed **company** shortlist: one
card per company, showing its match count and — where it has more than one site
— how many of its farms answered. Expanding a card lists the matching rows, each
naming its branch above the size line. Long plant names stay on one line and
scroll inside the name value rather than truncating or widening the card; touch
and trackpad panning work directly, and a focused row uses ←/→ or Home/End to
move the name. The underlined company name opens the company profile; the
chevron only discloses the rows.

## Contacts

**Every way of reaching a supplier lives in `contacts`**, joined to the supplier
through `supplier_contacts` — people and inboxes alike, including the company's
own main line. `suppliers` no longer has an `email` or `phone` column, so neither
table nor profile shows one, and the profile's quick call/email buttons resolve
through the contact list (primary first, then the first contact that has a
number or address).

Most contacts have **no name**, which is normal — see the schema doc. The
add/edit form marks name optional and a contact needs only one of name / email /
phone; cards fall back to the email, then the phone, for their heading.

**In the tables** — Suppliers and the Plant Search master rows carry
**Primary contact**, **Primary email**, **Primary phone** and **Other
contacts**. The first three are the supplier's `is_primary` contact and are
**read-only here**: a supplier row has no single contact id to write back to, so
there is nothing safe for an inline edit to target. "Other contacts" lists
everyone else as `Name [Title]`, showing the first with a `+N` counter, and the
whole cell deep-links to `?tab=contacts`.

### One contact, several suppliers

A contact is a person or inbox in its own right and can cover **several
locations** of a multi-location company (schema doc, `supplier_contacts`). The
supplier and the primary flag come from the link, not the person, so:

- `lib/queries.ts` reads `supplier_contacts` and embeds `contacts`, keeping the
  supplier and `is_primary` on the flattened `Contact` object the UI already
  expected. A contact shows up only when **both** the link and the person are
  active.
- A second lookup fills `also_at` — every other active location the same contact
  covers. The profile card prints it as "Also covers X, Y. Edits here change
  them there too", because the card edits the shared person.
- **Remove takes the contact off this supplier only.** It retires the link;
  the person is retired as well only when it was their last one.

`lib/queries.ts` fetches contacts in one batched `contactsBySupplier()` lookup
ordered `is_primary desc, contact_id asc`, then splits head from tail — so a
supplier with contacts but no flagged primary still shows its oldest one rather
than a blank. `search_suppliers` resolves the same three `primary_contact_*`
columns server-side for anything querying the RPC directly.

**On the profile** — a **Contacts** tab renders one card per contact: name,
title/department, `mailto:`/`tel:` links, notes, shared-location line, and a
**Primary** badge. Cards support edit in place, **Make primary**, and remove.
Adding uses the same form. On a company page the tab covers **every farm**, one
card per `supplier_contacts` link, each tagged with the location it is at — a
rep who covers three farms is three cards, because the primary flag and the
removal are per link and pretending otherwise would make either ambiguous. The
add form gains a farm picker for the same reason: a contact is always linked to
one location. Because promotion flips `is_primary` on two links at once, every
mutation re-reads the whole profile from `/api/suppliers/:id` instead of
patching local state. The profile's quick call/email actions fall back to the primary
contact when the supplier has no switchboard `phone`/`email`, and read from that
live list so a promotion is reflected immediately.

Field edits go through the generic `/api/rows` handler, which whitelists
`contacts` like any other table — those write the **person**, everywhere.
`/api/contacts` covers everything that is about the link: creating a contact
under a supplier, promotion — which must **demote the incumbent before
promoting**, or it trips the partial unique index that allows one active primary
per supplier — and removal, which needs the supplier as well as the contact.
`softDelete()` deliberately refuses `contacts`: there is no supplier-free way to
"delete" someone who works for three of them.

## Source files

Both the suppliers table's "Inventory sources" cell and the plants table's
"Source" cell link to the underlying file. Desktop supplier rows stay a uniform
48px regardless of source count. Because sources arrive newest-first, the cell
shows the latest filename as a direct signed-file link; when history exists, a
compact `+N` beside it deep-links to the supplier's existing Files tab via
`?tab=files`.

Every plant API/UI row derives **Ingested** from its active source's immutable
`inventory_sources.created_at`; manual/source-less rows and rows tied only to an
inactive source show blank. Supplier **Last ingestion** is the maximum timestamp
across that supplier's active sources. Search-RPC and `inventory` rows
already carry `source_id`, so `lib/queries.ts` resolves timestamps in one batched
source lookup rather than duplicating them into `inventory`. This timestamp is
when LPS ingested the source, **not** the source's printed/effective availability
date; the latter must be modeled separately rather than inferred from filenames.

The profile's **Files tab** lists the active sources of every location in
scope — tagged with the farm on a company page — and can retire one:
**Deactivate** confirms, then flips `is_active` on the file, which retires every
inventory row still attributed to it (`DELETE /api/rows` with
`table: 'inventory_sources'` → `deactivateSource`). The cascade itself is a
database trigger, not app code — `source_id` is a row's provenance, so a file
retired on its own would leave live rows with a blank **Ingested** date that
`search_inventory` also refuses to return. The app only counts the rows first,
so the toast can report how many went, and rows a later drop re-listed point at
that later source and are untouched. The Inventory tab refetches afterwards
rather than going on displaying what was just retired. Uploads still happen
through Daisy, not here.

`suppliers.website` is stored as a bare domain (`bluemountainnsy.com`), so
`websiteHref()` prefixes `https://` when linking.

Links point at `/api/file?path=…`, which signs on click and redirects.
**Signing on click, not at render time**, keeps the list endpoints cheap (a page
of suppliers can reference dozens of files) and means a link never expires while
the page sits open.

The path arrives from the browser, so `signedSourceUrl` checks it against
`inventory_sources.file_path` before signing — an endpoint that signs whatever
string it is handed is an oracle for every object in the `lps` bucket.

`file_path` is **not** stored consistently, and both quirks are handled:

- Most rows hold a bare object key.
- Some hold a **full public storage URL**. The object key is recovered from the
  URL so those get signed too, rather than handing out the public link. This
  also fixes the display name — before, they showed as
  `xyeyiqchadfszewztnrf.supabase.co` instead of the file name.
- Some hold a link to a supplier's own catalogue page. These pass through
  untouched and are labelled with the host.

## Writing

Inline edits **write to Supabase**. The Suppliers and Plant Search tables expose
only view-local row hiding in a rightmost action column, with a Restore bar; they
do not show delete buttons.
The supplier profile's Inventory tab still supports row delete as a **soft delete**
(`is_active = false`, the schema's convention), and so does each card on the
photo catalogue.

`softDelete()` accepts exactly three tables — `suppliers`, `inventory` and
`plant_photos` — and refuses everything else by name. `contacts` is excluded
because removing someone from one supplier retires the *link*, not the person
(`unlinkContact`), and `inventory_sources` because retiring a file has to take
its rows with it (`deactivateSource`). `plant_photos` needs neither: it cascades
in no direction, since a photo is evidence of what a plant looks like rather
than a claim about stock. Its **object stays in the bucket** — the row still
points at those bytes, deleting them is not reversible, and the confirmation
prompt says so instead of implying the file is gone.

**Job requests are the one hard delete**, and deliberately. A request and each
of its lines carry a trash button on `/requests`, and both issue a real
`DELETE` (`deleteJobRequest` / `deleteJobRequestItem`, `lib/job-request-queries.ts`)
rather than setting `is_active = false`.

Migration 0097 deletes the job’s lines, change history, Rosie transcript, and
orders and availability requests belonging exclusively to that job. Records
shared with other jobs are preserved; a shared availability ask closes and
revokes its public link when none of its remaining jobs is open. A durable
deletion marker lets webchat purge its cached conversation and agent session.
Deleting an individual line still removes its source association without
removing the supplier’s answer or ordered snapshots.

Neither delete leaves a changelog entry: `log_job_request_changes()` fires on
INSERT and UPDATE only, and the entries it already wrote are cascaded away with
the row they describe. There is no undo, which is why both confirms say so in
those words.

Editing happens in two places: table cells, and the **supplier profile's detail
card**. Profile values are inert by default: a deliberate pencil-icon edit
button (accessible label: **Edit supplier**) exposes `city`, `state` and the
three availability fields below; changes remain local
until one **Save changes** action writes only changed fields in one database
update. **Cancel** confirms before discarding a dirty draft, and reload/close
triggers the browser's unsaved-change warning. `website`, `Active items` and
`Last updated` are not editable — `website` isn't editable in the design either,
and the other two are derived.

`WRITABLE.plant_photos` is the photo half of that: the three name parts, size,
height/width/caliper, tags, caption and notes. `name` and the `*_key` columns
are absent because triggers derive them, and `supplier_id`, `captured_at` and
`source` are absent because attribution and provenance are cataloguing
decisions, not corrections someone makes in passing on the grid. Two rules ride
along with a photo edit: `tags` arrives as one comma-separated field and is
split into an array (the database trigger then lowercases, trims, dedupes and
sorts it, so there is one definition of a tag list and it is the database's),
and editing `size` **nulls `size_std`** — the same "a hand-edited source string
invalidates its standardized companion" rule that height/width/caliper follow on
`inventory`. The panel says so before you save, because the visible consequence
is that the photo leaves the Size filter until Daisy sets the bucket again.

`composePlantName()` in `lib/columns.ts` mirrors the database's
`compose_plant_name()` so an edited card can show its new derived `name`
immediately; the photo grid mirrors the tag normalization for the same reason.
Both are one line in each language, like `plantKey()` — keep them in step.

The table/column pair is checked against a whitelist in `lib/queries.ts`
(`WRITABLE`), **server-side**. The request body comes from the browser, so a
client asking to write `is_active`, or a column on `users`, must be refused
regardless of what the UI would send. `unit_price` is nullable: clearing an
inventory price writes `NULL`, and every table/card renders that as **Price
unavailable** rather than `$0.00`. Numeric sorting keeps missing values last in
both directions, and active min/max filters exclude missing values.

Deleting is genuinely destructive in effect: a soft-deleted row disappears from
`search_inventory` (or `search_plant_photos`) and from what the agents see. The
photo grid drops the deleted card locally and decrements its total rather than
refetching, which would pull a photo up from the next page and shift everything
the user was looking at.

### Optimistic updates

Every edit, toggle, status change and delete in the main app and the partner
portal shows **before** the server answers. A refused write puts the old value
back and says why (a toast, or the surface's own error line). The server stays
the source of truth: wherever a page already re-read after a write, it still
does, and that read replaces the optimistic copy.

Three patterns are used:

- **Pending value in the control**: `EditableText`, `EditableTextarea`
  (`editable.tsx`), the job `StatusPill`, the customer Type select and the
  focused job name editor hold the committed value in local `pending` state.
  It clears when the parent's refetched `value` arrives, so a slow refetch
  causes no flicker back to the old value, or when the write fails.
- **Patch local state, restore on failure**: the list pages (Suppliers, Plant
  search, Photos, Customers, Jobs), the supplier profile (plant cells, deletes,
  file retirement, detail card, notes, contacts, AR status), the partner
  By-item view and the partner AR page apply the change to the state they
  render, then undo it from a snapshot or by re-reading if the write is
  refused. A failed supplier detail-card or contact save reopens its editor
  with the draft intact; a failed job delete reopens its dialog with the error.
- **Overlay until settled**: `OrderCard` overlays in-flight order and line
  writes on the `order` prop and drops each one once its write and the refetch
  after it settle. `useAREditor` applies status, note, customer-sharing and line
  edits to its `ar` at once; its serialized write queue already re-reads after
  every write, success or failure. `withLineChanges()` (`lib/availability.ts`)
  maps a line write's snake_case columns onto the item's camelCase fields for
  the AR editor and both partner answer paths.

These stay **pessimistic** on purpose: anything that needs a server-made value
before it can be shown (creating jobs, lines, orders, contacts, availability
requests or partner logins, making a link public, uploads, sign-in), and dialogs
whose contract is to keep the entered details on failure (order
acknowledgement / fulfilment details, order line status notes). The public
availability link page and agent artifact sharing are outside the two portals
and unchanged.

### Row tinting and selection (job requests)

The line table follows the design's tint rule: a row's background is its status
pill's colour, thinned to about a third (`toneTint` in `lib/job-requests.ts`,
via `color-mix` so one rule lives in one place rather than doubling every tone
token with a faded twin). **Selected** overrides it, and nothing else does.

A needs-input amber used to sit between the two. It went on 2026-08-18 along
with the flag itself (below): once "waiting on somebody" became "any status but
`available`", the override painted nearly every row one colour and buried the
statuses it was drawn on top of.

Selection is over **line items**, not requests, and only over the lines the
filters let through. Every checkbox is on a line, in the table a card opens: the
card head carried a tri-state one until 2026-08-18, and the per-card column
header still has none, since either would only ever mean "all of them". When a
filter, a search or a page turn changes what came back, anything that fell out
of view leaves the selection with it — otherwise "12 selected" would act on rows
nobody has in front of them.

The bar that appears with a selection carries **Set status**, **Flag for
input** and **Clear flag**: writes this app already owns, applied per line
through `PATCH /api/rows` with `Promise.allSettled`, so one rejected line does
not hide the ones that went through and the toast can name the failures. The
design's Email quote / Text quote / PDF quote / Place order / Send availability
request are absent — see the deviations table.

### Job requests

Customer demand is stored in `job_request_items.demanded_quantity`; NULL means
unspecified. The Demand editor writes this column, and job reads map it to the
existing UI `quantity` property. Availability snapshots and remaining-order
calculations read the same demand. Order rows keep their own `quantity` (since
0146 there is no allocation table). Migration `0110_job_item_demanded_quantity.sql` preserves
existing values, generated totals and audit history.

`job_requests` and `job_request_items` are written through the same
`PATCH /api/rows` whitelist as every other table, with generated totals held back.
Since 0130 a job line is read through the `job_lines` view: the line's own
name, requested size, demand and internal note, plus the **selected
candidate's** size, price, available quantity, status and customer note, and
`total` = demand × price. The line's own `unit_price`, `total`, `status`,
`available_quantity` and `note_for_customer` columns are no longer read or
written (0131 drops them); edits of those four values go to `update_job_line`,
which writes the selected candidate, in a request of their own. **Size** and
**name** are the customer's ask: the job table shows `requested_size` and the
line's name whatever is selected (`JobRequestItem.size` is the requested size),
and an edit is a plain `job_request_items` update with demand and the internal
note — it never writes a candidate (0144), and `update_job_line` refuses
size and name since 0145. An emptied size is
NULL; an emptied name is refused. A request mixing the two groups is refused.

Job-line **unit-price cells** use the local `JobLinePrice` editor. A save still
writes through `PATCH /api/rows`; the cell then reads the whole saved job from
`GET /api/requests/<id>` and settles to that line's authoritative price, even
if it is unchanged. Entering 0 saves and reads back as $0.00 (0143); clearing
the cell leaves the line unpriced. Saving and refreshing are
labelled separately. A failed write or read retains an explicit error draft
with Retry price; a read retry does not repeat a successful write. A newer
open draft stays intact while the preceding save settles, newer saves invalidate
older settlement, and row or selection changes isolate their editors. This
cell's writes remain ordered. Other `EditableText` consumers, persisted price
semantics, totals and quote completeness are unchanged. This display correction
does not enable intentional-zero quotes.

- **`total`** is computed by `job_lines` and never written; the whitelist
  refuses it with a sentence.
- **`note_for_customer`** combines concise customer sourcing requirements with
  supported customer-facing sourcing outcomes. It is editable in its note column;
  exclude spacing, layout and unrelated details. Preserve current requirements
  when adding an outcome. On a job line it is an override on the selected
  candidate: NULL follows the supplier's reply (`note_from_supplier`), an empty
  note is a deliberate blank, text replaces the reply. `PATCH /api/rows` passes
  a JSON `null` through. While there is an override and a supplier's note, an
  inline **!** just before the note text shows the supplier's note on hover.

The Job request line table truncates both note previews to one line. Hover shows
full source text; clicking opens the full note and editor, with sourcing Markdown
and its links rendered in the popover. Notes do not increase row height.
Tab moves to the next cell and Shift+Tab to the previous cell, continuing across
rows and leaving the table at either end. Text cells open for editing on arrival;
blur saves the previous edit. The calculated Total is focusable but read-only.

**`note_internal` is free text, edited in place** — changed 2026-08-18, on
Chris's instruction. It had been an append-only log reached only through
`appendNote`, on the reasoning that a grid cell overwrites and an overwrite
would destroy the history. What it is actually used for is a **working sheet**:
one terse current line per supplier (`APS: 3 G: $26/unit · AR-42 Processing`)
plus one overall row summary (`Row: Selected APS · 3 G · $26/unit`). Include
name/variant when it distinguishes an offer, current availability or a relevant
alternative, and the pending decision when no supplier is selected. Replace
superseded updates rather than growing an event history. It is therefore an ordinary writable column,
edited as a textarea in the request drawer and in each line's Internal note
popover, and the history it used to carry itself is in `job_request_changelog`,
which records the before and after of every write anyway.

`customers.communication_notes` was the last column that still worked that way,
and it is **gone** — dropped 2026-08-25 by migration 0073, empty on every row.
The customer's Rosie thread is the contact history now, exactly as the supplier
side went in 0063/0066, and the app opens it from the customer page's header
button. `appendNote`, the `APPENDABLE` list, `POST /api/rows` and the
`AppendNote` control went with it; **`lib/notes.ts`** keeps only the reader
half (`parseEntries` / `shortStamp`), which the job-request note columns still
use.

**The column is `note_internal`.** It was `internal_notes` until migration
0061 renamed it on both job-request tables (`inventory.internal_notes` is
daisy's, means something else, and keeps its name). "Internal" said who may read
it, which the other two columns already imply by contrast; the name now says
what goes in it. The UI calls it **Internal note** in the drawer, the line table
header and the popover.

**A customer-facing note names a change; it does not argue for it.**
`note_for_customer` says what the customer is being offered — "Substituting 3 G for
the 5 G requested", "Quoting 12 rather than 10" — and never the reason, which is
a `note_internal` line. Sizes are written `XX G` in both note columns; only the
item's own `size` keeps the customer's verbatim wording.

**A request has a name.** `job_requests.name` (migration 0059) is what the job
is called out loud — "Riverbend patio planting" — written by Rosie at intake
and editable from the card head. It is nullable and never generated: an unnamed
request shows nothing there, because the `JR-<id>` beside it is already its
name, and a stand-in like "Request 12" would read as though somebody had named
it.

**Plant status uses seven choices.** Job lines offer Available, Partial Qty,
Unavailable, Diff Sz/Sub, Can Order, Arriving Soon and Pending. Migration
0083 retains existing stored values and adds `need_to_order` and
`arriving_soon`; 0121 adds `partial_qty`. Since 0137 a line's status is its selected
candidate's as stored (`job_lines.candidate_status`, mapped by `itemStatusOf`
in `lib/job-requests.ts`): unanswered is Pending, Can Order is Need to Order,
everything else as stored. The jobs-list status filter matches the same
column (`candidateStatusFilter`). Whether the candidate is the original no
longer matters (0130–0136 read a non-original or an Unavailable original
offering a substitute as Diff Sz/Sub, and avail short of demand as Partial
Qty; `alternative_proposed` is retired). An Available line short of demand is
tinted yellow like Partial Qty; quantity cells show the shortfall. The seven
summary buckets use the same labels and order. Parent sales stages use the separate lifecycle
described above, with all three working stages included in active-job views.

**"Needs input" is gone entirely** — migration 0060 dropped
`needs_attention` from both tables, and every trace of it went with the column:
the pill on a line, the badge on a card and on a customer's request list, the
amber row tint, the toolbar count and filter, the selection bar's Flag / Clear
buttons, the `needs=1` API parameter, and the sort that floated flagged
requests to the top.

It went in stages that each made the next one obvious. The flag started as one
of two signals — the hand-set column, plus "availability unanswered"
(`available_quantity IS NULL`). That second half broke when Rosie stopped
filling `available_quantity` (it is a human call, so her skill forbids it), and
was replaced by "any status but `available`". That derivation was right, and it
showed the flag up for what it was: **every** line not yet `available` is
waiting on somebody, so the marker appeared on nearly every row and
distinguished nothing — while the status pill next to it said the same thing in
a more specific word.

What says a line needs a person now is its **status** — `diff_size_sub`
is a substitution waiting on approval, `unavailable` is a decision somebody has
to make, `pending` is unanswered, and only `available` needs no one — and
**`note_internal`** says why. That was always the better record; the flag was a
second, blunter copy of it.

`status` (a job line's, written to its selected candidate) is checked against its vocabulary **server-side**
(`ENUMS` in `lib/queries.ts`), so a bad value comes back naming the allowed ones
rather than as a constraint-violation string, and the server does not depend on
the dropdown having been honest. `demanded_quantity > 0` and `available_quantity >= 0`
are likewise reported as sentences.

Every write — from this app or from Rosie — is recorded by the
`job_request_changelog` trigger with the actor that made it: `service_role` for
the app, `rosie` for the agent (which sets the `app.actor` GUC). Nothing in the
write path has to cooperate for that to happen, which is the point of it being
a trigger. A line's price, status, availability and customer note live on its
candidates since 0130, and `candidates` has no changelog trigger yet, so the
History panel no longer shows changes to them.

## Availability source

Three Suppliers columns record how a supplier's availability reaches us, all
editable in the table and on the profile:

| Column | Cell | Notes |
|---|---|---|
| **Availability source** | `select` | `Email` or `Hosted`, from `AVAILABILITY_SOURCE_TYPES` in `lib/columns.ts`. Multiselect filter |
| **Update every (days)** | number | Whole days (7 = weekly). Range filter; rejected server-side if fractional, since the column is an integer |
| **Hosted availability** | `url` | The page a hosted list lives on. Opens through `websiteHref()`, so a bare domain still links |

**Blank is a to-do, not a fact.** Every supplier starts null, and null means
nobody has established how that supplier publishes — the dropdown's leading
blank option clears back to it.

`kind: 'select'` was added to `Cell` for this: it renders a dropdown of
`col.options` in edit mode and **saves on change**, passing the new value to
`commit()` directly because `draft` state has not updated yet at that point in
the event. The hosted URL is the one editable `url` cell — clicking the text
must still open the page, so its editor hangs off a pencil button that appears
on row hover rather than off the cell.

## Column layout

`lib/table-config.ts` holds order, visibility and widths per table
(`suppliers`, `plantMaster`, `plants`) and persists all three to `localStorage`
under `lps.tables.v1`, so a reload keeps the arrangement. Sorting and
per-column filters are deliberately **not** persisted — they describe the
current question, not the layout. The `plants` config is shared, so a column
change on Plant search also applies to the profile's Inventory tab, exactly as
in the design. Caliper is now visible in the default layout. A one-time
`lps.tables.v1.cal-visible` migration removes only `cal` from a saved
`plants.hidden` list, preserving every other saved order, width and visibility
preference. The Suppliers **Category** column defaults to and cannot be resized
below 160px, which accommodates the normal one-line **Wholesale Supplier**
badge plus its cell padding and a gap before State. A one-time
`lps.tables.v1.suppliers-category-min-width-v1` migration raises only an
undersized saved Category width; wider saved widths, order, visibility and every
other width remain untouched. Stored table configs are normalized on every
load, independently of migration markers: malformed order/hidden/width shapes
fall back safely while valid entries survive. The 160px render-time floor
applies only to this explicitly constrained column; legacy saved widths below
the interactive 64px resize floor remain unchanged for every other column.
Badge wrappers contain unexpected oversized content within their own cell,
while the badges themselves remain content-sized and the table keeps its
existing horizontal overflow.

`FilterControl` renders one of four widgets per column (`text`, `range`,
`multiselect`, `none`). The multiselect dropdown opens with a **search box**
over its values — the option list is built from the rows on screen, so columns
like Size or City routinely list hundreds of values and scrolling for one is
hopeless. The search narrows the list only; selections outside the current
search stay selected.

Two things about the implementation are easy to break:

- **Persistence is written from an effect, guarded by a `hydrated` ref.** The
  stored layout is read *after* mount (so hydration matches the server render).
  Without the guard, the first render would write the defaults straight over
  whatever was stored and no layout would ever survive a reload.
- **The whole header cell is the drag drop-target**, not the resize handle. The
  handle is 6px wide; hanging `onDrop` off it made reordering nearly impossible
  to trigger.

`reorder()` inserts **after** the target when dragging rightward and **before**
it when dragging leftward. The design's original always inserted before, which
makes dropping a column on its immediate right-hand neighbour a silent no-op —
the most common "nudge this one over" gesture. `lib/table-config.check.mjs`
(`node lib/table-config.check.mjs`) locks in both directions of adjacent swap.

## Agent chat

`components/workspace/chat.tsx` is the panel from the design, wired to real
agents through the harness's [`webchat`](../harness/plugin-webchat.md) plugin.
Its parts live in `components/workspace/chat-kit.tsx` — markdown bubbles, the
voice-note player, attachments, `useComposer` (upload/record/paste), the
scrolling `Transcript`, the `Composer` and the width `SizePill`. The kit is
transport-agnostic: the caller passes the file href, the upload call, the
empty state and the copy, which is how the supplier portal's chat column
(*Supplier portal*) is the same chat as this one. Every text message carries a
one-click copy button beside its timestamp. Both use `text-muted-foreground`
(AA on the panel and on every accent-tinted bubble in both themes, still a step
quieter than message text); on coarse pointers the 24px button gains an
invisible 44×44 hit area without growing the icon or the row. In the admin chat it copies the
message's source plain text with normalized line breaks. The supplier portal
serializes the rendered, redacted text instead: Markdown labels become plain
text, safe HTTP destinations remain in parentheses, action targets and any URL
whose destination itself contains a hidden request reference are omitted rather
than exposed or rewritten. The button briefly changes to a check on success.
HTTP(S) addresses are clickable whether written as ordinary text or Markdown;
a Markdown label and destination split across adjacent lines are joined for
rendering while copy keeps the original text. Long labels, URLs and inline code
wrap inside the bubble, and the transcript never scrolls horizontally. Fenced
blocks (including labelled fences such as ` ```text ` and ` ```code `) render
as scrollable code panels with the label in their header and a dedicated,
always-visible Copy button that confirms when the block is on the clipboard.
The special `thread:` and `ar:` action links retain their button behavior.
Since 2026-08-23 the panel is **per-thread**: each agent opens on its default
thread — the one its Telegram uses (Daisy's `main`, Nova's `default`) — so
panel and Telegram stay one conversation there, and rosie's and daisy's
headers carry a **Conversations** button opening the thread picker: a search
bar over cards split into General (main only) and then, for rosie, Job
requests, Suppliers and Customers, and for daisy (2026-08-25) Suppliers alone
— jobs and customers are not hers. Built from `GET /api/chat-directory?agent=`
merged with the plugin's `api/threads` (last activity). Only those categories
are offered (Bhoumik, 2026-08-23) — working threads like `router`, daisy's
per-email threads or task threads stay reachable through deep links, never the
picker. Nova has no picker: it works on one thread. Switching agents resets
the panel to `main`.

**A job's chat has tabs** (2026-10-19). On a `jr-<id>` thread — the job
page's docked panel, the Rosie avatar on a job card, a job in the picker — a
strip of capsules under the header (above the composer on mobile) offers, in
order, **Rosie** (the job's own thread, Chris and Rosie), the customer, and one
tab per supplier the job has an AR or open order with (or a message tagged with
it). Every capsule is the same small width (2026-10-21): Rosie's avatar, a
**C** circle and the customer's name, or an **S** circle and the supplier's
`suppliers.short_name` (APS) when one is set, else its name — cut to its first
5 letters in a fixed `5.5ch` slot; the tooltip, accessible name and composer
use the full name.
The parties come from `POST /api/requests/:id/chat-parties` (`lib/job-chat.ts`), which
mints a missing `rosie_thread_id` the same guarded way the customer chat
button does, and re-reads on job changes (`useJobUpdates`). A party tab is that
supplier's or customer's one shared conversation, the same thread id the
portal reads, as the party sees it (the plugin serves only their messages and
LPS's party-visible ones), with their whole history across jobs; messages
about another job are tagged `JR-<id>`. A **JR-<id> only** switch on the line
above the composer narrows it to the job (`api/messages?job=<id>`); it re-reads
the tab without losing the draft and stays set when Chris moves between tabs
(not across reloads).
Since 2026-10-21 everything typed in a party tab is for the party — no `@`
needed. The destination carries `jobId`, so a send posts `jobRequestId`; the
plugin stores it party-visible, tagged with the job, and tells Rosie silently
on the party's own thread only (`plugin-webchat.md`, *Party conversations*). An LPS Partner
reads it in their portal as *Local Plant Supply*; a customer or non-partner
supplier has no portal, so it is only recorded. A line above the composer says
which. Chris's internal requests to Rosie go in the Rosie tab. The job
page's supplier and customer chat links open these tabs (`openChat({job})`).
The ⋯ *Clear conversation* menu is hidden on supplier and customer
conversations, which every job and the portal share.

**Who wrote each bubble.** `Transcript` takes an `identify(message)` that
places and labels it: the team's messages (`senderKind: 'lps'`, older rows by
`role`/`portal`) on the right with the sender's initials; the agent on the left
with its avatar; a supplier or customer on the left with their initials. The
name shows where the speaker changes. On a Rosie supplier or customer
conversation LPS is one side: the team's and Rosie's messages are both on the
right, each tagged with its writer (*Chris*, *Rosie*), and the party is on the
left. A message about another job than the open tab's (or any job, in the
whole conversation from the picker) also shows its `JR-<id>`.

**A job and its thread share one name.** `jr-<id>`'s title is the job
request's own name, so the rename is one write wherever it starts. Rosie stores
new names as `Customer/Company Name | Slug` under her job-intake skill. Headers,
inbox identity labels and HTML quotes keep that full name intact without adding
the matched customer/company again; legacy site-only names retain their separate
customer display. The mobile header omits a secondary identity line when it
would repeat the job name. On
`/requests`, renaming a job's card head dispatches `lps:rename-thread`
(`lib/chat-bus.ts`), which retitles a panel already sitting on that thread —
the picker itself needs no telling, since it rereads the directory from the
database each time it opens. The picker renames in the other direction: every
**Job requests** card carries a pencil that edits the title in place and
writes `job_requests.name` through the same whitelisted `PATCH /api/rows` the
Job Requests page uses, so the card, the page and the panel header all follow.
An emptied field abandons rather than unnaming the job — unnaming is not what
the pencil is for. Only job cards are renamable: a supplier's or customer's
thread is titled from their own record.

**Unread tracking and the bell.** `lib/chat-notifications.tsx` sweeps
`GET /api/chat/threads` once (and again on every stream reconnect, plus a 60s
fallback), then keeps its rows current from **`/api/chat/events`** — the app
server's relay of Supabase Realtime on the `threads` table, one event per
change (2026-08-26; a 15s poll of each agent's `api/threads` before that). A
thread is unread when `lastId > readId`; a closed thread (its job is done)
drops out on its event. Since 2026-08-24 **`readId` is plugin state**, not this
browser's — it lives on the `threads` row ([Read state](../harness/plugin-webchat.md#read-state)),
so opening a thread on a phone clears its dot on the desktop. The open panel's
poll carries `read=1`, which is what marks it; the plugin also marks your own
`api/send`, so nothing here special-cases the operator's own messages any
more. `markThreadRead` survives as an in-memory latency shim — the panel calls
it after each poll so a dot clears now rather than when the event comes back — and
"Mark all read" is the one path that marks without opening, through
`POST /api/chat/<agent>/read`. One provider (mounted by the Shell) feeds warn-colored
dots on the rail and header agent avatars, the thread picker's cards, the
mobile Agents list and tab — and the **notification bell** in the page
header: a badge count, and a popover listing unread threads (sender, thread,
snippet, time; "Mark all read"); clicking one opens that agent's panel on
that thread. The popover also carries an **agent filter** — a chip row of
*All* plus each chat agent with its unread count — narrowing the list to one
agent. It is a view, not a scope: the badge keeps counting every agent, and
while a chip is active the action reads "Mark read" and marks only the agent
shown, since marking away what is hidden would be a surprise. The filter
resets when the popover closes.

**Deep links.** Anything in the workspace can open the panel on a thread via
`lib/chat-bus.ts` (`openChat` → a window event `AgentChat` and the Shell
listen to): the Rosie avatar on a job-request card (`jr-<id>`), the chat icon
on a supplier chip or the customer line, or an agent-rendered button. Two
link schemes in agent markdown render as **action buttons** in bubbles:
`[…](thread:<id>)` switches the panel to that thread, `[…](ar:<id>)` opens the
availability-request drawer (`components/workspace/ar-drawer.tsx`, loaded
lazily by the Shell and opened from anywhere via `openAvailabilityRequest`).

**The drawer is editable**, unlike the supplier profile's read-only copy of the
same table: the admin answers lines on the supplier's behalf — suppliers reply
by phone and email as often as through their portal — with the same status
picker, answer pop-up and per-cell saves the portal has, and moves the
request's own status from the pill (New / Processing / Completed / Closed). Every write is
one `PATCH /api/availability-requests/:id` followed by a re-read, because the
line totals and the subtotal are derived. A **Save** button at the foot mirrors
the portal's: the answers are already written line by line, so what it does is
mark the whole request **Completed** and date it. A **closed** request is
read-only, loses the button and says so; reopening it from the pill is what
unlocks it, since `updateARItem` refuses a closed request whichever side is
writing. Admin-entered supplier answers also wake Rosie: partial saves emit
`availability_updated`, and completion emits `availability_submitted` on the
AR's job thread.

`submitted_at` follows the status wherever it is set, not just on the portal's
submit route: moving a request to `submitted` stamps it, moving it back to
Draft clears it, and reopening it as `new` (`reopen_availability_request`,
0130) or `closed` leaves it alone as history.

`lib/agents.ts` is the single list of agents (id, display name, role, avatar,
profile banner, empty-state intro, starter suggestions). It drives the
collapsed rail, the mobile tab, the `/agents` page, the settings tabs and the
`/api/chat/<id>/…` allowlist.

**Two flags mark an agent as unchattable, and they mean different things.**
`upcoming: true` is *not wired up yet*; `reachOn: '<channel>'` names where the
agent actually lives when it is not this panel. Either way the UI disables the
entry and the chat proxy answers 404; `chatBlockedReason(agent)` returns the
label to show in place of Online/Active ("Coming soon" / "On Telegram") and
`null` when the agent is chattable, and `CHAT_AGENTS` is the chattable subset
that drives the active agent, the saved selection and notification polling.

Daisy, Rosie and Nova are chattable. **Lily carries `reachOn: 'Telegram'`** —
she has no `webchat` plugin at all and is reached in her Telegram group, so she
appears on the `/agents` page and gets her own settings tab, but her rail and
selector entries are disabled and her card reads "On Telegram" without the
`upcoming` desaturation, because she is live, not pending. Her settings tab
omits the **Appearance** panel: chat theme and wallpaper style a panel
conversation she does not have (and `chat-appearance.ts` keys its stored
preferences to the three chat agents). No agent carries `upcoming` today;
activating one would be removing the flag plus `mkdir
harness/agents/<id>/plugins/webchat` (with a `config.json` naming the thread its
Telegram routes to — see the plugin doc), which is also what Lily would need to
become chattable.
On desktop, switching agents happens from the collapsed rail, or — with the
panel docked — from the other agents' avatars at the right of its header, which
swap the conversation in place. On mobile it is the tab bar's agent tabs
(`shell.tsx` owns the mobile selection and passes it down as `mobileAgentId`),
so the sheet's header carries the back button instead.

**Transport.** `app/api/chat/[...path]/route.ts` forwards to
`<harness>/webhook/<agent>/webchat/api/<action>`, attaching the app's bearer +
`X-App-User` and streaming the body (uploads need `duplex: 'half'`). The
browser can't call the harness directly — different origin, no CORS — and since
2026-08-30 it has nothing the harness would accept either, so the route
authenticates as the app and names the signed-in admin. The plugin re-checks
that pair on `/api/auth/me` exactly as it used to re-check the cookie
(`plugin-webchat.md`). The route requires `role === 'admin'`; the agent and
action are both checked against allowlists, since the path comes from the
browser. A harness that is down answers 502 rather than hanging the poll.

The panel fetches `api/messages?since=<cursor>` while it is open: once on
open, again the moment `/api/chat/events` reports its thread moved, and on a
10s fallback timer (which also covers the half of the working indicator that
lives in the harness queue, not the database). Until 2026-08-26 this was a
flat 2s poll. Message bodies are never pushed — the event says *something
changed* and the panel makes the same delta fetch it always made. A sent
message is added optimistically and then adopts the id the server returns, so
the next fetch doesn't duplicate it.

**Why a relay and not Realtime in the browser.** No Supabase key reaches the
browser and app users are not Supabase auth users, so no RLS policy could tell
them from the public. `lib/chat-realtime.ts` holds one subscription with the
existing server-side client (kept on `globalThis` across dev reloads) and fans
`threads` changes out over SSE; `lib/chat-events.ts` shares one `EventSource`
per URL between the bell, the open panel and the portal's hooks. That sharing
is per tab, so the public proxy must speak HTTP/2: over HTTP/1.1, a few open
tabs use up the browser's six connections per host and navigations hang
pending (see [public proxy](../deployment.md#public-proxy)).

During server shutdown, `lib/server-shutdown.ts` closes all active SSE responses
on `SIGTERM` or `SIGINT`. Each stream releases its subscriptions and heartbeat;
one signal handler is shared across routes and reloads. This lets Next.js finish
graceful shutdown with browser tabs still open instead of waiting for systemd's
90-second stop timeout. EventSource reconnects after startup, and the existing
recovery reads reconcile updates missed during the restart. See
[server restart behavior](../deployment.md).

The same server channel also watches `job_requests`, `job_request_items`,
`availability_requests`, `candidates`, `orders`, `order_items`,
`customers` and `suppliers` (publication migrations 0091/0092; candidates
renamed in 0119; the allocation table was dropped in 0146). Each insert, update or
delete sends only `{type: "jobs"}` to the internal stream and authenticated
`/api/partner/:id/events` streams. These are broad invalidations without
record IDs or supplier identities; each portal re-reads only its authorized
company's data. The separate partner chat stream still relays only its
authorized thread pings. No database credentials, row bodies or public
availability tokens are pushed to browsers.

`lib/use-job-updates.ts` shares the internal connection across All jobs, the
focused job/sidebar, the intake saved panel, customer job details and the open
availability drawer. It groups writes into 200ms batches and re-reads the
existing APIs, retaining mounted editors, drafts, filters and scroll. Reads
already in flight get a follow-up if another change arrives. Invalidations are
broad enough to cover deletions and reparented lines even when Realtime's old
row contains only its primary key. Browser reconnect, upstream subscription
readiness/reconnect, tab return and a 60s fallback reconcile missed events;
hidden tabs defer background work until they return. Portal home (By request, By item and
By status), request detail, order queues/details and both history lists use
`lib/use-partner-updates.ts` with the same batching/recovery behavior. Order
refreshes also refresh request notifications. Supplier switches close the old
stream and abort stale reads; background updates keep view/bucket selections. A focused job read failure
keeps the last saved record visible; an authoritative 404 removes it.

**Pagination.** The first fetch of a transcript asks for `&limit=50`, so the
panel opens on the 50 newest messages rather than the whole history. When the
server reports `hasMore`, a *Load earlier messages* button at the top of the
transcript fetches the previous 50 (`?before=<oldest held id>&limit=50`) and
prepends them; a layout effect adds the height the prepend introduced back to
`scrollTop`, so the reader stays on the message they were looking at. Polls
after the first send no `limit` — they carry a delta, and truncating a delta
would drop messages permanently. How far back the button can go is bounded by
the plugin's `historyLimit` (200), since paging reads the same in-memory
window.

**Scrolling** pins to the newest message: a `useLayoutEffect` sets
`scrollTop = scrollHeight` before paint, so a reload opens at the bottom rather
than flashing the top of the transcript. A scroll listener drops the pin once
the user is more than 40px up, so reading history isn't interrupted by an
arriving message, and image `onLoad` re-pins because a late image makes the
transcript taller after layout. Contextual floating arrows jump smoothly to the
first or latest message whenever the transcript is away from those edges.
Pulling down from transcript top triggers an immediate message poll with an
inline refresh indicator; this replaces document-level native pull-to-refresh,
which is intentionally unavailable while the PWA Shell is scroll-locked.

**Composer.** The message box is a textarea, not a single-line input: on
desktop Enter sends and Shift+Enter inserts a newline; on mobile (the `big`
sheet) Enter always inserts a newline and only the Send button sends. Pasted
multi-line text keeps its line breaks. It grows with its content up to `max-h-40` (~6 lines) and scrolls
internally past that; a layout effect on the draft resets `height` to the
scrollHeight so it also shrinks back after send.

**Attachments.** Files are uploaded one at a time *before* send (`api/upload`,
raw body + `x-file-name`), and `api/send` then carries the stored names. That
keeps multipart parsing out of the plugin entirely. The composer accepts the
file picker and pasted images (`onPaste` reads `clipboardData.files`). Header
values must be ASCII, so the display name travels in the send payload rather
than the header. Images render inline, audio gets the voice player below,
everything else is a download link.

### Voice notes

Recording swaps the whole composer row for a WhatsApp-style bar: discard, a
pulsing dot, a timer, a **live level meter**, and stop-and-attach. Levels come
from an `AnalyserNode` on the live stream (RMS every 90ms, newest bar on the
right). Stopping attaches the note as a chip — it does *not* auto-send, so text
can still be added.

Playback (`VoicePlayer`) is play/pause, a seekable waveform, and elapsed time.
Three things there are load-bearing:

- **The waveform is real**, decoded via `decodeAudioData` into 40 RMS buckets.
  Decode failure falls back to flat bars rather than breaking playback.
- **Duration comes from the decoded buffer, not `<audio>.duration`.**
  `MediaRecorder` writes a webm with no duration in the container, so the
  element reports `Infinity` until the clip has fully played once.
- The plugin sends `Accept-Ranges`, without which seeking doesn't work.

**Container choice is not cosmetic.** Safari — so every iPhone — cannot record
webm; it produces mp4/AAC. `pickRecordingType()` asks
`MediaRecorder.isTypeSupported` and the file extension follows the recorder's
actual `mimeType` (`extForAudio`). Hardcoding `.webm`/`audio/webm` mislabels
every iOS recording.

> **Voice notes need a secure context.** `navigator.mediaDevices` is `undefined`
> off `localhost` unless the origin is HTTPS, so on a phone hitting this app
> over plain `http://` the mic cannot work at all — no permission prompt, no
> error. The composer detects this and says so (checking `isSecureContext` to
> distinguish it from an unsupported browser), and reports denied permission and
> missing-device separately. Do not restore a bare `catch {}` here: it makes the
> button look broken rather than blocked.

**Busy state.** The plugin reports `pending` — true only while the agent is
working on the thread behind the open view (a job's party tab: while its own
message is answered on the job's thread); work on the agent's other threads
doesn't show (2026-10-19, plugin doc). The panel adds nothing of its own:
a message just sent, or still waiting in the agent's queue, shows no loader
until the agent actually starts on it. The supplier portal shows no working
indicator at all. The panel shows a bouncing-dot "Daisy is working…" bubble and a dot
on the collapsed rail avatar. The header carries no status line of its own —
name, role and thread label only, since the working bubble already says it. See
the plugin doc for what does and doesn't clear it.

**Message stamps.** Each bubble carries its full local date and time under it,
`fmtStamp` in `chat.tsx` (`2026-08-18 21:26`), not a bare clock. The transcript
pages back over days, so `9:41` alone left yesterday's message reading as
today's. It is the browser's zone — unlike the stamps in the agents' note
columns, which are written in `America/Chicago` because they become stored text.

**Markdown.** Agent replies render through a deliberately small subset renderer
(bold, inline code, fenced code blocks, links, bullet lists) rather than a
markdown dependency. Fenced blocks keep their whitespace, show their optional
language label and carry their own Copy button. The renderer also normalizes
literal `\\n` sequences from CLI replies into line breaks, including in existing
transcript entries. Tables are not supported — the plugin's seed prompt tells
Daisy to use bullet lists.

Panel open/closed, width, the selected agent and the thread it is on persist to
`localStorage` under `lps.chat.v1`, written from an effect behind a `hydrated`
ref — the same pattern, and the same reason, as the table layout. The agent is
part of that record because a refresh remounts the Shell (as every page move
did before the `(workspace)` layout): without it, the panel dropped back to the
first agent in `AGENTS`.
The thread is stored with the agent it belongs to (`{ agent, id, label }`) and
restored only when the panel comes back on that agent, so a refresh leaves a
`jr-` or supplier conversation open instead of resetting to Main — a rosie
thread never lands on Daisy. Switching agents by hand still resets to Main;
the restore sets the same `keepThread` ref the deep-link bus uses so its
`setAgentId` doesn't trip that reset.

### Appearance

Appearance is split across the tabs of `/settings` (*Settings*), reached from
desktop Settings or mobile **More → Settings**: what the whole app shares is on
**Global**, and what belongs to one conversation is on that agent's own tab.

**App header & accent** controls navigation highlights and action controls; the
Shell's content header remains a neutral surface. Browser/Android PWA chrome uses
fixed charcoal `#1A1A1A`, independent of the saved accent and light/dark mode. Its five contrast-paired light/dark palettes are Edge Teal (the
default), Ocean Blue, Forest Green, Soft Plum and Warm Coral; the browser/device
preference persists under `lps.app.appearance.v1`. A missing preference is the
former implicit Forest Green default and migrates to Edge Teal. Valid explicit
choices — including Forest Green — are never rewritten, and Reset deliberately
returns to Edge Teal.

**Outgoing message & accent** sits on each agent's own tab, named for what it
actually does rather than duplicated as a second bubble setting. It colors that
conversation's outgoing bubbles and chat actions only; Daisy, Rosie and Nova are
independently configurable with seven scoped chat palettes. New/default devices use Daisy Edge Teal,
Rosie Coral Rose and Nova Electric Violet; Forest Green, Garden Green, Fuchsia
Bloom and Agave Blue remain optional choices. The old exact Forest/Coral/Violet
default trio migrates once to Edge/Coral/Violet—even when a wallpaper caused
that trio to be persisted—while every custom color combination is preserved.

**Wallpaper is per agent too**, on the same tab: `wallpapers` is a
`Record<ChatAgentId, ChatWallpaperId>`, so Daisy can run the line art while
Rosie runs Desert Night and Nova runs none. Both legacy shapes of the old single
setting — `wallpaper: true` (the first line-art flag) and `wallpaper: <id>` (one
choice shared by every chat) — migrate by becoming *every* agent's wallpaper, so
splitting the setting never changed how an existing device already looked; the
migration is `readChatWallpapers()`, shared by the Shell and the supplier
portal. `chatWallpaperForAgent()` is the read side, mirroring
`chatThemeForAgent()`. The supplier portal's chat is the supplier's Rosie
thread, so it follows Rosie's wallpaper as it already followed Rosie's colour.
Wallpaper choices are None, the original
light **Desert line art** SVG at `public/desert-plants-chat.svg`, and the dense
black **Desert Night** cactus/agave pattern at
`public/desert-night-chat.webp` (a rights-confirmed user-provided image,
optimized from JPEG to WebP with the visible icon strokes dimmed an additional
20% from the prior treatment while black pixels remain untouched). Desert Night
uses a 58%-strength CSS `color` blend with the active agent accent:
image luminance is preserved, so black stays black while Daisy, Rosie and Nova
subtly tint only the dimmed artwork forest, coral and violet respectively.
Neither wallpaper is a Telegram asset. Color variables are scoped
to `AgentChat`, so changing chat bubbles/buttons does not recolor the workspace.
Preferences persist per browser/device under `lps.chat.appearance.v1` and also
apply to the desktop chat panel. On mobile, the wallpaper is painted on the
shared conversation layer so the floating identity pill lightly blurs and
tints—rather than hides—the artwork beneath it instead of compositing over a
solid transcript surface. The operator pill uses an 85% supported backdrop
tint (95% fallback) with a 24px blur and 150% saturation, so its name and
destination stay legible over any message, image or wallpaper behind it in
both themes while the frost still shows through; it carries no text shadow.
The supplier-portal chat keeps its existing glass treatment. Both
chat headers and the transcript reserve the top safe area, and the installed
iOS app uses a translucent status bar so the wallpaper reaches the top edge.
The wallpaper field is an id (`none`,
`line-art`, or `desert-night`); legacy boolean `true` migrates to `line-art`.
Agent/incoming bubbles use an 18% accent-tinted card surface with a 28%
accent-tinted border, separating them from black wallpaper; outgoing bubbles
stay solid accent with explicit white text. Chat messages, the composer and the
appearance preview use Roboto at 16px with a compact 1.35 line height, approximating native
Telegram typography while leaving the rest of the app on Inter.

## Settings

`/settings` is tabbed: **Global** for what the whole harness shares, then one
tab per agent in `lib/agents.ts` — **every** agent, chattable or not, since
model, schedules and run state are harness config rather than panel features.
Each panel gates itself on `installedPlugins`, so an agent without `gws` shows
no Google panel and one without `scheduler` shows no schedules; the Appearance
panel is skipped for an agent that has no panel conversation to style
(*Agent chat*). The active tab lives in `?tab=<id>` and is written with
`history.replaceState`, because Google's OAuth redirect has to be able to land
the browser back on the agent tab that started a sign-in.

Everything on this page except Appearance is **harness state, not app state** —
the app owns no copy of it. Appearance stays a per-device browser preference
(*Appearance*, above).

### How the app reaches the harness

Two paths, both same-origin so the browser never makes a cross-origin call to a
server that ships no CORS headers:

- **`/api/harness/*`** (`app/api/harness/[...path]/route.ts`) forwards to the
  harness's authenticated `/api/*` as **the app itself**:
  `Authorization: Bearer $HARNESS_APP_SECRET` plus `X-App-User: <admin>`
  (`lib/harness.ts`, harness 0.12.0). App users stopped being harness users on
  2026-08-30, so there is no cookie to forward. **The allowlist in that file is
  the whole security boundary** — it is no longer backstopped by the caller's
  own harness permissions, because the caller has none. Hence also the explicit
  `role === 'admin'` check there. `/api/agents/:id/fs/file` stays pinned to the
  scheduler's one state file, because it can otherwise read and write anywhere
  under an agent's directory. The authed half of the Google OAuth flow comes
  through here too (`gws/oauth`, `gws/oauth/:agent/start`, `DELETE
  gws/oauth/:agent`).
- **`/api/gws/oauth/callback`** — the *only* remaining `next.config.ts`
  rewrite. Google redirects the **browser** there, and a browser redirect can
  carry no bearer; the harness mounts that one route outside its own auth and
  authenticates it with the single-use `state` nonce its start route issued.

| Endpoint | Used for |
|---|---|
| `GET/PUT /api/harness/models` | provider status + the enabled-model allowlist |
| `POST /api/harness/models/oauth/openai-codex/{login,input,cancel}`, `GET …/status`, `DELETE …/openai-codex` | the Codex sign-in flow |
| `GET /api/harness/agents/:id` | `agent.json`, installed plugins, run state |
| `PUT /api/harness/agents/:id/config` | write `agent.json` back |
| `GET/PUT /api/harness/agents/:id/fs/file?path=plugins/scheduler/state/schedules.json` | the scheduler's state |
| `GET /api/harness/harness` | the harness timezone, for the schedules' next-run column |
| `GET /api/gws/oauth`, `POST /api/gws/oauth/:id/start`, `DELETE /api/gws/oauth/:id` | Google sign-in status / start / sign out |

### Global tab

**OpenAI Codex is the only provider offered here.** It authenticates by OAuth
against a ChatGPT Plus/Pro subscription rather than a pasted API key, which is
the one credential shape safe to connect from a browser; every other provider
stays on the harness console. The login is server-driven — the harness runs
pi's own flow and surfaces one interaction at a time (a method chooser, an auth
URL, a device code, a question), which the page polls for at 1.5s and renders.
When the harness and the browser are on different machines the provider's
localhost callback cannot fire, so the paste-the-redirect-URL field is the path
that always works.

**App header & accent** is the app-wide half of appearance — see *Appearance*.
**Reset all** lives here and clears both halves, agent colours and wallpapers
included, because one stored preference is behind them.

**Enabled models** is the allowlist each agent picks from. It offers the
provider's catalog plus any id already enabled that is not in it (`gpt-5.6-terra`
and `gpt-5.6-sol` today, both marked *custom*), and takes new ids by hand.
Saving restarts every agent running on that provider — the harness does that
itself, no server bounce.

### Agent tabs

- **Appearance** — that agent's outgoing-bubble colour and its chat wallpaper,
  over a live preview of its own bubbles. Alone on this page it is a browser
  preference rather than harness state, so it saves on click with no Save button
  and no reload (*Appearance*).
- **Model** — the id and thinking level from `agent.json`. The provider is
  shown but not editable: it is a harness-wide choice. Saving writes
  `agent.json` back **whole**, so the description, thread strategy, slot counts
  and secrets schema survive, then the harness reloads the agent.
- **Google account** — the gws plugin's Google Workspace sign-in, the same flow
  as the console's. Gmail read/write (`gmail.modify`) is always requested;
  anything more comes from the plugin's own `oauthScopes` config, which is a
  developer decision and is not editable here. Granted scopes are listed.
  Sign-in needs the shared OAuth client saved on the console's Settings page,
  and the app's own `https://<domain>/api/gws/oauth/callback` registered as an
  authorized redirect URI on that client. Agents without the plugin (Rosie,
  Nova) say so instead.
- **Scheduled tasks** — the scheduler plugin's `schedules.json`: the cron
  expression, when it next fires, the thread it fires into, the message the
  agent receives, and a pause/resume switch and delete button paired at the
  left of the row, so both stay put when the message column scrolls the table
  sideways. The agent still creates and edits these through its own scheduler
  CLI. The plugin reloads on any change to the file and the agent writes it
  too, so **every write re-reads the file first** rather than trusting what the
  page last rendered; delete asks for confirmation, since what it removes was
  something the agent set up for itself.

  **Next run** is computed with `croner` — the same library the plugin
  registers its timers with, at the same version the harness pins — against the
  harness timezone from `GET /api/harness/harness`, so the column says what
  will actually happen rather than approximating it. A paused schedule has no
  timer, and a one-time schedule is paused by the plugin once it has fired, so
  both read `—`.


## Agent artifacts

Daisy and Nova publish self-contained HTML pages — a report, a summary, a
dashboard — and hand out a link on this domain. The agent runs
`scripts/artifacts/artifact publish <file.html>`; the harness's `artifacts`
plugin stores the file and this app serves it.

Each artifact carries a **public/private flag** that decides which of its two
links works, and **no URL carries a token** — the slug is the whole path:

```
https://lps.cognisphere.sh/a/<agent>/public/artifacts/<slug>    anyone, while flagged public
https://lps.cognisphere.sh/a/<agent>/private/artifacts/<slug>   signed-in users, always
```

**The agent is a path segment** because both agents publish. The plugin builds
its share links as `<appBaseUrl>/<public|private>/artifacts/<slug>`, so each
agent's plugin config carries its own `appBaseUrl`
(`https://lps.cognisphere.sh/a/daisy`, `.../a/nova`) and one route tree under
`app/a/[agent]/` serves them both. `ARTIFACTS_AGENTS` is the allowlist: an
agent not on it is a 404 before any request leaves the app, as is a slug
outside the plugin's `[a-z0-9-]` charset.

**This app owns authentication; the harness only knows "the app vouched for
this reader".** The private routes attach a shared `ARTIFACTS_APP_SECRET` as
`X-Artifacts-Secret`, and without it the harness's private path is a `401` —
which is what keeps private artifacts off the open `/webhook/*` surface. The
public path takes no secret and 404s for an artifact that isn't flagged public,
so it is safe to leave outside the gate in `proxy.ts` — the one path besides
`/login` that is.

**The artifact renders in a sandboxed iframe and the toggle is app chrome
around it.** Agent-authored HTML arrives with `Content-Security-Policy: sandbox`
and no `allow-same-origin`, so it sits in an opaque origin and cannot reach this
app's cookies or storage. `passThroughHtml` deliberately preserves that header
across the hop — that relay is the security boundary. It is also why the toggle
can't live inside the artifact: a sandboxed document could never authenticate
back to the app.

Source: `lib/artifacts.ts` and `app/a/[agent]/`, adapted from the harness's
template at `app/artifacts-routes/` — see that directory's `LOCAL.md` for what
was changed and what to re-check on a harness upgrade. Deploy wiring (the
shared secret, the agent allowlist) is `scripts/app/secrets.sh`.

## Notes hold facts, not contact history

The profile's **Notes** tab backs onto `suppliers.notes` — what is **true
about** the supplier (quirks, preferences, ordering constraints), a textarea
edited in place, one tagged editor per farm on a company page. Contact history
does not live in the app: the Conversation tab and its `supplier_messages`
transcript were dropped 2026-08-23 (migration 0066) — supplier exchanges are
recorded by the agents.

`suppliers.communication_notes` — the old append-only prose log — was retired
on 2026-08-19 (migration 0063) and stays a frozen archive the app neither
reads nor writes. The customer side followed on 2026-08-25: migration 0073
dropped `customers.communication_notes` and the customer page's Contact log
with it, leaving `customers.notes` and the Rosie thread the header opens.

### The same split on inventory rows

`inventory` has its own pair, added by migration 0039 and following the same
rule — see [the schema doc](../supabase-schema.md#notes-vs-internal_notes):

| Column | Holds |
|---|---|
| **Notes** (`inventory.notes`) | What the **supplier** said about the offering — their row description, dated availability status, lead time, "limited". |
| **Internal notes** (`inventory.internal_notes`) | What **we** said — why a combined size was split, that a quantity is the supplier's shared/tentative count, parse caveats, QA exceptions. |

Both are editable in the plants table and both are in `PLANT_HIDDEN`, so the
column picker opts into them.

Both read paths carry the column directly. 0039 left `internal_notes` out of
`search_inventory` to avoid dropping and recreating the function, and the app
filled it in with a per-page keyed read (`hydrateInternalNotes`); migration 0040
had to recreate the function anyway, so the column went into its `RETURNS TABLE`
and that hydration was deleted.

## Where a filter runs

**Every column filter is SQL, applied over the search result.** `lib/server-filters.ts`
holds one spec per table mapping a filter key to the column it selects on, plus
`filterQuery()` (state → a stable query string), `parseFilters()` (validates it
back, ignoring any key not in the spec so this cannot become a
filter-by-any-column oracle) and `applyServerFilters()` (applies it to a
PostgREST builder).

PostgREST puts those filters in an outer query over the RPC's result set,
*before* its own `range()`, so a filtered page and its `count: 'exact'` describe
the same set. That is the whole point. Filtering in the browser could only ever
narrow the page already fetched: measured on `Crape Myrtle`, 570 rows match and
105 are `15G`, but only **73** are in the 300-row first page — 32 were
unreachable by ticking the box, and "Showing 73 of 570" was wrong twice over.

The photo catalogue uses the same spec map (`PHOTO_FILTERS`, prefix `p.`) and,
because `search_plant_photos` and `plant_photos` carry the same columns, one
spec drives both its search path and its no-query browse path. Its supplier
filter selects on `supplier_id` rather than the name — two locations of one
company share a name, so picking "Everde Growers" must not silently mean
whichever sorted first; the page keeps a label→id map and only appends the
city/state to labels that actually repeat. Its `tag` filter reuses the
`overlaps` kind *without* `normalize`, which the spec gained here: `cultivar_keys`
holds normalized plant keys while `tags` holds the vocabulary itself, and running
a tag through `plantKey` would strip its digits and punctuation.

Adding a filter is usually a line in the spec, not a migration, because the RPC
already projects the columns — and where it does not, projecting it is the fix.
**LPS Partner** on the Suppliers toolbar is the worked example: the page had
been reading `is_lps_partner` in a second `suppliers` query and stitching it
onto the RPC's rows, which draws the LPS tag but cannot filter, so migration
0074 added the column to `search_suppliers` and the second read went away. It is
a single-select toolbar chip (*LPS Partners* / *Not partners*) rather than a
column head, because the flag has no column on the table — the LPS tag beside
the name is how a row shows it. The chip stores `'true'` / `'false'`, the values
the boolean column selects on, and maps them to those words for display.

Two consequences worth knowing:

- **Option lists come from a separate facet call**, keyed on the search term
  alone (`?facets=1`). They have to: options derived from already-filtered rows
  would collapse to whatever is selected, so picking one size would remove every
  other size from its own dropdown. Because the key is the search term, changing
  a filter never refetches them.
- **Three things stay in the browser, each for a reason.** `# Items` on the
  Suppliers table, because it is a per-location COUNT from a second pass and
  not a column `search_suppliers` returns — and on a company row it is a sum
  over locations, so it filters the company, not one of its farms. **Branch**
  on the plant tables, because `inventory` has no farm-name column to select
  on; the panel's own company picker is what narrows by supplier. And a size
  *typed into the query*
  (`15g`), because it matches by value against the supplier's printed size text
  — `15g` finds a row listed as `10/15 G` — which is a range no single
  standardized bucket can express, so there is no column to compare against.
  Sorting used to be a third; it moved to SQL for the same reason filtering did
  (*Where a sort runs*, below).

`applyFilters()` in `lib/table-config.ts` therefore now runs with an empty
filter set on the plant tables; what it still applies is the handful of sorts
SQL cannot.

One thing the `cultivar` filter makes explicit on both tables: **the browser
normalizes, the server does not.** `filterQuery()` runs the selection through
`plantKey()` on the way out, because the dropdown offers display names
(`Emperor 1`) while `cultivar_keys` holds normalized ones (`emperor`).
`parseFilters()` takes what it is given, so `?f.cultivar=Natchez` matches
nothing while `?f.cultivar=natchez` matches — worth knowing when hand-testing an
endpoint.

## Where a sort runs

**A column header's sort is SQL too, applied over the search result**, and for
the same reason its filters are: the browser holds one page, so sorting there
answered "cheapest of the 300 rows relevance happened to return" when the
question was "cheapest of the 570 that matched". On the Suppliers table it was
plainer still — `Name ▲` only ever rearranged the fifty rows on screen.

All three tables do it: the Suppliers list, Plant search's plant table, and the
supplier profile's Inventory tab, where it matters most — Austin Plant Supply
carries 1,467 rows, so "cheapest first" over a 100-row page was answering about
7% of their catalogue.

`lib/server-sort.ts` mirrors `lib/server-filters.ts`: `SUPPLIER_SORTS` and
`PLANT_SORTS` map a column key to the column the database orders by,
`sortQuery()` serializes the header's state (`sort=` + `dir=`), `parseSort()`
looks the key up in the spec rather than trusting it as a column name — the same
reason `parseFilters()` does — and `clientOnlySort()` returns the sort only when
no spec covers it. Sort and filter state share one debounced string per page, so
a filter click and a sort click landing together cost one request.

Ordering goes on outside the RPC, before `range()`, so page 1 is the top of the
whole ordering. Missing values sort last in both directions (`nullsFirst:
false`), matching what the browser did — descending price must not promote
unpriced inventory above real supplier prices. On both plant tables a header
sort outranks relevance, which stays underneath it so equal prices still lead
with the best match; on Suppliers an `id` tie-breaker follows the sort column,
because without a total order two pages of a low-cardinality sort (State, say)
can repeat or skip a row. `PLANT_SORTS` drives the profile tab's search branch
and its no-query browse branch alike, the same way `PLANT_FILTERS` does — the
columns are on `search_inventory` and on `inventory` both.

Four kinds of column are absent from the maps and still sort the page:

- **Values assembled after the fetch.** `# Items`, `Other contacts`,
  `Inventory sources` and `Last ingestion` on Suppliers; `Source`, `Ingested`
  and `Branch` on the plant tables. None is a column the query could order by —
  `Branch` comes from `search_inventory`'s projected `supplier_name` on the
  search path and from a supplier lookup on the browse path, so there is no one
  column both could order on.
- **`Communication notes`**, which is on `suppliers` but outside
  `search_suppliers`' projection.
- **`Size`**, because SQL would order `size_std` as text and put `100G` between
  `10G` and `15G`. Its canonical order is a rule (`lib/size-std.ts`), not
  something an index expresses.
- **The whole company panel on Plant search.** Its master rows *are* this
  page's groups, assembled from the plants that came back, so ordering them
  arranges what was fetched. Asking for "the company with the most matches"
  across the entire result set is a different query — an aggregate over
  `search_inventory` grouped by head branch — and nothing here can serve it.

## Paging the list pages

The photo catalogue is the exception and works the other way: `PHOTO_PAGE_SIZE`
(50) in `lib/photos.ts`, an **offset rather than a page number**, and a **Load
more** button that appends the next batch instead of replacing the grid. Three
things follow from appending. The offset is `photos.length`, so deleting a photo
out of the middle doesn't make the next batch skip the row that moved up — which
a page number would. A batch that arrives after the question changed is dropped
rather than appended, compared against a `searchKeyRef`. And an id already on
screen is never appended twice, so a double-click costs a request and nothing
else. An offset past the end is an **empty batch with the true total**, not an
error: the browser's `total` is from the last response, so a photo someone else
deleted in between makes the request overshoot legitimately. PostgREST answers
that with HTTP 416, and the status is the only reliable signal — on the RPC path
the body parses to "Requested range not satisfiable", on the table path
supabase-js hands back a truncated `{ message: '{"' }` with no code at all.

Suppliers and Plant search page through their search server-side — `PAGE_SIZE`
(50 suppliers) and `PLANT_PAGE_SIZE` (300 plant rows) in `lib/queries.ts`. Both
RPC calls ask PostgREST for `count: 'exact'`, so the response carries how many
rows the *search* matched alongside the page it returned; the route divides that
total by its page size and hands the browser a `pageCount`, keeping the divisor
on the server. The counts are free in practice — both functions are `plpgsql`
and materialize their whole result before the range is applied.

The `Toolbar` renders the control (`pagination` prop: `page`, `pageCount`,
`onPage`, `busy`) and hides it while everything fits on one page. Its summary is
`Showing <rows on screen> of <total>` — the left number is what survived the
client-side filters, the right one is the whole match set, so filtering visibly
moves one and not the other.

Each page holds a page number that resets to 1 when the question changes — the
debounced query, filter or sort state, since page 3 of one ordering means
nothing under another — and does so during render, before the fetch
effect can run against the number the new search just invalidated. Every
client-side concern — column filters, the toolbar multiselects, size selection,
hidden rows, and Plant search's grouping by company — still applies to the
current page alone, so a company card's match count is its count *on this
page*.

## Paging the profile's inventory

A supplier can carry thousands of rows (Austin Plant Supply has 1,467), so the
profile's Inventory tab pages through them 100 at a time rather than capping the
list. `getSupplierPlants` takes the profile's **whole scope** — every farm of
the company, or the one farm — fetches `PROFILE_PAGE_SIZE + 1` and reports
`hasMore` from the extra row, so there is no second count query; the page count
in the header comes from the scope's summed `item_count`. The page it returns is
then grouped by farm and drawn as a **card beside its rows**, the same shape
Plant search uses, because inventory is per farm even when the page is not. A
single-site supplier has one group and no card — there is nothing to tell apart. Filters and the header sort are applied
before that slice, so both describe the supplier's whole inventory rather than
the hundred rows on screen — see *Where a filter runs* and *Where a sort runs*.

## Truncation

Cells truncate to their column width and carry the full value in a `title`, so
hovering shows the whole thing. The source-list cell's tooltip lists every file.
Availability request notes are an exception: the note to the supplier and the
supplier's answer notes wrap to show their full text, including desktop request,
By item and By status rows. Their desktop editors use multiline textareas sized
to the content.

## Performance notes

- **"# Items"** needs one indexed `COUNT` per location (PostgREST has aggregate
  functions disabled on this project), ~2s for a page of 50. It loads as a
  second pass so the table renders immediately. A company page counts every one
  of its locations, so the pass is slightly wider than the rows on screen — 60
  extra ids across the whole catalogue, since only 22 companies have more than
  one site. A `supplier_item_counts(ids bigint[])` RPC would collapse it to one
  query.
- Company-card aggregates on Plant search (`# Plants`, `Lowest price`,
  `In stock`) describe the **matched** plants across the company, not any
  farm's whole catalogue — same as the design, and free to compute.

## Auth

**The app owns its sign-in.** Credentials live in **Supabase Auth**; the app
mints its own session. Until 2026-08-30 app users *were* harness users —
`next.config.ts` rewrote `/api/auth/*` to the harness and the harness set its
`pi_sid` cookie — which could not survive giving suppliers logins, since a
supplier must never be a harness operator.

Two populations sign in through one form (`/login`):

| Role | Who | Sees |
|---|---|---|
| `admin` | the internal team | everything |
| `partner` | a supplier | their own company's portal, nothing else |

`public.app_users` (migrations 0081–0083) is the app-side half of each
identity: the login handle, the role, and for a partner the one **company**
(head branch) they may see. Supabase Auth owns the password and nothing else —
`lib/auth.ts` verifies it with `signInWithPassword`, then throws the Supabase
session away and mints `app_sid`, a token this app signs with
`APP_SESSION_SECRET`. See [`../supabase-schema.md`](../supabase-schema.md) for
the table, and *Portal access* below for how partner accounts are made.

**Nothing bootstraps an admin.** No credential of the app's own lives in
`config`, and `verifyCredentials()` refuses a username with no `app_users`
row, so an internal account must exist before anyone can sign in. It is
created out of band:

```sh
cd app && set -a && source ../config && set +a \
  && node scripts/create-admin.mjs <username> '<password>'
```

That writes both halves — the Supabase Auth user and the `app_users` row,
rolling back the first if the second fails — and then verifies the credential
through the same `signInWithPassword` call the login route makes. Run it again
on an existing admin and it **resets the password**; that is the only way to
rotate an internal one from outside the app — inside it, an admin changes their
own the same way a partner does (*Choosing your own password*). It refuses a
`partner` username, whose *admin-side* reset belongs to the supplier page,
where it is scoped to that company.

This replaced a lazy seed from `ADMIN_USER`/`ADMIN_PASS` in `config` on
2026-08-30, the same day it was written: a config value that mints privilege on
first use is a bootstrap path worth not having.

`lib/session.ts` is deliberately Web Crypto and string maths only, with no
`server-only` import: `proxy.ts` runs on the edge runtime, where `node:crypto`
does not exist, and it must verify exactly what the route handlers verify.
`lib/auth.ts` is where the Supabase half lives.

**Never call `signInWithPassword` on the shared `supabase` client.**
supabase-js keeps the session in memory even under `persistSession: false`,
and every later PostgREST or Storage call on that client then sends the user's
JWT instead of the secret key — running as `authenticated`, which RLS refuses.
`lib/supabase.ts` exports a module singleton, so one sign-in poisons every
query in the process until it restarts. `passwordMatches()` therefore builds a
throwaway client per attempt, and `lib/auth-client-isolation.test.ts` fails the
build if anyone reaches for the convenient one again. This is not
hypothetical — it shipped on 2026-08-30 and broke portal account creation
("new row violates row-level security policy for table app_users") and every
plant photo ("Object not found", Storage's answer to an unauthorized read) for
whoever had signed in most recently.

### Choosing your own password

A portal login is handed over on a password **we** generated and probably read
down a phone (*Portal access*), so it is not a secret. Since 2026-08-30 it must
be replaced before the account can do anything else:

- `app_users.must_change_password` (migration 0087) is true from the moment a
  password is minted for somebody — the account created, or its password reset
  from the supplier page — and false again the moment they set their own. It
  defaults to **false**, because an admin made by `create-admin.mjs` is given a
  password its operator typed; the two places that generate one set it
  explicitly.
- The flag rides in the `app_sid` cookie (`mustChangePassword`), not in a
  lookup: `proxy.ts` runs on the edge and cannot ask the database. A cookie
  minted before the flag existed carries no such key and reads as "nothing
  owed", so nobody was signed out by this landing.
- While it is set, the gate sends every page to **`/change-password`** and
  answers 403 on every API call but `/api/auth/*`. That page is the `/login`
  card again — this is the second half of a first sign-in, not an errand — and
  it is exempt from the partner gate too, or a partner would ping-pong between
  it and their portal.
- `POST /api/auth/password` is the only self-service password write, and works
  for either role. The account is the caller's own, taken from the signed
  cookie and never from the body, so it cannot reach anyone else's login; the
  **current** password is still required, so a borrowed browser is not enough
  to lock the owner out. On success it clears the flag and **re-mints the
  cookie** — the gate reads the cookie, so a stale one would send the person
  back to the form they just completed.
- The same form is the portal's Settings page (`/partner/:id/settings`), where
  changing your password is an ordinary thing to do rather than a toll.

A reset from the supplier page sets the flag again, so a rescued account is
back on a password of its own after one sign-in. That does not touch the live
cookie of whoever is already signed in on it — but their password no longer
works, so their next sign-in is the one that re-mints it.

### The gate

`proxy.ts` (Next 16's replacement for `middleware`) gates every route except
`/login`, `/api/auth/*` and the public artifact path (*Agent artifacts*). It
**verifies the signature**, so a hand-set `app_sid=anything` is nothing; a
missing or rotated `APP_SESSION_SECRET` fails closed, signing everyone out
rather than letting stale cookies through. That check is load-bearing: pages
read *and write* Supabase with the project's **secret** key, and nothing
downstream re-authorizes the call.

A signed-out internal job link such as `/jobs?jr=71` redirects to `/login?next=%2Fjobs%3Fjr%3D71`; after a successful admin login, the validated `next` opens that job instead of the bare Jobs list. Only one positive, safe-integer `jr` id survives the redirect; all unrelated query values are discarded rather than copied into a login URL or browser history. The login page accepts only same-app paths, strips other queries, rejects ambiguous/external destinations and honors `/change-password` before any deep link. Signed-in requests keep their original query string.

A `partner` session is refused every path outside `/partner` and `/api/partner`
— redirected to their own portal, or 403 on an API call. Ahead of that, a
session still on a generated password is refused everything but
`/change-password` (*Choosing your own password*).

**Which supplier a partner may read is not decided there.** `proxy.ts` sees a
path, not the database, and a portal id may be any branch of the partner's
company — a relation only `suppliers.head_branch_id` resolves. So
`lib/partner-auth.ts` (`requirePartnerAccess`) is the real scoping, applied by
every `/api/partner/:id` route against the exact id it is about to read. It
answers **404, not 403**, on another company's supplier: "forbidden" would
confirm the id exists, which is precisely what one partner should not learn
about another. Both halves are needed — the coarse one keeps suppliers out of
the internal app, the precise one keeps them out of each other's portals.

`/api/harness/*` and `/api/chat/*` check `role === 'admin'` themselves rather
than inheriting the guarantee, because what they reach carries full operator
access.

`lib/supabase.ts` is `server-only`, so importing it from a client component is a
build error rather than a leaked credential. It holds the secret key
(`service_role`), which bypasses the RLS enabled across the database on
2026-08-05 — so this app's queries were unaffected by that change. RLS is not a
licence to move queries into the browser: `anon` is denied every table, so there
is still no anon-key path worth exposing — hence no `NEXT_PUBLIC_` Supabase
variable anywhere. See [`../supabase-schema.md`](../supabase-schema.md).

**Who is signed in.** The nav rail reads the current user from
`/api/auth/me` (`useSessionUser` in `shell.tsx`) and derives the avatar
initials from it. The design mock had a name hardcoded into the markup; don't
put one back — the harness owns the session and is the only thing that knows
who is actually logged in.

## Installable app (PWA)

The app installs to a phone home screen or a desktop dock and launches full
screen. No library — a manifest, a service worker, and Chrome's
`beforeinstallprompt` event.

| Piece | Role |
|---|---|
| `public/manifest.json` | Static manifest: `start_url: /requests` (the Jobs list), `scope: /`, `display: standalone`, fixed charcoal `theme_color: #1A1A1A` (not rewritten by Shell), and versioned 192/512 cactus-logo icons. |
| `public/sw.js` | Service worker. Its *existence* plus a `fetch` handler is what makes Chrome consider the app installable. |
| `components/pwa/pwa-provider.tsx` | Registers the worker, captures the install event, exposes `usePWA()`. Wraps the root layout. |
| `components/pwa/install-popup.tsx` | The unprompted offer — Chrome only, once per session. |
| `components/pwa/update-banner.tsx` | The **new version** offer — see *Updates* below. Mounted in the root layout, so on every page, installed or not. |
| `app/api/version` | `{ buildId }`, read from `.next/BUILD_ID` per request (`null` under `next dev`), `no-store`. Public in `proxy.ts`, since the login page and the partner portal poll it too. |
| `components/pwa/install-app-button.tsx` | The manual entry point, rendered in the desktop rail and mobile ⋯ More. |
| Frame **Reload** entry | `WorkspaceFrame` rail row / ⋯ More item (so both apps) shown only when `usePWA().isStandalone` — an installed window has no browser toolbar, so this is the one way to reload. Plain `window.location.reload()`. **Install app** is its complement, drawn only when *not* standalone. |
| `isStandalone` | "Not a browser tab": `display-mode: browser` is false (Chrome reports the installed window as standalone / minimal-ui / window-controls-overlay by version) or iOS `navigator.standalone`. Remembered in `sessionStorage` (`lps.pwa.standalone`) for the window's lifetime, because a plain standalone match was seen flipping false after an in-app reload. |
| `components/pwa/ios-install-modal.tsx` | Safari has no install API, so iOS gets Share → Add to Home Screen instructions. |
| `public/lps-cactus-icon-{192,512}.png`, `lps-cactus-apple-touch-icon.png` | CR's purple LPS flowering-cactus mark for browser/iOS home-screen icons. |
| `public/lps-cactus-icon-maskable-512.png` | Android maskable variant: the full cactus stays inside the safe zone on a solid sampled-purple square. |

**Standalone viewport.** `Shell` is fixed to the visual viewport and tracks its
height and top offset rather than relying solely on `100dvh`. Document scrolling
is locked while a workspace Shell is mounted; only inner transcript/list panes
scroll. A custom pull-down gesture at an inner page's top refreshes the route;
Suppliers and Plant Search also rerun the currently active client query. The app
bottom nav hides while a mobile text-entry control is focused,
letting the composer sit directly above the keyboard, then returns on blur. This
keeps the header and navigation aligned through swipes, orientation and keyboard
panning.

**Flow.** `PWAProvider` registers `/sw.js`. Chrome runs its installability check
(HTTPS or `localhost`, linked manifest, `standalone`, 192 + 512 icons, a
fetch-handling worker) and fires `beforeinstallprompt`; the provider calls
`preventDefault()` to suppress Chrome's own mini-infobar and stashes the event,
which is what `isSupported` reflects. The popup then waits 1s, skips `/login`
and anything already flagged in `sessionStorage.pwa_prompt_shown`, and offers
the install. The stashed event is **single-use** — Chrome re-fires it on a later
load if the offer was dismissed.

**Caching is deliberately thin.** The worker is network-first and caches only
`request.mode === 'navigate'` GETs, keeping the last page as an offline shell;
API calls and assets pass straight through, because stale supplier data would be
worse than none. Nothing is precached — every page is behind the login, so an
install-time fetch would only cache the redirect to `/login`. Redirected
responses are skipped (`cache.put` throws on those), and offline lookups pass
`ignoreVary`, since Next varies its HTML on router headers.

**Updates.** A phone resumes an installed app where it left off instead of
reloading it, so a user would otherwise keep the JavaScript of whatever build
they last launched until they killed the app. `PWAUpdateBanner` takes the first
`/api/version` answer after load as the page's own build, then re-asks whenever
the page becomes visible again and every 15 minutes. When the id differs, a
pill at the top offers **Reload** (plain `window.location.reload()`) or dismiss;
a dismissed offer returns at the next check. It never reloads by itself, so a
half-typed message is never lost. To get a stuck phone onto the new build by
hand: the frame's **Reload** entry, or swipe the app away and relaunch.

**Things that quietly break it:**

- **A LAN IP never fires the event** — only HTTPS or `localhost`. The install
  button detects this and says so rather than doing nothing.
- **Already installed → no event either.** Same fallback message.
- `proxy.ts`'s matcher must keep excluding `/manifest.json`, `/sw.js` and the
  icons (it does, via the trailing-extension rule). Chrome's check follows no
  redirect and reports no error — a gated manifest just means the event never
  arrives.
- The manifest is linked through `metadata.manifest`; `theme_color` lives in
  **both** the manifest and `viewport.themeColor` in `app/layout.tsx`. Both use
  `#1A1A1A`; changing theme/accent never recolors this chrome. The launch splash's
  `background_color` remains `#F9FCF7`; public availability keeps its dedicated
  `#0A0A0A` viewport override, and iOS keeps `black-translucent`. Installed Android
  apps may need Chrome's manifest refresh to pick up the new launch chrome.
- `viewport.viewportFit: 'cover'` gives the mobile frame real safe-area
  insets. The bottom bar consumes `env(safe-area-inset-bottom)`; ordinary page
  chrome and mobile chat controls consume `env(safe-area-inset-top)`. The iOS
  standalone status bar is `black-translucent`, allowing chat wallpaper behind
  it without letting page controls overlap it.

## File map

```
app/
  api/           suppliers, suppliers/[id], plants, photos, photos/[id]/image,
                 customers, customers/[id], requests, requests/[id],
                 requests/[id]/changelog, availability-requests (+/[id],
                 /suppliers), orders (+/[orderId]), partner/[id] (+ requests/[arId],
                 /submit, orders, orders/[orderId]), file, rows, chat/[...path],
                 harness/[...path] (allowlisted admin proxy — see *Settings*)
  a/[agent]/     agent artifacts: public/ pass-through, private/ page +
                 ShareToggle + raw + share
  (workspace)/   route group for the admin pages; layout.tsx mounts the one
                 persistent WorkspaceShell (URLs carry no "(workspace)")
  (workspace)/suppliers/  list (one row per company) + [id] profile (one page per company)
  (workspace)/customers/  list (a table) + [id] page (details card, Requests / Orders tabs)
  (workspace)/requests/   job requests, one card per request
  (workspace)/jobs/       focused jobs (rail + one job's record)
  partner/[id]/        the supplier portal: the request list (three work buckets),
                 requests/[arId] (one request, answered and submitted) and
                 orders (lifecycle filters, status/plant grouping) and
                 orders/[orderId] (confirmation, readiness, source AR links)
  (workspace)/plants/     plant search, one card per company
  (workspace)/photos/     photo catalogue grid + lightbox
  (workspace)/agents/     Know your Agents — profile banner cards
  (workspace)/settings/   settings tabs (Global + one per agent)
  login/
  globals.css    design tokens — the theme's source of truth
public/
  daisy.png, rosie.png, nova.png    webchat avatars (cropped from the banners) —
                                    panel header, rail, selector, mobile tab
  lily.png                          Lily's matching Telegram identity avatar;
                                    not in the webchat agent list
  *_profile.png                     full profile banners; the three webchat
                                    agents' banners are shown on /agents,
                                    while lily_profile.png is reserved for
                                    Lily's external bot/profile identity
  manifest.json, sw.js              PWA manifest + service worker
  lps-cactus-icon-{192,512}.png      install icons (purple flowering cactus)
  lps-cactus-icon-maskable-512.png   Android safe-zone variant
  lps-cactus-apple-touch-icon.png    iOS Add to Home Screen icon
components/
  change-password-form.tsx  the one password-change form — drawn on
                 /change-password and on the portal's Settings page
  ui/            lps-ui primitives (button, input, label, card, alert, badge)
  pwa/           install: provider (SW + beforeinstallprompt), auto popup,
                 rail/menu button, iOS instructions modal; new-version banner
  workspace/
    frame.tsx        WorkspaceFrame — the one layout both apps fill in: viewport
                     container, header, nav rail + shared footer, page column
                     (pull-to-refresh, toasts), ⋯ More menu, bottom tab bar;
                     useTheme / useIsMobile / useToast
    shell.tsx        the admin app's fill-in: destinations, agent chat, bell,
                     session user, supplier-view picker, appearance contexts;
                     WorkspaceShell (persistent, from the layout) + the page's
                     Shell registrar
    chat.tsx         agent chat: docked panel / rail / mobile sheet, polling,
                     composer (attach, paste, voice), markdown subset
    editable.tsx     click-to-edit text/textarea, shared by Job Requests and
                     Customers
    agent-chat-button.tsx  an agent's avatar as a button — opens that agent's
                     thread for the row or page it sits on, in the docked panel
                     (customer and supplier lists, cards and profiles)
    job-request.tsx  a request's expanded card — RequestLinks (customer chat, supplier/AR pills), RequestBody (compact summary,
                     status strip, details/notes drawer, dense line table,
                     change history), the status pill (its
                     menu positioned `fixed`, so a card's own overflow cannot
                     clip it), the demand strip and note cells,
                     shared by Job Requests and Customers
    table-parts.tsx  column picker, column head (sort/filter/resize/drag),
                     FilterControl (the head's filter widget, reused on mobile),
                     cell (plain/link/badge/list/file/url), MultiFilter
    plant-table.tsx  the plant sub-table, shared by search + profile
    availability.tsx the availability-request pieces two apps draw: the line
                     table (optionally with one caller-supplied leading
                     column), the request and per-line status pills, the answer
                     summary strip and the per-status answer dialog
    supplier-items.tsx  the portal's By-item view: this supplier's request
                     lines grouped by plant, each group expanding into
                     ARLineTable itself with a Job leading column, which is
                     also the drag handle that maps a line to a catalogue row
    partner.tsx      the supplier portal's fill-in of the same frame (identity,
                     three destinations, right-docked chat with attachments +
                     voice, its own bell, Settings+Log out)
    toolbar.tsx      search box, multi-select filter chips, count summary
    search-loader.tsx  sprouting-seedlings loader + overlay for ongoing searches
    icons.tsx        the design's icon set
    settings/        the /settings tabs: index (tab bar + Global/agent panels),
                     provider-settings (Codex login, enabled models),
                     app-appearance (the app accent + Reset all),
                     agent-settings (model, Google account, schedules),
                     agent-appearance (one agent's chat colour + wallpaper),
                     parts (Panel/Field/StatusPill + the button/input classes)
lib/
  agents.ts        the agents (id, name, role, avatar, profile, upcoming flag,
                   intro, suggestions) + CHAT_AGENTS, the chattable subset, and
                   supplierAgentThreads() — the rosie/daisy threads on a row
  columns.ts       column definitions mapped to schema columns + websiteHref()
  rows.ts          row shapes (SupplierRow, SupplierCompany, SupplierProfile,
                   SupplierScopeLocation, PlantRow, PlantGroup, SourceLink,
                   PhotoCard, PhotoFacets, JobRequestRow, JobRequestItem,
                   JobNote, JobAddress, JobRequestFacets)
  queries.ts       every database read, the whitelisted writes, file signing
  job-requests.ts  the two status vocabularies, their tones and labels, the
                   derived Partial pill, coverColor()/toneTint() — the one place
                   the schema's spellings and the design's colours are reconciled
  job-request-queries.ts  the job-request reads: one page of requests with all
                   their items, one request by id, the facets, the header totals
                   and one request's whole changelog
  customer-queries.ts  the customer reads: one page of customers with their
                   request rollup, one customer by id, the state facet and the
                   header totals
  customers.ts     customerThreadId() — the customer's rosie thread, computed
                   from their name until rosie mints the column
  notes.ts         the stamped-entry note convention the agents' skills write
  availability.ts  availability-request vocabulary + types;
                   availability-queries.ts the server reads/writes
                   /shortStamp(), one definition of the format the agents' skills
                   and this app both write
  photos.ts        the photo catalogue's reads, facets and image signing
  table-config.ts  column layout state + localStorage persistence + reorder()
                   — one entry per TableId (suppliers, plantMaster, plants,
                   customers)
  table-config.check.mjs  self-check for reorder()
  size-std.ts      the size_std vocabulary and the order the filter offers it in
  size-std.check.mjs      self-check for that order
  server-filters.ts       the filter spec: state -> query string -> SQL
  server-sort.ts          the sort spec, same shape: which columns SQL orders
  use-debounced.ts query + filter/sort state debounced as one request
  format.ts        money / number / date formatting
  supabase.ts      server-only client
  session.ts       the app's own signed session: mint, verify, read the cookie.
                   Web Crypto only, no server-only import — proxy.ts runs on the
                   edge and must verify exactly what the routes verify
  auth.ts          the Supabase-Auth half: verify a password, change your own,
                   create/reset partner logins, resolve a supplier to its
                   company (server-only)
  partner-auth.ts  requirePartnerAccess() — the per-request gate on
                   /api/partner/:id, which company an id belongs to
  harness.ts       the app's bearer client for the harness (server-only)
scripts/
  create-admin.mjs create an internal admin, or reset one's password from
                   outside the app — the only way the first happens (see Auth)
  artifacts.ts     agent allowlist, upstream URLs, signedIn(), header relay
  harness-settings.ts  the harness shapes /settings reads (provider, agent.json,
                   gws status, schedules) + harnessFetch(), which unwraps the
                   harness's `{ error }` bodies into the thrown message
  utils.ts         cn()
proxy.ts           session gate
artifacts-routes/  the harness's own route template, refreshed on upgrade and
                   excluded from the build — reference only, see its LOCAL.md
```

## Environment

`app/.env.local` is **generated from the repo-root `config`** by
`scripts/server.sh` — do not hand-edit it. `HARNESS_URL`, `DOMAIN`, `PORT` from
the stock script; `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ARTIFACTS_AGENTS`,
`ARTIFACTS_APP_SECRET`, `SUPPLIER_EVENTS_APP_SECRET` and `WEBCHAT_APP_SECRET`
appended by the `scripts/app/secrets.sh` deploy hook. Both `config` and
`.env.local` are gitignored — keep it that way.

`AUTH_EMAIL_DOMAIN` is appended by the same hook. It is what turns a username
without an `@` into a Supabase Auth email, and is **effectively immutable once
accounts exist** — changing it orphans every account whose username was not a
full address.

The stock script also writes `APP_USER`, `APP_PASS`, `APP_SESSION_SECRET` and
`HARNESS_APP_SECRET` (harness 0.12.0), for apps that own their sign-in and
authenticate to the harness with a bearer token. **This app reads none of
them** — it signs in against the harness itself and its users *are* harness
users, so a session is the harness's `pi_sid` cookie (`lib/session.ts`), which
`/api/*` still accepts ahead of the bearer. Until that changes, the four keys
sit unused in `.env.local`. The harness-owned reference implementation of the
bearer model is `app/auth-routes/` in the harness package, not vendored here.

## Scripts

`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm typecheck`, `pnpm test`.

There are standalone checks, run directly rather than through a test runner:

```sh
node lib/table-config.check.mjs     # column reordering
node lib/size-std.check.mjs         # size_std ordering
```

## Public availability requests

The admin availability-request drawer and partner request toolbar have a Share
button. It opens sharing options with Make public, Copy public URL, and Make
private actions. Opening Share does not change access. Partner requests default to private. Non-partner requests receive a public URL
for the supplier email. Publishing copies a randomly generated,
request-specific URL; the visible URL supports manual copying if clipboard access
fails. The copy button shows a spinner and “Copying…” while writing, then a
green check and “Copied!” for two seconds on success; a failed copy shows manual
copy instructions. Anyone holding the link can view and answer only that request, with the
existing customer-detail disclosure flag applied. The standalone page requires no
partner login and exposes no portal navigation, chat, or catalogue mapping. It
refreshes on focus and every 30 seconds; every write independently checks access.

`POST /api/availability-requests` accepts optional boolean `isPublic` and returns
`{ id, publicPath }`. `PATCH /api/availability-requests/:id` accepts `{ isPublic }`
and returns `publicToken`. Public page/API paths are `/public/availability/:token`
and `/api/public/availability/:token`. Responses are not cached or indexed.
The public page's title is *Availability Request* and its description the job
name its header shows (request refs redacted) — what a messaging app's link
preview shows. `generateMetadata` looks the token up with the page's own
`publicAvailabilityRequest`, so a dead, closed or draft link (or one with no job
name) gets *Local Plant Supply* instead.
The root layout sets no description, so every other page — partner links,
public orders, sign-in — previews with its title alone.
Public submission uses the existing supplier event notification. Authorized
partner payloads include their requests' sharing tokens; public payloads omit
them. Partner sharing writes use `PATCH /api/partner/:id/requests/:arId` with
`{ isPublic }`, checking company access and applying the supplier ID to the
database update so another supplier's request cannot be published or revoked.

Both public and partner routes render `AvailabilityRequestView`: the same status
and job-name header, disclosed contact/delivery details, answer summary, portal
line table, printable sheet, pinned Submit/Re-Submit bar and the received
acknowledgement a successful submit plays (the view's `onSubmit` resolves `true`
only when the answers were accepted, so a failed submit shows its error instead). The public frame
adds the LPS label and Print control; account navigation, notifications and chat
remain confined to the authenticated portal. Only this shared supplier detail opts
into centered desktop Status headings/controls; its pinned Submit/Re-Submit button
is centered alone in the bar, in the app's primary colour. Ops drawers, the focused portal-style drawer and profile/By-item
callers keep their prior controls. See [shared-detail presentation](availability-shared-detail-presentation.md)
for scope, accessibility and verification boundaries.

Migration `0082_public_availability_requests.sql` was applied to the live database
on 2026-09-10. It adds the nullable, unique UUID capability; private/closed/inactive requests
have no working public link. Republishing rotates the token. Migration 0088 permits public requests for active non-partner suppliers as well.
Partners receive availability requests in their portal; Rosie sends non-partners
an HTML email containing the request and its public URL from the supplier thread.
Customer details still follow the existing disclosure flag. Only Won,
Lost, legacy Archived or job deactivation closes linked availability
requests when no linked job remains open, and revokes their public links.
Deleted ARs keep their saved status and public token even when jobs close or reopen.
Working-stage changes (such as Quote → Availability → Committed) keep supplier
requests open. Reopening a job leaves its ARs closed. Explicitly reopening a
closed AR (`reopen_availability_request`, only while its job is open) gives a
non-partner whose link was revoked a fresh one. Public and
authenticated supplier writes lock the request row, serializing
with closure and revocation, and accept only supplier answer fields. Database
guards also reject changes made through direct SQL to closed request lines.
Saving an answer emits `availability_updated`; explicit submission emits
`availability_submitted`. Both wake the supplier thread, which routes current
sourcing evidence to the job thread. Missing supplier thread IDs fall back to
Rosie’s main thread for routing. Portal chat messages carry the authenticated
supplier ID and name; internal app messages carry their origin thread and channel
so communication approvals return to the original request chat even if Chris
switches chats. Supplier/customer threads still own the actual external send.

Regression SQL lives in `harness/agents/daisy/migrations/tests/0082_*` and
`0083_*`: run each fixture, migration, then assertions in an empty disposable PostgreSQL database
(or PGlite). The fixtures must never run against the application database.

### Webchat questionnaires

The shared transcript renders agent-created questionnaires in the internal
chat panel, mobile chat, and supplier portal. Each step offers preset choices
and an always-visible free-text field with “Something else” as its placeholder.
Selecting a preset saves it and immediately advances to the next question or
review. A `multiSelect` question shows checkboxes (“Select all that apply”):
ticking doesn't advance, free text adds to the ticked choices, and Save
answer records them joined by `; `. Previous and review-screen Edit controls preserve answers. Free text
uses Save answer after typing. Questionnaire cards, options, and review text
wrap within the message width, including narrow panels. Submit answers sends
all reviewed question/answer pairs through that surface's chat transport.
The card disables repeat clicks while sending, preserves answers on failure,
and recognizes completed submissions in loaded history. Sending custom text
from the chat composer collapses earlier question cards to their title and plain
question text, including after reload; unsent messages do not collapse them. Draft answers reset
when the card unmounts. Implementation: `chat-questionnaire.tsx` alongside
`chat-kit.tsx`; the versioned envelope is shared with the Webchat plugin.

Partner Orders lists active orders; Closed Orders (`/partner/:id/closed-orders`)
contains orders explicitly closed or associated only with closed/inactive jobs.
Shared orders stay active while any linked job is open. The archive is read-only.
ARs accept an optional supplier note for the whole request, submitted atomically
with answers and shown in the admin AR drawer. Migration 0095 is required.

### Permanent job deletion

`DELETE /api/requests/:id` uses migration 0097’s `delete_job_request` RPC.
One transaction deletes the job, demand lines, audit history, canonical Rosie
chat transcript, its ARs with their lines (0139) and its orders: an order
only this job uses is deleted, an order shared with another job loses this
job's lines and is deleted once empty (0141). The response reports affected
counts, including `availabilityRequests`, `availabilityRequestItems`,
`orders` and `orderItems`.
A durable chat marker queues harness cleanup and prevents late
chat writes from recreating the deleted thread. Deleting one item is a
separate operation; it deletes the item's rows on supplier requests too (0139)
and the toast says how many were removed.

The `/requests` desktop toolbar keeps search, filters, New request, and notifications in one row. The live request and line-item count appears in small text below search, including on mobile.

### Deleted availability requests

Admin’s **Delete request** action sets `is_active=false`. It preserves the saved
workflow status, submission date and public token. Normal admin views, supplier
portal lists, By item results, direct detail URLs and public links exclude
deleted ARs. Answers, mapping changes, sharing and submission are blocked,
including from stale pages. Migration 0109 removes Hidden and the two closure
history columns. Reopening a job never reopens or restores an AR; AR reopening
requires an explicit status change on an active request.

### Merged audience notes

Job requests and items use `note_for_customer` and `note_internal`. Availability
requests use `note_for_supplier`; their lines (candidates) split it again in
0119 into `note_for_supplier` (LPS's ask) and `note_from_supplier` (the reply);
a candidate's `note_for_customer` is LPS's override of that reply for the
customer (0130: NULL follows the reply, empty is a deliberate blank), and a job
line shows its selected candidate's. Orders and order items use
`note_for_customer` and `note_for_supplier`. Each audience field combines sourcing
requirements and relevant response facts; API names use corresponding camelCase.
Migration 0115 preserves existing text, drops the old `note_from_*` columns and
updates RPCs. Order creation takes one customer note argument.

Customer and supplier line notes appear once in their named note column on
desktop, mobile cards, print and copied order tables; notes no longer appear
beneath plant names. Quotes use only `note_for_customer`; supplier order
screens/copy/print use only `note_for_supplier`. Internal notes stay private.
The shared supplier note editor is prefilled with the current merged text.
LPS note-only AR corrections do not start processing; supplier answer RPCs do.

Rosie keeps customer notes focused on sourcing: cultivar, color, alternatives,
purchasing units and meaningful availability/ETA. Spacing, layout, installation
instructions, project headings and unrelated details are excluded. Updates
preserve still-relevant requirements and supported outcomes in the same field.

Request-card **Copy quote**, order-card **Copy order** and AR-card **Copy
availability** actions use the same compact 32px outline button. The quote template picker renders in a body portal
so rounded cards cannot clip it; it opens above the trigger when needed and
closes on outside click, Escape, or page scroll. A copied quote prints each
line's requested size and name (the customer's ask, as the table shows it, even
with a substitute selected) with the selected candidate's price and effective
customer note. An unavailable line copies as quantity 0 and total $0.00 and
needs no price (an unpriced one prints `—` for Each); every other line still
needs a quantity and unit price. The availability templates add a Status column; in **HTML
Availability** each Status cell is coloured like the table's status pill
(light-theme tone colours inlined, since email clients drop CSS variables).
