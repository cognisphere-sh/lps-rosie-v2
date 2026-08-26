# Changelog

Notable changes to this app home — the app (`app/`), the harness data dir
(`harness/`), and the deploy scripts. Loosely [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); dates are `YYYY-MM-DD` in
`America/Chicago`.

This project is deployed from `main` rather than tagged, so entries are dated,
not versioned. The `cognisphere-harness` dependency has its own version, called
out when it moves — its upstream changelog is
[`docs/base-harness/CHANGELOG.md`](docs/base-harness/CHANGELOG.md) (read-only
here).

> Entries before 2026-07-27 were reconstructed from git history when this file
> was started, so they are coarser than what follows. `git log` remains the
> complete record.

## 2026-08-26

### Added

- **Reload button for the installed app.** The nav rail (and mobile ⋯ More
  menu) gains a **Reload** entry, shown only when running as an installed PWA
  — a standalone window has no browser toolbar, so on desktop there was no
  way to refresh the page short of knowing Ctrl+R. It first landed in the
  admin Shell only, and the portal — which has its own rail — didn't get it;
  that gap is what the change below removes.
  Later the same day: **Install app is hidden inside the installed window**
  (it and Reload are complements), and the standalone check became "not a
  browser tab" remembered per window in `sessionStorage` — Chrome's
  `display-mode: standalone` match was seen flipping false after an in-app
  reload, which made Reload vanish and Install app appear inside the app.

### Changed

- **The supplier portal now lives at `/partner/:id`** (was `/portal/:supplierId`).
  `/portal/*` redirects permanently to `/partner/*`, so links already in
  suppliers' inboxes keep working. The page routes moved
  (`app/app/partner/[id]/…`) and so did the API (`/api/partner/:id/…`,
  `app/app/api/partner/[id]/…`, no redirect — nothing outside the app calls
  it). The files follow the name: `components/workspace/partner.tsx`,
  `lib/partner-display.ts`, `lib/partner-chat.ts`, and their `Portal*`
  exports are `Partner*` (`PartnerFrame`, `PartnerChat`,
  `redactPartnerRequestRefs`, …). The proxy's public-prefix list, the admin
  app's *Supplier view* and *Portal view* links, rosie's
  `supplier-coordination` skill and the docs follow. Unchanged on purpose:
  the words a supplier sees ("Supplier portal"), the `lps.portal.chat.v1`
  panel preference, and the webchat plugin's `portal` visibility flag — those
  are not paths.
- **One workspace frame for both apps.** `components/workspace/frame.tsx`
  (`WorkspaceFrame`) is now the layout — viewport container, header, nav rail
  with the shared Dark mode / Install app / Reload footer, page column with
  pull-to-refresh and toasts, mobile ⋯ More menu, bottom tab bar — and the
  admin `Shell` and supplier `PortalFrame` are fill-ins of it through slots
  rather than two copies of the same chrome. The portal thereby gains what it
  had been missing: Install app, pull-to-refresh, toasts, the document scroll
  lock, and a rail width preference (`lps.nav.open`) shared with the admin
  app. `useTheme` / `useIsMobile` / `useToast` moved to the frame; `shell.tsx`
  re-exports them, so pages import as before.
- **By item — the portal's requests, grouped by plant.** The supplier portal's
  home gains a **By request / By item** switch. By request is unchanged: one
  card per job under the All / New / Processing / Submitted tabs. **By item**
  is one card per plant, across every open request that asked for it — the
  question the per-request list can't answer, because a plant is spread over
  all of them. A card carries the plant's name and size, the same answer strip
  a request card shows (counts per answer, line count, subtotal) computed over
  the group, and the ask count. **The status tabs are hidden under By item**,
  deliberately: a status is a fact about a request, and that view is grouping
  plants.
- **The expanded rows are the request's line table — the same component, and
  editable.** `ARLineTable` gained an optional **leading column**
  (`leadingHeader` + `renderLeading`); everything after it is untouched, so the
  request page's table and this one are the same table, with the same status
  picker and answer dialog, the same inline Avail qty / Price / Notes cells,
  the same tone accent, row tint and subtotal footer. **A line is answered here
  exactly as it is answered on its own request's page** — a supplier working
  plant by plant no longer opens six requests to say the same thing six times.
  The leading column is **Job**: the request's name (redacted) with its status
  pill, linking to the request, and the customer beneath it where the request
  shares customer details — a request without the flag is never even queried
  for one. Each row belongs to a different request, so a write names its own,
  and answering refetches both lists because it also moves that request to
  `processing`.
- **Dragging an ask onto a catalogue row groups it under that row**, writing
  `availability_request_items.mapped_inventory_id` through
  `setARItemMapping()` — kept a separate entry point from the four answer
  columns, so a mapping can never ride in on an answer write or the reverse
  (`{changes: {mapped_inventory_id}}` is still refused). **The handle is the
  Job cell, not the row** — the rest of the row is editable, and a drag begun
  in a text input would fight selecting its text. Only mapped groups take a
  drop, a group never takes a line it already holds, and the row must
  belong to the supplier's own company (`head_branch_id`). **This makes the
  mapping the one column of ours a supplier can move** — it says which of
  their rows an ask is about, never what they are answering. A supplier with
  nothing mapped has no drop targets, and By item is a read-only regrouping by
  name until rosie seeds one at share time.
- `GET /api/portal/:supplierId/items` behind it (`listPortalItemLines`),
  scoped by `portalSupplier` like every other portal read and deliberately not
  on the shared `AR_ITEM_COLUMNS`. `groupSupplierItems()` is unit-tested in
  `lib/availability.test.ts`.

- **The mapped plant is written down.** `availability_request_items` gains
  **`mapped_inventory_id`** (uuid → `inventory.id`, ON DELETE SET NULL,
  migration 0077): the supplier's own catalogue row our look-up matched to a
  line. The mapping already drove the request — the jr thread named the row it
  found, the supplier thread copied its price into `unit_price` — but it was
  never stored, so a seeded price could not be traced to what produced it, and
  a supplier's answer could not be read against the row we thought answered
  the line. Now it can. **Nothing renders it**: it is outside
  `AR_ITEM_COLUMNS`, outside the portal PATCH whitelist and off every screen,
  by request. **Not backfilled** — the mapping was never stored, and a re-run
  search answers a different question than "which row did we ask from".
  Written by rosie's supplier thread; the app's own Availability request
  dialog still seeds a price without recording the row, so a priced line with
  no mapping is an app-made request, not an inconsistency.
- Rosie's `supplier-coordination` skill writes and reads it: §2 pairs the
  mapping with the price it produced (**both or neither**, and a near-miss is
  an `lps_notes` sentence rather than a mapping), §3 reads each answer against
  it and leaves it alone when the answer contradicts it. `job-requests` §5.2
  makes the `inventory` **id** the part of an availability ask that has to
  travel, and requires a near-miss to be named as not mapping.

- **A page per availability request in the supplier portal**
  (`/portal/:supplierId/requests/:arId`). The home list's cards are links now,
  not disclosures: answering a request is the work, so it gets the whole
  viewport — our note, the customer and delivery blocks where they are shared,
  the count/subtotal strip, the line editor and the button that hands it back.
  A back link, the status pill and the requested/submitted dates sit in the
  frame's toolbar slot. The list card keeps its design — same head, same
  count/subtotal strip — less the chevron, which was the expand toggle and has
  nothing left to toggle; its gutter went with it.
- **Two more supplier answers.** Lines can now be answered **Arriving soon**
  (`arriving_soon`, migration 0075) alongside Available, Can order,
  Diff Size/Qty/Sub and Unavailable. **No new colour**: Diff Size/Qty/Sub keeps
  the `teal` `substitute` already had, and Arriving soon takes `lime`, the one
  of the design's six tones nothing else was using.
- **`processing`, and a request that re-opens itself.** `availability_requests.status`
  gains `processing` (migration 0075) — the supplier has started answering but
  has not submitted — and an AFTER INSERT trigger on
  `availability_request_items` puts a `processing` or `submitted` request back
  to `new` whenever a line is added to it. Adding a plant to a request they had
  already started is a new question, and it has to reach their New tab whoever
  added it, so it is a trigger rather than app code: rosie adds lines by SQL as
  readily as the app does. `submitted_at` is left alone, so the button on such
  a request still reads *Re-Submit*.

- **A Closed destination in the portal's nav rail** (`/portal/:supplierId/closed`),
  last in the rail and last in the mobile bottom bar. One list, newest first,
  no tabs and no filters — a closed request is something you look up, not
  something you triage between. It is the **only** place a closed request now
  appears: they are off the requests page entirely, not even under *All*, so
  the four tabs describe open work and *All* means all of it. Both lists draw
  the same card (`PortalRequestCard`, exported from `portal.tsx`), and a closed
  request's back link and rail highlight follow it to Closed rather than to the
  requests page.

### Changed

- **The supplier portal's mobile layout is the main app's.** No header on any
  portal page — the frame starts at the page's own toolbar, as the Shell's
  `hideHeaderOnMobile` pages do. The bell moves out of the header and into the
  bottom bar as **Alerts, pinned left**, in the Shell's own icon-over-label
  shape with its popover opening upward; **Chat stays pinned right**; and the
  destinations sit between them in the independently scrollable strip, sized to
  a third of the viewport each, so Requests / Orders / Closed show and ⋯ More
  scrolls in. This replaces the portal's one deliberate divergence from the
  Shell, which had kept the bell in a header drawn on both breakpoints. The
  request page — the only one a highlighted tab does not identify — puts the
  job name in its own toolbar row on mobile.
- **The portal request list is four tabs and no filters.** All · New ·
  Processing · Submitted, each drawn label-over-count with the count in that
  status's own tone. The search box, the job-status / item-status / customer
  chips, the date range, the sort and Expand all are gone — that toolbar was
  the admin Job Requests one, and an operator triaging every job needs it in a
  way a supplier looking at their own handful does not. `closed` requests show
  under **All** only. **No API changed**: every server-side filter behind those
  controls still works.
- **Save is now Submit, and Re-Submit once the request has been answered
  before.** The stored `submitted` status reads *Submitted* rather than
  *Answered* to match, and a portal line write moves the request to
  `processing` — the supplier is working on it. The admin drawer's own PATCH
  deliberately does not: an operator entering answers a supplier gave by phone
  is not a sign they are in the portal.
- **Picking a status now behaves per answer.** *Available* opens no dialog at
  all and writes straight through with the available quantity set to the demand
  — "all of it, as asked" needs nothing typed. *Can order*, *Arriving soon* and
  *Unavailable* take a note alone, the first hinting the ETA; *Unavailable*
  also clears any available quantity a previous answer left behind, so a line
  cannot read as unavailable and still quote a quantity. *Diff Size/Qty/Sub*
  takes the quantity you can supply plus the note naming what instead, which
  opens focused. **Price left the dialogs entirely** — it arrives prefilled
  from our catalogue and is corrected in the table's own Price cell, which is
  where a supplier looks for it.
- **`substitute` is `diff_size_qty_sub`** (migration 0076), the value and not
  only its label. The answer always covered a different size or quantity as
  well as a different plant, and the stored word named a third of it. One of
  thirteen answered lines carried the old value; the CHECK is dropped, the row
  rewritten and the CHECK re-added in one statement.
- **rosie's `supplier-coordination` skill → 1.6.0** for the new vocabulary, the
  request lifecycle and what the portal writes alongside each status, so a
  relayed answer is read the way it was given.

## 2026-08-25

### Added

- **Filter the notification bell by agent.** The bell's popover carries a chip
  row — *All* plus each chat agent with its unread count — that narrows the
  list to one agent's threads. It filters the view only: the badge still
  counts every agent, and with a chip active the action reads "Mark read" and
  marks just the agent shown, so nothing you can't see gets cleared. The chip
  resets when the popover closes.

### Changed

- **Supplier-facing availability-request IDs are hidden.** Portal request cards
  and notification rows now identify work by its job name (or the generic
  *Availability request*) instead of exposing internal references. A portal-only
  display transform also covers request/line notes, unread-chat previews and
  chat prose, links, actions and code (including case, spacing and Unicode-dash
  variants) without mutating rendered Markdown destinations. Portal message
  copying serializes redacted labels as plain text, preserves safe HTTP URLs,
  and omits action or URL targets that would expose a hidden reference. Admin
  cards, drawers, transcripts, routing keys and API IDs are unchanged; portal
  search no longer indexes the hidden ID.
- **Fenced chat markdown renders as copyable code.** Triple-backtick blocks,
  including language labels such as `text` and `code`, now render as distinct
  code panels instead of showing their fence markers as prose. Each panel keeps
  its whitespace, scrolls long lines inside the bubble and has an always-visible
  Copy button with success feedback.
- **Chat links are clickable and stay inside their bubbles.** Ordinary HTTP(S)
  text and Markdown links now open safely in a new tab, including agent replies
  that put a Markdown destination on the line after its label or wrap the whole
  link in bold. Long link text,
  raw URLs and inline code wrap instead of creating horizontal scrolling on the
  mobile or desktop transcript; `thread:` / `ar:` action buttons and plain-text
  message copying keep their existing behavior.
- **The supplier portal's Item status chip now filters the line rows, not just
  the cards.** It matched a request that had at least one line in the picked
  status and then drew every line of it, so picking *Available* still showed
  the pending and unavailable rows underneath — the filter looked broken. The
  expanded table now draws only the lines in the picked statuses, matched
  requests open themselves (the drill-in the admin Job Requests page already
  did), and a line under the table says how many of the request's lines are
  shown. The card's own count strip and the header stats still describe the
  whole request, as they did.
- **An availability request line's note to the supplier unfolds on hover.**
  The grey line under a plant name (`availability_request_items.lps_notes` —
  e.g. "Confirm White Natchez; generic Lagerstroemia 15 G listed @…") still
  truncates to one line while the table is scanned, and now wraps to its full
  text when hovered. It carried a `title` tooltip already; the line table is a
  horizontal scroll box, so the text is unfolded in place rather than in a
  panel the box would clip. Applies everywhere `ARLineTable` is drawn — the AR
  drawer, the supplier profile and the supplier portal.
- **The supplier portal's nav rail opens collapsed**, to icons, as the admin
  Shell's rail already did. The chevron at its foot still expands it to
  labels.
- **A job request card's supplier strip is hidden on a collapsed phone card.**
  The engaged-supplier pills (supplier name, its `AR-<id>` links and the
  conversation segment) had nowhere to sit on a narrow card and wrapped to a
  right-aligned line of their own, which is what made the collapsed card read as
  a jumble. Below `md` they now appear only once the card is expanded, and take
  a full-width line instead of hanging off the right edge. Nothing changes on a
  wide card.
- **The chat header no longer shows an agent status line.** The green/amber
  status dot and its *Online* / *Working…* label are gone from both the docked
  and full-screen headers, which now carry the agent's name, role and — off the
  main thread — the thread label. The busy state is still visible where it
  matters: the bouncing-dot "…is working…" bubble in the transcript and the dot
  on the collapsed rail avatar. `StatusDot` remains exported from `chat-kit.tsx`
  but is now unused.

### Added

- **Lily gained matching profile artwork** in `app/public/lily.png` (256×256
  avatar) and `app/public/lily_profile.png` (1672×941 banner). The blue-teal
  project-management identity complements Daisy's green, Rosie's coral and
  Nova's purple while retaining the same illustrated character, curved
  information panel, wordmark and four-capability layout. Lily stays
  Telegram-only — she has no `webchat` plugin — but the artwork is used by the
  app: the banner on **Know your Agents**, and the avatar in the settings tabs
  and the (disabled) chat rail, per the entry below.

- **Lily is wired up: Telegram route, cropped avatar, and a place in the app.**
  Three finishing pieces on the new agent.

  **Telegram → `main`.** Her group `-1004474937526` now routes to thread `main`
  via `state/routes.json`, the rule daisy, rosie and nova each already carry.
  This is not cosmetic: `threadIdStrategy: single` does **not** put telegram
  messages on `main` — without a route they land on a thread called `default`,
  which is where her first messages went in the window between the token being
  set and the rule being added. (`docs/harness/agent-lily.md` now says so; the
  nova doc's older wording implied the fall-through was `main`.) The plugin
  re-reads routes on every poll batch, so it took effect with no restart.

  **Avatar.** `app/public/lily.png`, 256×256, cropped from Nova's banner at
  (168, 0)–(728, 560). The box was chosen against the existing three, recovered
  by template-matching each `<agent>.png` back to its own banner: side 560
  matches daisy's and rosie's, and head-height-over-side lands at 0.56 against
  daisy's 0.57, so the shoulders read the same. Her eyes sit centred
  horizontally at 0.50 and 0.45 down, against daisy's 0.47.

  **In the app.** `lib/agents.ts` gains a fourth entry and a second reason an
  agent can be unchattable: `upcoming` means *not wired up yet*, while the new
  **`reachOn`** names the channel an agent lives on instead of this panel.
  Lily is `reachOn: 'Telegram'`, so she appears on **Know your Agents** and gets
  her own **settings tab** (model, schedules and run state are harness config,
  not panel features), while the rail, the selector and the mobile list disable
  her and `/api/chat/lily/*` answers 404. `chatBlockedReason(agent)` is now the
  one place that label is decided ("Coming soon" / "On Telegram" / `null`),
  replacing the `upcoming` ternary at each of those sites; `CHAT_AGENTS` filters
  on both flags. Only `upcoming` fades a banner on `/agents` — an agent reached
  elsewhere is live, not pending. Her settings tab omits **Appearance**, which
  styles a panel conversation she doesn't have (`chat-appearance.ts` keys its
  stored themes to the three chat agents, so `themes['lily']` would be
  `undefined`), and `suggestions` became optional rather than inventing starter
  prompts for a chat nobody can open.

- **New agent: `lily`, the project manager** (Chris). A fourth agent, added
  because Chris's feedback on how the business and the app actually work was
  landing in whichever conversation he happened to be in and then evaporating.
  Her job is **to listen, continuously**: record everything he says about how
  LPS runs and how the software serves it, build a real picture of the
  business from it, and turn what repeats into changes that improve the
  workflow and the app. She is the only agent whose scope is the whole rather
  than a slice. She writes no application code, touches no Supabase table, and
  contacts no supplier or customer.

  **Telegram only** — no web chat panel, no Gmail, no artifacts, by Chris's
  instruction — on a `single` thread (`main`), which is also where inbound
  agent messages land. `openai-codex` / `gpt-5.6-terra`, 5 slots, no
  `secretsSchema`. Scaffolded with `cognisphere agent new`, so her
  extensions, `scripts/agent/` toolset and `0-*` prompts are byte-identical to
  the other agents'. The app's chat panel is unchanged — it lists the three
  webchat agents, and Lily is not one of them.

  **Three files in her knowledge dir carry the job**, in the order work flows
  through them, all git-tracked with the rest of `harness/`:
  **`feedback.md`**, the running log — every input dated and close to Chris's
  words, **append-only**, because the point is that one remark is noise and
  three is a requirement, and you only see the third if the first two were
  written down; **`business/`**, the working picture of LPS (operations,
  people, seasons, recurring friction) as living documents revised in place,
  each fact carrying where it came from; and **`requirements/`**, what
  crystallizes out — one file per change, with the log dates as its evidence,
  a status (`drafted` → `routed`/`staged` → `shipped`/`dropped`) and a route,
  plus an `index.md` backlog. A **workflow change counts** — not everything
  there is software.

  The procedure is the new **`feedback-loop` 1.0.0** skill: capture, then
  understand, then propose, then route, then close the loop. Capture is
  deliberately cheap — no interrogating Chris, no making him file things
  properly — because the failure that actually costs something is feedback
  that only ever lived in the Telegram scrollback.

  **The routing rule is Chris's** (2026-08-25) and is what shapes the agent:
  **UI/UX changes go to nova to ship now**; **database and workflow changes
  are staged for Bhoumik**, never handed to nova to build; **a skill or script
  goes to the agent that owns it**, which updates its own with Chris's or
  Bhoumik's approval. Mixed requirements are split, and the file says which
  slice is which.

  **Brainstorms now converge on her.** When Chris starts designing rather than
  asking, daisy, rosie and nova tell him to carry it on with Lily *and* send
  her the context by agent message, so she opens the Telegram conversation
  herself instead of making him repeat the idea. Lily is the one LPS agent
  that opens conversations rather than only answering them. Written into
  daisy's and rosie's `1-agent.md` (*Chris & Bhoumik*) and nova's (new
  § *Requirements from Lily*, which also tells him to refuse a DB/workflow
  requirement and send it back to Bhoumik's queue). The same paragraph sends
  Lily a **standing complaint about how the work goes** — "this always takes
  forever" — not just a feature idea: that is exactly the raw material her log
  exists for, and the agent hearing it answers the operational question in
  front of it either way. The three stale `0.1-agent-directory.md` rosters gained a lily line;
  hers is generated on first start.

  **Outstanding, both operator-side:** the bot token
  (`secrets.json → lily.telegram.TELEGRAM_BOT_TOKEN`) and her group's chat id
  (`plugins/telegram/config.json` → `allowedChatIds`, currently empty =
  allow all). Without the token the telegram plugin logs
  `TELEGRAM_BOT_TOKEN not set; telegram plugin disabled` and the agent starts
  regardless. Docs: [`docs/harness/agent-lily.md`](docs/harness/agent-lily.md).

- **Each agent's surfaces are now split by urgency, not by thread type.** For
  **daisy**: a supplier thread's own web panel carries that supplier's work —
  updates, the ingestion feed, and **minor approvals** (an email draft, a
  judgment call worth a nod), asked there and answered there. **`main` is for
  urgent escalations only, over Telegram**, relayed up by agent message from
  the thread that hit the blocker; a routine question or progress update never
  goes there, and `supplier-communications` no longer reports routine sends to
  it — the quoted send on the panel is the report. For **rosie**: routine
  Chris-facing work lives on the thread that owns it (a job order's on its
  `jr-<id>` thread; a non-order supplier or customer matter on that thread),
  and an **escalation goes to `main` on both surfaces** — its web chat *and*
  Telegram — so a critical blocker can't be missed by someone watching one.
  Skills bumped: `supplier-communications` **6.1.0**.

- **The `jr-<id>` thread is now the source for its order** — the one place
  Chris is asked about it, and the one thread that knows its whole state
  (rosie `1-agent.md`, new rule 5). Previously each thread asked him on its
  own web chat, so a single order could ping him in three places and no thread
  held the full picture. Now every job-related approval, decision and
  trade-off goes to the jr thread, and the customer's and supplier's threads
  **route their inputs back to it**: what the supplier answered, what the
  customer said, a changed date, a cut scope, a question they cannot settle.

  Outbound follows the same path. What is to be said is **drafted on the jr
  thread**, approved there, and routed verbatim to whichever thread owns that
  channel, which sends it **exactly as approved** — a sending thread that
  spots a problem returns it for re-approval instead of editing an approved
  draft. Moving drafting to the jr thread also puts the customer-safe filter
  (`job-requests` §4.2 — no supplier names, no supplier pricing) on the thread
  that actually holds the unsafe data, one hop closer than before. Contact
  with no order behind it is still owned, decided and approved on the thread
  it belongs to, and an LPS Partner's portal availability request still needs
  no approval. Skills bumped: `job-requests` **3.4.0**,
  `customer-coordination` **2.3.0**, `supplier-coordination` **1.5.0**.

- **Rosie gets her own mailbox and an email router; the daisy/rosie line is now
  drawn by subject, not by party.** Her mailbox is
  **`chris@localplantsupply.com`** (sending as *Christopher Runyon*) — the
  **correspondence** inbox. Daisy's `chris.r@localplantsupply.com` stays the
  **lifecycle** inbox (price lists, newsletters, onboarding, account setup),
  and both are permanent.

  **The split:** daisy owns supplier **lifecycle management** — discovery,
  onboarding, account setup, paperwork, how availability reaches us, record
  corrections, availability ingestion — and the communication about it. Rosie
  owns every communication about an **order or a job request**, supplier and
  customer alike. A lifecycle matter is daisy's even while rosie is mid-order
  with that supplier; an order matter is rosie's even on first contact.
  Neither can read the other's mailbox, so each router hands over what isn't
  its own — an agent message carrying `MessageId` / `GmailThreadId` / sender /
  subject, with `gws gmail +forward` when the body itself is needed. An email
  carrying both halves is split, each side taking its own.

  **Rosie's `router` now dispatches email.** Her `message-routing` skill
  already routed to `jr-<id>` / supplier / customer threads and anticipated
  this ("future channels (email, phone) will land their unrouted traffic
  here"); it gains the email forward shape, cheap identification from
  sender/subject/attachment names before any body read, promotion of stable
  senders to their own `--from` rules with the catch-all kept last, and the
  lifecycle hand-off to daisy. `plugins/gws/state/routes.json` is seeded with
  the `router-all` catch-all → `router`.

  **Having a mailbox changes both coordination skills.** `supplier-coordination`
  §4 outreach to a non-Partner and `customer-coordination`'s approved customer
  message are now **sent by rosie herself** (`gws gmail +send` / `+reply`,
  replying in the same Gmail thread, routing the answer back with a
  `--gmail-thread-id` rule) instead of being relayed through Chris or daisy's
  mailbox. Chris's per-draft approval is unchanged — a template or a past yes
  is still never standing permission — and he can still send something
  himself. Daisy's `supplier-communications` keeps its send path, scoped to
  lifecycle.

  **Not live yet:** `pollIntervalSec` is deliberately left at `-1` and
  `oauthScopes` at `""` (Gmail only) because the Google credential does not
  exist. Sign in at console → rosie → Settings → gws → *Sign in with Google*,
  then set `pollIntervalSec` to `300`. Scopes must be chosen before sign-in;
  changing them later means signing in again. Skills bumped:
  `message-routing` **1.1.0**, `supplier-coordination` **1.3.0**,
  `customer-coordination` **2.1.0**, `supplier-communications` **6.0.0**,
  `supplier-email-routing` **2.1.0**.

- **A supplier thread's web chat is now that supplier's contact history**, on
  **both** daisy and rosie — the move the customer side made with migration
  0073, extended to suppliers. Every contact is posted to the thread's own
  panel in the same task it happens, inbound and outbound, and the amount
  depends on its kind. **Direct communication** — their reply or question, an
  email daisy sends, an ask rosie had Chris or daisy send — is quoted **in
  full**, headed by subject, sender/recipient and a Gmail deep link. A
  **broadcast** — availability drop, price list, newsletter — gets the header
  only: subject link, sender, first line of the body, attachment names, never
  the body itself. Daisy closes each with a one-or-two-sentence summary
  carrying the numbers (rows updated/inserted, or what it turned out to be if
  nothing was written). Nothing carries `--portal`, so the supplier's portal
  chat never shows any of it, and nothing reaches `main` or Telegram — the bar
  for actually messaging Chris is unchanged.

  Correspondingly, **`notes.md` no longer holds a communication log** on
  either agent. An audit found seven places specifying it as the contact
  record — daisy's `1-agent.md`, `supplier-communications`,
  `supplier-onboarding` and `availability-ingestion`, and rosie's
  `supplier-coordination` (twice) — all now point at the panel instead. Notes
  keep only what outlives the exchange: open loops still owed an answer, and
  durable supplier facts, which continue to live in `suppliers.notes`.
  Existing notes are left as they are.

  The Gmail link is
  `https://mail.google.com/mail/u/0/?authuser=chris.r@localplantsupply.com#all/<MessageId>`:
  `?authuser=` pins it to the LPS mailbox instead of whichever Google account
  the reader is signed into, and the `#all/` view keeps it resolving after the
  `Daisy/*` labelling pulls the mail out of the inbox. (The `/mail/u/<email>/`
  path form Google appears to accept is not real — it errors — and the Gmail
  mobile app takes no deep link, so a phone tap lands in Gmail web.) Formats
  live in each agent's `1-agent.md`; skills bumped:
  `supplier-communications` **5.0.0**, `supplier-onboarding` **2.4.0**,
  `availability-ingestion` **2.3.0**, `supplier-coordination` **1.2.0**. No
  app change — `chat-kit.tsx` already renders markdown links.

- **Every customer and supplier opens its agent conversations from wherever it
  is listed** — the profile header, the table row and the mobile card. A
  customer carries a **Rosie** button: her `customers.rosie_thread_id` thread,
  the one conversation with that customer across all their job requests. A
  supplier carries **Rosie** and **Daisy**: the same `supplier-<slug>` string
  under two agents, so the two buttons open two distinct threads — Rosie for
  order coordination, Daisy for onboarding and availability. Both ids belong to
  the *company* and ride on every location row, so a farm page opens the same
  conversations its company does; on the Suppliers list the pair sits on the
  company row only, since a nested farm row would just reopen the same two.
  On desktop the buttons live in each table's sticky actions column at the
  right edge (Suppliers' widened to hold them beside its hide button); on
  mobile they sit at the card's bottom-right, outside the card's own button
  rather than nested inside it. The control is the agent's own avatar
  (`agent-chat-button.tsx`), the same face the panel and the rail use.
  A customer whose thread rosie has not minted yet gets the id her
  `customer-coordination` skill would mint (`customer-<slug of name>`,
  `lib/customers.ts`) — the same fallback the chat panel's thread picker
  already used, now shared by both. `supplierAgentThreads()` (`lib/agents.ts`)
  is the supplier half: it reads the two columns off a row and offers nothing
  where they are unset, which is what keeps the buttons off the
  search-projected farm rows.

- **Rosie has the `gws` (Gmail) plugin enabled, in passive mode.**
  `harness/agents/rosie/plugins/gws/config.json` is `{ "pollIntervalSec": -1 }`
  — the poll loop only re-reads its settings, never touches Gmail, so no
  inbound-mail notifications fire and nothing is marked read. The dir is what
  makes her a gws agent in the console and seeds her `plugin-gws.md` prompt
  fragment, `scripts/gws/` and the `read-email`/`search-email`/`route-email`
  skills. She has no mailbox yet, so the plugin reports `failed` until someone
  signs her in with Google from her Settings tab (the agent keeps running —
  per-plugin failures don't sink it). Enable procedure and the note that the
  once-per-start `gws_settings` message is not suppressed: `docs/harness/agent-rosie.md`.

- **Each agent's chat colour and wallpaper moved onto its own Settings tab, and
  wallpaper is now per agent.** Appearance used to be one Global block setting
  all three agents' bubble colours side by side over a single shared wallpaper.
  Colour and wallpaper are properties of a conversation, so they now sit on that
  agent's tab beside its model, Google account and schedules, over a preview of
  its own bubbles — Daisy can run the desert line art while Rosie runs Desert
  Night and Nova runs none. Global keeps the app header/accent palette and
  **Reset all**, which still clears both halves. `ChatAppearance.wallpaper`
  became `wallpapers: Record<ChatAgentId, ChatWallpaperId>`; both older shapes
  (`wallpaper: true` and `wallpaper: <id>`) migrate by becoming *every* agent's
  wallpaper, so no existing device's chats changed appearance. The supplier
  portal follows Rosie's wallpaper, as it already followed Rosie's colour.

- **`/settings` is now section-wise, and configures the harness.** The page
  was appearance-only; it is now tabbed — **Global** plus one tab per agent —
  and everything new on it is harness state the app owns no copy of. Global
  holds the harness-level LLM provider (OpenAI Codex only: a browser-driven
  OAuth sign-in that polls the harness's server-side flow, plus the
  enabled-model allowlist, custom ids included) with Appearance below it. Each
  agent tab holds its model id + thinking level (written back into `agent.json`
  whole, so nothing else in the file is lost), its Google Workspace sign-in via
  the gws plugin, and a table of its scheduler `schedules.json` — cron, thread,
  the message the agent receives, when it next fires, and pause/resume and
  delete controls. Every write re-reads the file first, since the agent writes
  it too, and delete confirms first. The next-run column is computed with
  `croner` (added to `app/`, pinned to the `^9` the harness itself uses) against
  the harness timezone, so it agrees with what the plugin will actually do.
  Reaching the harness adds `app/api/harness/[...path]`, which forwards the user's own `pi_sid` (app users
  are harness users) to the harness's authenticated API behind an allowlist —
  the allowlist is the security boundary, and it pins `/fs/file` to the one
  scheduler state file rather than the whole agent directory. Google's redirect
  needs `/api/gws/oauth/*` rewritten straight through, so
  `https://<domain>/api/gws/oauth/callback` must be registered as an authorized
  redirect URI on the shared Google OAuth client before an agent can sign in
  from the app.

- **The availability-request drawer is now editable.** Opening `AR-<id>` from a
  job-request card or an agent's `[…](ar:<id>)` button used to be read-only;
  the admin can now answer its lines — the status picker, the per-status answer
  pop-up and the per-cell quantity/price/notes saves the supplier portal
  already had — and move the request's own status from its pill. Suppliers
  answer by phone and email as often as through the portal, and until now those
  answers had nowhere to land. `PATCH /api/availability-requests/:id` takes
  `{itemId, changes}` alongside `{status}`, going through the same
  `updateARItem` as the portal route without its supplier scope; a closed
  request still refuses writes, so the drawer draws it read-only and points at
  the pill to reopen it. `ARStatusPill` gained an optional `onChange` that
  makes it a picker — the supplier profile's copy passes none and is unchanged.
  A **Save** button at the drawer's foot mirrors the portal's: the answers are
  already written line by line, so what it does is mark the whole request
  Answered and date it. It deliberately does not wake rosie the way the
  portal's Save does — `availability_submitted` says a supplier answered in
  their portal, and the admin who typed the answers here is the one who would
  act on it. `setAvailabilityRequestStatus` now maintains `submitted_at`
  alongside the status (stamped on `submitted`, cleared on `new`, untouched on
  `closed`), so the header's Submitted date is right however the status moved.

- **Supplier Search filters by LPS Partner.** A single-select chip in the
  toolbar beside Type / City / State — *LPS Partners* or *Not partners* — over
  `suppliers.is_lps_partner`. It runs as SQL over the whole match set like the
  other three, which needed migration 0074 to project the column from
  `search_suppliers`: the page had been reading the flag in a second
  `suppliers` query and stitching it onto the RPC's rows, which is enough to
  draw the LPS tag on a row but not to filter one out. That second read is gone.
  Filtering happens on locations before grouping, as the other filters do, so a
  company can appear because one of its farms is the partner.

- **A job request and each of its lines can be deleted.** A trash button last in
  the card head on `/requests`, and one at the right end of every line in the
  table it opens. **Both are permanent** — a real `DELETE`, not the
  `is_active = false` the suppliers and photos tables use. That is the point
  rather than an oversight: an availability request is read in the supplier's
  portal by *supplier id*, not through the job's `is_active`, so retiring a job
  would leave a supplier answering an ask for a job that no longer exists.
  Deleting the request takes its lines, its whole change history, and every
  availability request it produced with their lines — the cascade is the
  database's own FKs, so one statement does it. Deleting a **line** is narrower:
  its changelog entries go with it, but a supplier already asked about it keeps
  their answer, which is unlinked rather than deleted
  (`availability_request_items.job_request_item_id` is ON DELETE SET NULL, and
  the answer keeps the name/size/quantity it was asked about). Both confirm
  first, and the confirm names what goes and says it cannot be undone; the toast
  afterwards reports what the server actually removed, counted before the
  statement ran. `DELETE /api/requests/:id` and
  `DELETE /api/requests/:id/items/:itemId` — the request id is part of the
  line's lookup, so a wrong id cannot reach into another job. The customer
  page's request cards get neither button: that page lists a customer's jobs, it
  does not administer them.

### Changed

- **"LPS Partner" is the only name for it now — the column included.** The flag
  that says a supplier answers availability requests in their portal was
  `suppliers.is_onboarded` in the database and on the supplier profile
  (*Portal onboarded*), while every prompt, skill, tag and screen that reads it
  said **LPS Partner**. Migration 0074 renames the column to `is_lps_partner`
  and re-comments it; rosie's system prompt and her `supplier-coordination`
  skill (v1.1.2) name the new column; the profile field, the LPS tag's tooltip,
  the availability-request dialog's empty state, the rail's Supplier view
  picker and the docs all say Partner. "Onboarded" was also the wrong word
  twice over: daisy *onboards* suppliers into the database — contacts,
  availability, ingestion — without any of them becoming partners, so one word
  named two unrelated states. Historical records (past changelog entries,
  earlier migrations) keep the old name, because the column was called that
  when they were written.

- **The desktop nav rail starts collapsed and stays where you put it.** It
  opened at 196px on every page load and, because each page renders its own
  `Shell`, sprang back open every time you used it to navigate — so collapsing
  it never stuck. The width is now a stored per-device choice (`lps.nav.open`),
  changed only by the rail's own chevron, and an unset preference means
  collapsed. Entering Full chat still force-collapses the rail without saving
  that, since an automatic collapse is not a preference.

- **A job request's links moved out of its sourcing notes and onto its card.**
  The request-level sourcing-note block and every line's sourcing-note popover
  no longer render supplier chips. The links live on the card instead, in the
  empty half of the customer line so the card gains no row: a **Chat** chip on
  the customer's own name, and opposite it **one segmented pill per engaged
  supplier** — the supplier mark and name written once, then a segment for
  **every** availability request the job has with them (previously only the
  newest per supplier was linked at all) and one for their conversation.
  Suppliers are ordered most recently engaged first. A job can have several
  suppliers and several requests with each, so the supplier is the unit rather
  than the request. A note is free text, so any link in it had to be built from
  the job's engagement anyway — and that engagement is a fact about the job, not
  about a sentence in a note.
  `SupplierLink.availabilityRequestId` became `availabilityRequestIds` to carry
  the full list. Request cards on a customer's page share the notes component,
  so they lose the sourcing-note chips too; their head has no links strip.

### Removed

- **`customers.communication_notes` is dropped** (migration 0073), and with it
  the customer page's append-only **Contact log**. The customer side now works
  the way the supplier side has since migrations 0063/0066: what was *said to*
  a customer lives in their Rosie thread, which the page's new header button
  opens, and `customers.notes` keeps its half — what is durably *true about*
  them, edited in place. The column was NULL on every row, so nothing was
  archived and no backup table was made.
  The whole append-a-stamped-entry path went with it: `appendNote` and the
  `APPENDABLE` whitelist, `POST /api/rows`, the `AppendNote` control and
  `noteStamp`. `lib/notes.ts` keeps the reader half (`parseEntries` /
  `shortStamp`), which the job-request note columns still use. Rosie's
  `customer-coordination` skill is 2.0.0 for it — a contact is posted to the
  thread's own web chat now, which is why that chat has to stay complete —
  with `job-requests` and `quote-generation` following where they referenced
  the log.

### Fixed

- **Back out of a conversation opened from a card returns to the card, not to
  the Agents list.** Tapping the Rosie or Daisy button on a customer or
  supplier — in a table row, on a mobile card or in a page header — used to
  push *two* mobile history entries, the Agents channel list and the
  conversation over it, so leaving the conversation landed on a list the reader
  had never opened and had to leave again to get back to what they were doing.
  It pushes one entry now. The view records that it was opened from a card
  (`MobileView.from`), which also makes its Back control read **Back** instead
  of **Back to Agents**, and makes the bottom bar's **Agents** tab open the
  channel list from there rather than walking out of the conversation — that
  tab is the one place the list is still the right destination.

## 2026-08-24

### Changed

- **Mobile chat identity pills now reveal the wallpaper beneath them.** The
  operator and supplier-portal conversations paint their wallpaper on the
  shared mobile chat layer while the transcript stays transparent, so the
  floating pill no longer composites over a solid backing surface. Its mobile
  glass uses a 35% supported backdrop tint (45% fallback) and a light blur so
  cactus lines remain discernible while labels retain contrast. Desktop
  transcript rendering and no-wallpaper light/dark surfaces are unchanged.

- **Chat messages have a one-click copy affordance.** Every text bubble in the
  shared agent-panel / supplier-portal transcript now has an always-visible,
  accessible copy button beside its timestamp and confirms success with a
  checkmark. It copies the plain text users see, including normalized line
  breaks, on mobile and desktop alike.

- **Supplier profiles now show and edit the full address.** The head-office
  profile and every Farms card have a clearly labelled Address section with
  separate stored street, city, state and ZIP values. All four participate in
  the existing staged pencil / Save / Cancel update, preserving blanks and
  partial addresses rather than composing or inferring missing information.

- **Supplier Contacts refresh when opened.** The profile API and browser fetch
  are explicitly no-store, and entering the Contacts tab re-reads all active
  supplier-contact links. Contacts Daisy linked while the profile remained
  mounted now appear without a manual browser refresh.

- **Upgraded `cognisphere-harness` 0.10.2 → 0.11.0.** No harness data-dir
  changes were required — the release is console/API-side. What it means here:
  - **gws sign-in moved to the agent's Settings tab.** Google sign-in/out and
    the scope picker now live on the gws plugin card of each agent's own
    Settings tab; the app-level Settings page keeps only the shared OAuth
    client id/secret (already saved). The callback returns to
    `/agents/<agentId>/settings`.
  - **Legacy `gws auth login` + `gws auth export` is gone.** Nothing here used
    it — `daisy.gws.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` is written by the
    web flow — but the stale `harness/.secrets/gws-credentials.json` (Jul 7)
    is now dead weight, kept only because deleting a credential file is the
    operator's call. `docs/harness/agent-rosie.md`'s "Pending: email (gws)"
    enable procedure was rewritten around the web flow.
  - **Gmail scope rationalized**: `gmail.modify` is always requested (the poll
    loop's mark-read needs it) and no narrower Gmail choice is offered.
    Optional per-service scopes (Calendar, Drive, …) still live in the gws
    config key `oauthScopes` — unset for daisy, so nothing changed.
  - Refreshed the harness-owned scaffold: only `docs/base-harness/README.md`
    and `docs/base-harness/CHANGELOG.md` moved. `scripts/`, `config.example`,
    `.claude/skills/` and `app/artifacts-routes/` were already byte-identical
    to the 0.11.0 shipped versions, and no local edits were overwritten.

- **Upgraded `cognisphere-harness` 0.9.2 → 0.10.2.**
  - **Main threads are coordinators, not workers** (0.10.2, base prompt,
    refreshed wholesale in all three agents). A non-task thread understands the
    request, splits it, delegates, tracks and assembles — it does not read
    `SKILL.md`s, read files or do the work. Any skill-driven procedure now
    goes to a task thread, which reads the skill itself; the main thread only
    names it. Nova's persona bullet defers to that rule for code reads,
    searches and implementation.
  - **The no-version rule moved out of the base prompt.** Since 2026-08-15 the
    deployment forbade quoting a skill's version when referencing it, as an
    edit to the harness-owned `0-base_prompt.md`. That file is replaced by the
    seed on every upgrade, so the rule now lives where deployment behaviour
    belongs — a bullet in each agent's `1-agent.md` — and all three `0-*` files
    are byte-identical to the 0.10.2 seed again.
  - **Skill descriptions rephrased to the tightened spec** (0.10.1,
    `create-skill` v1.3.0): "what's included" is a brief sketch of the main
    procedures rather than an exhaustive contents list, partial applicability
    moved under "use when", and the whole description stays under 1000
    characters. Patch bumps, no procedural change: daisy's
    `availability-ingestion` v2.2.1, `daily-supplier-availability-onboarding`
    v2.1.1, `plant-and-supplier-search` v1.6.2, `plant-photo-catalogue`
    v1.6.2, `supplier-communications` v4.1.2, `supplier-email-routing` v2.0.1,
    `supplier-onboarding` v2.3.1; rosie's `customer-coordination` v1.1.1,
    `job-requests` v3.0.1, `plant-and-supplier-search` v1.1.4,
    `quote-generation` v1.3.1, `supplier-coordination` v1.1.1. Rosie's
    `message-routing` and `text-quote-format` already conformed and were left
    alone. This is the spec Bhoumik asked for on 2026-08-18, now upstream.
  - **Harness-owned skills refreshed** in the app home (`.claude/skills/`) and
    in nova's agent dir, where `create-plugin` and `cognisphere-upgrade` had
    been left at v1.1.0/v1.2.0 by earlier upgrades that only refreshed the
    home's copies: all three are now v1.3.0. `docs/base-harness/` refreshed;
    `scripts/`, `config.example` and `app/artifacts-routes/` were already
    current.
  - 0.10.0's additions (web-based Google sign-in for gws agents and per-agent
    OAuth scope selection) need no data migration; daisy's hand-set
    `gws` credentials path keeps working and is now labelled
    "operator-managed" in the console's new Settings card.
  - Nova's `create-skill` listing adopts the shipped persona's wording — the
    skill authors or updates a skill for **any** agent in this harness, and is
    what to reach for whenever an agent asks to capture or change a procedure.
  - `pnpm-workspace.yaml` excludes 0.10.2 from `minimumReleaseAge`, as every
    prior bump has.

- **Mobile Agents and the supplier chat are pages, not overlays.** Both drew
  over the route they were opened from with nothing but component state behind
  them, so the device Back button skipped past them and left the route
  entirely. Each view now pushes a history entry — the same URL, so the app
  router treats the popstate as a no-op restore — and what is open is read back
  out of `history.state` (`app/lib/history-view.ts`). Back pops one view at a
  time: conversation → Agents list → the page underneath, and in the portal the
  chat → the requests underneath. A conversation opened from a card
  (`openChat`) pushes both entries, so backing out of it still lands on the
  Agents list, matching its own Back arrow. Returning to an entry after
  navigating away restores the view it was opened on. An open view also holds
  the bottom bar's highlight rather than sharing it with the page underneath,
  and a page tab tapped while one is open returns to that page — the tab you
  are already on has no route change to make, so it unwinds the views in
  place instead of leaving the tap doing nothing. One behaviour change
  falls out of it: the portal's remembered open/closed chat panel
  (`lps.portal.chat.v1`) is now the *desktop* panel's only — a mobile chat you
  navigate to should not be open when you arrive.

- **Chat read state moved from the browser to the webchat plugin.** Unread
  dots used to be per-browser localStorage (`lps.chat.read.v1`,
  `lps.portal.chat.read.v1`), so reading a thread on a phone left it shouting
  unread on the desktop. The plugin now owns it in
  `harness/agents/<id>/plugins/webchat/state/read.json` — **two cursors per
  thread**, `web` for the team's panel and `portal` for the supplier, because
  one thread has two audiences with opposite views of it. An open panel's
  existing poll carries `&read=1` and marks the whole thread; `api/send` /
  `api/app-send` mark your own message; the new `POST api/read` backs the
  bell's "Mark all read". `api/threads` and `api/app-messages` now return
  `readId`, so the app just compares `lastId > readId` and no longer
  special-cases the operator's own sends. **`read=1` is opt-in on purpose:**
  the portal's bell polls `api/app-messages` precisely while the chat is
  *closed*, and marking on any GET would have cleared the alert unseen. On
  first start every thread already on disk is seeded read, so switching this
  on lit up nothing; `api/reset` drops that thread's cursors with its
  transcript. Docs:
  [plugin-webchat](docs/harness/plugin-webchat.md#read-state).

### Added

- **New job request** on the Job Requests page — a button beside the
  notification bell on desktop, a floating button above the tab bar on mobile
  (that page draws no header there). It **creates no row**: `POST
  /api/requests/reserve` takes only the id the request will have, through the
  new `reserve_job_request_id()` (migration 0072 — `nextval` on the identity
  sequence, `service_role` only), and the panel opens on `jr-<id>`. Writing
  the row is rosie's, from that conversation, which is also how her `main`
  thread now works: **migration 0072 comes with `job-requests` v3.0.0 and a
  new threads section in her system prompt — `main` creates nothing, it
  reserves an id and hands the ask to the request's own thread, which does the
  customer find-or-create and inserts the request under its own thread's id
  (`OVERRIDING SYSTEM VALUE`) before the lines.** An abandoned start leaves a
  gap in the numbering and nothing else.
- **A job request and its Rosie thread share one name.** Renaming a job on
  `/requests` now retitles `jr-<id>` in the chat panel: the card's rename
  dispatches a new `lps:rename-thread` bus event (`lib/chat-bus.ts`) that the
  panel header follows, and the thread picker already reads its titles from
  `job_requests.name` on each open. The picker renames in the other direction
  too — each **Job requests** card carries a pencil that edits the title in
  place and writes `job_requests.name` through the existing whitelisted
  `PATCH /api/rows`, so the page, the card and the panel header agree. Only
  job cards are renamable; an emptied field abandons rather than unnaming the
  job. `EditableText` now hands the committed value to `onSaved`, which is how
  the rename travels without a refetch.
- **Supplier portal file attachments and voice notes.** The portal composer now matches main chat’s Paperclip + Mic / input / Send order, stages allowlisted images, documents and audio through Rosie’s webchat inbox, records browser-native voice notes (`webm` or Safari/iPhone `m4a`), sends attachment-only messages, and renders portal-visible images, audio and downloads. New app-secret `app-upload`/`app-file` plugin endpoints enforce the existing 25MB cap, fixed-length opaque stored names, sanitized labels/types, HMAC tickets bound to the exact supplier thread and file, transcript-scoped downloads, audio byte ranges, one-hour orphan expiry, a 20-file/100MB pending quota and a 10-file/50MB message cap; the app always derives the supplier thread server-side.
- **Line totals and subtotals on availability requests.** `ARLineTable`
  (`components/workspace/availability.tsx`, shared by the supplier portal and
  the admin supplier profile) gains a **Line total** column — avail qty ×
  price, an em dash until an answer carries both, so a half-answered line
  never reads as costing nothing (`lib/availability.ts`'s new `arLineTotal`)
  — and a **Subtotal** row at the table's foot (`arSubtotal`, summed over
  lines that carry a total). The portal's collapsed request card
  (`app/portal/[supplierId]/page.tsx`) shows the same subtotal in its status
  strip, appearing once any line has both a quantity and a price.

### Changed

- **A working thread's web chat is the only webchat channel to Chris about
  its work** (Bhoumik). Rosie's questions, approvals and round reports about
  a job request post on that `jr-<id>` thread's own web chat — never on
  `main`'s, and never relayed to `main` by agent message; supplier and
  customer threads ask their own Chris questions (share-details preference,
  draft approvals) the same way. The `main` relay survives only as the
  Telegram escalation for critical blockers. `1-agent.md`, `job-requests`,
  `supplier-coordination` and `customer-coordination` updated.

- **A refresh keeps the chat panel on its open thread.** `lps.chat.v1` now
  records the thread alongside the agent (`{ agent, id, label }`), and the
  panel restores it on mount instead of dropping every reload back to Main —
  so a `jr-` job thread or a supplier conversation survives a page refresh or
  a navigation between pages. The thread is only restored when the panel comes
  back on the agent it was saved for, so rosie's threads never appear under
  Daisy, and switching agents by hand still lands on Main.

- **Supplier portal mobile navigation now matches the main app.** The redundant supplier identity header is gone; Alerts and Chat are fixed at the bottom edges around a three-visible scroll strip for Requests / Orders / More. Alerts shows real new-request counts, and More carries the desktop footer actions in the same Theme / Settings / Log out order without relaxing the disabled supplier-auth gates.
- **Supplier availability cards now follow the admin Job Request hierarchy.** Collapsed and expanded cards use the same bordered horizontal count/subtotal summary and tinted open body; shared customer/delivery locality stays in the scan header while supplier answer states retain their own vocabulary.
- **Supplier chat now reuses the main agent-chat design.** The portal keeps its isolated, portal-visible transport while adopting the saved Rosie accent/wallpaper, mobile glass identity pill, matching bubbles and timestamps, typing dots, top/latest controls and composer treatment.
- **Substitute answers now take a quantity and a price.** The status-answer
  pop-up (`components/workspace/availability.tsx`) showed those two fields for
  Available and Can order only, so a substitute could never carry a line total
  and never reached the request's subtotal — even though a substitute is still
  something being supplied at a price, and the line table's own cells always
  accepted both. Substitute now opens with the demand-prefilled quantity and an
  **empty** price: the price on file belongs to the plant being replaced, and
  carrying it over would quote a different plant at the wrong number. Its
  `What instead` note keeps focus (naming the substitute comes before pricing
  it) and drops `@ price $/unit` from its hint, which the price field now owns.
- **The supplier portal now uses the admin app's layout.** `PortalFrame`
  (`components/workspace/portal.tsx`) holds itself in the Shell's fixed
  visual-viewport frame — keyboard-panned pages no longer clip, and the mobile
  bottom bar hides while a field has focus — and gains the Shell's own slots:
  a **page header on desktop and mobile** (21px serif title, muted subtitle,
  action slot), a **toolbar slot** pinned under it, and children handed a fixed
  `overflow-hidden` box they scroll themselves. Both portal pages moved onto
  those slots, so the Availability Requests page now matches the admin Job
  Requests page down to the empty state and content padding; its title and
  stats line moved out of the page body into the header.
- **A notification bell in the portal header.** `PortalNotificationBell` is the
  admin bell's design and behaviour, over the supplier's own two sources:
  availability requests still at `new` (clicking one expands that card and
  scrolls to it) and an unopened reply from Local Plant Supply — polled every
  20s with the read marker in `lps.portal.chat.read.v1`, and mirrored as a warn
  dot on the chat rail and the mobile Chat tab. It replaces the mobile bottom
  bar's Alerts slot, so the bar is now Requests / Orders / More with Chat fixed
  right: the admin keeps its mobile bell in the bottom bar, but two bells on
  one screen reads worse than one.
- **The supplier portal's chat sidebar is now the same components as the agent
  panel.** The pieces both chats had been keeping their own copies of moved
  into `components/workspace/chat-kit.tsx` — markdown bubbles, the voice-note
  player, attachments, `useComposer` (upload / record / paste), the
  `Transcript`, the `Composer` and the width `SizePill` — and each surface now
  supplies only its transport (file href, upload call) and its copy. The
  portal gains what only the agent panel had: markdown replies instead of flat
  text, the seekable waveform player instead of a bare `<audio controls>`, a
  live recording meter and timer, microphone errors that say which problem it
  is, paste-to-attach, optimistic sends, pull-to-refresh, **Load earlier
  messages** paging (the portal route already forwarded `before`/`limit`),
  starter suggestions, and the panel chrome — a drag handle, **Full / 50% /
  30%** presets and the fold-to-rail chevron, with open state and width kept
  in `lps.portal.chat.v1`. Deliberately not carried over: the ⋯ **Clear
  conversation** menu, which would let a supplier wipe a thread the team also
  reads. Both chats also pick up an upload-failure message (previously the
  agent panel dropped failed uploads silently) and release the microphone if
  the panel closes mid-recording.

### Fixed

- **Supplier cards no longer collapse into horizontal lines on mobile.** The fixed-height result column was allowed to shrink all 27–50 direct card children, while each card’s `overflow-hidden` clipped the content; company wrappers are now `flex-none`, so the list scrolls and every card keeps its intrinsic height.
- **The chat composer opened two rows tall.** Its auto-grow set the textarea's
  height from `scrollHeight`, and Chrome counts a wrapped *placeholder* in that
  measurement while the box is empty — so the portal's long placeholder opened
  the composer at two rows (the agent panel's short "Ask Rosie…" never wrapped,
  which is why it never showed). An empty box now sizes itself from `rows`, and
  a non-empty one adds the border back that `scrollHeight` stops short of, so
  the last line is no longer cropped. The portal's placeholder is short now too
  — the panel narrows to 280px.
- **Agent reply attachment containment uses a real path boundary.** The webchat plugin now checks `relative()` rather than a string prefix, so a sibling directory whose name merely begins with the agent directory can never pass as an in-agent attachment path.
- **Supplier portal mobile editing stays contained.** The availability line table now constrains its own horizontal scroller so the Notes input cannot escape the card, and the status-answer dialog tracks the live browser visual viewport with internal scrolling so Notes and Save remain reachable above Android/iOS keyboards.
- **The per-status answer pop-up's data wasn't reaching the row.** Saving it
  writes quantity, price, status and notes in one PATCH and the page
  refetches, but `AnswerCell` (`components/workspace/availability.tsx`)
  seeded its draft from `value` only on mount, so the refetched answer never
  displayed — the write had landed, the row just kept showing what it held
  before. The cell now takes a freshly committed `value` when one arrives.

### Removed

- **Order-side data reset, take two.** Hard-deleted (no backup) everything in `customers`, `job_requests`, `job_request_items`, `job_request_changelog`, `availability_requests` and `availability_request_items` on the live Supabase project, restarting all id sequences — same pattern as the 0069 reset.

## 2026-08-23

### Added

- **Order-management chat UI across the app and portal.** The `webchat`
  plugin is now **multi-thread** (one transcript per thread under
  `state/threads/`; the old `transcript.jsonl` migrates to the default
  thread; `webchat-cli` gained `--thread-id`, defaulting to the current
  thread, and `--portal`). In the admin app: rosie's chat panel carries a
  **Conversations** picker (search + cards in exactly four categories — Main,
  Job requests, Suppliers, Customers — from the new `/api/chat-directory`
  merged with the plugin's `api/threads`; router and task threads are
  deliberately not offered); every job-request card gets a
  **Rosie avatar** opening that job's `jr-<id>` chat, an **AR chip list**
  opening each availability request in a global right-hand drawer
  (`ar-drawer.tsx`, mounted by the Shell), and **chat icons** on the supplier
  chips and the customer line opening those threads; agent markdown schemes
  `[…](thread:<id>)` / `[…](ar:<id>)` render as action buttons in bubbles —
  rosie renders them when she creates a job request or an availability
  request. In the **supplier portal**: a chat with Local Plant Supply docked
  on the **right** where the admin app's agent panel sits — a 46px rail that
  opens the panel (bottom tab on mobile) — on the supplier's own rosie
  thread, over new server-to-server plugin endpoints
  (`api/app-send`/`api/app-messages`, secret `WEBCHAT_APP_SECRET` wired by
  `scripts/app/secrets.sh`); the portal sees **only portal-visible**
  messages — the supplier's own, and replies rosie sends with
  `webchat-cli --portal` — never the team's internal traffic on the same
  thread. Rosie's `supplier-coordination` gained §3.5 (portal chat), her
  `job-requests` intake acknowledges with the `thread:` button and routes any
  main-thread message about an existing request to its jr thread, and §5.2's
  ask now names the mapped `inventory` rows the supplier thread prefills
  from.

### Removed

- **Order data hard-reset** (Bhoumik's instruction, migration
  `0069_order_data_reset` — deliberately no backup). `customers`,
  `job_requests` (+ items + changelog) and `availability_requests` (+ items)
  truncated with identity restart, clearing the pre-restructure test data so
  real orders start clean on the new thread model.

- **Unread notifications across the chat surfaces.** The webchat `threads`
  listing now carries `lastId`/`lastSender`; the app tracks read state
  per-browser (`lib/chat-notifications.tsx`, localStorage) and shows
  warn-colored dots on agent avatars (rail, panel header, mobile Agents
  list/tab) and thread-picker cards, plus a **notification bell** in the page
  header — badge count, unread list (sender, thread, snippet, time,
  mark-all-read), click-through to the agent and thread. Unread = an agent
  reply or a supplier's portal message; the open panel marks its thread read.
- **`availability_request_items.lps_notes`** (migration 0070) — LPS's brief
  note to the supplier about a line, typically the mapped substitute
  (`Substitute ok: Muskogee Crape Myrtle 30 G`), written by rosie's supplier
  thread at share time and rendered under the plant name in the portal's and
  admin's line tables; not in the portal PATCH whitelist, so never
  supplier-editable.
- **Answering a portal line is a pop-up, not bare status.** Picking a status
  in the portal's line table opens a per-status dialog: Available / Can order
  collect quantity (prefilled with the demand), price (prefilled where on
  file) and notes (Can order hints at the ETA); Substitute and Unavailable
  collect the note with the format hinted (`Name, Size @ price $/unit`;
  Unavailable invites substitutes). One PATCH saves the whole answer; the
  inline cells stay for later tweaks; clearing back to "Set status" stays
  direct.
- **Per-thread web status updates are now the norm** (rosie): every jr /
  supplier / customer thread posts short milestones to its own web chat
  (`webchat-cli send`, defaulting to the current thread) and coordinates with
  Chris there when he writes on the thread in the panel; the never-ping bar
  now applies to Telegram only. Stated in `1-agent.md` and the three
  coordination skills.

### Changed

- **Mobile agent chat now uses a Telegram-style glass header.** The active agent's larger avatar and two-line name / role-and-live-status identity float in an inset rounded pill with a translucent blurred surface while the transcript scrolls beneath it; reserved top spacing keeps the oldest visible content clear of the overlay.
- **Mobile navigation now keeps Alerts and Agents in reach.** The bottom bar
  pins the existing unread-notification bell at the left and Agents at the
  right, with a touch-scrollable middle strip showing three page destinations
  at a time and automatically centering the active route. The strip retains all
  five workspace routes plus More, whose actions mirror the desktop rail's
  bottom section and order (Settings, theme, install, agent profiles, Supplier
  view, account and log out), without allowing its horizontal gesture to move
  the page body.
  Job Requests now omits its redundant Shell title header on mobile, matching
  the other mobile-first list pages; desktop headers and navigation are
  unchanged.
- **Rosie restructured: she owns all order-side supplier and customer
  coordination** (Bhoumik's direction, same day as daisy's restructure). Her
  thread model now mirrors daisy's: `main` (Chris/Bhoumik coordination only —
  a job order gets its customer + request rows created there and is handed
  whole to its thread), one **`jr-<id>`** thread per job request (items,
  sourcing round, statuses, quote), one thread per supplier
  (**`suppliers.rosie_thread_id`**, migration `0068_rosie_thread_ids` — the
  same `supplier-<slug>` string daisy uses, in rosie's own thread namespace;
  backfilled for all 1,395 rows, and set alongside `daisy_thread_id` by
  daisy's onboarding), one thread per customer
  (**`customers.rosie_thread_id`**, `customer-<slug>` minted on first
  contact), and a **`router`** thread for unmapped messages. New skills
  `supplier-coordination` (availability requests for LPS Partners are the
  supplier thread's standing job — Chris is asked only for preferences
  nothing remembers, `share_customer_details` first among them, and his
  answers are recorded as per-supplier preferences in `suppliers.notes`;
  non-Partner outreach is drafted, Chris-approved, and sent by Chris or
  daisy's mailbox), `customer-coordination` (the draft → Chris-approves →
  Chris-sends flow and the `communication_notes` log, moved out of
  `job-requests` §7) and `message-routing`; `job-requests` bumped to 2.0.0
  (asks go to rosie's own supplier threads, not daisy — the dropped
  `supplier_messages` mirror-INSERT and the legacy `supplier-<id>` targets
  are gone; the `…-sourcing` task thread is retired in favour of the jr
  thread). `1-agent.md` rewritten to match (daisy's shape).
- **The supplier-events plugin is back, lean, on rosie.** Recreated with a
  single event kind — `availability_submitted` — delivered to the supplier's
  `rosie_thread_id` thread (`router` fallback when NULL); the daisy-era
  `supplier_message` / `instruction` kinds died with the portal chat. The
  app's `lib/notify-supplier-events.ts` is restored and the portal submit
  route wakes rosie again, passing the thread id it reads at submit time;
  `scripts/app/secrets.sh` re-wires `SUPPLIER_EVENTS_APP_SECRET` (rosie's
  bucket + `app/.env.local`).
- **Daisy's email-router thread renamed to `router`, and it now manages gws
  routing rules.** The catch-all rule is `router-all` → `router`;
  `supplier-email-routing` 2.0.0 adds §5: a stable sender/domain is promoted
  to a direct `routes add` rule pointing at the supplier's dedicated thread,
  with the catch-all re-added after every rule so it stays last (first match
  wins, `add` appends). A directly-routed email arrives as a raw
  `email_received` on the supplier thread, which then applies the primary
  `Daisy` label itself (`availability-ingestion` 2.2.0); `main` hands
  anything un-targetable to `router`. `supplier-onboarding` 2.3.0 sets
  `rosie_thread_id` beside `daisy_thread_id`; `supplier-communications`
  4.1.1 notes the new reply paths.
- **Supplier Type tags replaced and every supplier reclassified** (Chris's
  2026-08-21 direction, applied by Bhoumik). Migration
  `0067_supplier_type_tags` narrows `suppliers.category` to **Grower /
  Wholesale Supplier / Retail / Broker/Platform** (NULL = insufficient
  evidence), retiring `Nursery`, `Wholesaler` and `Other`. The 697-row
  reclassification was a reviewed pass, not a bulk mapping: evidence is the
  original supplier workbook's outreach cohorts cross-checked per company,
  plus a web review of all 73 companies whose cohorts conflicted, were
  ambiguous or matched nothing — per-supplier rationale in
  `harness/agents/daisy/migrations/artifacts/0067_supplier_type_review.csv`,
  pre-change values in `supplier_category_backup_20260823`. Notable
  corrections: Calloway's, Moon Valley stores, Premier Nursery and The Growers
  Outlet are `Retail`; Devil Mountain is a `Wholesale Supplier`; the workbook's
  luxury-builder and non-plant cohorts are NULL with a note saying they are
  not plant suppliers. App: `SUPPLIER_CATEGORIES` and the badge styling carry
  the new vocabulary (filters, Type editors and edit validation follow from
  it). Daisy: `supplier-onboarding` and
  `daily-supplier-availability-onboarding` updated to the new tags. Texas-first
  outreach logic stays separate from the Type field, per the direction.

- **Daisy restructured to supplier discovery, onboarding and availability
  ingestion only** (Bhoumik). Work is now organised as **one dedicated thread
  per supplier company**: migration `0064_supplier_daisy_thread_id` adds
  `suppliers.daisy_thread_id` (`supplier-<slug of head-branch name>`, one per
  head branch, 1,395 rows backfilled), a catch-all `gws` route pins every
  inbound email to a new **`email-router`** thread, and the new
  `supplier-email-routing` skill has it identify the supplier from
  sender/subject/attachment names alone (reading a body only when that fails)
  and forward a pointer to the supplier's dedicated thread — minting the
  thread and briefing onboarding+ingestion for a brand-new supplier. `main` is
  coordination with Chris/Bhoumik only. Skills: `availability-ingestion` 2.0.0
  runs on the supplier thread (absorbing the retired
  `availability-drop-intake`'s Gmail labelling and outcome recording),
  `supplier-onboarding` 2.0.0 sets `daisy_thread_id` and makes newsletter
  signup explicitly best-effort, `supplier-communications` 3.0.0 carries the
  new thread convention plus Chris's 2026-08-20/21 feedback (short casual
  email style, the stored Sales & Use Tax permit as an approved-send
  attachment, standing learning mode), and
  `daily-supplier-availability-onboarding` 2.0.0 dispatches ingestion to
  dedicated threads and honours placeholder-supplier holds. Escalation policy
  throughout: make the defensible judgment call; `main` only for critical
  blockers.
- **`inventory.notes` boilerplate cleanup** (migration
  `0065_inventory_notes_boilerplate_cleanup`, data-only, per Chris): notes no
  longer carry "available as of"/receipt dates, source-file names or verbatim
  source-row restatements — that lives in `source_id`/`inventory_sources`.
  18,162 of 48,771 active noted rows cleared, total notes text halved;
  supplier qualifiers, item codes, yard locations and future-availability
  windows kept. Backup in `inventory_notes_backup_20260823`; the ingestion
  skill's lean-notes rule keeps new rows clean.

### Removed

- **Daisy's availability management** — the `availability-requests` and
  `availability-drop-intake` skills are deleted; request management moves to
  rosie in a later phase (rosie unchanged for now — her sourcing asks and
  `job-requests` thread targets are aligned then).
- **The `supplier-events` plugin** (user-space app→daisy webhook for portal
  activity and chat-view instructions), dropped with its app plumbing
  (`app/lib/notify-supplier-events.ts`, the three notify call sites, the
  `scripts/app/secrets.sh` secret block) — to be recreated, re-targeted, when
  rosie takes over request management. Portal writes still land in the
  database; nothing wakes an agent for them in the interim.
- **The supplier chat transcript** (`supplier_messages`, migration
  `0066_drop_supplier_messages` — 213 rows snapshotted to
  `supplier_messages_backup_20260823`; `suppliers.communication_notes` stays
  the frozen pre-0063 archive), together with its UI and API: the supplier
  profile's Conversation tab and composer, the portal's docked chat pane,
  `GET·POST /api/supplier-messages`, `GET·POST /api/portal/:supplierId/messages`,
  and the chat components/vocabulary in `lib/availability*` /
  `components/workspace/availability.tsx`. Availability requests and their
  portal answering flow are untouched; job-request sourcing links now count
  only availability requests as engagement, and a non-onboarded supplier's
  chip links to their profile. Daisy's `supplier-communications` 4.0.0 records
  a contact as a dated pointer (substance + Gmail thread id) in the supplier
  thread's notes instead.
- **Daisy's memory model tightened** (same day): every supplier quirk lives in
  `suppliers.notes` in Supabase — the `workspace/suppliers/…/notes.md` dirs
  are read-only legacy (read, promote anything durable, write nothing new) —
  and only what long-term consistency depends on gets persisted at all: no
  task updates, progress notes, or minor observations. `1-agent.md` plus
  `availability-ingestion` 2.1.0, `supplier-onboarding` 2.1.0 and
  `supplier-communications` 4.1.0. `1-agent.md` was also simplified (217 → 143
  lines): everything the base prompt already covers (thread-directory and
  workspace conventions, task threads, bash quoting) and every procedure a
  skill owns (router behaviour, ingest-retirement and head-branch rules) now
  lives only in its owning file.

## 2026-08-20

### Changed

- Job Request details now follow the supplied compact workspace reference: an expanded request opens with schema-honest request/contact/delivery/billing-payment blocks, one horizontal status/count/item/subtotal strip, and a denser editable line table. Unsupported delivery schedule and payment-method values are called out as unrecorded rather than invented; complete addresses, audience-specific notes, supplier links, selection actions, and immutable change history remain available in their existing drawers and controls, including on the shared customer request view.
- Supplier detail profiles now show **Type** as an explicit field and edit it through the schema-backed Grower / Nursery / Wholesaler / Other dropdown (with an unset/NULL option). The server write whitelist and enum validation now cover `suppliers.category`; values are never inferred from supplier names, and the profile is re-read after saving.
- Daisy's Supabase query guard now lexically masks PostgreSQL strings, quoted identifiers, and nested comments. Forbidden words in ordinary source-note evidence (including doubled quotes and `E'…'` escapes) no longer cause false rejections, while real destructive statements remain visible; malformed quoted regions fail closed.

## 2026-08-19

### Added

- **Supplier portal, availability requests and the per-supplier chat
  transcript** (migrations `0062_availability_requests_and_supplier_messages`
  and `0063_supplier_chat_transcript`). The second way to verify availability,
  beside daisy's email: an **onboarded** supplier (`suppliers.is_onboarded` —
  Austin Plant Supply is the first) answers a structured ask in their own
  portal, and everything said with any supplier is one chat transcript.
  - **Database** — `availability_requests` (job request → supplier, with
    `share_customer_details` and a `new`/`submitted`/`closed` lifecycle),
    `availability_request_items` (the shared lines **snapshotted** at share
    time plus the supplier's answer: `available` | `unavailable` | `can_order`
    | `substitute`, avail qty, price, notes) and `supplier_messages` — **the
    supplier transcript**: one append-only row per message, `sender`
    broker/supplier, `sender_name`, channel `email` | `text` | `app` |
    `internal`, optionally tied to a job request and/or availability request.
    **`suppliers.communication_notes` is retired**: 0063 migrated its 196
    entries (92 suppliers) into the transcript as internal notes (stamps →
    `created_at`, the literal-`\n` writing defect normalized) and froze the
    column as a read-only archive. `customers.communication_notes` is
    untouched.
  - **Supplier portal** (`/portal/<supplierId>`, ungated — supplier auth is a
    deliberately deferred step, so every route scopes itself to the onboarded
    supplier in the URL and discloses customer details only where the request
    shares them): the admin Shell's design language — collapsible nav rail on
    desktop, bottom tabs on mobile, theme toggle, Settings/Log out drawn
    disabled until sign-in exists — over a request list, a request detail with
    the four-status line editor and Submit, per-request conversation threads,
    and an empty-on-purpose Orders tab.
  - **Admin app** — the supplier profile's **Communications tab is gone**;
    **Conversation** renders the whole transcript as one flat chat after the
    reference design: legend row; bubbles coloured by channel (text green,
    email teal, portal lime, internal grey/dashed); our side right — agents
    solid, staff outlined — supplier left; `time · sender` captions; messages
    from the brief per-request era keep an `AR-<id>` jump chip. The composer
    is mode-first: **Daisy** (records an `internal` instruction and wakes
    her), **Portal** (onboarded farms — reaches the supplier's portal chat),
    **Text**/**Email** (record an exchange that happens outside the app).
    **Availability requests** tab lists and opens requests inline (deep link
    `?tab=requests&ar=<id>`) with a Portal view link and Close/Reopen — no
    per-request chat. The
    Job Requests selection bar gains **Availability request** (onboarded
    supplier + share-details flag, one request per job involved); sourcing
    notes render **supplier link chips** built from the request's engagement;
    the profile gains **Portal onboarded** and the **LPS tag**; the nav rail
    gains **Supplier view**, a stand-in picker until supplier sign-in.
  - The portal home is shaped like the admin Job Requests page — a stats
    header (X new jobs · Y rows pending · Z rows unavailable), the admin's
    own Toolbar (search; **multi-select chips** for job status, item status
    and customer — the customer chip fed only by requests that share one; a
    Requested date range; sort; Expand all) over **cards that expand in
    place** (the per-request page is gone), each card head carrying a status
    strip (X pending · available · can order · substitute · unavailable,
    zeros dimmed), with a **Save** button per request that stamps `submitted`
    (rendered *Answered* — a supplier can save partial answers and refine)
    and wakes daisy on every save. **The chat is one thread per supplier,
    never per availability request**: the per-request threads (and their
    daisy task threads) lasted hours before Bhoumik settled on a single
    conversation; the portal docks that one chat as a right sidebar the way
    the admin app docks its agent panel — starts as the 46px rail, click to
    open, 10-second poll, `internal` messages never cross — and creating a
    request drops a "Sent availability request AR-n" internal note into the
    thread, so no request appears from nowhere.
  - **Harness** — one supplier = one **daisy** thread (`supplier-<id>`),
    availability requests included. New user-space plugin
    **`supplier-events`** on daisy (`POST /webhook/daisy/supplier-events/notify`,
    gated by `SUPPLIER_EVENTS_APP_SECRET`, wired app↔harness by
    `scripts/app/secrets.sh`): portal Saves, portal chat messages and chat-view
    **instructions** all wake her there. **Daisy owns every
    supplier conversation, the portal included** — her new
    `availability-requests` skill (1.0.0) creates requests and answers events;
    `supplier-communications` 2.0.0 replaces the retired log with the
    transcript and the thread convention. **Rosie never touches the supplier
    channel**: `job-requests` 1.13.0 routes every ask to daisy on the
    supplier's thread (task thread for AR follow-ups) and mirrors it into the
    transcript as an internal note. (Earlier the same day the portal was
    briefly wired as rosie's channel — 1.12.0 and a rosie-side skill — before
    Bhoumik settled the ownership; the intermediate state never shipped beyond
    this repo.)

### Changed

- **Appearance controls replace the fixed forest-green app accent.** Settings
  now offers five contrast-paired app header/accent palettes with live updates,
  an Edge-inspired teal default, device persistence and Reset. The existing
  per-agent picker is explicitly labelled **Outgoing message & agent accent**:
  it still independently controls each conversation's outgoing bubbles and
  chat actions, rather than adding a confusing duplicate bubble control. It
  gains an Edge Teal choice and uses it for Daisy by default; the old exact
  Forest/Coral/Violet default trio migrates once while all custom color
  combinations remain untouched. A missing app preference (the former implicit
  green default) moves to teal; valid explicit choices are preserved.
  Browser/PWA theme chrome follows the selected accent, including dark mode;
  the app's internal content header remains a neutral surface.

- **Portal cards and chat take the admin design wholesale** (portal home,
  `availability.tsx`, `portal.tsx`). The availability-request card head now
  follows the Job Requests card exactly — `AR-<id>` ref in primary bold, job
  name, status pill, right-aligned date, the shared customer on its own line,
  and the status strip restyled to the admin demand strip (small dots,
  tabular counts, hairline divider). The shared line table takes the admin
  item table's row treatment: each line's answer paints a 3px left accent bar
  and a row tint (grey while unanswered), under the admin's header
  typography — on the portal and on the admin's read-only view alike. And the
  supplier chat now looks identical on both sides: the portal sidebar gains
  the same legend row the Conversation tab draws, flipped to the supplier's
  side ("You (right)", Internal omitted since it never crosses), over the
  already-shared bubbles and composer.

- **Chat composer is multi-line** (`chat.tsx`). The message box is now a
  textarea: on desktop Shift+Enter inserts a newline (Enter still sends), on
  mobile Enter always inserts a newline and the Send button sends, pasted text
  keeps its line breaks, and the box grows with its content up to ~6 lines
  before scrolling internally.

- **Daisy: nothing is "available" before confirmation, and Chris gates
  availability requests** (`availability-requests` 1.1.0,
  `supplier-communications` 2.1.0). A published listing is not an answer:
  until the supplier submits in their portal (or replies over email/text) — or
  Chris explicitly says to treat a line as confirmed — daisy relays it to
  rosie as a listing ("listed at $X on their <date> sheet, awaiting
  confirmation") and the line stays pending. And the portal is no longer
  standing-authorized per request: unless Chris asked for one or created it
  himself in the app, daisy confirms with him (supplier, job, lines) before
  raising an availability request; replying within an already-open request
  thread remains approval-free.

- **An availability request covers the whole job, and Chris answers two
  questions before it goes** (`job-requests` 1.16.0, daisy's
  `availability-requests` 1.4.0). Rosie's §5.2 opened on "you ask her only for
  what your own look-up couldn't settle", which made the priced lines invisible
  to the step that confirms them and quietly dropped every line no price list
  matched — the ones a supplier is most likely to surprise us on, since a
  published list is what they published, not what is standing in their yard. The
  ask now carries **every line of the request**, with what the look-up found
  stated per line ("nothing on their list" included), and daisy's snapshot
  defaults to every active line rather than a chosen few. A subset is Chris's
  instruction, recorded in the excluded line's `sourcing_notes`, never an
  inference. And the two things a request cannot default now go to him in the
  same message as the go-ahead, answered before anything is inserted: **does
  every line go** (named by count) and **are the customer's name and shipping
  address shared** (`share_customer_details`, still false unless he says
  otherwise).

- **An availability request goes out with the price we already know**
  (`availability-queries.ts`, the portal's request card, daisy's
  `availability-requests` 1.3.0). `availability_request_items.unit_price` is
  seeded at share time from that supplier's own `inventory` row, so the
  supplier confirms or corrects a number instead of typing one and a price
  that has moved since their last list reads as a correction. The app's
  look-up is deliberately narrow — `search_inventory`'s exact identity mode
  (no fuzzy tail), scoped to that supplier and the size asked for, and only
  when every surviving row agrees on one price; anything less certain goes out
  blank, because a wrong number in front of a supplier costs more than an
  empty box. Daisy prefills from the row she can point at (usually the one
  rosie's sourcing note names). `status`, `available_quantity` and `notes` are
  never seeded: **`status` remains the only column that says a line was
  answered**, and the portal says as much under the table while a request is
  still `new`.

- **Rosie: same rule, her side of the line** (`job-requests` 1.15.0,
  `plant-and-supplier-search` 1.1.3, `quote-generation` 1.2.2,
  `system_prompts/1-agent.md`). The rule above was written for daisy only, so
  on JR-5 rosie priced eleven lines off the Austin Plant Supply catalogue and
  marked them `available` — which `job-requests` §5 rung 1 told her to do in
  as many words ("Fill the price from their row, status `available`. Nothing
  goes to daisy."). The ladder now settles **which row prices a line, not
  whether it can be filled**: every rung leaves the item `pending`, and the
  new §5.3 names the only two things that move it — the supplier's own answer
  relayed by daisy (a table maps their four answers onto the item statuses),
  or Chris explicitly saying to treat the line as confirmed, recorded on the
  line. §6 restates `available` and `alternative_proposed` as answers rather
  than findings, so a priced `pending` line is now the correct shape of a
  sourced-but-unconfirmed one; the `Substitute:` sourcing line still goes in
  on proposal, but the customer-visible `Quoted for …` note waits for the
  status move. A search skill hit is reported as a listing ("listed at $X on
  their Aug 18 sheet") and a catalogue stock count as what that sheet claimed
  on ingest day; a filled `unit_price` is no longer permission to quote.
  Rosie's prompt carries it as a fourth never-bent rule.

- **Rosie runs a job request's sourcing round in a task thread**
  (`1-agent.md`, `job-requests` §1.4/§5). One per request —
  `main-§-[TASK]-§-jr-<id>-sourcing` — spawned as the last step of intake and
  kept for the request's life: the catalogue look-ups (a screen of rows per
  line), the item writes and the asks to daisy live there, with
  `--from-thread-id` set to itself so her answers come back to it. `main`
  keeps what a person sees — questions for Chris, customer drafts, quotes —
  plus the `## Tasks` tracking line. Quote builds and long reads get their own
  the same way. The base prompt has said "delegate aggressively" all along;
  nothing in rosie's own prompt or skills had ever named a case, and JR-5's
  eleven-line sourcing round ran end to end on `main`.

- **The shared note never names a supplier or a price list unless someone
  asks for it.** `job-requests` §4.2 ended on a single sentence — "Supplier
  names and supplier pricing never appear either" — sitting at the tail of a
  paragraph about substitution reasons, where it read as a rule about
  substitutions rather than about the column. It is now its own rule naming the
  whole category (supplier names, supplier or catalogue pricing, price lists,
  stock counts, who was asked and what came back), with the exception it was
  missing: Chris or the customer can explicitly ask for one to be named, and
  then it is written — that and nothing more, with who asked recorded in
  `sourcing_notes` in the same task. A message that merely mentions a supplier
  is not that instruction. `quote-generation` and rosie's agent prompt carried
  flat "never" wordings of the same rule and now carry the exception too, since
  a quote's Comments cell is filled from `external_notes`.

- **Job-request cards scan in three lines.** The collapsed head on
  `/requests` was carrying a bordered Demand & Availability panel — six figures
  at 17–19px over two rows — plus the customer's email and phone and both the
  created and updated dates. The panel is now a single-line strip (subtotal,
  item count, then every status with its count, zeros dimmed rather than
  dropped, so "nothing is unavailable" still cannot render as "nobody has
  looked yet"), the contact routes are gone (they belong to the customer, one
  click away on their card, not to this request), and only the updated date is
  drawn, with created in its tooltip. A card is about half as tall, so more of
  the list is in view at once. Nothing was removed from the expanded card.

- **Rosie's sourcing notes name what was priced before the price.** A supplier
  line on a job-request item now follows one shape —
  `<Supplier>: [Substitute: ]<the row they have> @ $<price>/unit[, <facts>]`.
  `APS: $175/unit, Dwarf Sabal Minor/Silver Palmetto 15 G` left a reader to
  work out which half was the offer, and flagged a swap with a trailing
  `alternative` that disappears at the end of ten lines;
  `APS: Substitute: Thryallis 3 G @ $23/unit` puts the swap in the second word.
  The catalogue row is named whenever its wording differs from the ask — that
  is *which row we priced*, which no column holds — and a line with nothing to
  price keeps its `@`-less form (`APS: no 30 G`). `Substitute:` rides with the
  `external_notes` `Quoted for <offering>.` note and `alternative_proposed`;
  catalogue naming differences earn none of the three. `job-requests` §4.1
  (new) with every example moved onto it, plus the matching convention in
  `1-agent.md`. Existing rows keep the old wording until they are next
  rewritten.

## 2026-08-18

### Added

- **A customer has their own page.** `/customers/:id` — a details card (contact
  routes, the four figures, editable Who they are / Address grids, Notes and
  the append-only contact log) with **Requests** and **Orders** tabs under it.
  Each request on the Requests tab opens into the same body the Job Requests
  page draws. Backed by a new `GET /api/customers/:id`. The customer list
  stopped expanding cards in the same change, and everything the old drawer
  held is here.

- **Order columns, drawn and empty.** The customers table and the customer page
  both carry `Orders` and `Total order value`, and the customer page has an
  Orders tab. All three read `—` and say why: there are no order tables —
  migration 0055 defers them, with a won request as the hook they will be
  created from. Chosen over reusing closed-won requests as stand-in orders, so
  nothing on screen calls a request an order.

- **The chat sidebar pages its history.** Opening a conversation now loads the
  50 newest messages instead of everything the plugin holds, with a *Load
  earlier messages* button at the top of the transcript for the previous 50 at
  a time. `webchat`'s `api/messages` grew `before=<id>` (walk backwards),
  `limit=<n>` and a `hasMore` flag to serve it; the 2s poll deliberately keeps
  sending no `limit`, because it carries a delta and a truncated delta loses
  messages for good. Prepending a page adjusts `scrollTop` by the height it
  added, so the reader keeps their place. How far back the button reaches is
  still bounded by the plugin's `historyLimit` (200) — paging reads the same
  in-memory window, not the transcript file.

- **Switch agents without closing the chat panel.** The docked panel's header
  now carries the other agents as small avatars — click one and the
  conversation swaps in place. Until now the only way to reach another agent on
  desktop was to hide the panel, click their avatar in the collapsed rail, and
  have it re-open, which meant losing the conversation you were looking at to
  get to the one you wanted. The rail still works the same way; mobile keeps
  its Agents list.

### Fixed

- **The status picker is no longer clipped by its own card.** A job card
  clips its overflow — it has to, for its rounded corners and its
  sideways-scrolling line table — so the absolutely-positioned status menu was
  cut off at the card's bottom edge, which is exactly where a request near the
  foot of the list opens it. The menu is now positioned `fixed`, measured off
  the pill, flipping above it when it would not fit below, and closing on any
  scroll underneath it.

- **The open chat panel stays on the agent you picked.** Every page mounts its
  own `Shell`, so the panel's agent state was rebuilt from scratch on each
  navigation and refresh and fell back to the first entry in `AGENTS` — you'd
  be mid-conversation with Rosie, click through to another page, and find Daisy
  in the header. The selected agent now persists to `localStorage` alongside
  the panel's open/closed and width, in the same `lps.chat.v1` record.

### Changed

- **rosie's price column is Austin Plant Supply's.** The sourcing ladder was
  already Austin-Plant-Supply-first, but a line she had to source elsewhere used
  to get that supplier's price written into `unit_price`. It doesn't now: the
  other supplier's price goes on its own `sourcing_notes` line — named, with
  what they quoted — and `unit_price` stays NULL until Chris or the customer
  explicitly sources the line there, which is the one instruction that puts
  someone else's price in the column. A quote reads that column as what the
  house yard charges; a bought-in price belongs to a decision only Chris makes.
  (`job-requests` §5/§5.1/§5.2 → 1.7.0, `quote-generation` → 1.0.4, which now
  says an unpriced line may be unpriced on purpose. Both skills' descriptions
  were rewritten short in the same bump — what the skill covers, plus when to
  use it; job-requests' had grown to within a few characters of pi's
  1024-character cap.)

- **Skill descriptions are an intro plus a when-to-use, not a second copy of the
  procedure.** Bhoumik's rule, applied across the long ones: daisy's
  `plant-photo-catalogue` (→ 1.6.1 — its description was 1455 characters, *past*
  pi's 1024-character cap, so its tail may never have reached her at all),
  `supplier-onboarding` (→ 1.1.2), `supplier-communications` (→ 1.1.1) and
  `plant-and-supplier-search` (→ 1.6.1), plus rosie's copy of
  `plant-and-supplier-search` (→ 1.1.2). Descriptions only — no procedure moved.
  `availability-drop-intake` and `availability-ingestion` were already short;
  the cognisphere-authored skills are upstream's and were left alone.

- **Chat message stamps carry the date.** Every bubble's caption is now
  `YYYY-MM-DD HH:MM` local (`fmtStamp` in `chat.tsx`) instead of a bare
  `9:41 PM`. The transcript pages back over days, so a clock alone made
  yesterday's message read as today's.

- **The chat sidebar says *Working…* whenever the agent is working.** `webchat`'s
  `pending` used to mean only "this panel is owed a reply", so an agent busy on a
  Telegram message, a cron tick or another agent's ping read as *Online* in the
  app. Each poll now also asks the harness for the agent's in-flight queue rows
  (`GET /api/agents/<id>/events?status=in_flight&limit=1`, the browser's session
  cookie forwarded) and ORs that in. A harness that is unreachable or refuses the
  cookie answers "not working" rather than failing the poll. Queued rows still
  read as idle — nobody is chewing on them yet.

- **The customer list is a table, not a stack of cards.** `/customers` now
  renders in the same shape Suppliers does — sticky header with per-column
  sort, filter, resize and drag-to-reorder, a column picker, and the layout
  persisted — with Name, Company, Email, Phone, **Active requests**, **Active
  request value**, **Orders**, **Total order value**, City, State, Street, ZIP,
  Notes, Added and Last updated. The two request figures are summed in the
  browser from the rollup each customer already carries; the name opens their
  page. Cards that expand in a list are for scanning a few; a table is for
  comparing many, and comparing was what the page was being used for.

- **The job card leads with a Demand & Availability panel.** The per-status
  count pills — which only appeared for statuses that had lines — gave way to a
  panel carrying Subtotal and Items demanded above a rule, and below it every
  line status with its **count under its own label**, zeros included. A pill row
  that hides its empty statuses renders "nothing is unavailable" and "nobody has
  looked yet" identically, and those are the two things the card is scanned for.
  The right-hand total/lines stack folded into the same panel.

- **The job card head lost its checkbox.** Selecting every line on a request
  from the head duplicated what the lines already do, on a card whose whole
  first row is now about the job. Selection is per line, in the table the card
  opens; the selection bar is unchanged.

- **Toolbar filter chips select more than one value.** Every chip on Job
  Requests and Customers is a multi-select: a checkbox per option, an "all" row
  that clears, and the menu stays open while more are picked. Date-range chips
  stay single-pick — two ranges back from now are one range. The list APIs
  already parsed comma-separated sets, so nothing server-side moved.

- **Job Requests opens with Archived unticked.** The Status chip starts on every
  status but Archived, and *Clear all* returns to that rather than to nothing.
  Archived is terminal and there are only ever more of them. It is a starting
  selection, not a rule — ticking Archived brings them back.

- **A request's internal log scrolls instead of running on.** The sourcing log
  in the Order details drawer is append-only and unbounded, so on a
  well-worked request it was the block setting the height of the whole note row
  — the shared note and the customer's words beside it padded out to match, and
  the line table pushed off screen. It now sits in a 160px scroll box, on both
  pages that draw the drawer. The other two blocks are untouched.

- **Rosie sources from Austin Plant Supply first, and signs every note she
  writes.** Two policy changes from Chris, carried in her `1-agent.md` and the
  three skills that act on them (`job-requests` 1.3.0,
  `plant-and-supplier-search` 1.1.0, `quote-generation` 1.0.2).

  **The default source.** Austin Plant Supply (`suppliers.id = 1`) is the house
  yard and its catalogue is already in the database, so a line is priced from
  their row by Rosie's own look-up — reading inventory was never "contacting a
  supplier", and going to daisy first for something the database can answer was
  a round trip for nothing. `job-requests` §5 is now a ladder: their price, else
  their closest alternative (a neighbouring size, a near cultivar — proposed to
  the customer with `alternative_proposed` + an `external_notes` explanation),
  else other suppliers, else `unavailable`. A line that leaves Austin Plant
  Supply must say in `internal_notes` **why** it left and **whose** price it now
  carries; when an Austin substitute and another supplier's exact ask both
  exist, both are recorded and `needs_attention` lets Chris pick. Chris or the
  customer naming a supplier — or excluding one — overrides the ladder, recorded
  with who said it. `plant-and-supplier-search` gained the scoped look-up
  (filter `search_inventory`'s result to supplier 1, and read the whole size
  range, since the closest size they *do* have is what gets recommended) and had
  a stale claim corrected in the same pass: the RPC has no `supplier_ids`
  parameter — scoping and sorting are the caller's.

  **Pricing writes one column.** New `job-requests` §5.1: `unit_price`, from the
  row sourced. `available_quantity` is **not** Rosie's — how many we can supply
  is settled by people in the app — and `total` stays generated, i.e. the
  customer's *asked* quantity times the unit price, which is also what a quoted
  line is. A `0` in an inventory row is not a price.

  **Notes are signed as well as stamped.** The entry format becomes
  `[<timestamp>] <Name>: <text>`, the name being whose entry it is: `Rosie` for
  her own work, `Chris`/`Bhoumik` for what they decided, `Daisy` for what came
  back from her. It applies to every append-only column she writes — both
  `internal_notes` and `customers.communication_notes`. The app's appends
  (`lib/notes.ts`) are unchanged and still carry no name — it resolves the
  signed-in user in `lib/session.ts` but never threads it into `appendNote` —
  so an unsigned entry now reads as one a person typed in the UI.

- **"Needs input" is derived from status, not from an empty availability.** A
  line waits on a person when its `needs_attention` flag is set **or** its
  status is anything but `available` — a substitution to approve
  (`alternative_proposed`), a plant we can't get (`unavailable`), or a line
  nobody has answered yet (`pending`). The previous implicit signal was
  `available_quantity IS NULL`, and the pricing rule above breaks it: that
  column is filled by people in the app and never by Rosie, so it says nothing
  about whether the sourcing landed and would have flagged every line she ever
  touched. One rule — `needsAttention` in `lib/job-request-queries.ts` — feeds
  the line pill, the card badge, the header count and the `needs=1` filter
  (applied in SQL, so a page and its count still describe one set). Rosie's
  `job-requests` §6 says the matching thing from her side: the status flags
  itself, so the column is for what the status doesn't say.

- **`internal_notes` is now `sourcing_notes`** on both job-request tables
  (migration 0061), and **Sourcing note** in the UI — the drawer block, the line
  table header and the popover. "Internal" said who may read it, which
  `customer_notes` and `external_notes` already imply by contrast; the new name
  says what goes in it. Data, column position and history are untouched, and
  changelog entries written earlier still name `internal_notes`, which is what
  it was called when they were written. `inventory.internal_notes` is daisy's,
  means parse caveats on an ingested row, and keeps its name.

- **A customer-facing note names a change; it does not argue for it.**
  `external_notes` now says only what the customer is being offered —
  "Substituting 3 G for the 5 G requested", "Quoting 12 rather than 10" — and
  never the reason, which stays a `sourcing_notes` line. A note that argues its
  case invites a negotiation about the case; one that states the offer leaves
  Chris to say more if he wants to. **Sizes are written `XX G`** in both note
  columns, the way the inventory prints them; only an item's own `size` keeps
  the customer's verbatim wording. The two notes already written were rewritten
  to match.

- **Newlines in a note are real newlines.** Rosie had been writing `\n` as two
  characters — a plain single-quoted `'\n'` in psql is a backslash and an `n`,
  not a line break — so three sourcing sheets rendered as one long line in the
  app. The three rows were repaired and the `job-requests` skill now says to use
  `E'…\n…'`. Nothing in the app changed: the note field already renders real
  newlines (`whitespace-pre-wrap`), which is how the bug was visible at all.

- **`needs_attention` is gone — the column and every trace of it**
  (migration 0060). It was the weaker of two ways to say "a person has to look
  at this"; `status` is the other, and says it in a more specific word.
  Removed with it: the badges on lines, cards and a customer's request list;
  the amber row tint; the toolbar's count and filter; the selection bar's
  **Flag for input** / **Clear flag**; the `needs=1` API parameter and the
  `needsOnly` filter; the sort that floated flagged requests to the top;
  `attentionCount` and `summary.attention`; the column's entries in the PATCH
  whitelist and the boolean coercion that existed only for it; the two partial
  indexes over it from 0055 (dropped with the column by Postgres); Rosie's
  `job-requests` §6 and her prompt's "set the flag" instruction; and the
  Job Requests chat starter that asked which requests need attention. What
  says a line needs a person now is its **status** —
  `alternative_proposed`, `unavailable`, `pending`, against `available`, which
  needs no one — and `internal_notes` says why. Both tables were empty, so
  nothing was lost. `job-requests` skill at 1.5.0; Statuses and Contacting the
  customer renumber to §6 and §7.

- **The "Needs input" badge is gone from every row.** The pill on a line, the
  badge on a request card, the copy of it on a customer's request list, and the
  amber row tint all went. They were drawn when "waiting on somebody" meant an
  unanswered availability and marked a handful of rows; under the status rule
  above they marked every line that is not `available` — which is every line
  still being worked, so the marker stopped distinguishing anything, and the
  status pill next to it already said the same thing in a more specific word.
  The row tint went with them, because it had begun overriding the status
  colours it sat on top of. What remains: the toolbar's **Needs input · N**
  count and filter, the selection bar's **Flag for input** / **Clear flag** over
  selected lines, and the `needs_attention` column itself, which Rosie still
  sets with a reason. The per-request toggle went with the badge that carried
  it, so a request-level flag is now set from the selection bar or by Rosie,
  not from the card head.

- **A popover closes when anything outside it is clicked**, including another
  popover. `useOutsideClose` tested whether the click had landed inside *any*
  `[data-menu]`/`[data-pop]`, so opening a second note or status picker left the
  first one open behind it. It now returns a ref for the popover's own
  container and closes on a mousedown outside *that* node; every caller (the
  note and status popovers, the toolbar chips, the column and filter menus)
  attaches it. A caller that doesn't keeps the old behaviour rather than closing
  on its own clicks.

- **`internal_notes` is free text, edited in place — no longer an append-only
  log.** What the column is actually for is a working sheet: a terse line per
  supplier on a line item (`APS: $26/unit, availability requested`,
  `Acosta: $50/unit, confirmed available`), *kept current*, so a supplier's
  answer rewrites their line instead of adding a second entry under it. Free
  text is welcome and nothing enforces the shape. At request level it is
  narrower still — only what changed about the job (`Delivery date 8/22 →
  8/29`); a line's sourcing detail belongs on the line. Both are ordinary
  writable columns now, edited as a textarea (the drawer's Internal note block,
  and each line's Internal note popover, which previews the last line and counts
  the rest). `customers.communication_notes` is untouched and is the last
  append-only column in the app — a contact happened at a time and cannot be
  edited into not having happened — so the stamped-and-signed entry format
  applies there alone. The history `internal_notes` used to carry itself was
  always in `job_request_changelog`, which records the before and after of every
  write regardless of who made it.

### Added

- **A job request has a name** (migration 0059 — `job_requests.name`, nullable
  text). A request was addressable only as `JR-<id>` and by whose it is, which
  is enough to look one up and not enough to recognize one: a customer with
  three open requests gave three identical-looking card heads. The name is the
  handle people already use — "Riverbend patio planting" — written by Rosie at
  intake and editable from the card head. Nullable and never generated: an
  unnamed request shows nothing there, because `JR-<id>` beside it is already
  its name, and "Request 12" would read as though somebody had named it.

- **A customer's requests open in place, on `/customers`.** An expanded
  customer card now leads with its *Job requests*: the customer's own record —
  name, company, contact routes, address, notes and contact log — moved behind a
  **Customer details** drawer, shut by default with a one-line summary of what
  it holds, the same second-level chevron a request card keeps its particulars
  behind. A customer is opened to see what they have asked for; their record is
  read when it is being edited.

  Each line in the *Job requests* block now has a chevron of its own, and
  opening it draws the request exactly as `/requests` draws it — the Order details drawer
  (shipping, billing, the three note blocks), the editable line-item table and
  the Change history — so the question "what did they actually ask for?" is
  answered where it is asked, without changing page and searching for the
  customer again.

  The expanded card was ~700 lines living in `app/requests/page.tsx`; it is now
  `components/workspace/job-request.tsx`, whose `RequestBody` both pages render.
  Line selection is the one thing that varies: it is a prop, and without it the
  select column is not drawn at all — `/customers` has no bar to act on a
  selection, and a checkbox nothing can act on would be a lie. Nothing about
  `/requests` changed on screen.

  The request itself is fetched only when a line is opened, through a new
  `GET /api/requests/:id` (`jobRequest()` in `lib/job-request-queries.ts`, which
  now shares its record → row mapping with the list read). The customers payload
  is untouched: it still carries only the rollup each line shows, so a card
  costs nothing extra until a request on it is actually opened. Writes made
  inside an opened request refetch it along with the customer list, since the
  totals and counts on both are derived.

- **Rosie is live in the web app's chat panel**, alongside Daisy and Nova. Her
  `webchat` plugin was already configured and running on the harness side
  (`threadId: main`) since she was created; the only thing holding the panel
  back was the `upcoming: true` flag on her entry in `app/lib/agents.ts`, which
  the desktop rail, the mobile Agents list, the `/agents` page and the
  `/api/chat/<id>/…` proxy all read. Removing it — plus an intro line and three
  starter suggestions — is the whole change. `main` is the same thread her
  Telegram route lands on, so the panel and Telegram are one conversation, the
  way Daisy's are. No agent carries `upcoming` now.

  Two descriptions that had gone stale were corrected in the same pass: her
  `agent.json` (and the peer `0.1-agent-directory.md` copies daisy and nova
  read) still called both channels "pending", and `docs/harness/agent-rosie.md`
  still called her Telegram bot token pending — `lps_rosie_bot` authenticates
  and its chat is routed to `main`.

- **A Customers page** at `/customers`, with a rail entry beside Job Requests —
  the two customer-side surfaces, in the order the work runs: who they are, then
  what they asked for. One collapsed card per person, ordered by **name**,
  because that is how a customer is looked up (Job Requests leads with what
  needs attention instead). The head carries name, company, whichever contact
  routes exist, the address, `N requests · M open` with the summed line total,
  and the last contact-log entry on one line. Expanding gives editable blocks
  for who they are, their address, their **Notes** (durable facts, edited in
  place) and their **Contact log** (`communication_notes`, append-only — the
  same rule as a request's internal log), plus a list of their active requests
  with status, line count and total. Search matches name, company, email or
  phone; a State chip and a **With requests** toggle narrow it.
  New `GET /api/customers` and `lib/customer-queries.ts`.
  - **No create form, deliberately.** Customer creation is Rosie's find-or-create
    during intake — email, then phone, then name + company. A New button beside
    that is a second, blinder create path, and the duplicate rows it produces are
    exactly what the matching order exists to prevent. The empty state says so.
  - Two extractions, because Customers is the second consumer of each and
    duplicating either would let the copies drift: **`lib/notes.ts`** now holds
    the append-only note convention (`parseEntries` / `noteStamp` /
    `shortStamp`) that the agents' skills and this app both write, and
    **`components/workspace/editable.tsx`** holds the click-to-edit text,
    textarea and append-entry controls that were the Job Requests page's.
  - Fixed in passing: the nav rail's comment and the docs both still claimed
    Job Requests was "rendered disabled because it is out of scope". It has been
    live for two days.

- **A Change history drawer on every job request** — the whole
  `job_request_changelog` trail at the foot of the expanded card, behind a
  toggle. Every edit to the request or its lines appears, by this app *and* by
  the agents: the log is trigger-written, so neither write path has to cooperate
  for it to be complete. An entry names its actor in words (`service_role` →
  "This app", `postgres` → "An agent script"), says whether it created or
  changed something and what it was about, and lists each column as
  `old → new`. New `GET /api/requests/:id/changelog` and
  `jobRequestChangelog()`; fetched only when the drawer opens, and re-fetched
  after any write so an edit you just made appears in the history you are
  looking at. Read-only — the rows are immutable by design.

### Removed

- **The Size chip is gone from the Job Requests toolbar.** It read poorly as a
  facet: unlike `inventory.size`, which is a graded vocabulary with a reviewed
  `size_std`, `job_request_items.size` is the customer's **verbatim ask** and
  migration 0055 deliberately gives it no standardized twin — "30 gal", "30 gal
  or larger" and "30g" are three dropdown options for one thing. The
  **server-side filter and its facet stay** (`GET /api/requests?size=`,
  `?facets=1`): this is a toolbar decision, not a lost capability.

- **Job request JR-3 was hard-deleted at the owner's request** — the only
  request on the deployment, an anonymous 2026-08-17 Telegram intake with 13
  line items. `ON DELETE CASCADE` took its items and all 52 of its
  `job_request_changelog` entries with it; the tables are now empty
  (`customers` already was). Not recoverable.

### Changed

- **Caliper is visible by default in both desktop plant tables** — Plant Search
  and supplier Inventory share the `plants` column layout, so `cal` was removed
  from that layout's default-hidden list without changing its `caliper_std`
  range filter or sort. Existing `lps.tables.v1` layouts migrate once by
  removing only `cal` from `plants.hidden`, preserving all other column order,
  width and visibility preferences. Mobile Plant Search keeps its labelled
  **Cal** value, and mobile supplier Inventory cards now show the raw supplier
  caliper when present. Dimensions remain outside broad free-text search.

- **`job_request_items.status` narrows from seven words to four** —
  `pending → available | alternative_proposed | unavailable`
  (**migration 0058**, applied via the Supabase MCP).
  - **`sourcing` is gone** because it described an *activity*, not a state of
    the line, and the activity was already recorded item by item and
    timestamped in `internal_notes` — which says *what was found out*, not just
    that someone was looking. A line being worked is `pending`.
  - **`confirmed` is gone**: it was a stronger `available` that nothing in the
    app or the skills distinguished. Acceptance is a note plus
    `job_requests.status = 'closed_won'`.
  - **`cancelled` is gone**: a dropped line is `unavailable` with the reason in
    the notes, and a line entered *in error* is deactivated
    (`is_active = false`), never statused.
  - Existing rows were remapped before the CHECK narrowed —
    `sourcing`→`pending` (6 rows), `confirmed`→`available` and
    `cancelled`→`unavailable` (none). Every remap is in
    `job_request_changelog`, so each line's prior value is recoverable.
  - App side: the status dropdown offers four, the derived **Partial** pill now
    overrides only `available`, and a card's count pills have four buckets. The
    `job-requests` skill and `docs/supabase-schema.md` say why in the same
    change. `job_requests.status` is untouched — its `sourcing` is the
    *request's* lifecycle stage.

- **`customer_notes` is documented as the remainder, not a transcript.** The
  `job-requests` skill now states that whatever a structured column already
  holds — plant, size, quantity, address, identity — belongs in that column and
  only there, with a where-it-goes table, the rule that restating the ask adds
  nothing, and the observation that a note duplicating a column means the column
  was filled wrong. This is what the app's new sub-line under an item name is
  for: the *extra* the customer said, read alongside the fields.

- **Job Requests: order details became a second level of expansion.** Shipping,
  billing and the three note blocks moved out of the bottom of the expanded card
  into an **Order details** drawer directly under the head, shut by default and
  carrying a one-line summary of what it hides. They are read when a request is
  being actioned, not when it is scanned. The head is lighter for it — the
  street address moved into the drawer and only the destination city and state
  remain — and was repolished around that: the line total is now the prominent
  figure, the per-status count pills have their own row, and the newest note sits
  below a hairline.

### Added

- **Job Requests gains the Order Requests design's selection, action bar and
  split note columns.** The screen already drew the design's cards, tones and
  status pills; this brings over the parts that were missing and finishes the
  three audiences the schema actually has.
  - **Selection.** A tri-state checkbox on each card selects that request's
    visible lines; each line has its own. A selection only means something over
    lines you can see, so anything that falls out of view when a filter, a
    search or a page turn changes the result set leaves the selection with it.
  - **A bulk action bar** appears with the selection: **Set status**, **Flag
    for input**, **Clear flag**, and Clear. Applied per line through
    `PATCH /api/rows` with `Promise.allSettled`, so one rejected line does not
    hide the ones that went through and the toast names the failures. The
    design's Email quote / Text quote / PDF quote / Place order / Send
    availability request are **deliberately absent** — Rosie has no mailbox and
    may not contact a customer unbidden, and the order tables are deferred by
    migration 0055. A button that only raised a toast would misrepresent the
    system.
  - **Two note columns instead of one.** The mock draws a single Notes column;
    the schema has three audiences with three different rules, and one cell
    cannot honestly edit a field written for the customer *and* an append-only
    log. **Shared note** edits `external_notes` whole; **Internal note** shows
    the log and appends to it; the **customer's own words about a line** are a
    read-only italic sub-line under its name, where the ask is read. The
    collapsed card gained the newest note on the request, truncated to one line
    and tagged with its audience.
  - **`internal_notes` is writable from the app for the first time**, by
    appending only. New `appendNote()` behind `POST /api/rows` — a separate verb
    from PATCH because PATCH *replaces* and these columns must never be
    replaced. It has its own short whitelist, stamps the entry
    `[YYYY-MM-DD HH:MM America/Chicago]` server-side (the browser's clock is not
    the deployment's timezone) and separates entries with a blank line, which is
    what `noteEntries` reads back. It is read-modify-write, because PostgREST
    cannot express `col = col || $1`; `job_request_changelog` records every
    write either way, so a racing append is recoverable rather than gone.
  - **Row tinting** now follows the design: a line's background is its status
    pill's colour thinned to about a third (`toneTint`, via `color-mix`), with
    selected beating waiting-on-input beating the status tint.

### Fixed

- **Popovers holding an editor closed on the first click inside them.**
  `useOutsideClose` only treated `[data-menu]` as inside, but the job-request
  status pickers and note popovers mark themselves `[data-pop]` — a mousedown
  into one of their textareas counted as an outside click. It now honours both,
  the same pair the Order Requests design listens for.

### Changed

- **Suppliers, Plant search and the supplier profile now present one company,
  not one `suppliers` row.** A company that operates at several sites is
  several rows tied together by `head_branch_id`, and every surface drew one
  line per row — Everde alone filled fifteen lines of a fifty-line page, and a
  buyer had to reconcile them by eye. The database is unchanged: stock, prices
  and pickup are still per farm, and every plant still belongs to one. What
  moved is the unit each screen presents.
  - **`/suppliers`** is one row per company, and the row is the **head
    office's own record** — its contacts, website and address. Only `# Items`
    and the ingestion columns are company-wide, because a corporate office
    holds no stock and a row reading `0 items` would understate the company it
    stands for. A leading chevron expands the farms that answered the query as
    full rows. The head office is read from `suppliers` rather than picked out
    of the match set, so searching `bunnell` still presents *Everde Growers*,
    with `1 of 15 farms` on the expander. This replaces the collapsed
    company *wrapper* row added on 2026-08-16, which showed a name and two
    counts and cost a click before any supplier detail was visible.
  - **`/plants`** is one card per company, with every matching row from every
    one of its farms beside it and a new read-only **Branch** column naming the
    farm each row is at. Everde's 102 Crape Myrtle rows are now one card
    spanning six farms instead of six cards under a wrapper. The card's
    aggregates (`# Plants`, `Lowest price`, `In stock`) describe the matched
    plants across the company.
  - **`/suppliers/:id`** on a head-branch id is one page for the whole company.
    Contacts, Communications, Notes and Files cover every location and **tag
    each entry with the farm it belongs to**; Notes is one editor per farm and
    Communications merges the farms' logs by timestamp. The **Other farms** tab
    becomes **Farms**, which now carries each location's full editable field
    grid — so a farm's city, availability source and cadence stay editable
    without leaving the company page — beside a link to that farm's own page.
    The Inventory tab spans the company and draws a **farm card beside its
    rows**, the same shape Plant search uses, because inventory is per farm
    even when the page is not. A farm id still resolves to that farm alone:
    same component, scope of one, with a link up to the company.
  - Server side: `getSupplierProfile()` replaces `getSupplier()` /
    `getSupplierLocations()` / `getSupplierSources()` and answers the whole page
    in one payload; `getSupplierPlants()` takes a set of farm ids;
    `listSuppliers()` and `searchPlantGroups()` group on `head_branch_id` and
    carry the head-office row. `GET /api/plants?supplierId=` accepts a
    comma-separated set. `# Items` still loads as a second pass, now over every
    location of every company on the page (60 extra ids catalogue-wide — only
    22 companies have more than one site).
  - A single-site supplier — 1,313 of 1,335 companies — renders exactly as it
    did before: `head_branch_id` never chains and a lone supplier is its own
    head, so "this company" and "this farm" are the same code path with a
    different id list.

- **Harness upgraded 0.8.25 → 0.9.2** (data dir migrated with the
  `cognisphere-upgrade` skill). The whole breaking-change window is 0.9.0's
  gws rework, so **daisy is the only agent it touches**:

  - **Daisy owns her mail notifications now.** 0.9.0 adds an agent-writable
    overlay at `plugins/gws/state/settings.json` with a `scripts/gws/settings
    show|set|reset` CLI, re-read on every poll tick: she can change
    `pollIntervalSec` (`-1` silences email outright — no polling, nothing
    marked read, she searches when she wants), `gmailQuery`, `allowedSenders`
    and `requireAgentInTo` without an operator edit. `firstOfThreadOnly` stays
    operator-only, and the effective settings are announced to her as a
    `gws_settings` message on every harness start.
  - **The upstream default flip is a no-op here.** 0.9.0 moved
    `pollIntervalSec` 60 → 900 and `requireAgentInTo` true → false; daisy's
    `plugins/gws/config.json` sets both explicitly (300 and false), so her
    inbound behaviour is unchanged.
  - **The other three entries are seed files** — the new `scripts/gws/settings`,
    the rewritten `system_prompts/plugin-gws.md`, and the `read-email` (1.1.1),
    `search-email` (1.0.1) and `route-email` (1.0.1) skills, all reworded off
    the old you-in-`To` delivery rule and onto her settings. They re-copy on the
    next agent start, so restarting daisy was the entire migration.
  - **0.9.1 and 0.9.2 are runtime-only** — three memory leaks closed (the
    session-cost cache, the Ajv singleton, a wedged `pi` child that now times
    out at 60s), stdin EPIPE no longer crashes the server, and batch teardown
    now SIGKILL-sweeps pi's whole process group, plus a /tmp janitor for
    `pi-bash-*.log` and stale browser profiles. One behavioural consequence
    worth knowing: **a background process an agent starts no longer survives
    its turn** — the group sweep kills it at batch end.

  The scaffold refresh was again a no-op beyond the upstream changelog:
  `scripts/`, `config.example`, `docs/base-harness/`, `.claude/skills/` and
  `app/artifacts-routes/` are byte-identical across the two versions, so the
  live routes adapted from the template (its `LOCAL.md`) gained no drift to
  port. No base-prompt entry in the window, so the documented local edit to all
  three agents' `0-base_prompt.md` survives untouched.

### Removed

- **JR-14 is deleted.** "16202 Oak Grove Rd landscaping, Aug 25 delivery" and
  its 11 line items, removed at the owner's request; the changelog rows went
  with them on the foreign key's cascade.

## 2026-08-17

### Added

- **The Job Requests screen is live at `/requests`**, implementing the Order
  Requests design comp (Claude Design project `ebbc6644-…`) against the real
  tables. Each request is a **collapsed card** carrying what it is judged on —
  `JR-<id>`, status, a Needs-input badge, customer and contact routes, ship-to
  address, dates, `N lines · $total`, and a per-status count pill row — and
  expands to the design's line-item table (Item / Size / Demand / Avail / Unit
  price / Total / Status / Notes), colour-keyed by status with a tinted
  needs-input row. **A collapsed card's counts always describe the whole
  request**, never the filtered subset the expanded table draws. Searching or
  filtering by item status auto-expands the cards that matched, because that
  question was about lines. Toolbar carries search (plant, customer, or
  `JR-7`), Status / Item status / Size / Customer / Created / Updated chips, a
  Needs-input toggle and Expand all. New: `app/app/requests/page.tsx`,
  `app/app/api/requests/route.ts`, `app/lib/job-request-queries.ts` (server) and
  `app/lib/job-requests.ts` (the status vocabulary, shared with the API), plus
  the six status **tones** in `globals.css` with dark variants. The nav entry is
  enabled; `docs/app/README.md` records what was deliberately *not* built —
  selection and the bulk quote/order actions — because those are approval-gated
  flows that do not exist yet, and a button that only raised a toast would
  misrepresent it.
- **Inline editing on Job Requests.** Click a line's name, size, demand, avail
  or unit price to edit it (Enter or blur commits, Esc abandons, an unchanged
  value is never written to the changelog); pick a status from the pill's
  dropdown; toggle the needs-input flag from its badge; edit the ship-to and
  bill-to parts and the shared customer-facing note in the expanded detail
  block. Writes go through the existing whitelisted `PATCH /api/rows`, extended
  with the two job-request tables plus server-side vocabulary checks for
  `status` and range checks for the quantities — so a bad value returns a
  sentence naming what is allowed rather than a constraint-violation string.
  **`total`, `customer_notes` and `internal_notes` are deliberately not
  editable**: the first is generated, the second is the customer's own words,
  and the third is an append-only sourcing log a grid cell would overwrite.
  Verified against the live request: an edit from the app records
  `service_role` in `job_request_changelog` beside Rosie's own `rosie` entries,
  which is exactly what the 0055 trigger was for.
- **`job_request_items.available_quantity`** — migration 0056. The design's
  Demand/Avail pair, and the source of its "Partial" state: NULL is unanswered
  (a dash, never zero), 0 is confirmed unavailable, and below `quantity` is
  partial cover. "Partial" stays **derived** rather than stored so a status word
  can never contradict the numbers printed beside it.
- **The customer side of the database** — migration 0055
  (`customers_and_job_requests`, applied via the Supabase MCP): `customers`
  (inline contact fields, unlike the supplier `contacts` split),
  `job_requests` (nullable `customer_id` for anonymous intake; status
  `sourcing|quoted|closed_won|closed_lost|archived`, `closed_won` being the
  future convert-to-order hook), `job_request_items` (verbatim `name`/`size`,
  generated `total`, per-item status and notes), and the trigger-written
  `job_request_changelog` audit trail that captures UI and agent edits alike
  (actor from the `app.actor` GUC, else the connecting role). `needs_attention`
  flags on requests and items are the surface the future Job Requests UI will
  read. Full narrative in `harness/agents/daisy/migrations/0055_*.sql` and
  `NOTE.md`; schema doc updated in the same change.
- **The `rosie` agent**, rebuilt from scratch as the customer-success agent
  (`harness/agents/rosie/`, docs in `docs/harness/agent-rosie.md`): owns every
  agent-side write to the new tables, coordinates all supplier questions
  through daisy by agent-message (never contacts a supplier), and emails
  customers only after Chris approves the specific draft. Skills:
  `job-requests` (intake, concurrency discipline for UI-shared tables,
  sourcing via daisy, statuses), `plant-and-supplier-search` (read-only
  adaptation of daisy's), `quote-generation` (HTML/PDF quotes from templates
  in `knowledge/files/templates/`). Plugins: artifacts + webchat + telegram
  enabled (Telegram bot token pending — the plugin idles without it); **gws
  deliberately not enabled** until a rosie mailbox exists (it hard-fails
  without credentials); enable steps prewritten in her doc. Daisy's prompt
  gained a matching *Sourcing requests from rosie* section, and both existing
  agents' stock `0.1-agent-directory.md` files were deleted to regenerate with
  rosie on restart. The app still lists rosie as upcoming — the Job Requests
  UI is a later build.

### Fixed

- `docs/harness/README.md` drift, corrected while adding rosie to it: the
  harness version line said 0.8.11 (`harness.json` has been 0.8.25 since the
  upgrade) and the agents table still showed nova on `gpt-5.6-terra` (its
  `agent.json` moved to `gpt-5.6-sol`, a drift the 0.8.25 entry below already
  acknowledged).

### Changed

- **The install/home-screen icon is now CR's purple LPS flowering-cactus mark.**
  New versioned 192px, 512px and 180px Apple assets replace the generic white
  leaf on green, and the manifest has a dedicated 512px maskable variant with
  the full cactus inside Android's safe zone. Versioned filenames keep fresh
  installs from reusing the old icon cache.
- **Double-quoted Plant Search is exact; unquoted search remains broad**
  (Bhoumik's direction, migration 0057). One balanced outer pair such as
  `"Italian Cypress"` bypasses partial/fuzzy/note discovery and compares complete
  common, botanical, composed or cultivar identity plus one active direct alias
  hop. Case, punctuation and token order are ignored, but extra identity tokens
  are not—so `"Cypress Italian"` is identical while Arizona Cypress / Blue Ice
  stay out. The app preserves quotes in its existing URL/local-storage query and
  now advertises the mode in the search prompt. Live regression held four
  unquoted ID digests exactly; quoted Italian Cypress returned 20 clean rows / 8
  suppliers and quoted Cupressus sempervirens 29 / 12, both with zero wrong
  identities. No inventory or alias data changed.
- **Multi-location suppliers now present once at company level** in Supplier
  Search and Plant Search (Chris's request, Bhoumik-approved). Supplier Search
  groups the location-level `search_suppliers` match set by migration 0049's
  `head_branch_id` **before** its 50-company pagination, shows combined active
  item/latest-availability summaries, and expands to the exact matching farms.
  Plant Search wraps its existing location groups as company → farm → inventory;
  multi-location companies and their farm inventory start collapsed, while
  single-site suppliers keep the direct row/card. City/state/type filters still
  execute on farms before grouping, so a narrowed wrapper says `N of M
  locations` and aggregates only those matches. No inventory, source, contact,
  edit or profile link changes ownership: every plant remains under its original
  location `supplier_id` and provenance.
- **Column sorting now runs in SQL** on all three tables — the Suppliers list,
  Plant search, and the supplier profile's Inventory tab — over the whole match
  set, rather than reordering the page already in the browser. It was the last
  piece of table state left behind when filtering moved to the server: sorting
  Plant search by price answered "cheapest of the 300 rows relevance returned"
  instead of "cheapest of the 570 that matched", `Name ▲` on Suppliers only ever
  rearranged fifty rows, and on a profile it covered 100 of Austin Plant
  Supply's 1,467.

  New `app/lib/server-sort.ts` mirrors `server-filters.ts` — one spec per table
  mapping a column key to the column the database orders by, plus
  `sortQuery()`/`parseSort()`/`clientOnlySort()`. Sort travels with the filters
  in one debounced string, so a filter click and a sort click landing together
  still cost one request, and a sort change resets to page 1. Missing values
  stay last in both directions; on the plant tables a header sort outranks
  relevance and relevance becomes its tie-breaker. `PLANT_SORTS` drives the
  profile tab's search branch and its no-query browse branch alike, as
  `PLANT_FILTERS` already did.

  What still sorts the page, and why: values assembled after the fetch
  (`# Items`, `Other contacts`, `Inventory sources`, `Last ingestion`, `Source`,
  `Ingested`), `Communication notes` (outside `search_suppliers`' projection),
  `Size` (SQL orders `size_std` as text and puts `100G` between `10G` and
  `15G` — the canonical order is `lib/size-std.ts`, not an index), and Plant
  search's supplier panel, whose master rows *are* this page's groups. Asking
  for "the supplier with the most matches" across the whole result set is an
  aggregate over `search_inventory` grouped by supplier, which no RPC serves.

### Fixed

- **`docs/app/README.md` no longer claims size filtering is page-local.** It
  said the Size selector applied to the current 300-row page of
  `search_inventory`; `PLANT_FILTERS.size` has selected on `size_std` in SQL
  since column filtering moved to the server, so the paragraph had been wrong
  since that change and contradicted *Where a filter runs* further down.

- **daisy moved to `gpt-5.6-terra`** from `gpt-5.6-sol` (provider and
  thinkingLevel unchanged). `docs/harness/` already described daisy as
  `terra`, so the config now matches the docs rather than the other way
  round. nova is still on `sol` against the same doc claim.

- **daisy's `maxConcurrentSlots` raised 5 → 10.** daisy fields Telegram, Gmail
  and the app's chat panel through one agent, and the slot pool is what caps
  how many of those turns run at once — at 5, a burst across the three
  channels queued behind itself.

- **Harness upgraded 0.8.23 → 0.8.25** (data dir migrated with the
  `cognisphere-upgrade` skill). Nothing in the window needed a hand edit:

  - **0.8.24 adds `scheduler-cli list` filters** (`--thread-id`,
    `--active`/`--paused`, `--from`/`--to` with a `fires` array per schedule)
    and the dependency-free cron evaluator behind them,
    `scripts/scheduler/cron-fires`. All three breaking-change entries land in
    plugin-owned seed files — the two scripts and `plugin-scheduler.md` (34 →
    41 lines) — which re-copy on the next agent start, so **restarting daisy
    and nova is the whole migration**. `scheduler-cli list --from/--to` exits
    non-zero until `cron-fires` is seeded.
  - **0.8.25 is web-only** — the thread list nests task threads as a tree to
    any depth instead of a flat two-level dropdown. No harness artifacts.

  The scaffold refresh was a no-op beyond the upstream changelog: `scripts/`,
  `config.example`, `docs/base-harness/` and `.claude/skills/` are byte-identical
  across the two versions. `app/artifacts-routes/` is unchanged too, so the live
  routes it was adapted into (see its `LOCAL.md`) gained no drift to port. The
  documented local edit to both agents' `0-base_prompt.md` survives untouched —
  no base-prompt entry in this window.

## 2026-08-16

### Added

- **The orphan sweep** — migration 0054 adds `plant_photo_reclaimable()`, and
  the photo skill ships `scripts/reclaim-orphans`. This completes lever D of the
  cost plan.

  It lists bucket objects **no active catalogue row points at**: a `retired`
  photo's tombstoned object, or an `orphan` with no row at all from an upload
  whose insert failed. The safety rule — an active photo's object is never a
  candidate — lives in the function rather than the script, so it holds however
  the sweep is called. `SECURITY DEFINER` granted to `service_role` only, since
  `storage.objects` isn't reachable through PostgREST and `authenticated` has no
  business enumerating bucket contents.

  Dry run by default, 30-day grace, `--delete` to act. That default is also the
  answer to the plan's open question about how long a deleted photo's bytes are
  kept — a per-run knob rather than a policy.

  **Reclaiming makes retirement permanent**: the row keeps its `storage_path`,
  so reactivating a swept photo gives a broken image with no way back. That
  warning is written from an incident, not caution — a `--older-than-days 0
  --delete --force` run intended for two test orphans took a real retired photo
  with it. Restored the same day from the on-disk intake original (its `sha256`
  was unchanged, which incidentally confirmed the source-hash design), and
  `--reason {orphan,retired,all}` exists as a direct result. `--reason orphan`
  sweeps only the half that cannot cost anyone an undo.

- **Photos are normalised before they are stored** — migration 0053 plus a new
  `scripts/prepare-photo` in the `plant-photo-catalogue` skill. This implements
  lever D of the cost plan, on an explicit decision by Bhoumik: **the catalogue
  is a reference library, not an archive.** Originals are not kept.

  One command bakes EXIF orientation into the pixels, drops all metadata, caps
  the long edge at 2048px and re-encodes to WebP, then reports the column values
  for the insert. Measured on a 4032×3024 phone photo: **7.9 MB → 819 kB, 89.6%
  smaller**, correctly rotated, GPS gone. An already-recompressed Telegram photo
  saves 11% — the honest range, and the win is on phone drops, which is where
  growth comes from.

  Dropping GPS is a privacy change as much as a size one: a photo taken at a
  supplier's site carries their coordinates and the catalogue has no use for
  them.

  **The bucket enforces it rather than the skill describing it.** 0053 narrows
  `plant-photos` to `image/webp` and 8 MB, so uploading an original now fails
  with `InvalidMimeType` — exactly one process writes to that bucket and it
  always emits WebP. HEIC left the accepted list because it is a *source* format
  `prepare-photo` reads (via the newly-declared `pillow-heif`) and converts,
  never something we store.

  **`plant_photos.sha256` now means the file we were handed, not the object
  stored.** The distinction only exists once normalisation does, and getting it
  wrong would quietly break dedupe: a photo re-sent next month must still
  collide with the row we hold, and it would not if the key described our own
  output, which changes whenever the encoder settings do. One-row-per-object is
  guaranteed by `plant_photos_object_idx` instead — which is what it was always
  for.

  **The 44 existing objects are deliberately not backfilled.** Re-encoding them
  would destroy originals we still hold to save roughly 13 MB. They normalise if
  and when they are re-sent, so this saving is prospective.

  Still open from lever D: the orphan sweep. Retired photos' objects are never
  reclaimed (one today); the skill carries the audit query, and automating
  deletion waits on a decision about how long a deleted photo's bytes are kept.

- **`/photos` loads 50 at a time behind a Load more button** — the grid appends
  instead of flipping pages, because a wall of photos is scanned downwards and a
  pager throws away everything already looked at. The button carries the
  remaining count.

  The API takes an **`offset`, not a page number**, and that is what makes it
  correct rather than merely different: the offset is how many photos are on
  screen, so deleting one out of the middle doesn't make the next batch skip the
  row that moved up into its place. A batch that arrives after the question
  changed is dropped rather than appended, and an id already on screen is never
  appended twice.

  **Fixed while building it:** an offset past the end of the match set returned
  a 500. It is reachable in normal use — the browser's `total` is from the last
  response, so a photo someone else deleted in between makes the request
  overshoot legitimately. It now returns an empty batch with the true total.
  PostgREST signals this with HTTP 416 and the **status is the only reliable
  signal**: on the RPC path the body parses to "Requested range not
  satisfiable", but on the table path supabase-js hands back a truncated
  `{ message: '{"' }` with no error code at all.

- **A storage and network cost plan** for the photo catalogue, in daisy's
  `knowledge/files/plans/photo-storage-and-network-cost-plan.md`. **Nothing in
  it is implemented** and every phase has a trigger, because at 44 photos and
  20 MB none of it is worth doing yet — the point is to decide the trigger
  points before the numbers arrive.

  The measured finding: cost is not storage, it is egress, and it is one
  mistake. The grid renders thumbnails from **full-size originals** — 459 kB
  average, 4.5 MB at the top end, to paint a 250 px square. A full batch of 50
  is ~23 MB where thumbnails would be ~1 MB. Second is round-trips: every image
  costs an app request, a database read and a signing call, none of it cacheable
  because the signature is minted per request.

- **Ingests now catalogue the photos in a drop** — `availability-ingestion`
  gains an image-triage table in §1 and a new §6. Every image in a drop is one
  of three things: a photograph *of a price list* (a source — parse it), a
  photograph *of a plant* (a catalogue photo — §6), or a logo/signature/
  letterhead (skip; it is most of what an email carries, and it is under 200 px
  or 20 KB). §6 hands the write to `plant-photo-catalogue`, now a fourth entry
  in the skill's boundary list, and adds only what the ingest context
  contributes: the supplier §0 resolved — **only** when the drop mapped to
  exactly one location — and the drop's provenance string.

  Most of §6 is about what the drop is **not** evidence for. The sheet beside a
  photo says nothing about the photo: identity comes from the photo's own
  evidence, size is stated or null and never inherited from the sheet's size
  column, and there is no photo↔inventory link to invent.

  **We hold bytes only for photos someone handed us.** An attachment or file is
  catalogued; a photo that exists as a **URL is captured as a URL and never
  downloaded**. The image stays on the supplier's server, where it is theirs and
  already addressable, so no licence has to be assumed — and we don't maintain a
  duplicate that goes stale the day they replace it. A captured URL lands in
  **`inventory.image_url`** when it belongs to a row being ingested (that column
  is a link, not a copy, and never describes the same image as a `plant_photos`
  row), and otherwise only in the report. `supplier-onboarding` likewise **notes**
  a gallery's URL rather than downloading it.

  `availability-drop-intake` passes every image and the verbatim body (sorting
  plants from logos is the thread's job), digests a new *Photos* block, and its
  `Catalogued` label now also covers an email that carried no availability but
  did carry photos worth keeping.

### Changed

- **The newest source wins, stated explicitly** — `availability-ingestion` §4.
  Update-in-place always meant the current drop's values replace what an older
  file put there, but the skill never said so, leaving a parse that looks like a
  repricing open to being "corrected" back to the stored figure. Three
  qualifications make it usable: **silence is not a value** (a field the drop
  omits is left alone, so a partial list blanks nothing), **the email body
  outranks its own attachment** as the later thing written, and the exception is
  **quotable or it doesn't exist** — the brief, the source itself, or knowingly
  replaying a file older than the row's current source.

  That last one is the trap worth the words: `inventory_sources.created_at`
  records when *we* ingested a file, so a January sheet replayed in August gets
  the newest timestamp and would clobber current data under a naive "latest
  wins". §5 gains the matching QA check and the report an *Overrides withheld*
  block, which intake reads as a judgement check — withholding on someone's
  say-so is correct, withholding because a price "looked wrong" means the
  database is disagreeing with what the supplier actually sent.

### Added

- **Edit a photo's details inline** — the `/photos` lightbox gains a pencil that
  turns its detail panel into a form: the three name parts, size,
  height/width/caliper, tags and caption/notes, staged locally and written as
  one atomic update on Save, the same contract the supplier profile uses.

  `WRITABLE.plant_photos` deliberately omits `name` and the `*_key` columns
  (triggers derive them) and `supplier_id` / `captured_at` / `source`
  (attribution and provenance are cataloguing decisions, not passing
  corrections). `tags` arrives as one comma-separated field and is split into an
  array — the trigger then lowercases, trims, dedupes and sorts it, so the
  database keeps the only definition of what a tag list is. Editing `size`
  **nulls `size_std`**, the same rule height/width/caliper already follow on
  `inventory`; the panel warns that the photo will leave the Size filter until
  the bucket is set again, rather than letting that happen quietly.

  `composePlantName()` is extracted from `plantEditPatch()` and mirrors the
  database's `compose_plant_name()`, so an edited card shows its new derived
  name without refetching a page to learn one string.

- **Delete a photo from the catalogue** — each card on `/photos` carries a
  delete control in its top corner. It confirms first, then soft-deletes
  (`is_active = false`, the schema's convention) through the existing
  `DELETE /api/rows`; `softDelete()` gains `plant_photos` alongside `suppliers`
  and `inventory`. The control is **always visible rather than hover-only** —
  this grid is used on touch screens, where there is no hover. The **image file
  stays in the bucket**: the row still points at those bytes and deleting them
  is not reversible, so the prompt says that instead of implying the file is
  gone. The grid drops the card locally and decrements its total rather than
  refetching, which would pull a photo up from the next page and shift
  everything the user was looking at.

- **Cultivar filter on `/photos`**, matching Plant search. It reuses
  `cultivar_keys` and the same `plantKey` normalization, so one spec entry
  serves both tables — the payoff of the identity parity below.

- **`plant_photos.name_key`** (migration 0052) — generated with the expression
  `inventory.name_key` uses, so the two tables **join on identity**, which is
  what a photo indicator on Plant Search will need. `search_plant_photos` was
  recreated to project it (33 columns). It keys the **whole composed identity**
  (`windmillpalmtrachycarpusfortunei`), not a plant name — the part keys or the
  RPC answer "do we have a photo of this plant?". `height_std` / `width_std` /
  `caliper_std` are now the only columns `inventory` has that photos do not,
  left out because nothing captures a measured value for a photo yet.

- **Searchable plant photo catalogue** — a new `/photos` page, a new
  `public.plant_photos` table, a new **private** `plant-photos` bucket, and
  `search_plant_photos` (migration 0051). An MVP of the plan Nova wrote in
  daisy's `knowledge/files/plans/searchable-photo-catalogue-plan.md`.

  **A photo is an independent record, not a column on `inventory`.** Its
  supplier is optional, it may show a plant nobody currently stocks, and nothing
  about it is retired when inventory or a supplier is. A catalogued photo says
  *this is what this plant looks like* — never *this supplier has it in stock*.

  **Search is `search_inventory`'s algorithm over a different document**
  (name + size + caption + tags + notes) rather than a new one, which is also
  why the table copies `inventory`'s three-part identity and derived `name`:
  that is what puts photos on the `plant_aliases` graph. Searching *Chusan Palm*
  finds a photo catalogued as *Trachycarpus fortunei* even though neither word
  appears on it. Typo tolerance, both-ends partial matching, IDF ranking and
  size-as-a-ranking-group all come along unchanged. One structural difference:
  suppliers join **LEFT**, so an unattributed photo is still findable.

  **The bucket is private**, unlike `lps`. Every image is served through
  `/api/photos/<id>/image`, which takes a **photo id** and reads the path from
  the row — a client never supplies a storage path, so the endpoint cannot be
  turned into a signing oracle for the bucket. Agents use
  `scripts/agent/supabase/sign-url`.

  A blank query **browses** the catalogue newest-first instead of showing an
  empty prompt, which is the one place this page deliberately differs from Plant
  search: browsing is the normal way to use a photo library.

  Daisy gets the **`plant-photo-catalogue`** skill — hash → dedupe on `sha256` →
  upload at an id-built path → insert, plus the evidence rules that keep a
  reference photo from being read as an availability claim: supplier, size and
  dimensions are written only when a source stated them, size is **never**
  inferred from apparent scale, and a conflict between two sources is preserved
  in `notes` rather than reconciled.

  The four photos staged under `knowledge/files/plant-reference-photos/intake/`
  since 2026-08-05 were catalogued in the same pass — they had been waiting for
  exactly this bucket to exist. Their manifests' SHA-256s matched the files
  byte-for-byte, and the windmill palm's recorded discrepancy (a label reading
  `25 Gallon` against Chris's instruction to catalogue it as `30 G`) is carried
  into the row's `notes` intact.

  **Not built, deliberately:** the plan's seven-table model (separate assets,
  many-to-many subjects/links/tags, provenance events), the review workflow,
  perceptual near-duplicate detection, generated thumbnail/display derivatives,
  bulk intake, and a Photos tab on the supplier profile. There is **no approval
  gate** — a catalogued photo is visible to every signed-in user at once.

- **Daisy and Nova can publish pages on the app's domain** — the harness's
  `artifacts` plugin (new in 0.8.23), enabled on both agents. An agent writes a
  self-contained HTML file, runs `scripts/artifacts/artifact publish`, and gets
  a link; each artifact carries a public/private flag that decides which of its
  two URLs works, and **no URL carries a token**.

  ```
  https://lps.cognisphere.sh/a/<agent>/public/artifacts/<slug>    anyone, while public
  https://lps.cognisphere.sh/a/<agent>/private/artifacts/<slug>   signed-in users
  ```

  **The agent is a path segment**, which is the whole reason this deviates from
  the shipped template. The plugin builds share links as
  `<appBaseUrl>/<public|private>/artifacts/<slug>`, so two agents cannot share a
  prefix; upstream's answer is to copy the route tree per agent. Instead each
  agent's plugin config carries its own `appBaseUrl` (`…/a/daisy`, `…/a/nova`)
  and one tree under `app/app/a/[agent]/` serves both, with `ARTIFACTS_AGENTS`
  as the allowlist — a third agent is then a `config.json` and one more name on
  the list. The upstream template is vendored unmodified at
  `app/artifacts-routes/` (excluded from the build) so future upgrades refresh
  it and surface upstream security fixes in the diff; its `LOCAL.md` records
  what was adapted.

  **`signedIn()` verifies the session** rather than checking that a cookie
  exists, as the shipped placeholder does: `pi_sid` is a signed stateless token,
  so it asks the harness `/api/auth/me` — the same call `proxy.ts` makes, now
  extracted to `lib/session.ts` so there is one definition of a real session
  instead of one per caller. `/a/*/public/artifacts/*` is the only path besides
  `/login` left outside the gate; the harness serves it only while the artifact
  is flagged public.

  Deploy wiring lives in the `scripts/app/secrets.sh` hook, not in `config`'s
  `ARTIFACTS_AGENT`: that stock path wires exactly one agent **and** would
  overwrite the committed per-agent `config.json` with a domain-root
  `appBaseUrl`. The hook generates one `ARTIFACTS_APP_SECRET` (reused across
  restarts, so links and sessions survive), writes it to both agents' buckets in
  `harness/.secrets/secrets.json`, and appends it plus the allowlist to
  `app/.env.local`. New `config` key: `ARTIFACTS_AGENTS` (documented in
  `scripts/app/config.example`).

### Changed

- **Harness upgraded 0.8.20 → 0.8.23** (data dir migrated with the
  `cognisphere-upgrade` skill). What the window forced here:

  - **Inbound mail is a preview now, not the mail.** 0.8.22 cut the
    `email_received` body down to the header, the first two lines of the
    sender's own text and the *names* of any attachments — nothing is
    downloaded at poll time. Daisy's `availability-drop-intake` skill (→
    2.2.1) asked the coordinator to put "attachment paths … and the relevant
    email body text" in every dispatch brief, which the notification no longer
    carries, so §2 now says to read the message with `scripts/gws/email read
    <MessageId> --attachments` first (full body; files land in
    `plugins/gws/inbox/<MessageId>/`) and to pass the `MessageId` along so the
    task thread can re-read the mail itself.
  - **`scripts/gws/format-email` is gone**, replaced by the richer
    `scripts/gws/email` (`read`/`thread`/`search`/`labels`/`label`). Plugin
    seeds are never pruned, so the stale script and its `.ts` source were
    deleted by hand; `knowledge/files/gmail-labels.md` named it too and now
    names `email`.
  - **Re-seeded on the next harness restart, no edits needed:** the shortened
    `plugin-gws.md` / `plugin-telegram.md` fragments (capped at 50 lines
    upstream, with their procedures moved into plugin-owned skills), the new
    `email` CLI, and the plugin skills `read-email`, `search-email`,
    `route-email` (gws) and `route-chats` (telegram).

  Not adopted: the new **`artifacts`** plugin (0.8.21) is opt-in per agent and
  no agent here publishes pages, so no `plugins/artifacts/` dir was created and
  `ARTIFACTS_AGENT` stays blank in `config`. The refreshed `config.example` and
  `scripts/server.sh` carry the wiring for whenever that changes. The
  harness-owned scaffold (`scripts/`, `config.example`, `docs/base-harness/`,
  `.claude/skills/` + its `.agents/skills/` mirror) was refreshed wholesale; it
  held no local edits.

- **Daisy's non-thread reference material moved from `workspace/` to
  `knowledge/files/`** — `brand/`, `credentials/`, `plans/`, `templates/` and
  `plant-reference-photos/`. The two prompts that define the layout
  (`0-base_prompt.md` §Workspace, `1-agent.md`) give `workspace/` only
  `index.md`, `threads/`, `daily_notes/` and (LPS-specific) `suppliers/`;
  everything cross-thread and non-supplier is `knowledge/`. `credentials/`
  keeps its `0700` mode and is flagged sensitive in `knowledge/index.md` rather
  than being summarised there. The five references to the old paths in
  `daily_notes/2026-08-{02,05,12}.md` and `threads/main/notes.md` were
  repointed.

  **The move changed what git can see.** `workspace/` is ignored
  (`.gitignore:14`) but `knowledge/` is tracked, so the relocated dirs became
  committable — including the supplier portal login. `.gitignore` now carries
  `**/harness/agents/*/knowledge/files/credentials/**` so it cannot be
  committed (CLAUDE.md §6); `brand/`, `plans/`, `templates/` and
  `plant-reference-photos/` are trackable on purpose.

- **The Gmail label ID table moved the other way — out of `knowledge/` and into
  the skill that reads it** (Bhoumik's call): `knowledge/files/gmail-labels.md`
  → `skills/agent/availability-drop-intake/artifacts/gmail-labels.md`
  (`availability-drop-intake` → **2.2.2**, §5 and the description name the new
  path).

  A procedure's supporting files travel with it, and this one has a single
  reader — `supplier-communications` defers to `availability-drop-intake` for
  labelling rather than labelling itself, so nothing else consulted the table.
  It walks back the skill's own 1.0.0 split, which pulled the label-*application*
  steps out of that file into the skill but left the IDs behind in `knowledge/`.
  `knowledge/index.md` now states the rule (a lookup only one skill reads is that
  skill's artifact) so the table doesn't drift back.

### Added

- **The supplier profile has an *Other farms* tab.** A company that operates at
  several sites is several `suppliers` rows sharing a `head_branch_id`, and the
  profile had no way to get from one to the others — the only cross-location
  link on the page was a contact's *Also covers* line, which only shows the
  locations that happen to share that contact. The tab lists every other active
  location as a card (name, category, city/state) linking to its profile, head
  branch first and tagged **Head office**.

  The tab is offered **only when there is another location**, so the 1,326
  single-site suppliers don't get an empty tab; `?tab=locations` on one of them
  falls back to Inventory. Viewing the head office itself tags no card — it is
  not one of its own other farms — and the tab's intro says so instead.

  New `getSupplierLocations()` in `app/lib/queries.ts`, returned as `locations`
  by `GET /api/suppliers/:id`. It is two cheap indexed reads, not a per-location
  count pass: `head_branch_id` never chains, so one equality on it is the whole
  company. **No item count on the cards** — that would be one `COUNT` per
  location on every profile load (Moon Valley has 17), and the profile already
  loads its own count separately.

### Removed

- **The whole catalogue was deleted again** (Bhoumik's call): `inventory`
  26,340 rows and `inventory_sources` 173 — every row, active or not — leaving
  both tables empty. `suppliers` (1,383), `contacts` (1,854) and their links
  were untouched. A **hard delete with no backup schema**, unlike
  `backup_20260814`, so this state is not restorable from the database.

  **`plant_aliases` was kept and stripped of provenance.** All 432 rows survive,
  but the 431 carrying a `source_id` had it nulled —
  `plant_aliases_source_id_fkey` has no cascade, and deleting the rows instead
  would have re-opened every retired pair, since `dedupe_plant_aliases()` treats
  a tombstone as a blocklist. `source_line` still holds each pair's verbatim
  evidence; what is gone is the link from a pair to the drop it was read out of,
  which is the hole migration 0040 added `source_id` to close.

  **The 2,050 supplier availability files were deleted from the `lps` bucket
  too** (1.63 GB — every object under `suppliers/`, current and historical).
  Only 164 of them backed a live source; the rest were drops the 2026-08-14
  wipe left behind. **There is now no recovery path for the catalogue at all** —
  not a backup schema, not a re-ingest. It also strands `backup_20260814`:
  those 238,748 rows still restore, but every `file_path` they carry now points
  at a deleted object.

  **The other 23 objects in `lps` were deliberately kept**, being work products
  rather than availability data: `daisy_shared/` (16 — the Laurent quote PDFs,
  the supplier duplicate audit CSV, the Twin Lakes image, all handed out as
  signed links), `inventory/` plant photos (5), `brand/lps-logo-transparent.png`
  and the favicon. The `chat-attachments` bucket (240 objects) was not touched.

- **Everde Growers (supplier 32) and Devil Mountain Wholesale Nursery
  (supplier 126) were emptied of catalogue data** (Bhoumik's call): 6,780
  `inventory` rows — 6,187 Everde, 593 Devil Mountain — and their 10
  `inventory_sources`, every one of them active. Active inventory across the
  rebuild went 31,560 → 24,780, active sources 174 → 164. The two `suppliers`
  rows themselves, their contacts and their locations were **not** touched, and
  neither were the source files in the `lps` storage bucket.

  These were the only two multi-location companies with anything ingested since
  the 2026-08-14 reset, so no multi-farm supplier now carries catalogue data.
  Both had their availability ingested against the **head branch** rather than
  the individual farms.

  A **hard delete, against the schema's soft-delete convention**, for the same
  reason the 2026-08-14 wipe was: a deactivated source cascades to its rows
  irreversibly (`trg_cascade_source_deactivation` records nothing about which
  rows it retired), so a soft retire would have been no more recoverable while
  leaving the tables carrying 6,780 rows they could not describe. **No backup
  schema was taken this time** — unlike `backup_20260814`, this is not
  restorable from the database. The 10 source files remain in the bucket, so a
  re-ingest is the recovery path.

- **Alias 242 (`Olive` ↔ `Olea`) kept its tombstone and lost its provenance.**
  It was the one `plant_aliases` row pointing at a deleted source — already
  `is_active = false` — and `plant_aliases_source_id_fkey` has no cascade, so
  the first delete attempt aborted on it. Its `source_id` was nulled rather than
  the row deleted: `dedupe_plant_aliases()` treats a retired pair as a
  blocklist, and deleting the row would have re-opened Olive↔Olea for
  re-insertion. `source_line` still carries the verbatim evidence; only the link
  to the deleted file is gone.

- **Daisy's email threads were purged from `workspace/` and `sessions/`**
  (Bhoumik's call), leaving only the main thread and its own task threads:

  - `workspace/threads/` went 364 → 1 dir (131 MB → 125 MB). Deleted: 228 email
    thread dirs (`Subject[gmailThreadId]`), 61 of their task threads, and 74
    bare-hex dirs from before the subject-prefixed naming. `threads/main/` and
    its 99 `tasks/` are untouched.
  - `sessions/` went 649 → 126 dirs (493 MB → 181 MB). Deleted the 523
    email-thread sessions; kept `main`, `admin` and the 124
    `main-§-[TASK]-§-*` task-thread sessions, mirroring what survived under
    `threads/main/`.

  **Done with the harness stopped** (`server.sh stop harness`), because the
  running server was writing into these dirs mid-inventory; both agents came
  back with zero failed plugins and the agent-manager re-backfilled its thread
  session ids without error. **No backup was taken** and both trees are
  gitignored (`harness/.gitignore:5`, `.gitignore:14`), so this is not
  recoverable.

  `workspace/index.md` was rebuilt from 552 lines to 73: every entry pointing at
  a deleted thread dir is gone, and the 38 `main`-scoped entries were kept
  verbatim.

## 2026-08-15

### Changed

- **`supplier-onboarding-and-ingestion` is split in two, by what each half
  writes.** One skill covered two procedures that run at different times, for
  different reasons, against disjoint tables: onboarding a supplier (which
  happens once, and can happen with no drop attached) and ingesting a drop
  (which happens every week, and usually needs no onboarding at all). It is now
  **`supplier-onboarding`** (`suppliers`, `contacts`, `supplier_contacts`) and
  **`availability-ingestion`** (`inventory`, `inventory_sources`,
  `plant_aliases`), both v1.0.0. **No procedural rule changed in the move** —
  the parsing, size, alias, matching and QA content is the same text, renumbered.

  - **The two call each other, so the main agent still dispatches one thread.**
    `availability-ingestion` §0 works out which location each parsed row belongs
    to; when the sender matches no supplier, or the file names a farm the company
    has no row for, it follows `supplier-onboarding` to create it and returns
    with the id. A supplier onboarded directly that came with availability
    attached goes the other way. Whether onboarding is in scope is discovered
    during the ingest, not decided when the brief is written, so
    `availability-drop-intake` **v2.0.4 → v2.1.0** names `availability-ingestion`
    alone and reads one report — `supplier-onboarding`'s *Onboarding* block folds
    into the ingestion report.
  - **`scripts/match-candidates` moved with the ingestion half**; §4's path is
    now `skills/agent/availability-ingestion/scripts/match-candidates`.
  - **One stale clause dropped on the way.** The alias quality bar still said
    "never a species ↔ one of its cultivars **in a `plant` pair** — that is what
    the `cultivar` type is for", four paragraphs after explaining that migration
    0050 dropped `alias_type` and there are no kinds of pair. The rule stands;
    the reference to a type that no longer exists is gone.
  - The retired skill's `CHANGELOG.md` is kept under *Prior history* in
    `availability-ingestion/CHANGELOG.md` — it carries the approval record
    (dates and sign-off) for rules still in force in both halves.

- **The coordinator stops assembling a list only the task thread can build**
  (`availability-drop-intake` **v2.1.0 → v2.2.0**). §2's brief required "every
  other active location of the same company with their ids", but §1's lookup
  joins `contacts` → `supplier_contacts` → `suppliers` and returns only the
  locations the *sender* is linked to — it never fanned out on `head_branch_id`.
  The contract asked for something the step above it could not produce, and
  nothing broke only because `availability-ingestion` §0 re-derives the set from
  the head branch regardless. That redundancy was masking the gap; both are now
  gone. The brief carries the matched ids and the `head_branch_id`, and the
  fan-out belongs to the thread, whose query also returns the city and state that
  resolving a tab label like `Ft Pierce` against a real row depends on.

  Two smaller overlaps went with it. **§1 now says which lookup fits which
  input**: `search_suppliers` for a name (typo tolerant, where the old
  hand-written `ILIKE` was the query shape `plant-and-supplier-search` exists to
  discourage), the exact `contacts` join for an address (an email matches the
  RPC's contacts branch but scores 0, ranking below every name match). And
  **§4's update/insert check is framed as what it can actually do** — this skill
  reads a report about an already-committed transaction, so it is the backstop
  for a §5 that didn't fire, not a second gate.

- **A skill is referenced by name, never by version.** A stale `(v2.0.0)` in
  `availability-drop-intake` §2 — pointing at a
  `supplier-onboarding-and-ingestion` that is actually v3.6.2 — sat inside the
  one instruction whose purpose is pinning a procedure, and was the line most
  likely to be copied verbatim into a task-thread brief. The rule is now the
  general one, because the version belongs where it is authoritative (the
  skill's own frontmatter and `CHANGELOG.md`) and nowhere a copy can go stale:

  - `availability-drop-intake` **v2.0.3 → v2.0.4**: §2's brief names the skill
    with no version and says why; the boundary list also gains
    `supplier_contacts`, which the ingestion skill writes throughout its §0.3
    but which the "you never write to …" list had left unclaimed.
  - `0-base_prompt.md` **Task threads** for **daisy and nova** (identical
    edit): the "name the skill to follow" bullet asked for "skill name and its
    current version" and now forbids the version. The receiving thread's
    `<available_skills>` is rebuilt at spawn, so it resolves the name to the
    current version itself. **This is a local edit to a `0-*` file**, which is
    harness-owned and seed-replaced on upgrade — the first such divergence, now
    recorded in [`docs/harness/README.md`](docs/harness/README.md) so the
    `cognisphere-upgrade` local-edit pass carries it forward.
  - `docs/harness/agent-daisy.md` and `agent-nova.md` no longer label each
    skill in their listings with its version. Historical `since vX.Y.Z` notes
    stay — those are statements about when something changed, and don't go
    stale.

  Not changed: a skill's own `description` suffix and `metadata.version`, which
  `create-skill` requires and which are the authoritative copy.

- **Harness upgraded 0.8.18 → 0.8.20** (`@cognisphere-sh/cognisphere-harness`,
  both phases; data stamped in `harness/harness.json`). Two breaking changes,
  both about where guidance lives, and both already satisfied by the day's
  earlier work here — the shipped `knowledge/memory.md` header is word-for-word
  what Daisy's had been rewritten to say.

  - `0-base_prompt.md` replaced with the 0.8.20 seed for **daisy and nova**.
    Neither fork carried a local edit, so this is a clean seed swap. It changes
    two things: **Memory** is now defined as episodic — facts and events, with
    global rules going to `1-agent.md` and procedure-scoped rules to the
    relevant skill — and **`1-*` prompt files become the agent's own to edit**
    with the relevant admin's approval, instead of every prompt change being
    routed through `nova`. `0-*` and `plugin-<id>.md` stay platform-owned.
  - `knowledge/memory.md` gained the shipped "what belongs here" header on both
    agents (Daisy's already matched). Nova's one memory, `telegram-contacts`,
    was trimmed to the fact it records — the group id and who asked for it —
    since the instruction to use that group is already in its `1-agent.md`.
  - Scaffold refresh (`scripts/`, `config.example`, `docs/base-harness/`,
    `.claude/skills/`): everything was already byte-identical to the 0.8.20
    template, so only `docs/base-harness/CHANGELOG.md` moved. No local edit
    existed to re-apply; `scripts/app/`'s deployment-owned `secrets.sh` and
    `config.example` were untouched, as intended.

  0.8.19 is additive and needs nothing here: the harness session API gained an
  optional `?limit=N` tail-read and the **console's** chat pages backwards over
  it. Our own `app/` chat panel doesn't use it — worth doing if a thread ever
  grows big enough to make opening it slow, but it isn't today.

- **Daisy's supplier-contact skills merged, and `1-agent.md` trimmed to identity
  and behaviour.** `supplier-communication-log` and `supplier-email-reply` are
  replaced by one **`supplier-communications`** skill (v1.0.0) — replying to a
  supplier and logging that contact were always the same task, and splitting them
  meant two reads and a cross-reference for one procedure. It also adds a rule
  that was missing: a routine availability drop is **not** a contact event, so it
  never gets an entry in `suppliers.communication_notes`; only the correspondence
  around it does.

  `1-agent.md` drops everything the harness or a skill already supplies: the
  *Your skills* table (the harness appends `<available_skills>` on every spawn,
  so the table could only go stale), the *Agent messaging — app rules* section
  (the agent-messaging plugin prompt and the *Asking Chris & Bhoumik* section
  carried all three bullets), the restated daily-note mechanics from the base
  prompt, and the ingestion rules that live in
  `supplier-onboarding-and-ingestion` (notes vs `internal_notes`, missing prices,
  contacts/`is_primary`, never-email-unbidden). Behavioural change: Daisy no
  longer asks about routine gaps in a source — a missing price, an unclear size,
  a plant that fits no obvious section — she records what the source says, keeps
  going, and lets it surface in the daily note. Questions are for a drop she
  can't attribute to a supplier, or a decision that is Chris's.

- **Daisy's `knowledge/memory.md` is episodic-only; its standing rules moved to
  the prompt or a skill.** Memory had become the place procedure went to hide:
  seven of its eight sections were "always / never" rules, which meant a rule
  only fired if Daisy happened to grep the right term — and grep is not how a
  procedure gets followed. Each one moved to where it actually governs
  behaviour, and the file's header now states the rule so later writes don't
  reintroduce it.

  To `1-agent.md` (they hold everywhere): the daily-note concurrent-write
  safeguard — append with a targeted `edit`, never a whole-file `write`, because
  the day's file is shared by every thread — the notification threshold
  (blocker, needed input, failure/data risk, or genuinely noteworthy; nothing
  per routine ingest), and Chris's cost-discipline rule (detect change cheaply
  before re-running an expensive ingest). To **`supplier-communications`**
  (v1.1.0): the `gws` routing rule for supplier correspondence must be keyed on
  the Gmail thread id — a sender-wide rule silently swallows every later mail
  from that supplier, including their next availability drop — plus the dates
  behind the send-as-Chris and 250px-logo rules. To
  **`plant-and-supplier-search`** (v1.6.0): a geographic question may not be
  answered from `suppliers.state` alone, since HQ and stock location differ
  (Everde: Houston HQ, Bunnell FL farm) — check the row's farm/region evidence
  and say which the answer rests on. Two memories were dropped outright as
  already-covered duplicates of the `supplier-communications` skill (the
  supplier-email approval policy and the outbound identity/signature rules).
  What remains in memory is the 2026-07-22 harness-upgrade validation record.

- **Daisy's `share-file-with-user` skill retired; its one novel claim was
  wrong.** The skill was two script calls — `upload` then `sign-url` — both
  already documented in `1.1-supabase.md`, under a path convention
  (`daisy_shared/YYYY-MM-DD/<filename>`) already documented in SCHEMA.md's
  *Storage buckets*, ending with a paragraph on durable-vs-intermediate files
  already in `1-agent.md`. What it added on top was the instruction "never share
  a publicly accessible URL, always share a pre-signed one", which reads as an
  access control and is not one: the `lps` bucket is public, so an object key is
  directly fetchable signed or not — the risk being a file uploaded on the belief
  that the signature gates it. `1.1-supabase.md`'s `sign-url` section now carries
  the `daisy_shared/` convention **and** the public-bucket caveat, next to the
  command it qualifies.

### Fixed

- **`__pycache__/` and `*.pyc` are gitignored.** A compiled cache for
  `match-candidates` was tracked, and bytecode is keyed to the path it was
  compiled at — so it went stale the moment the script moved between skills.

### Removed

- **"Also known as" and the alias edge type** (Bhoumik's call, migration
  `0050_drop_other_names_and_alias_type.sql`). The derived `other_names` column
  is gone from the plants table, the supplier profile and both mobile card
  layouts, along with its `Also known as` header filter. With it go
  `inventory_enriched` — whose only contribution over `inventory` was that one
  column — the `plant_alias_names()` function behind it, and
  `plant_aliases.alias_type`.

  The column did not earn its cost: NULL for 90% of active rows (28,444 of
  31,560) and unindexable, because `plant_alias_names()` is `STABLE` and reads a
  second table, so filtering on it meant evaluating the function per candidate
  row. `alias_type` fell out as a consequence — 0045 had already stopped search
  from reading it, leaving the *Also known as* display as its last consumer.

  **Search behaviour is unchanged, and that was verified rather than assumed.**
  A botanical-name query still returns 250 rows of which 85 are reached *only*
  through an alias edge, which is the property that would have broken had query
  expansion regressed. What is lost is the record of which kind of equivalence a
  source asserted; that is not recoverable. Uniqueness on `plant_aliases` moves
  to `(name_key, other_name_key)` — no rows collided — and the dedupe trigger
  still rejects both orientations and still treats a retired pair as a blocklist.

  Daisy's skills move with it: `plant-and-supplier-search` v1.5.0 lists from
  `inventory`, and `supplier-onboarding-and-ingestion` v3.6.0 drops `alias_type`
  from its insert template. **An ingest that still writes the column will fail.**

### Changed

- **Daisy's ingestion skill closes three gaps on multi-farm workbooks**
  (`supplier-onboarding-and-ingestion` v3.6.1, approved by Bhoumik). The
  location-mapping rules in §0.1 already treated a spreadsheet tab as evidence
  of which farm a row belongs to, but §1 — how you convert the file — never
  mentioned sheets, so nothing connected the two. §1 now states that
  `markitdown` converts every sheet under a `## <tab name>` heading and that the
  headings must be counted against the workbook's tabs before parsing: a
  per-farm workbook parsed as its first table alone loses every other farm, and
  the §5 count check cannot catch it, because a location that was never written
  to simply doesn't appear in the group-by. It also names three converter
  behaviours, confirmed against a test workbook rather than assumed — hidden
  sheets convert with nothing marking them hidden, each sheet's first row
  becomes its header (so a title row pushes the real headers into row 1 and
  leaves `Unnamed: 1` where cells were blank or merged), and an empty sheet
  still emits a degenerate table.

  §0.1 gains the two judgement calls that go with it. A tab carrying no
  offerings — `Terms`, `Legend`, `Price Key`, an empty or hidden leftover — is
  not a location however it is named. And a location the database doesn't have
  must be resolved on city and state, and against the company's own locations
  page, before it is onboarded: a tab reading `Ft Pierce`, `Bunnell Farm` or a
  bare farm code is usually a row that already exists, and onboarding a
  duplicate splits that farm's catalogue across two `supplier_id`s permanently.
  A near-match is now explicitly the ambiguity case — ask, don't onboard.

- **The plant table's **Plant** column is now labelled **Full Name**.** One
  label in `PLANT_COLS`, so it renames in both places that table appears — Plant
  search and the supplier profile's Inventory tab. The column is unchanged
  otherwise: still the read-only composed identity the database derives from the
  three name parts.

### Fixed

- **Searching fires one request per intent, not two.** Both search pages (and
  the supplier profile's Inventory tab) already debounced at 300ms, but on two
  independent timers — the typed question and the serialized filter state — so a
  keystroke and a filter click inside the same window settled at different
  moments and cost a request each. `useDebounced` is now `useDebouncedSearch`,
  which debounces the pair as one value. The page-number reset moved out of an
  effect and into render for the same reason: an effect commits *after* the
  fetch effect has already run once against the page number the new search just
  invalidated, so searching from page 3 fetched the stale page and then page 1.

- **`/plants` with no search term returns plants again.** The API short-circuited
  on an empty query (`if (!search.trim()) return … groups: []`), so the default
  page rendered nothing and the browse branch behind it was unreachable. That
  branch also sampled 8 suppliers × 30 rows, reported the sample size as the
  total, and ignored `page` entirely. It is now one filtered, ordered,
  `count: 'exact'`, paginated read of `inventory`, so the header count and page 2
  mean what they say — the same contract the search path already had. The trade
  is the deliberate supplier spread: ordering by `updated_at` surfaces the most
  recently ingested suppliers first, so page 1 is a shallower set of groups.

### Changed

- **A multi-location company is now a head branch, not a group row**
  (Bhoumik's call, migration `0049_supplier_head_branch.sql`).
  `suppliers.head_branch_id` points every supplier at its company's head branch
  — the row at the company's business office — and **a head branch points at
  itself**, as does every single-site supplier. The column is therefore never
  null and never chains, so a company's locations are one predicate:
  `head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <any>)`.
  A `set_head_branch` trigger fills the self-reference on insert (an identity PK
  cannot be a column default) and refuses both ways of creating a chain:
  pointing at a row that is itself a branch, and demoting a head that still has
  locations. Live after apply: 1,383 suppliers, zero nulls, 16 heads carrying 41
  branches, 1,326 single-site rows self-heading, zero chains.

  Each head was chosen from the contacts on file — whose row holds the generic
  company inbox, the switchboard, the company-level people — and then confirmed
  against the address each company publishes as its head office. **The head is
  the business office, not the biggest farm**: Everde's head is supplier 32, a
  Houston office suite, and its four farms point at it. Six differ from the
  first member migration 0033 happened to list — Snapper Creek (Ft Pierce, not
  Homestead), Vickery (Dallas), Whitfill (Southern Ave), Tree Valley (Tomball),
  Triangle (the Houston business office, not the Groveland farm) and Tree of
  Life RGV (San Juan). ArborGen, Calloway's and Moon Valley have **no
  head-office row at all** — their heads are stand-ins, flagged in the migration
  for revisiting if that office is ever onboarded.

### Removed

- **`supplier_groups` is dropped**, along with `suppliers.group_id` and the
  `suppliers_group_idx` index — superseded by the head branch above. Nothing was
  lost: all 16 group rows had null `notes`, every group `website` duplicated its
  members' own, and the company name they carried is the head branch's own name.
  The seeding data itself is still readable in
  `0033_supplier_locations.sql`, including the families deliberately left
  ungrouped, which remain their own heads.

## 2026-08-14

### Removed

- **The whole catalogue was deleted, to be re-ingested from scratch** (Bhoumik's
  call): `inventory` 238,748 rows, `inventory_sources` 2,113, `plant_aliases`
  127 — every row, active or not. `suppliers` (1,383), `contacts` (1,851) and
  their links were not touched, and neither were the source files in the `lps`
  storage bucket. `search_inventory`, `inventory_enriched` and `search_suppliers`
  were checked after the delete and behave normally against the empty tables.

  This was a **hard delete, against the schema's soft-delete convention**, for
  two reasons. `dedupe_plant_aliases()` rejects a pair that already exists in
  either orientation *regardless of `is_active`* — deliberately, so retired bad
  aliases stay dead — so deactivated aliases would have silently blocked the
  reingest from ever recreating them. And a deactivated `inventory` row is
  indistinguishable from the 174,909 already inactive, which would have left the
  table permanently carrying a wipe it could not describe.

  A row-for-row copy of all three tables lives in the **`backup_20260814`**
  schema (73 MB, outside PostgREST's exposed schemas, verified equal before the
  delete). Restore is `insert … select` in the order sources → inventory →
  aliases: `inventory.source_id` and `plant_aliases.source_id` both reference
  `inventory_sources` without a cascade.

### Added

- **A supplier's Files tab can deactivate an ingested file, and the deactivation
  takes that file's plants with it.** `inventory_sources.is_active` has always
  existed, but nothing outside SQL could flip it — `softDelete` whitelists
  `suppliers` and `inventory` only, and every file rendered with a fixed
  **Active** badge. Each file now carries a **Deactivate** action that confirms,
  retires the inventory rows still pointing at the file, then retires the file,
  and reports the count (`deactivateSource` in `app/lib/queries.ts`, reached
  through `DELETE /api/rows` with `table: 'inventory_sources'`).

  The cascade is the whole design decision. Retiring the file alone leaves its
  rows live but sourceless — blank **Ingested** in the app, and invisible to
  `search_inventory`, which skips rows whose source is inactive, while browsing
  still lists them. Since `source_id` points at the most recent drop that
  contained a row, the cascade unwinds exactly what this file is still the
  provenance for; anything a later drop re-listed belongs to that later source
  and stays. This is the manual counterpart to the same-day change that stopped
  *ingestion* from retiring previous sources: automatic retirement orphaned rows,
  deliberate retirement no longer can.
- **Migration `0048_cascade_source_deactivation.sql` puts that cascade in the
  database**, so it is a property of the table rather than of one caller: a
  hand-written `UPDATE inventory_sources SET is_active = false` in SQL now
  retires the file's rows too. The app is left counting the rows for its toast
  and flipping the file. The original pre-wipe design audit found 1,340 of 2,079
  sources already inactive and **zero** active inventory rows pointing at an
  inactive source. The live apply happened after the catalogue reset, with 10
  active sources and the same zero-row invariant; it created only the function
  and trigger and rewrote no data. A rollback-only fixture verified the cascade.
  It fires one way only — reactivating a source does not restore its rows,
  because nothing records which of them the trigger retired.

### Changed

- **`supplier-onboarding-and-ingestion` 3.4.0 → 3.5.0: `internal_notes` stops
  being a log of the obvious** (Bhoumik's call). Ingests were appending
  observations the row itself already answers — that a price or quantity was
  missing, when the row was last updated, when the drop was ingested, a
  restatement of the size or name — none of which survives a reader who can see
  `unit_price`, `quantity`, `updated_at`, `source_id` and
  `inventory_sources.created_at`. The skill's *Two note columns* section now
  names each of those as never-write, and says that a row you concluded nothing
  about gets no note at all.

  This **reverses the price rule**: §2 previously instructed recording "price on
  request / not printed" in `internal_notes`, and listed it as an example of the
  column's content. A `NULL` `unit_price` already carries that; when the
  *supplier* prints "price on request", it is their text and belongs in `notes`
  like any other qualifier, where the evidence/commentary split already puts it.
  §5's QA pass gained a matching check — anything appended that merely restates
  the row is deleted before the transaction commits. Timely: the catalogue
  reingest above rewrites every row's notes from scratch, so the rule lands
  before the volume does. The `notes`/`internal_notes` split, the
  append-don't-clobber rule and the caveats that do belong there (a split
  combined size, a shared/tentative quantity, a parse caveat, a QA exception) are
  unchanged. `docs/supabase-schema.md` and `docs/harness/agent-daisy.md` follow.
- **`supplier-onboarding-and-ingestion` 3.3.0 → 3.4.0: `search_inventory` is now
  a required gate before any insert** (§4 step 1), not a fallback for when
  `match-candidates` came back empty. Trigram similarity on the identity key
  misses a plant the supplier renamed or now prints botanically where it used to
  print the common name — precisely the entries an update-in-place ingest then
  duplicates. The skill spells out the call shape: the RPC takes no supplier
  filter, so search first and scope with `WHERE supplier_id = …` in the outer
  query, once per name form the entry gives. §5's update/insert sanity check
  re-runs it on a sample of the inserted entries.
- **Upgraded `cognisphere-harness` 0.8.17 → 0.8.18 and migrated both agents'
  on-disk notes to the new layout.** The 0.8.18 base prompt reorders itself
  around the agent's actual reading path, drops the `# Guidelines` grab-bag,
  and — the part that needed migrating — moves where notes, knowledge and
  memory live. Per agent:
  - `workspace/memory/*.md` became a single grep-able `knowledge/memory.md`,
    one section per memory (`name` / `lastUpdated` / `description`, separated by
    `-----$-----$-----$-----`). Daisy's four files became nine sections, split
    so each standing rule greps independently; nova's one became one.
  - Reference docs moved from `knowledge/` to `knowledge/files/`, indexed by a
    new `knowledge/index.md`. Daisy's `SCHEMA.md` symlink was re-pointed one
    level deeper and still resolves to `docs/supabase-schema.md`; every
    `knowledge/SCHEMA.md` / `knowledge/gmail-labels.md` reference in
    `1-agent.md`, `1.1-supabase.md` and three skills was updated to match.
  - `workspace/taskThreads/<ThreadId>/tasks.md` was folded into the parent's
    `workspace/threads/<ThreadId>/notes.md` under `## Tasks` (108 files for
    daisy, 1 for nova) and the directory removed.
  - Each thread's `summary.md` was folded into `notes.md` under `## Context`
    and deleted (336 daisy threads); loose files in a thread dir moved to
    `files/`, and a subdirectory whose name exactly matches a known task slug
    moved to `tasks/<slug>/`.
  - `workspace/index.md` was rebuilt into the new shape — 457 thread entries
    preserved and de-duplicated, dead `summary.md` paths rewritten, and the two
    stale `## Memory` sections dropped in favour of `knowledge/`.

  Skills whose only change was a reference path were bumped:
  `availability-drop-intake` 2.0.1 → 2.0.2 (it also now files results into
  `notes.md` rather than the removed `summary.md`), `plant-and-supplier-search`
  1.1.0 → 1.1.1, `supplier-onboarding-and-ingestion` 3.0.0 → 3.0.1.

  Note that `harness/agents/*/workspace/` is gitignored, so the notes half of
  this migration is not visible in the diff.

- **Column filters run in SQL now, not in the browser** (migration
  `0044_search_inventory_cultivar_keys_out`, plus `app/lib/server-filters.ts`).
  Filtering happened after the server had already paginated, so it could only
  narrow the page in hand. Measured on `Crape Myrtle`: 570 matches, 105 of them
  `15G`, but only **73** in the 300-row first page — 32 were unreachable by
  ticking the size box, and the header's "Showing 73 of 570" was wrong twice
  over. Every filter (size, cultivar, price, quantity, the three dimensions,
  supplier type/city/state, the text columns) is now applied by PostgREST as an
  outer query over the RPC result, *before* its own pagination, so the page and
  the count describe the same set.

  Adding a filter is a line in a spec rather than a migration, since the RPC
  already projects the columns; `cultivar_keys` was added to the projection
  because the cultivar cell is a comma-separated residual and selecting one name
  needs the normalized array. Option lists moved to a separate facet call keyed
  on the search term — otherwise picking one value would remove every other
  value from its own dropdown. The six dimension parameters are kept on the
  function but no longer sent, after verifying the two forms agree on three
  fixtures. Sorting, `# Items`, and a size typed into the query stay client-side,
  each for a stated reason.

- **The composed plant name is dash-delimited** (migration
  `0043_dash_delimited_plant_name`). `Forest Pansy Redbud - Cercis canadensis -
  Forest Pansy`, not `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]` —
  one ` - ` between every part, in the order common, botanical, cultivar. The
  comma stopped being usable as a part separator when the cultivar column became
  comma-separated, and a spaced dash is what distinguishes the separator from
  the hyphen inside a name like `KN30-8`. Display only: the bracket and dash
  forms share one identity key and one token array, so no search result moves
  and no index was rebuilt. Ingestion skill v3.2.0.

- **A size typed into the search now ranks instead of filtering** (migration
  `0047_size_as_ranking_group`). `15g Live Oak` puts 15 G live oaks on top and
  keeps every other size below them rather than removing them; `15 gal`,
  `15 gallon` and `24 inch box` all behave the same way.

  This needed code because the tokenizer splits `15g` into `15` and `g`, which
  are close to the two least selective terms in the catalogue — `g` is in 63% of
  active rows — so the query used to return 42,099 rows with 5 G, 45 G and 200 G
  tied against 15 G. A size span is now one phrase group with a real weight, so
  it returns 6,935 rows with every top row a 15 G live oak and the 1,728 other
  sizes ranked below.

  The client-side special case is gone with it: no more `parseSizeQuery`, no
  `matchesSizeFilter`, no removable "Size: 15 gal" chip, and the query reaches
  the server whole. That closed the last filter-after-pagination fault, since
  the chip only ever filtered the 300 rows the browser held. The Size
  multiselect is unchanged — filtering by size is still its job.

- **Search rewritten: ranked, not gated** (migration `0046_bm25_search`). It now
  matches **names, size and notes**, is **typo tolerant**, matches **partially at
  both ends** (`sycamor` *and* `ycamor` find `sycamore`), expands query terms
  through aliases, and ranks by **IDF-weighted term coverage** — overlap, with
  rare terms weighted heavily. Filtering and sorting run over the ranked result.

  This replaced three mechanisms with one. The identity-intent gate is gone: it
  hard-excluded every row not matching the rarest query word, which is what IDF
  does natively without discarding anything. The pg_trgm fallback is gone —
  substring matching is what it approximated. Two pgroonga indexes now cover one
  document expression, a bigram one for substring and a whole-word one for
  fuzzy, because edit distance over a bigram lexicon is meaningless (measured:
  the typo `mvskogee` returns 0 rows through the bigram index and 188 through
  the word index).

  `Crape Myrtle Muskogee` now ranks in three clean tiers — 10.38 for rows
  matching both groups, 5.82 for the rare word alone, 4.55 for generic crape
  myrtles. **Result sets are much larger and that is deliberate**: retrieval is
  OR, so it returns 755 rows where the gated version returned 116, with the
  weakly-matched tail ranked last. Empty searches now return nothing instantly,
  retiring the long-standing "never call it with an empty search" footgun.

- **Aliases now enrich the search query, and the cultivar column takes every
  selection name** (migrations `0041_multi_name_cultivar_keys`,
  `0042_alias_query_term_expansion`). Two corrections to the change below, made
  the same day.

  `cultivar_variety_trade_name` captures **everything the printed name carries
  that the common and botanical name don't** — cultivar, variety, selection and
  trade name, comma-separated — not just the cultivar. Sources don't reliably
  distinguish them and guessing which is which loses information. Its key
  therefore became the array `cultivar_keys`, one per name, matched by overlap:
  without that, `Wolff, Emperor 1` keyed as `wolffemperor`, matched neither
  name, and the row would have silently stopped answering searches for either.
  The comma is load-bearing and the ingestion SOP now QAs for it. The app's
  Cultivar filter follows — it lists one option per name, not one per
  combination.

  **Aliases were not enriching the query at all.** The alias branch selected an
  edge only when the *whole* query matched that edge's text, and pgroonga's
  `&@~` is AND across tokens — measured, not assumed. So `Live Oak Boardwalk`
  could never reach the `Live Oak` ↔ `Quercus virginiana` edge, and the cases
  that appeared to work were the pg_trgm fallback firing on string similarity,
  which is why the same query worked through a plant's botanical name and
  returned nothing through its common name. An edge is now reached by **any
  contiguous run of query words**. The change is additive, admission is still
  exact key equality, and the identity-intent gate still runs after it, so an
  invented cultivar still returns nothing. Not observable on live data until the
  re-ingest — `plant_aliases` is empty — so the live fixtures are unchanged by
  construction; the behaviour is verified against synthetic rows. Ingestion
  skill v3.1.0, `plant-and-supplier-search` v1.2.0.

- **A plant's identity is three columns now, and the alias table is typed**
  (migration `0040_typed_plant_identity`). `inventory` gains `common_name`,
  `botanical_name` and `cultivar_variety_trade_name`, each holding **only what
  the availability source explicitly prints**, and `inventory.name` becomes the
  composition of them — `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`
  — written by trigger. That is byte-for-byte the format the ingestion SOP
  already required, so no existing row moved and the search index was not
  rebuilt; what changed is that the parts are separately readable, filterable
  and aliasable instead of having to be re-parsed out of a bracket. `name` and
  all four `*_key` columns are now derived and must never be written.

  `plant_other_names` is replaced by **`plant_aliases`**, where every pair
  declares what kind of thing its two sides name: a `plant` edge (`Live Oak` ↔
  `Quercus virginiana`) is matched against a row's common/botanical name, a
  `cultivar` edge (a variety name ↔ its trade name) against its cultivar column
  **only**. That is the point of the change — a cultivar edge is never compared
  to a column a generic row fills, so it cannot make every row of a species
  answer a search for one of its selections. Six migrations (0006, 0007, 0021,
  0025, 0028, 0029) existed to clean up exactly that; it is now closed by the
  schema rather than by a quality bar, and cultivar/trade-name pairs become
  expressible for the first time. Pairs also carry their evidence (`source_id`,
  `source_line`), and the dedupe trigger now rejects mirrored orientations —
  168 retired pairs had come back reversed in the old table.

  `search_inventory` was dropped and recreated with the three parts in its
  return type, and — since the drop was unavoidable — with `internal_notes`,
  which 0039 had left out and the app had been hydrating with an extra read per
  page. **No backfill:** all 235,976 existing rows have NULL parts and the
  13,700 alias pairs went with their table, at Bhoumik's instruction, ahead of a
  full re-ingest. Fixtures `Abelia Francis Mason` (10 rows / 9 suppliers) and
  `Japanese Holly Compacta` (4 / 2) are unchanged; `Crape Myrtle` moved 548/35 →
  532/30, which is the retired alias directory and is temporary.

  App-side: the plants table's **Plant** column shows the composed identity and
  is now read-only, with **Cultivar** visible beside it (multi-select filter,
  both in the column header and as a **Cultivar: Any** dropdown in the Plant
  search toolbar) and common/botanical name available through the column picker.
  **Also known as** no longer repeats a name already spelled inside the Plant
  value. Ingestion skill v3.0.0, `plant-and-supplier-search` v1.1.0,
  `availability-drop-intake` v2.0.1; `match-candidates` reads the parts and
  marks a candidate whose cultivar contradicts the entry's as
  `CULTIVAR MISMATCH`.

- **An ingest now refreshes availability instead of replacing it** (ingestion
  skill v2.0.0). Every drop used to insert a fresh copy of the supplier's whole
  catalogue and then flip the previous rows `is_active = false`. It now finds the
  row each parsed offering already has and **updates** it, **inserts** only what
  is genuinely new, and **reactivates** rather than duplicates a plant the
  supplier has brought back. **Nothing is retired** —
  not `inventory` rows, not `inventory_sources`. An offering the supplier stopped
  listing keeps `is_active = true` and its older `source_id`, and that is now the
  staleness signal: "when did we last see this" is answered by the row's source,
  not by a flag. Taking an offering out of circulation became a deliberate,
  separately approved act, so a discontinued item is reported under *Flags
  needing Chris* rather than flipped mid-ingest.

- **Rows are matched by looking, not by key** — new
  `scripts/match-candidates` in the ingestion skill. Matching on
  `(supplier_id, name_key, size)` looks decisive and isn't: a supplier who
  respells a name, re-punctuates it, adds a cultivar, changes container, or
  switches between the botanical and common name makes an existing offering
  invisible to the key, and an update-in-place ingest then duplicates it. The
  script instead returns, per parsed entry, up to five of that supplier's
  **active** rows plus the single best **retired** one, ranked by trigram
  similarity on the plant identity with a size-agreement bonus, over a
  deliberately narrow column set — id, name, size/size_std, price, quantity,
  dimensions, is_active, and how many identical rows collapsed into each line.
  Notes are not fetched: they are long and never tell two offerings apart. The
  agent reads the candidates and decides update / insert / reactivate / flag;
  the script's `SUGGEST` column buckets by score alone and says so.

  Two details came out of testing it against live data. Retired history badly
  outnumbers live rows on established suppliers — supplier 32 carries 34.9k rows
  of which 5.4k are active — and a single ranking let dead clones take all five
  slots, so active and inactive are ranked separately. And identical rows are
  collapsed to one line with a count, because otherwise five copies of the same
  retired row crowd out the one you need. Measured cost: ~4.8s for 200 entries
  against the largest supplier.

  Two consequences of update-in-place worth knowing. A bad parse now
  **overwrites** good data instead of sitting beside it, so QA got stricter,
  including a new check for the characteristic failure of this model — a repeat
  drop that reports mostly *inserts* means candidates were taken at face value
  and the catalogue has just been duplicated. And the identity of a row is **not
  unique today**: a count run while
  writing this found 5,714 `(supplier_id, name_key, size, height, width,
  caliper)` keys across 77 suppliers matching more than one active row — roughly
  13,500 rows, about two-thirds of them carrying the same price *and* the same
  printed name, which is what the old replace-and-retire model left behind when a
  retirement pass missed. So the skill splits the multi-match case: same price and
  name means duplicates (update the one with the newest source, leave the rest,
  list them under a new *Duplicates found* report line), while differing price or
  name means two real offerings the key can't tell apart (touch nothing, flag for
  Chris). **That backlog is worth a cleanup migration** — under the no-retirement
  rule an ingest will never resolve it on its own.

- **`inventory.notes` and `inventory.internal_notes` are now separate columns**
  (migration 0039). `notes` is evidence — what the supplier printed or said about
  the offering, dated. `internal_notes` is commentary — why a combined size was
  split, that a quantity is the supplier's shared/tentative count, that no price
  was printed, parse caveats, QA exceptions. On an update `notes` is replaced
  with the current drop's text and `internal_notes` is appended to, so a later
  reader can tell "the supplier says two weeks" from "we guessed two weeks".
  `inventory_enriched` carries both. `search_inventory` deliberately still
  returns only `notes` — changing its fixed `RETURNS TABLE` means dropping and
  recreating the most load-bearing function in the app, which this change didn't
  warrant — so the app fills `internal_notes` in for the two RPC-backed paths
  with one keyed read per page and the column reads the same however the rows
  were fetched. **The plants table now has an editable "Internal notes" column**
  (hidden by default, like Notes). Rows written before today hold a mix of both
  kinds in `notes` and were not reclassified.

- **One availability file is not one supplier** (ingestion skill §0.1, rewritten).
  A multi-location group's single sheet routinely covers several farms, so the
  unit of mapping is the availability **row**, not the file: each parsed offering
  gets its own `supplier_id`, and one drop can legitimately write to five
  suppliers. Precedence is most-specific-wins — a per-row "Ship from" column beats
  a section heading, which beats the file header — and only when the file names no
  location *anywhere* does every active location in the group get its own copy of
  every offering (Everde's five farms × 900 offerings = 4,500 rows, each with its
  own source row and its own upsert pass). Ambiguity is never resolved by falling
  back to "all locations"; it stops and asks.

- **`availability-drop-intake` and `supplier-onboarding-and-ingestion` are now
  mutually exclusive** (both v2.0.0). They had drifted into restating each other:
  supplier identification appeared in both, and each enumerated the other's half
  of the handoff. Intake now coordinates and talks to humans and **writes no
  database row**; ingestion **owns every write** and talks to no one, routing
  anything a human must answer through its report. The two shared contracts are
  single-sourced — the brief is canonical in intake §2 and the report is canonical
  at the end of the ingestion skill, each pointing at the other instead of
  repeating it. Ingestion's leftover supplier search became a
  confirm-don't-re-derive check on the main agent's lookup.

- **cognisphere-harness 0.8.11 → 0.8.17, and Daisy's SOP became six skills.**
  0.8.12 made *skills* the home for procedural memory: a `1-*.md` prompt file is
  deployment-owned and carries identity, persona and behaviour only, and every
  step-by-step procedure lives in `skills/agent/<slug>/` with a version in its
  description, a `CHANGELOG.md`, and its own scripts/artifacts. So
  `knowledge/SOPs/supplier-onboarding-and-ingestion.md` is now the
  **`supplier-onboarding-and-ingestion`** skill (v1.0.0, content unchanged), and
  the procedures that had accreted in `1-agent.md` and `1.1-supabase.md` came out
  as **`availability-drop-intake`** (the coordinator loop: identify the supplier,
  brief the task thread, digest its report, label the email),
  **`plant-and-supplier-search`**, **`supplier-communication-log`**,
  **`supplier-email-reply`** and **`share-file-with-user`**. `1-agent.md` is
  roughly half its former size and now names the *situation* that triggers each
  skill instead of restating its steps; the standing rules that are behaviour,
  not procedure — never email a supplier unbidden, never write generated `*_key`
  columns, one row per location — stayed put. `knowledge/gmail-labels.md` keeps
  the label IDs (reference facts) and lost the apply-a-label steps.
  **Changing any of these skills still needs Chris's or Bhoumik's approval**,
  followed by a version bump; the approval rule moved with the content.

  The rest of the window: both agents' `0-base_prompt.md` reseeded (skills, the
  system-prompt ownership contract, per-call context checkpoints, one daily-note
  entry per thread per day, and 0.8.17's rule that task-thread delegation is
  aggressive by default); `context-meta.ts` rewritten and a new
  `skill-update-notice.ts` extension added, which tells a long-running agent when
  a skill it read has since changed; the shipped `create-skill` skill installed
  in both agents; and nova's persona file renamed `1-dev-agent.md` → `1-agent.md`.

- **App-specific deploy logic moved to `scripts/app/`.** 0.8.12 made the deploy
  scripts harness-owned and refreshed on upgrade, with deployment-owned hooks
  sourced at fixed points. The two local edits this home carried — passing
  `SUPABASE_URL`/`SUPABASE_SECRET_KEY` into `app/.env.local` from
  `scripts/server.sh`, and documenting those keys in the root `config.example` —
  are now `scripts/app/secrets.sh` and `scripts/app/config.example`. Behaviour is
  unchanged; the next upgrade no longer needs a hand-merge. Fresh-clone setup is
  `cp config.example config && cat scripts/app/config.example >> config`.

### Added

- **Multi-location suppliers are a first-class shape** (migration 0033). A
  nursery that grows or sells at several sites was already several `suppliers`
  rows — Everde has five, Moon Valley seventeen — but nothing tied them
  together, so "every Everde location" was a guess from names that don't parse:
  `Everde Growers`, `Everde Growers - Glen Flora Farm`, `EVERDE GROWERS -
  BUNNELL`, Newton with no dash at all, Calloway's with an em dash. A
  `supplier_groups` row now names the company and `suppliers.group_id` points at
  it; each location stays its own row, because stock, prices and pickup are per
  site. `group_id IS NULL` means one location, not "unknown".

  16 groups seeded over 57 supplier rows, identified by hand from a shared brand
  name **and** a shared website domain. Nothing was merged or retired. Families
  that matched only one half of that test — Hawkins TX/SC, New Life NJ/MI,
  Groundworks TX/FL, a possible fourth Tree of Life site — and three same-city
  sets that look like duplicates rather than locations (Acosta, R. Plants, Old
  Courthouse) are listed at the bottom of `0033_supplier_locations.sql` for
  Chris to confirm. A wrong group is not cosmetic: it fans a supplier's
  availability out to a nursery that never offered it.

  Daisy's ingestion SOP gained §0.1 for it: **a drop that names a location is
  written to that location alone; a drop that names none is written to every
  location in the group**, each with its own `inventory_sources` row and its own
  version swap, and per-location row counts in the report. Naming a location the
  group doesn't have onboards it as a new row in the same group. Anything
  ambiguous stops and asks rather than guessing which farm claims the stock.

- **One contact can be the point of contact for several nurseries** (migration
  0034). `contacts.supplier_id` said a person belongs to exactly one — wrong at
  a multi-location company, where one inside-sales rep quotes across every farm.
  It forced a duplicate contact row per location, five "same" people who drift
  apart as one of them gets a new number, and made "who else does she cover?"
  unanswerable. `contacts` now describes the person or inbox; the tie to a
  supplier is a `supplier_contacts` row, and `is_primary` moved onto it too
  because the rep who answers at Bunnell need not be the one at Canal Point.

  1,843 links backfilled one per existing contact, then **migration 0036 merged
  the duplicates that column had forced — 33 rows into 13**, every link kept.
  Jim Ord is one contact with six nurseries instead of six contacts; Ken Howard
  one with five; Jana Dean one across both Klepac sites. 20 rows retired, each
  noting where it went, and one link deleted where a contact had been entered
  twice at the same supplier.

  The match was email **and** phone, with no field of one contradicting the
  other. **Email alone would have been wrong**: `info@calloways.com` is three
  rows with three phone numbers and two different store managers, and the phone
  lives on the contact rather than the link, so merging on the shared inbox
  would have deleted working numbers. Twelve such groups were left alone and are
  listed at the bottom of `0036_merge_duplicate_contacts.sql`. Verified after
  apply: no link lost, no supplier left with two primaries, no name, title or
  note dropped — and reversible from the `contacts_merge_map` /
  `contacts_pre_merge` / `supplier_contacts_pre_merge` snapshots.

  There are now two levels of `is_active` and they say different things: the
  person left the company (`contacts`) versus they stopped covering this
  location (`supplier_contacts`). Removing a contact from a supplier in the app
  retires the link, not the person — their other locations are untouched — and
  the card says "Also covers X, Y. Edits here change them there too", because
  the edit form writes the shared person. Deactivating a supplier cascades to
  its links and retires a contact only when it was their last one.

  The SOP's §0.3 now says to **link, don't duplicate**: look for the person
  across the whole group before inserting, work out how many locations they
  cover from what the source actually says — a signature reading "Inside Sales —
  all farms" is every location, "Yard Manager, Bunnell" is one — and link only
  what is attested.

- **Suppliers and Plant search page through their full result set, and say how
  big it is.** Both headers ended at the first server page — Suppliers read the
  first 50 matches of `search_suppliers` and Plant search the first 300 rows of
  `search_inventory` — and their summaries counted only what had been fetched,
  so "Showing 50 of 50 suppliers" was really "of 1,376" and there was no way to
  see the 51st. Each toolbar now carries Previous / Next with `Page N of M`, and
  the summary reads `Showing 42 of 1,376 suppliers` — the total is the whole
  match count from PostgREST's `count: 'exact'`, not the page. It costs nothing:
  both RPCs are `plpgsql` and already materialize their full result before the
  page is sliced off (measured: 229ms with the count, 221ms without).

  The page number resets to 1 whenever the question changes — a new search term
  on either page, or a new dimension bound on Plant search — so a page 7 can
  never outlive the result set it belonged to. The count left of it is still the
  count *shown*, so client-side filters (supplier type, city, state, size, the
  numeric ranges) visibly shrink it while the total stays put. Those filters,
  and Plant search's supplier grouping, keep applying to the current page only.

### Changed

- **One plant, one name on the plants page.** `Thuja occidentalis 'Smaragd'`,
  `Thuja occidentalis [Smaragd]` and `Thuja occidentalis ['Smaragd']` were
  three rows-groups in the UI for one plant, because the cultivar delimiter
  drifted between suppliers and between ingests. Migration 0035 rewrites the
  quoted forms into the SOP's bracket form across **2,965 names / 7,691 active
  rows**, collapsing **1,013 duplicate display identities** (distinct active
  names 26,491 → 25,478). Active rows only; retired history keeps its printed
  text.

  Search is provably untouched: `normalize_plant_key()` strips non-alpha
  characters and `normalize_search_text()` maps punctuation to a space, so
  every affected row already shared one identity key *and* one search token
  stream with its twins — verified 0 key changes and 0 token-stream changes
  after apply. That is also why no `plant_other_names` edge moved, which is the
  thing that went wrong when 0005 last rewrote names and 0007 had to retire
  48,269 alias pairs behind it.

  **The bracket contents are not backfilled.** The SOP fills
  `Name [scientific name, variant]` from what the source printed, so the
  missing scientific and common names cannot be recovered with SQL — 0005 tried
  deriving them from the alias graph and abandoned it as too unreliable. That
  work is a per-supplier re-parse of the 491 stashed sources under SOP §5, and
  remains open. 642 names / 1,386 rows that still carry a quoted cultivar were
  also left alone on purpose: they mix in form/grade words, dash-separated
  trade names (`Acer palmatum 'Wolff' - Emperor 1®`), foot marks and internal
  apostrophes, and each needs a judgment a regex cannot make. Full list and
  rationale in `harness/agents/daisy/migrations/NOTE.md`.

### Fixed

- **Newton Nurseries Spring was routing to a closed company's inbox**
  (migration 0037). The 0036 merge flagged this as "a Newton location carrying
  another farm's contact details"; checking it before changing anything showed
  that read was half wrong, and the wrong half mattered. **Newton acquired Riley
  Fuzzel in 2023** — the site trades as "Riley Fuzzel - Newton Nurseries" at 630
  Riley Fuzzel Rd — so the phone `281-355-5495` is genuinely that yard's and is
  unchanged. The *email* was the problem: `info@rileyfuzzelfarm.com` is the
  acquired company's own inbox, now listed as closed, so availability requests
  for the Spring yard were reaching the previous owner. The location now has its
  own `Main line` contact with the verified phone and **no email** —
  `spring-sales@newnurseries.com` would match its three siblings on file, but no
  readable source prints it and the SOP forbids inventing a contact value. The
  old row keeps serving Riley Fuzzel Farm, unchanged.

- **Riley Fuzzel Farm retired — it was Newton Nurseries Spring under its old
  name** (migration 0038). The two supplier rows sat at the same street address
  because Newton acquired Riley Fuzzel in 2023; both were created by the same
  2026-08-05 backfill from different angles, and neither had ever been contacted
  or ingested from. 963 is soft-deleted with a note pointing at 1320, and
  **nothing was lost**: no inventory, sources, availability queries or notes were
  attached to it.

  1320 takes the address it should have had — Newton relocated the Spring yard
  to 21121 N Fwy Service Rd, Spring TX 77388, keeping the same phone. Because the
  retirement note names Riley Fuzzel and `suppliers.notes` is in the search
  document, searching "riley fuzzel" now returns exactly one row: Newton
  Nurseries Spring, at the current address. Coordinates stay null rather than
  inherit the retired row's, which point at the old site.

  This was also the first production run of 0034's rewritten deactivation
  cascade, and it did the new thing correctly: retiring the supplier retired its
  contact link and then the contact itself, because that was its last location.

- **A phone number stored with a leading colon.** Lynn Agee's row at YC Nursery
  - Prosper held `:214-213-0962`. The delimiter is stripped; the digits are left
  as printed, because that row and its sibling differ in the last digit
  (…0961 vs …0962) and only the source can say whether that is two lines or a
  typo.

## 2026-08-13

### Added

- **`inventory.size_std` — one checkbox per real container, instead of one per
  spelling.** The size facet listed raw `size` text, so `15 G`, `15G`, `15 gal`,
  `15 G/17"` and a 17" pot were five separate boxes out of 1,722 distinct active
  values, and picking "15 gallon" meant ticking whichever spellings you happened
  to spot. Migration 0030 adds `size_std` beside `size`, exactly as `height_std`
  sits beside `height`: `size` stays the supplier's printed evidence and is what
  the table cell shows, `size_std` is the one bucket the row belongs to and is
  what the filter selects on. Vocabulary approved by Bhoumik: `<N>G`,
  `<N>" Box`, `Bare Root`, `Liners`, `Plug`, `Trays`, `Field Grown`,
  `Grow Bags`, `Root Pruned`, `other`. The gallon and box families are **open
  sets** — the CHECK constraint tests the shape, not a fixed list — so a
  supplier who starts selling 12G needs no migration, and the number is always
  the one the source printed rather than a rounded neighbour. `inventory_enriched`
  and `search_inventory` both carry the column (the RPC had to be dropped and
  recreated for the return type; grants restored, `security_invoker` preserved
  on the view), and `inventory_supplier_size_std_idx` backs the facet. `size_std`
  is deliberately **not** in the pgroonga document — raw `size` already carries
  every spelling a search could type.
- **The size filter offers the standard, in the standard's order.** Word grades
  first, then gallons and boxes ascending **by number** (`2G`, `15G`, `100G` —
  not alphabetically), then the remaining word grades, then `other` last;
  sorting the Size column follows the same order. `app/lib/size-std.ts` holds
  the rule with a self-check (`node lib/size-std.check.mjs`). Stored selections
  moved to `lps.plant-search.size-choice.v3` and the two earlier keys are
  deleted on load, since raw-text selections mean nothing against buckets.

- **`B&B` and `<N>" Pot` buckets** (migration 0032, same day). The 0031 backfill
  left 8,589 rows in `other`, and its two biggest occupants were real containers
  a buyer would filter on: balled-and-burlapped stock (3,224 rows, 219 distinct
  spellings) and bare pot diameters with no gallon equivalent (2,122 rows, 52
  diameters). `B&B` joins the word grades — the burlapped ball *is* the
  container. `<N>" Pot` is a third open numbered family beside `<N>G` and
  `<N>" Box`; the three don't overlap, and which one a bare diameter joins is a
  judgment about the row: a diameter with a gallon equivalent stays a gallon
  (17" is `15G`), one that is really a box becomes `<N>" Box` even unlabelled
  (desert growers print a bare `36"`), and the rest are pots. A diameter
  attached to merchandise — Austin Plant Supply prices planters, bowls and hand
  tools the same way — stays `other`. **`other` fell 8,589 → 3,326**, now 5.3%
  of mapped rows and mostly quarts, six-packs and hanging baskets; buckets 52 →
  66. The filter orders pots before gallons, so the list runs smallest container
  to largest, and `B&B` sits with the field-dug grades.
- **Heights and calipers lifted out of B&B strings.** `B&B; 3-4' HT`,
  `4 - 5'; B&B` and `30 - 36"; B&B` printed the plant's size next to the
  container; those measurements moved into `height`/`caliper` with their
  `*_std`, **added only where the column was empty** and never substituted, so
  2,557 B&B rows now answer the height filter. 13 pairs were held back —
  topiary standards printing both a stem height and a head size, and sheared
  globes whose diameter is arguably width. Unlike 0031 the `size` text stays
  put, since these rows do have a real container in it.

### Changed

- **Every active row is bucketed, and 6,705 misfiled measurements left `size`.**
  Migration 0031 backfilled all 62,572 active rows: 54,821 carry a `size_std`
  across 52 buckets (`1G` 8,986, `other` 8,589, `3G` 7,445, `15G` 5,099, `5G`
  4,358, `Trays` 3,814), and the 7,751 with no container are `NULL` in both
  columns. 1,336 distinct printed size strings now collapse onto those 52
  checkboxes. Retired history rows are untouched by design (Bhoumik decision).
  The mapping came from 12 subagents classifying all 2,783 active
  `(supplier_id, size)` pairs against one shared ruleset — **the pair, not the
  string, is the unit**, because `2.5"` is a caliper at supplier 100 (Quercus,
  Magnolia, caliper column already holding 2.5) and a pot at supplier 73
  (Begonia, Narcissus). Verified afterwards: no active row has a `size` without
  a `size_std`, no `size_std` is stranded on a row whose size was lifted, and no
  supplier/size pair is split across two buckets.
- **`size` no longer holds heights and calipers.** 6,705 rows had a measurement
  the SOP has banned from `size` since 2026-08-05 — `5-6'`, `3/4'`, `30/36"`,
  `2.5"` on a shade tree — moved into `height`/`caliper` with the paired
  `*_std` in feet/inches, and both `size` and `size_std` cleared. The move is
  deliberately conservative: it fires into an empty column, one holding the same
  text, or one holding the range's own lower bound (`height = '4'` beside
  `size = '4/5'''` is one measurement, and the fuller range wins the text while
  `height_std` keeps the lower bound). A column holding a genuinely **different**
  value is left completely alone and only gets `size_std = 'other'` — a 4" pot on
  a 6"-tall Carex keeps both facts. 47 pairs whose reading was uncertain were
  likewise left in place rather than guessed.

- **"Soft leaf yucca" no longer returns Spanish Dagger.** Chris asked for
  Softleaf Yucca pricing at Austin Plant Supply and got a 15 G *Yucca gloriosa*
  at $101 alongside the correct rows. One false alias was responsible: id 44255,
  `Yucca gloriosa ↔ Yucca, Soft Leaf`. It was verified as the sole admission
  path — the Yucca gloriosa document matches neither
  `pgroonga_condition('soft leaf yucca', 0.34)` nor the `<%` trigram predicate
  (word_similarity 0.375), and of the ten active edges incident to
  `yuccagloriosa` only 44255 matches the query. Unfiltered it put **9 wrong rows
  across 4 suppliers** into a 20-row result. Approved migration 0028 retires it
  with 15 more Yucca edges of the class 0021 and 0025 already covered — a
  cultivar, selection or form name sitting in `other_name` against a bare
  species. Two of those searches were 100% wrong: `yucca jewel` returned 9 rows
  of plain *Yucca gloriosa* and `yucca rancho blue` 14 rows of plain *Yucca
  rostrata*, though no inventory row of either selection exists. After: `soft
  leaf yucca` 20 rows / 10 suppliers → 11 / 7, every one a genuine soft-leaf
  yucca; `yucca jewel` and `yucca rancho blue` → 0; controls `adams needle`,
  `red yucca`, `spanish dagger`, `yucca pendula` and `yucca recurvifolia`
  unchanged. Searching a bare species no longer reaches its cultivar rows
  through an alias — the same tradeoff 0021 and 0025 made deliberately, and the
  cultivar rows still match their own printed names. No inventory row changed.

- **The whole alias directory was audited; 4,654 false pairs retired (migration
  0029).** Chris's yucca bug was one bad edge, so the same defect classes were
  swept corpus-wide. Twenty reviewers covered all 13,553 active pairs against a
  rubric built around a **buyer's test** — "if someone ordered one and received
  the other, would that be a wrong shipment?" — because the previous audit had
  reviewed the yucca pair and cleared it by reasoning from taxonomy. Thirteen
  adversarial verifiers then tried to refute every flag, defaulting to *keep*
  when torn, since a wrongly retired alias breaks a real search silently while a
  wrongly kept one stays visible. Of 4,993 flags, 264 (5.3%) were refuted and 75
  low-confidence entries held back, leaving 4,654 retired: 3,981 cultivar-link,
  275 data-not-name, 194 generic-category and **204 wrong-taxon** — the last more
  than double the 96 the previous full-corpus pass found, and the class that
  produced the original complaint (`Abies alba ↔ White Fir`, which is
  *A. concolor*; `Acer truncatum ↔ Norway Maple`; `Araucaria bidwillii ↔ Monkey
  Puzzle`). Active pairs 13,553 → 8,899. The refutation pass rescued genuine
  trade names that would have broken searches — `Artemisia stelleriana ↔ Dusty
  Miller`, `Agave weberi ↔ Blue Weber Agave`, `Arecaceae ↔ Palms`, and the whole
  name-plus-grade class (`River Birch Multi Trunk`, `Chilean Mesquite standard`).
  Regression across 20 searches: rescued pairs and untouched hubs unchanged,
  wrong-taxon removals landed (`norway maple` 16→13 rows / 2→1 supplier,
  `monkey puzzle` 9→6), `red yucca` 57→54 as three generic *Hesperaloe funifera*
  rows stopped arriving through retired `RED YUCCA LITTLE GIANT` cultivar-links.
  Bare-hub counts barely moved (`acer palmatum` unchanged despite 75 retired
  edges, `rosa` −13 rows despite 187) because those rows match their own printed
  names — the aliases were redundant for finding them and load-bearing only for
  the false cross-matches. Coverage was proven, not assumed: each flag was mapped
  back to its position in the canonical ordering and checked against its
  reviewer's window. That check caught a real defect — concurrent agents sharing
  one scratchpad corrupted each other's cached tool results, so three windows
  collided and two (~1,356 pairs) went unreviewed while the row total still
  summed to 13,553. Those were re-run against explicit boundary ids. Evidence in
  `workspace/threads/main/alias-audit-complete-20260813/`. No inventory changed.

### Changed

- **The ingestion SOP now tests evidence instead of botanical knowledge.**
  Every alias guardrail was previously a knowledge test — "never two different
  species" only helps someone who knows soft-leaf yucca is *Yucca recurvifolia*,
  and knowledge tests fail silently. 44255 was created by pairing a supplier's
  printed label (`Yucca, Soft Leaf`) with a botanical name the writer chose,
  when that same source printed the right one on the row itself. §2 now requires
  **both sides of a pair to be printed in the source being ingested**, quotable
  from one line, never supplied from the writer's own knowledge, the web, or
  another supplier's list; adds "never two line items from the same list", since
  a supplier does not price one plant twice under two names; and settles
  taxonomic disputes with **the trade wins** — names sold as different products
  are different plants. §5 QA gains a mechanical alias check: search both sides
  of every new pair, retire it if either returns an identity that is not the
  plant just ingested, and report the source line that attests it.
  The schema doc records what the table cannot tell you (no `created_at`,
  `source_id` or confidence, so an audited edge looks like a fresh guess) and
  two holes in the dedupe trigger: it dedupes only one orientation, so a
  mirrored pair inserts cleanly — 168 mirrored rows exist and one retired pair
  already has an active mirror — and the 2026-07-31 cleanup deleted its retired
  pairs rather than keeping them as tombstones.

## 2026-08-12

### Changed

- **Ingestion SOP and schema doc now describe the post-0026 alias semantics.** Both still claimed search "hops between siblings" through the alias graph — the exact behavior migration 0026 removed. They now state that search and *Also known as* use only pairs directly incident to a row's identity, cite the 0021/0025 focal retirements as the standing cautionary record, and the schema doc's `plant_other_names` counts reflect the live directory (13,700 pairs / 13,563 active) instead of the pre-0021 "all active" snapshot.

## 2026-08-11

### Changed

- **Supplier geography/type filters are now searchable multiselects in both list-page toolbars.** Plant Search and Suppliers expose Supplier type, City and State beside the natural search field; multiple selections use OR within one field while type/city/state combine with each other and the text query. The controls share the existing column-filter state rather than creating a second filtering path, work in the wrapped mobile toolbar, remain visible before and during a Plant Search rather than appearing only after results load, and Clear all resets them with the other page filters. Plant Search keeps price and numeric dimensions in a compact mobile toolbar disclosure without duplicating those primary controls.
- **Mobile Plant Search results now arrive as a supplier shortlist.** The redundant second Filters/results-summary card is gone, and supplier inventory details start collapsed whenever a new result set arrives. Name, type, location and match count remain visible; the chevron expands an interesting supplier in place while its underlined name still opens the full profile.
- **Inventory dimensions now separate source evidence from numeric filtering.** Approved migration 0022 moved 2,309 explicit dimensions out of `inventory.size` into the existing human-readable height/width/caliper fields with exact guards. Migration 0023 adds nullable `height_std` (feet), `width_std` and `caliper_std` (inches), preserves lower-bound range semantics, appends the fields to both views and `search_inventory`, and applies six inclusive bounds before global result caps or supplier pagination. Desktop column headers and mobile filters show unit-labelled min/max controls while cells/cards retain source strings; invalid API bounds return 400, null standards remain unknown, and an unpaired manual string edit clears its numeric companion rather than leaving stale evidence. Guarded migration 0024 then backfilled 94,297 rows directly from their displayed fields: height 75,357, width 40,537 and caliper 22,589. Exact float conversions, full outside-target digests and display/filter regressions passed; no human string, timestamp, identity, source, price, quantity or activation value changed.

### Fixed

- **Cultivar-specific Plant Search no longer admits sibling cultivars through shared species hubs or generic fuzzy words.** After the approved 66-edge Crape Myrtle cleanup, migration 0026 removes reverse-hub sibling traversal from `search_inventory` and `inventory_enriched`, returns only direct reviewed aliases, and requires the least-common distinguishing token for multi-word identity searches with bounded typo/prefix tolerance independent of word order. `Crape Myrtle Muskogee` and its reverse fell from 442 rows / 30 suppliers / 344 wrong identities to 98 / 20 / zero; generic Crape Myrtle remains broad. The UI now says **Also known as**, and the browser no longer re-refines backend results through alias text. Follow-up migration 0027 applies explicit selected-word prefix matching in both intent selection and the final gate; the server also no longer splits an empty specific query into generic one-word searches, so invented cultivars fail closed. Abelia Francis Mason, Japanese Holly Compacta, Clusia Small Leaf, typo/prefix, dimension-bound, desktop and mobile regressions pass.
- **Francis Mason no longer inherits sibling Abelia cultivars through unsafe bare-species hubs.** With Bhoumik's approval, migration 0021 retired 15 audited Abelia alias edges while preserving four legitimate `Abelia × grandiflora` / Glossy Abelia mappings. Florida + 3 G now returns exactly Joe's Nursery Francis Mason instead of also returning Rose Creek; generic Abelia stays broad. No inventory changed.

### Security

- **RLS enabled on `inventory_pre_size_normalization`** (migration
  `harness/agents/daisy/migrations/0020_enable_rls_size_snapshot.sql`). The
  0019 rollback snapshot was created after the 0011 RLS sweep, so it was the
  one table PostgREST still served to `anon` — flagged by the dashboard's
  `rls_disabled_in_public` linter. No policies: only `postgres`/`service_role`
  read it, and it is still slated to be dropped once the size change settles.

## 2026-08-05

### Added

- **Suppliers record how their availability reaches us.** Migration 0018 adds
  three nullable columns to `suppliers` — `availability_source_type`
  (`Email` | `Hosted`), `availability_update_days` (a whole number of days) and
  `hosted_availability_url` — and the Suppliers table and supplier profile show
  and edit all three. This was previously prose in `notes` ("sends an XLSX every
  Monday"), which nothing could filter or sort on. Null means **not established
  yet**, not "none", so every one of the 910 rows starts blank, and nothing ties
  the URL to a `Hosted` source type: half-filled rows are normal while someone
  works out how a supplier publishes, and suppliers that both email a sheet and
  post one exist. `search_suppliers` was recreated to return the three columns
  (its return type is fixed, so the app cannot see a new column otherwise) and
  to accept them as sort keys; the pgroonga document was deliberately left
  alone, so searching "Hosted" does not find hosted suppliers — filter the
  column instead. Editing the source type uses a new `select` cell kind that
  saves on change, and the hosted URL is the first editable `url` cell: it keeps
  its link and puts the editor behind a hover pencil.
  Daisy's onboarding SOP now tells her to fill the three columns during browser
  enrichment and to report which she set (**approved by Bhoumik, 2026-08-05** —
  the SOP requires approval to edit). Two rules in that wording matter: the
  refresh interval is recorded **only when the supplier states it**, never
  inferred from two drops falling a week apart, and an existing non-null value
  is never overwritten without evidence it changed.
- **Supplier contacts are their own table.** `public.contacts` holds one row per
  person at a supplier (`name`, `email`, `phone`, `title_department`, `notes`,
  `is_primary`, `is_active`, `supplier_id`), replacing the single
  `suppliers.poc_name` / `poc_email` / `poc_phone` triple — a supplier can now
  have as many contacts as it has people. A partial unique index allows one
  active primary each, so promoting a contact means demoting the incumbent
  first. The supplier profile gains a **Contacts** tab of cards with edit, add,
  make-primary and remove; the Suppliers and Plant Search tables swap the three
  `PoC` columns for **Primary contact / email / phone** (read-only, resolved
  from the primary) plus an **Other contacts** column listing `Name [Title]` and
  deep-linking to that tab.
- **Supplier search reaches through people.** `search_suppliers` returns
  `primary_contact_*` from a lateral join over `contacts`, and matches a
  supplier when any of its active contacts matches on name, email, phone or
  title. Because an index expression cannot read another table, contact text
  left `suppliers_pgroonga_idx` for a new `contacts_pgroonga_idx`, and matching
  `supplier_id`s are folded in as a precomputed array — the same shape as the
  existing trigram fallback, so the main branch still uses its index.
  Contact-only matches score 0 and sort after direct matches.

### Changed

- **38,090 legacy `inventory.size` values standardised (migration 0019).** The
  cause was worth the dig: `normalize_size(text)` has been in the database all
  along and **nothing ever called it** — no trigger, no generated column, no
  default — so the SOP's size rule applied only when a parsing agent remembered
  to hand-apply it. `1G` (8,533 rows) and `1 G` (7,096 rows) were two values in
  the same table, as were `3G`/`3 G`, `15 G / 17"`/`15 G/17"` and `024 Inch
  Box`/`24" Box`. Running the existing function over the existing rows took
  distinct sizes 5,255 → 4,974 (2,769 → 2,671 active), which is what collapsed
  the duplicate checkboxes in the new size filter.
  **Syntactic only** — unit spelling, spacing and leading zeros. Qualifiers
  (`6 G; Bush`, `3 G TRUE`, `1 G <24"`) and height/caliper values parked in
  `size` (`5-6'`, `2-2.5"`) were left untouched; separating those is a semantic
  change needing source review, and it is why the filter still lists ~2,671
  choices. 12 `#N box|bag` rows were excluded because `#` means gallons but a
  box is sized in inches, so `#24 Box` → `24 G Box` may be flat wrong — they are
  listed in the migration NOTE for a human to check against the source.
  Verified: 0 rows lost alphanumeric content, 0 sizes nulled, row count
  unchanged, search unaffected. `inventory_pre_size_normalization` holds the
  pre-rewrite values until this settles.

- **Daisy's size rule became a size standard** (SOP §2, approved by Bhoumik).
  One line about unit spelling grew into: canonical units with a conversion
  table, `normalize_size()` named as the reference implementation, the `#N box`
  exception, when a word (`B&B`, `Field Grown`, `Quart`) is a valid size, and an
  explicit list of what must **not** go in `size` — height/width/caliper, form
  and grade codes, pack counts, and anything guessed. It also tells her not to
  bulk-fix legacy rows as a side effect of an ingest.

- **The Plant Search size filter now lists the raw `size` values, not
  categories.** The selector used to normalize each row into commercial buckets
  — collapsing `15 G`, `15G` and `15 G/17"` into one `15 gal` choice, splitting
  a `3–5 G` range into its endpoints, and inferring gallon/box/caliper types
  with plausibility guards (calipers had to be inch-qualified and ≤ 20 to keep
  known source noise like `caliper = 215` out). It read as tidy but hid what the
  rows actually say, and any size the classifier did not recognize was simply
  unfilterable. It is now a checkbox list of every distinct `size` string in the
  current matches, matched by exact text, which is what the Size column filter
  on desktop already did. Stored selections moved to
  `lps.plant-search.size-choice.v2` because the old keys (`gallon:15`) mean
  nothing now; the v1 key is cleaned up on load. Size typed *into the query*
  (`15g Agave Americana`) is unchanged — it still parses the token out of the
  plant name and matches by value, so it finds a row listed as `15 gal`.

- **Multiselect column filters have a search box.** Their options come from the
  rows on screen, so Size, City and similar columns list hundreds of values and
  finding one meant scrolling the whole dropdown. The search narrows the visible
  list only — selections outside the current search stay selected. Matches the
  supplier multiselect, which already had one.

- **Contact people moved out of `suppliers.notes`.** All 54 suppliers with notes
  were read by hand; the people written into that prose before `contacts`
  existed are now rows — 29 inserted (47 → 76), 12 existing rows gained the role
  the notes described, 3 a missing email or phone. 20 notes were trimmed, 5 of
  them to empty. Notes keep hours, addresses, policies, parsing quirks and
  business history. Verified after the fact: every name resolves to a contact
  row, and **no email or phone was lost**.

- **`contacts` is now the only place a supplier can be reached.**
  `suppliers.email` and `suppliers.phone` moved in and the columns were dropped,
  so `suppliers` describes the company and `contacts` holds every route to it —
  the main line included, as a row with `title_department = 'Main line'`. Where
  a name was recoverable from an address it came from a hand-curated allowlist
  of the values actually present, never a pattern, and each of those ~160 rows
  is stamped `Name inferred from the email address; unverified.` Most contacts
  have no name at all, which is expected: the add/edit form marks name optional
  and a contact needs only one of name / email / phone. Contacts 76 → 973 across
  907 suppliers. Supplier search now finds an address through the contacts
  branch rather than the supplier document.
- **The old `lps-rosie` app's public supplier form moved onto the service-role
  key** (that app lives outside this repo, at
  `projects/local_plant_supply/lps-rosie`). `/availability/[id]`, its three API
  routes and `/api/upload` are reachable without a login — suppliers open them
  from an emailed link — so they ran as `anon` and would have broken. They now
  use a new `lib/supabase/service.ts` client; the unguessable `friendly_id` in
  the URL remains the capability token, as before. Logged-in paths still use
  the anon-key + cookie client so per-user policies keep applying.

  One deliberate regression: that page's Realtime subscription on
  `availability_queries` subscribes as `anon` from the browser and now receives
  no events. It was redundant cross-tab sync — every edit, voice note and form
  upload already returns the updated rows in its own response — so the form
  itself is unaffected. Restoring it would mean giving `anon` read access to
  every availability query, which is the hole this change closed.

### Removed

- **`suppliers.poc_name` / `poc_email` / `poc_phone` are gone.** All 47 rows
  that used them were reconciled against the new `contacts` table before the
  drop — matching counts on every field and no value mismatches — so nothing was
  lost, but the drop is irreversible. Supplier deactivation now cascades to
  `contacts` alongside `inventory` and `inventory_sources`.
- **`suppliers.email` and `suppliers.phone` are gone too**, verified against a
  snapshot as **0 emails and 0 phones lost**. Anything that matched a supplier
  by `suppliers.email` must now join through `contacts` — Daisy's
  supplier-identification query and the onboarding SOP were updated to do so,
  and both tables plus the profile lost their Email/Phone fields.
- **`suppliers.fax` is gone**, and with it the last contact field on the table —
  `suppliers` now describes the company and nothing else. The 12 fax numbers
  moved into their supplier's main-line contact `notes` rather than `phone`,
  which the app renders as a dialable `tel:` link.
- **The 0015/0016 rollback snapshots were dropped.** `suppliers_notes_pre_contact_extraction`
  and `suppliers_contact_pre_move` are gone, so **the 0014–0017 column drops are
  no longer reversible from the database.** Every one was reconciled against its
  snapshot before the drop.

### Security

- **Row level security is on for every table.** `suppliers`, `inventory`,
  `chat_sessions`, `users` and `availability_queries` were running with RLS
  *disabled* — four of them already carried policies, which were therefore
  inert. Since `anon` holds table grants across `public`, the publishable key
  was in practice a full read-write handle on the whole database, `users`
  (which stores Gmail OAuth tokens) included. Migration
  `harness/agents/daisy/migrations/0011_enable_rls.sql` enables RLS on all
  five and gives `availability_queries` the `authenticated` full-access policy
  it never had. Verified against the live REST API: `anon` now returns `[]`
  for every table and both views.

  Nothing in this repo had to change to keep working — agents connect as
  `postgres` and the app uses the secret key, both of which hold `BYPASSRLS`.
  Both were re-verified after the migration (daisy's `query` bin, the search
  RPCs, and `inventory_enriched` over REST).

- **`inventory_enriched` and `rate_charts` are now `security_invoker`.** Both
  views are owned by `postgres`, so with Postgres's default they ran with the
  owner's `BYPASSRLS` rights and would have served `anon` the entire catalogue
  regardless of RLS on `inventory` — enabling RLS without this would have been
  security theatre. Any future `CREATE OR REPLACE VIEW` over these tables must
  set the option again; it is not inherited.

## 2026-08-04

### Changed

- **Inventory rows expose source ingestion time.** Plant rows now derive
  **Ingested** from their active source timestamp, and supplier list/profile
  views show the newest active-source **Last ingestion**. Manual/source-less
  rows remain blank; ingestion time is explicitly not the source's effective
  availability date.
- **Desktop Full chat uses the full canvas.** Selecting Full hides both the
  navigation and workspace; a centered edge handle reveals or hides a 240px
  supplier/search peek pane on demand. Restored Full state keeps that layout,
  while 50%/30%, resizing or hiding chat exits it. Desktop Full restoration is
  blocked/reset at the mobile breakpoint so it cannot zero-width Supplier or
  Plant Search during hydration.
- **Missing inventory prices retain their meaning.** The approved nullable-price
  migration stores an omitted supplier price as `NULL`; a follow-up cleanup
  converts all 28,998 historical zero-price placeholders to `NULL`. The app
  displays them as unavailable rather than `$0.00`; blank edits, range filters,
  and client/`search_inventory` sorting preserve the distinction and keep
  missing values last. Future numeric zero remains valid only when explicitly
  printed by the supplier.
- **Mobile agent navigation is consolidated.** One **Agents** bottom tab now
  opens Daisy, Rosie and Nova as channels; selecting an active agent opens the
  same existing conversation and Back returns to Agents. This is UI-only — no
  chat transport, routing, thread, model or API behavior changed.
- **Desktop supplier rows are uniform height.** Inventory sources show the
  newest filename as a direct link plus `+N` when older files exist; `+N`
  deep-links to that supplier's Files tab. Source counts no longer enlarge rows,
  and no API, source-record or ingestion behavior changes.

## 2026-08-03

### Added

- **The app installs as a PWA.** A static manifest, a service worker and a
  generated leaf icon set make the workspace installable to a phone home screen
  or a desktop dock, launching full screen at `/suppliers`. Chrome gets a
  one-per-session install offer; the desktop rail and mobile **⋯ More** both
  carry a manual **Install app** entry, which falls back to iOS
  Share → Add to Home Screen instructions on Safari and to an explanation when
  the browser cannot install (already installed, or a LAN address rather than
  HTTPS/localhost). The worker is network-first and caches only whole-page
  loads, so an offline launch shows the last page instead of a browser error
  while supplier data itself is never served stale. See
  [`docs/app/README.md`](docs/app/README.md#installable-app-pwa).

### Changed

- **Desert Night is available as a chat wallpaper.** The rights-confirmed
  user-provided cactus/agave pattern keeps its deep-black base while the icon
  strokes are selectively dimmed, including a further 20% reduction after live
  review. CSS color blending preserves luminance and subtly tints only the
  artwork forest/coral/violet with the active agent. Incoming bubbles now use a
  stronger tinted surface/border, while solid outgoing bubbles force white text;
  None and the original light line-art wallpaper remain available in Settings.
- **Pull-to-refresh works across mobile workspace pages.** Pulling down from a
  page pane's top refreshes its route; Suppliers and Plant Search additionally
  rerun the active client query while preserving its term and filters.
- **Chat history has edge navigation and pull-to-refresh.** Contextual arrows
  jump to the first/latest message, and pulling down from transcript top runs an
  immediate message poll without re-enabling unsafe document overscroll.
- **Keyboard-open PWA layout follows the visual viewport pan.** The Shell now
  tracks `visualViewport.offsetTop` as well as height; mobile bottom navigation
  hides while typing so the composer sits directly above the keyboard and
  returns when focus leaves the field.
- **PWA scrolling stays inside content panes.** The workspace Shell is fixed to
  the visual viewport and locks document overflow, so transcript/list swipes no
  longer move the header off-screen or leave blank space below the bottom nav.
- **Nova now recognizes its shared Telegram group.** Its system prompt records
  group `-1004330045748` as the communication channel with Bhoumik Shah and
  Chris and explicitly treats posts there as group-visible.
- **Mobile Plant Search opens a supplier only from its name.** The whole card
  header used to be the link, so a tap meant to read the category, location or
  match count navigated away. Only the underlined supplier name now navigates;
  the rest of the header is inert and the chevron still expands the plant list.
- **More → Settings works from an agent chat on mobile.** The chat sheet is a
  full-screen overlay over the outgoing page, which stays mounted until the new
  route commits — so the tap looked ignored. Both More-menu route entries now
  close the sheet as they navigate.
- **The viewport now declares `viewport-fit=cover`.** The mobile bottom tab bar
  already padded itself with `env(safe-area-inset-bottom)`, which resolves to
  zero without it — so the bar sat under the home indicator on notched phones,
  which the installed full-screen app would have made obvious.

## 2026-08-02

### Changed

- **Mobile navigation stays inside the Android PWA viewport.** The Shell now
  tracks the live visual viewport rather than trusting standalone-mode
  `100dvh`, keeping the bottom bar above system chrome through resize,
  orientation and keyboard changes.
- **Chat appearance is now a responsive Settings page.** `/settings` is enabled
  in the desktop rail and mobile More uses the same **Settings** label and route.
  The redundant
  mobile Back button/overlay are gone, so tapping another bottom-nav item always
  navigates normally.
- **Chat colors now follow each agent's profile art.** Daisy defaults to Forest
  Green, Rosie to Coral Rose and Nova to Electric Violet. The earlier Garden
  Green, Fuchsia Bloom and Agave Blue remain optional; Chat appearance can
  customize each mapping independently while wallpaper remains shared.
- **Agent chat uses Telegram-like typography.** Message bubbles, the composer
  and Chat appearance preview now use 16px Roboto with compact line spacing;
  timestamps remain small and the inventory/search workspace remains on Inter.
- **Mobile More is always visible.** All seven bottom-nav items now share the
  available width instead of overflowing horizontally, so Chat appearance and
  other More actions remain discoverable without swiping the tab bar.
- **Chat appearance settings are available on mobile.** More → Chat appearance
  provides a live preview, Garden Green / Fuchsia Bloom / Agave Blue palettes, an
  optional original dense cactus-agave-yucca-sun doodle wallpaper in green,
  blue and fuchsia, plus Reset. Preferences
  persist per device and remain scoped to chat rather than recoloring the app.
- **Generic list-page headers are removed on mobile.** Suppliers and Plant
  Search now start with their primary controls; highlighted bottom tabs already
  identify those pages. Desktop headers and supplier-specific identity headers
  remain unchanged.
- **Mobile chat now uses one compact header.** Avatar, agent name, short role
  (`Suppliers`, `Customers`, or `Developer`) and live status align on one line. Opening an agent
  replaces the underlying page-title row rather than stacking
  both headers above the conversation. The redundant close icon is removed;
  the highlighted active-agent tab remains the close toggle.
- **Mobile supplier profiles now prioritize inventory space.** The supplier
  name/category live in one sticky header; the duplicate title and mobile back
  link are gone. The pencil appears only at the bottom of expanded Supplier
  details, making expand → edit an intentional safety gate. Company data is
  collapsed behind a compact Supplier details summary by default, with one-tap
  call, email, website and
  map actions. The pencil expands the safe staged-edit form automatically;
  desktop details and its back link remain visible.
- **Supplier profiles now open directly to Inventory.** Tabs are ordered
  Inventory, Communications, Notes and Files; all four use compact mobile
  sizing and remain on one line.
- **Supplier profiles now require deliberate edit mode.** Profile fields are
  read-only until the pencil icon (**Edit supplier**) is pressed; edits are staged locally and a
  single **Save changes** action writes only changed fields atomically. Cancel
  warns before discarding changes, and reload/close gets an unsaved-change
  warning, preventing accidental mobile taps from entering or saving edits.
- **Mobile Plant Search rows now show availability specifications.** Height,
  width/spread and caliper appear beside the source size when present, rather
  than being stored correctly but hidden from mobile results. Tapping a row
  expands full other names, notes, update date and source link inline without
  leaving the supplier comparison.
- **Common-name + cultivar searches now recover from alias-combination gaps.**
  When a full multi-word search returns zero, the server searches its individual
  words in parallel and uses the smallest non-empty result set. `Live oak
  boardwalk` now reaches the same 32 Boardwalk rows as `Quercus boardwalk`,
  without adding fallback calls to normal successful searches.
- **Multi-word Plant Search now respects the full identity.** Broad fuzzy/alias
  results are refined to rows whose own name or aliases contain every requested
  word (with prefix support), falling back to the broad result only when none
  qualify. `Agave Americana` no longer pulls in unrelated `americana` trees,
  and their caliper sizes no longer contaminate its available-size selector.
- **Simplified size filtering in Plant Search.** Removed the permanent
  unit/min/max form. Users can type a natural query such as `15g Agave
  Americana`, or search the plant name first and choose from a compact selector
  containing conservative commercial categories from those matches. Gallon/box
  spellings collapse without inventing cross-unit equivalences; range descriptions
  contribute their endpoint categories; and bare dimensions, untyped numbers and
  implausible source-column values stay on result rows instead of becoming menu
  options. The compact selector now accepts multiple categories with OR logic;
  repeated URL parameters and browser storage preserve the selected set across
  navigation.
- **Plant Search now starts with a useful state instead of an unexplained
  sample.** A blank search shows a prompt and makes no catalogue request. The
  last term is restored from the URL or browser storage when returning, current
  results are fetched afresh, browser Back/Forward is honored, and Clear forgets
  the saved term.

## 2026-07-31

### Changed

- **Increased dark-mode contrast in the search workspace.** Muted labels,
  empty-state text, input outlines, borders, header rows, resize affordances and
  table hairlines are now brighter and easier to distinguish.
- **`cognisphere-harness` 0.8.7 → 0.8.11.** Two seeded artifacts moved, both
  re-seeded into daisy and nova (clean forks, no local edits): `context-meta.ts`
  now emits checkpoints as standalone prune-safe messages
  (`customType: "context-meta.checkpoint"`) instead of stamps fused onto
  neighboring messages — 0.8.9 fixed an 0.8.8 infinite-LLM-call regression and
  0.8.10 lands turn-ending checkpoints on `agent_settled` — and
  `0-base_prompt.md` documents the checkpoint messages as FYI-only telemetry.
  0.8.11 (no data migration) makes pi's own models.json mirror
  `.secrets/models.json` overrides, so spawned pi children and the dashboard
  agree on context windows. Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Plant identity now lives entirely in `inventory.name`.** The name is written
  `Name [scientific name, variant]` — the printed name in full, plus the
  scientific name and cultivar/trade name when the source gives them. The
  ingestion SOP (`harness/agents/daisy/knowledge/SOPs/`) and `SCHEMA.md` were
  rewritten to match; both had said the opposite ("botanical preferred; marketing
  names go to `plant_other_names`, never into `inventory.name`").
- **Dropped `inventory.category` and `inventory.variety`**
  (`harness/agents/daisy/migrations/0005_inventory_name_consolidation.sql`). The
  source's own grouping is no longer tracked, and the cultivar is part of the
  name. 101,678 rows had their variety folded in; both search indexes, the
  `rate_charts` and `inventory_enriched` views and `search_inventory` were
  rebuilt around the drop, and the RPC lost its `category_filter` parameter.
  `suppliers.category` is untouched. The app drops the plants table's Category
  and Variety columns to match. Pre-change values are kept in
  a rollback table (since dropped — see below); the scientific name was **not**
  backfilled, because deriving it from the existing alias graph proved
  unreliable (`Acer Palmatum` resolved to the cultivar `Oto hime`).
- **Purged the retired aliases and the rollback scaffolding**
  (`0010_purge_inactive_aliases_and_rollback_tables.sql`): 78,807 deactivated
  pairs deleted, leaving 13,429 — the entire table, all active — and both
  rollback tables dropped. Two consequences worth knowing: the name
  consolidation can no longer be reversed and the source `category` values are
  gone for good; and because the dedupe trigger ignores `is_active`, the retired
  rows had been silently acting as a blocklist against bad aliases returning.
  That guard is now the ingestion SOP's job alone.
- **Aliases are search equivalents only.** `plant_other_names.other_name` may now
  hold only another name for the *same plant* — common name, scientific name,
  synonym, abbreviation, spelling variant — never a cultivar, variant, trade name
  or patent code. Those linked a species to one of its selections, so every
  sibling cultivar matched every other one; the cultivar is searchable in the
  name instead (`0006_cultivar_alias_cleanup.sql`).
- **Retired 0005's alias carry-forward** (`0007_retire_carryforward_aliases.sql`),
  which turned out to be the largest single source of search false positives: it
  ran before the cleanup and copied unquoted cultivar compounds and sibling
  *species* onto cultivar rows, so `Redbud [Forest Pansy]` inherited
  `Cercis mexicana`. 48,269 pairs retired; 19,106 of 92,236 remain active.
  "Forest Pansy" and "Ruby Falls" now return zero false positives. The cost is
  that only 4,378 of 40,715 bracketed rows are still reachable through the alias
  graph — the durable fix is reparsing sources so the name carries the printed
  common-first identity. Cultivar cleanup is **not finished**: see
  `migrations/NOTE.md` for the Merlot-class residue and the token-OR noise, both
  left deliberately rather than fixed with a rule that deleted genuine names.
- **Audited and pruned the alias directory** (`0008_alias_quality_audit.sql`):
  generic category labels by fan-out ("Grass" was an alias for 64 distinct
  plants), non-plant junk (hardgoods, 31-char feed truncations, grade codes),
  nine hand-verified wrong-taxon pairs, and cultivar residue on single-word
  epithets. Active pairs 19,106 → 13,452; "Forest Pansy" and "Ruby Falls" return
  zero false positives and "Merlot Redbud" went 46 → 7. Four plausible rules
  were built, measured and **rejected** for destroying genuine names — the
  migration records why, so they don't get retried.
- **Cleared the last cultivar aliases** (`0009_residual_merlot_aliases.sql`): the
  four Merlot/Cercis pairs, plus a table-wide sweep for the same shape that found
  19 more (`Sedum rupestre` ↔ `Angelina Stonecrop`, `Ulmus` ↔ `Allee Elm`). The
  sweep is gated on trademark corroboration — ungated it also flags `Pinus taeda`
  ↔ `Loblolly Pine` and `Agave vilmoriniana` ↔ `Octopus Agave`, which are real
  names. Forest Pansy, Ruby Falls and Merlot Redbud now have **no alias false
  positives**; Loblolly Pine, Octopus Agave and Texas Redbud are unharmed.
- **The ingestion SOP now sets an explicit alias quality bar** — same plant only,
  no cultivars/trade names, nothing generic, names not data, and "when in doubt
  insert nothing", because search hops between siblings so one bad pair pollutes
  a neighbourhood. It also requires the printed **common name first** in
  `inventory.name`, since the name is the only place a printed common name
  survives.

### Added

- **Applied `0004_active_plant_aliases.sql`**, which had been prepared on
  2026-07-30 but held back because daisy's guarded query runner blocks
  `ALTER TABLE`. Adds `plant_other_names.is_active`, so inactive pairs power
  neither search nor the derived "Other names" column.

## 2026-07-30

### Changed

- **`cognisphere-harness` 0.8.6 → 0.8.7.** Fixes the gap we hit testing
  0.8.6: `context-meta.ts` (re-seeded into daisy and nova) now replays its
  stamping state machine over the persisted session on spawn, so
  `CheckpointTokens` stamps span batch boundaries — plain chat turns get
  stamped from a thread's second message on, instead of only tool
  results/steers within a single batch. No other seeded files changed.

- **`cognisphere-harness` 0.8.5 → 0.8.6.** Ships context-window telemetry
  for agents: a new seeded extension `context-meta.ts` (copied into daisy
  and nova) stamps per-step `CheckpointTokens` deltas into the session and
  injects ephemeral `Model`/`ContextUsage` figures into each LLM call, and
  the seeded `0-base_prompt.md` documents both (re-seeded in both agents —
  clean forks). Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Nova's webchat re-pointed to the `main` thread**
  (`harness/agents/nova/plugins/webchat/config.json`, now with the other
  keys' defaults spelled out), matching the telegram main-route pattern;
  daisy's `config.json` was dropped as redundant (the plugin default is
  already `main`). Nova's telegram bot is live (`lps_nova_bot`), but until
  a `main` chat route exists in its `plugins/telegram/state/routes.json`
  (runtime state, like daisy's), telegram messages still land on the
  `single` strategy's `default` thread rather than sharing `main` with the
  panel.

- **Harness upgraded 0.8.3 → 0.8.5.** Task-thread ids move to the
  unambiguous `<ThreadId>-§-[TASK]-§-<task-slug>` form and the admin UI
  groups task threads under their parent thread (no data migration —
  old-format threads keep working). Migration re-seeded both agents'
  `0-base_prompt.md`, `plugin-agent-messaging.md`, and `session-reader`
  (all were clean forks), and refreshed the harness-owned scaffold
  (`.claude/skills/`, `.agents/skills/`, `docs/base-harness/`); the local
  Supabase env wiring in `scripts/server.sh` / `config.example` was
  untouched upstream and survives intact. 0.8.4 also reworked the upgrade
  skill's scaffold refresh to audit local edits before copying.

### Added

- **Nova is now chattable from the web app**: the `webchat` plugin is enabled
  on `nova` (`harness/agents/nova/plugins/webchat/config.json` with
  `threadId: "default"` — the thread nova's `single` strategy computes, so the
  panel and Telegram share one conversation) and its seed CLI/prompt are
  checked in. In the app, Nova's `upcoming` flag is removed in `lib/agents.ts`
  (with dev-flavoured starter suggestions), the panel's empty-state line is now
  a per-agent `intro` instead of Daisy's hardcoded one, and the mobile tab
  bar's agent tabs now select which agent the chat sheet opens with (same tab
  toggles it closed). Rosie remains the only "Coming soon" agent.

- **Animated search loader**: while a search is in flight on Plant search, the
  Suppliers list or a supplier profile's Inventory tab, the results area dims
  under three sprouting seedlings (`components/workspace/search-loader.tsx`,
  theme-coloured, staggered, honours `prefers-reduced-motion`). The loader
  starts on the first keystroke — it also covers the 300ms debounce window that
  already gated the search RPCs — and empty states no longer flash while a
  search is pending. The caption under the seedlings rotates every 1.6s
  through a quirky set per search flavour (plant searches vs the suppliers
  list) instead of one fixed line per page. Its caption rotates through a set of quirky lines per
  search flavour ("Watering the seedlings…", "Ringing the nurseries…", …).

- **Know your Agents page (`/agents`)**: one card per agent showing its
  profile banner (`app/public/*_profile.png`) with an Active / Coming soon
  badge. Reachable from the nav rail's bottom section (above the user entry)
  on desktop and the ⋯ More menu on mobile.
- **Rosie and Nova listed as upcoming agents** in `lib/agents.ts` — they appear
  in the chat selector, the collapsed rail and the mobile tab bar as disabled
  "Coming soon" entries, and the chat proxy refuses them until the flag is
  removed. Daisy remains the only chattable agent.
- **New avatars for all three agents** (`daisy.png` replaced, `rosie.png` and
  `nova.png` added), cropped from the profile banners.

### Changed

- **Chat panel header simplified** — the agent selector tabs are gone; the
  header keeps only the Full / 50% / 30% size presets. Agents are picked from
  the collapsed rail.
- **Mobile chat no longer covers the bottom tab bar.** The sheet overlays the
  page content only, so navigation stays visible and usable while chatting.
- **Mobile bottom bar gained a ⋯ More menu** (Settings, theme toggle, Know
  your Agents, signed-in user + log out), replacing the bare Theme tab.

- **Upgraded `cognisphere-harness` 0.8.1 → 0.8.3.** No data-dir breaking
  changes (0.8.2 fixes `HARNESS_BASE_URL` export in the runner itself). Per
  0.8.3's new upgrade procedure, refreshed the harness-owned scaffold from the
  package: `scripts/` (upstream refactor of aws/contabo setup into
  `scripts/lib/remote-bootstrap.sh`; default `HARNESS_PORT` now 3142; dropped
  the now-redundant `HARNESS_BASE_URL` systemd line and the auto-retire of
  stale units), `config.example`, `docs/base-harness/`, and the
  `cognisphere-upgrade` skill (in `.claude/skills/`, `.agents/skills/`, and
  nova's `skills/agent/` mirror). Re-applied the local Supabase env wiring
  (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` in `config.example` +
  `scripts/server.sh` gen_secrets) that the refresh reverted.

- **Upgraded `cognisphere-harness` 0.8.0 → 0.8.1** (prompt/script corrections
  from upstream): re-seeded `0-base_prompt.md` (drops the `ddgs -o json`
  advice, routes plugin requests to `nova` instead of the operator) and the
  `scripts/agent/` wrappers (`session-reader` help reflects the task-thread
  session layout; wrapper headers no longer cite the removed `pi -p` CLI) on
  both agents. Daisy's local `cd /tmp` guard in the `ddgs` wrapper was
  re-applied on top of the new seed.

- **Upgraded `cognisphere-harness` 0.7.1 → 0.8.0** (two-phase: dependency bump +
  data-dir migration per the upstream CHANGELOG window):
  - Sub-agent CLI removed upstream — deleted the seeded
    `scripts/agent/subagent` + `sub-agent-prompt.md` from both agents, and
    removed `subagentModel` from daisy's `agent.json`. Delegation now runs
    through **task threads** (self-messages via the core agent-messaging
    plugin); daisy's `1-agent.md` ingestion workflow was reworded accordingly.
  - `0.1-main-agent.md` merged upstream into `0-base_prompt.md` — replaced both
    agents' base prompt with the new seed (forks were pristine; daisy's former
    local edits are already covered by her `1-agent.md`) and deleted
    `0.1-main-agent.md`. Roster renamed `0.3-agent-directory.md` →
    `0.1-agent-directory.md`.
  - agent-messaging became a core plugin — removed daisy's now-redundant enable
    dir (config was `{}`, inbox/state empty).
  - Developer agent id frozen upstream to `nova` — renamed `agents/dory/` →
    `agents/nova/`, updated `agent.json`, daisy's roster entry, and the docs
    (`docs/harness/agent-dory.md` → `agent-nova.md`); replaced the pristine
    `1-dev-agent.md` fork with the new nova seed.

## 2026-07-29

### Changed

- **Harness upgraded 0.7.0 → 0.7.1.** Adds gws thread-routing on the raw
  Gmail thread id (`scripts/gws/routes add --gmail-thread-id RE`) — the
  precise way to keep replies to one mail in one thread; daisy's forked
  `scripts/gws/routes` and `system_prompts/plugin-gws.md` were pristine
  0.7.0 seeds and took the 0.7.1 seeds unchanged. (The registry publish
  lagged the git tag by a couple of hours; a briefly vendored tarball was
  replaced with the registry package once 0.7.1 appeared.)

### Fixed

- Agent chat now renders literal `\\n` sequences from CLI replies as line
  breaks, fixing paragraphs and bullet lists in both new and existing messages.

## 2026-07-28

### Changed

- Removed the delete/deactivate buttons from the Suppliers and Plant Search
  tables; their rightmost action columns now contain only the view-local hide
  control.

### Fixed

- **Word-prefix search returned nothing** — `search_inventory('Mexican
  Sycamor')` found 0 rows while the full word found 17. The pgroonga
  `TokenDelimit` index only matches whole tokens, its fuzzy path doesn't cover
  edits at the end of a token, and the trgm fallback excludes queries that are
  substrings of the document — typed prefixes fell between every branch. Both
  search RPCs now OR in a Groonga `*` prefix match on the query's last token
  (when ≥ 3 chars). Migration `040_search_prefix_match`
  (`harness/agents/daisy/migrations/0003_search_prefix_match.sql`); no app
  code changed.

## 2026-07-27

### Added

- **Agent chat in the app.** A chat panel for `daisy`, built on the Supplier
  Workspace design: a resizable docked panel on desktop, a 46px collapsed rail,
  and a full-screen sheet on mobile opened from the bottom tab bar. Panel state
  persists to `localStorage` (`lps.chat.v1`).
- **`webchat` harness plugin** (`harness/plugins/webchat/`) — the first
  user-space plugin in this deployment. HTTP inbox at
  `/webhook/<agent>/webchat/api/*`, replies via the seeded
  `scripts/webchat/webchat-cli`. Configured with `threadId: "main"`, so the web
  panel and Telegram **share one thread and one context** rather than being two
  separate conversations.
- **Attachments both ways.** Users can attach files, paste images, and record
  voice notes; the agent can return files with `--file`. Images render inline,
  audio in a player, everything else as a download.
- **Voice notes** with a WhatsApp-style player — play/pause, a seekable
  waveform decoded from real RMS amplitude, elapsed time — and a live level
  meter while recording.
- **"Working…" indicator** while the agent owes a reply: a typing bubble, an
  amber status dot, and a badge on the collapsed rail avatar.
- `lib/agents.ts` — the single list of chattable agents, driving the selector,
  rail, mobile tab and the `/api/chat/<id>/…` allowlist.
- `docs/harness/plugin-webchat.md`, and this changelog.
- Mobile filters on plant search, plus a shared `FilterControl` component.

### Changed

- **Mobile supplier cards on plant search collapse.** A chevron on each card
  toggles its plant list; the card header still opens the supplier profile.
- **Mobile bottom tab bar alignment.** Tabs stretch to equal height, so a
  two-line label ("Plant search") no longer knocks its icon out of line.
- **Plant search mobile filters** are now a fixed, useful set — supplier,
  supplier category, state, city, size, price — instead of mirroring every
  filterable plant column (plant name, other names, quantity are gone).
- Harness dependency upgraded to **0.7.0**.
- Root `README.md` no longer claims the app "does not talk to agents" — it now
  does.
- Daisy's `agent.json` description and docs note both reachable channels.

### Fixed

- **Voice notes could never have worked on iPhones.** Safari cannot record
  webm — it produces mp4/AAC — but the recorder hardcoded `.webm` /
  `audio/webm`. The container is now chosen with
  `MediaRecorder.isTypeSupported` and the extension follows the recorder's real
  `mimeType`.
- **The mic button failed silently off `localhost`.** `navigator.mediaDevices`
  is `undefined` outside a secure context, and the resulting `TypeError` was
  swallowed by a bare `catch`, so nothing happened at all. It now reports the
  cause — insecure origin, unsupported browser, denied permission, or no device.
  (Recording over plain `http://` remains impossible; the app must be served
  over HTTPS for it to work on a phone.)
- `api/file` sends `Content-Length` from `stat` rather than the client-declared
  size, which could truncate or hang a response, and adds `Accept-Ranges` so
  audio is seekable.
- `webchat-cli` builds its URL from `$PI_WEBHOOK_BASE` instead of a hardcoded
  port — the harness serves on **3142** here, not the library default, so the
  original fallback would have failed on every send.
- The transcript now scrolls to the bottom on load (a layout effect, so there is
  no flash of the top), unpins while the user reads history, and re-pins when a
  late image changes the height.
- `next.config.ts`: `allowedDevOrigins` type error that had been failing
  `pnpm build` and `pnpm typecheck`.

### Security

- Browser-facing `webchat` endpoints require a resolved harness session — the
  plugin forwards the cookie to `/api/auth/me` rather than trusting that
  `pi_sid` is present, since it is a signed stateless token. `api/reply`
  requires `COGNISPHERE_WEBHOOK_SECRET`. Attachment paths are rejected if they
  escape the inbox/outbox or the agent dir, and uploads are capped (25MB).
- **Chat transcripts are no longer committed.** `webchat`'s `state/` and
  `inbox/` are gitignored and the transcript that had been committed was
  untracked — it is session data (`CLAUDE.md` §6). Scoped to `webchat` so that
  telegram's `routes.json` and scheduler's `schedules.json`, which are real
  config, stay tracked.

## 2026-07-24

### Added

- Per-agent documentation under `docs/harness/` (`agent-daisy.md`,
  `agent-dory.md`) and system prompts for the developer agent.

## 2026-07-22

### Changed

- **App-home restructure** to the 0.4.0 layout: harness data dir moved to
  `harness/` (from `lps-harness/`), the web app to `app/` (from `web/`).
- Telegram and internal-messaging plugin documentation clarified.

### Added

- Contabo provisioning scripts; the S3 backup script made S3-compatible.

## 2026-07-15 – 2026-07-17

### Added

- User-scope **telegram** plugin override with its own CLI.
- Gmail message decoding and attachment handling (`format-email`).
- **agent-messaging** plugin for inter-/intra-agent communication.

## 2026-07-06 – 2026-07-14

### Added

- **`daisy`** — the supplier-onboarding and availability-ingestion agent, with
  Gmail labelling to track processing status.
- S3 backups on a cron job; AWS setup script made version-flexible.

### Fixed

- Supabase reached via the IPv4 pooler with a direct-host fallback.
- Agent bootstrap installs all dependencies reliably; shebang scripts made
  executable.

## 2026-06-17 – 2026-06-29

Initial build.

### Added

- The harness, and `rosie` as Austin Plant Supply's supplier-side agent (since
  removed — the deployment keeps the name as deploy identity).
- The Supplier Workspace UI: catalogue tables, customer/job workspace, an
  availability-request flow and a stock-check form (both since removed).
- Deploy scripts, systemd units, config template and the root README.
