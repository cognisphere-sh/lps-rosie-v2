# App documentation

The user-facing web app (`app/`). Owned by whoever changes the code — the
developer agent (`nova`) or a human — and updated **after every change** under
`app/` (see `CLAUDE.md` §7).

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
  `Order Requests.dc.html`) — the Job Requests screen, implemented at
  `/requests`. It contributes the six status **tones** now in `globals.css`
  (`--lps-tone-{green,lime,grey,amber,red,teal}-{bg,fg,dot}`, each with a dark
  variant), read through `lib/job-requests.ts`.

The layout is followed as-is; only the **columns and fields** were remapped onto
the real schema. Two things the design owns that are easy to lose:

- **Tokens.** `lps-ui` only maps `--color-*` onto the semantic names; the values
  live in `app/app/globals.css`, which is the theme's source of truth. The
  Supplier Workspace design adds the `--lps-*` table-chrome tokens
  (`--lps-headrow`, `--lps-hair`, `--lps-edge`, `--lps-dim`, `--lps-tint`,
  `--lps-bubble`, `--lps-shadow`, `--lps-warn-*`) **and overrides dark mode's
  purple accent back to green** (`--primary: #4DD67D`), so dark mode stays the
  same product as light mode.
- **Dark-mode contrast.** Muted copy, empty states, borders, input outlines,
  header rows and table hairlines use brighter dark-mode tokens than the design
  mock so the dense search workspace remains legible on typical displays.
- **`--destructive-foreground`** ships equal to `--destructive` upstream, which
  makes destructive text invisible on a destructive surface. `globals.css` sets
  it to white, as the lps-ui README instructs.

Fonts: Inter (`font-sans`), Playfair Display (`font-serif`) via `next/font`.

### Deliberate deviations

Everything below differs from the mock **on purpose**. If you are "restoring
fidelity", start here rather than reverting one of these by accident:

| Deviation | Why |
|---|---|
| Higher-contrast dark-mode muted text and table chrome | The mock's small labels, empty states, controls and dividers were difficult to distinguish on typical displays. |
| `--destructive-foreground` set to white | Upstream ships it equal to `--destructive`, making destructive text invisible. |
| `Job Requests` is a **live route** (`/requests`) | Was rendered disabled while it was out of scope; the Order Requests design is now implemented against the real `job_requests` tables. |
| Requests are **collapsed cards that expand**, not one always-open grouped table | Asked for directly: a request is scanned by its metadata and counts first, and opened only when its lines matter. The mock's left-hand merged "order" cell becomes the card head, which is also what makes the screen work on a narrow viewport. |
| No selection checkboxes and no bulk action bar (Email quote / Text quote / Place order / PDF quote / Send availability request) | Every one of those actions is an approval-gated flow that does not exist yet — customer email needs Chris's sign-off per the `job-requests` skill, and order placement is the deferred request→order conversion. A button that only raised a toast would misrepresent what the system can do. |
| Inline editing covers **fields the mock never made editable** (name, size, demand, avail, unit price, addresses, shared note) as well as its status picker | Asked for directly. Writes go through the existing whitelisted `PATCH /api/rows`, so the server — not the dropdown — decides what may be written. |
| "Partial" is **derived**, not a stored status | The mock lists it beside the others; in the schema it is a fact about two numbers (`available_quantity < quantity`), so `itemPill()` derives it. A stored value could disagree with the figures printed next to it. |
| Notes are grouped by **kind** (Customer / Shared / Internal), not by named author with avatars | The schema keeps three note columns rather than a thread table, so "who said it" is not recorded per entry. The kind is what actually governs disclosure, and it is what the popover shows. |
| The mock's own agent chat sidebar is not rebuilt | The Shell already carries the app's agent chat panel on every page; a second one on this page would be two chats side by side. |
| Chat lists three agents (Daisy, Rosie, Nova); Daisy and Nova are chattable | Rosie is `upcoming` in `lib/agents.ts` — shown disabled ("Coming soon") in the desktop rail and mobile Agents list, and refused by the chat proxy. |
| No agent selector in the chat header — size presets only | Removed at the owner's request. Agents are picked from the collapsed rail (close the panel to switch). |
| A **Know your Agents** page (`/agents`) added to the rail's bottom section (above the user entry) and the mobile ⋯ menu | Not in the mock; shows each agent's profile banner from `public/*_profile.png` with an Active / Coming soon badge. |
| Chat composer adds attach / voice / paste; panel has a ⋯ → Clear conversation | The mock's composer was a text box and a send button; a real agent channel needs to carry files and be resettable. |
| No "list is 7+ days old" staleness flag anywhere | Removed at the owner's request, along with the panel tint that went with it. |
| Signed-in user read from `/api/auth/me` | The mock hardcoded a name and initials into the markup. |
| **Communications** tab added; **Notes** edits in place; supplier profile fields require explicit edit mode | The schema has two distinct note columns, and tap-anywhere field editing is unsafe on touch screens. Profile changes are staged and saved together. See below. |
| Suppliers, Plant search and the profile present **one company**, not one `suppliers` row | A company with several sites is several rows in the database (`head_branch_id`), and the mock draws one row per row — so Everde filled fifteen lines of a fifty-line page and a buyer had to reconcile them by eye. Asked for directly. The farm is never lost: it expands under the company row, names itself in the plant table's **Branch** column, and tags every entry on the profile. See *Companies and farms*. |
| Profile inventory is paginated | The mock had a fixed list; real suppliers carry thousands of rows. |
| Column reorder is direction-aware | The mock's algorithm makes an adjacent rightward drag a no-op. See *Column layout*. |
| Source/website cells are links; supplier sources show latest + history count | The mock rendered them as plain text. |

## Shell and responsive behaviour

`components/workspace/shell.tsx` renders the frame for every page. Its optional
`headerAction` slot lets detail routes keep a compact, single sticky identity
header rather than repeating the page title inside the content. Its
`hideHeaderOnMobile` option removes redundant generic titles from the Suppliers
and Plant Search lists, where the highlighted bottom tab and primary control
already identify the page:

- **Desktop** (≥900px): a collapsible left nav rail (196px ↔ 56px), a header
  with the page title + subtitle, and the agent chat on the right — a resizable
  docked panel, or a 46px rail when hidden. Choosing **Full** hides both the
  left navigation and workspace so chat uses the complete width. A centered
  pull handle on chat's left edge reveals/hides a 240px supplier/search peek
  pane without restoring the menu. Saved Full state restores the same layout;
  choosing 50%/30%, hiding chat, or manually resizing exits Full. Full state is
  desktop-only and is explicitly cleared at the mobile breakpoint, including
  during initial media-query hydration and device rotation.
- **Mobile** (<900px, the design's own breakpoint): the left rail is replaced by
  a five-item bottom bar. One **Agents** tab replaces the old permanent
  Daisy/Rosie/Nova tabs and opens a channel list for the same existing agent
  conversations; chattable rows open the current chat sheet, Rosie remains
  disabled as Coming soon, and the conversation's Back control returns to the
  Agents list. This is navigation-only — transport, routing, threads, models and
  APIs are unchanged. Both data-list pages swap their tables for cards. The
  chat sheet overlays page content inside the main column, above the tab bar, so
  global navigation remains visible while chatting. Its compact identity/status
  row keeps avatar, name, short role and live status on one line and replaces
  the underlying page header rather than stacking a second header. The bar ends
  in a **⋯ More** menu carrying what the desktop rail keeps at the bottom —
  Settings, the app theme toggle, Know your Agents, **Install app**, and the
  signed-in user with log out. All five tabs share the available width, so More
  stays visible without horizontal scrolling.
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
  entries also close the mobile chat sheet as they navigate — that sheet
  overlays the same wrapper the popover sits in, and the outgoing page stays
  mounted until the new route commits, so leaving it open hides the
  destination.

`Job Requests` remains **rendered disabled** because it is out of scope. Settings
is enabled in the desktop rail and through mobile More.

## Routes

| URL | Kind | Purpose |
|---|---|---|
| `/` | server | Redirects to `/suppliers`. |
| `/login` | client | Harness sign-in → `/api/auth/login`, then `/suppliers`. |
| `/suppliers` | client | Supplier Search, **one row per company** — see *Companies and farms*. The row is the head office's own record; only `# Items` and the ingestion columns speak for the whole company. A leading chevron expands the farms that answered the query beneath it, as full rows with their own profile links. Type/city/state and column filters still run on locations before grouping, so a company can appear because one farm matched and its expander reads `2 of 5 farms`. Company pagination is 50 results at a time. Rows retain the column picker, sort, resize, inline edit and view-only hiding; compact cards serve mobile. |
| `/suppliers/:id` | client | Profile — **one page per company** on a head-branch id, one farm on a farm id (*Companies and farms*). One Shell header carries supplier name/category; the duplicate in-page title is removed. On mobile, a compact **Supplier details** summary with call/email/web/map actions is collapsed by default; expanding it reveals the field grid and its bottom-right pencil, making expand → edit an intentional safety gate. Save/Cancel move into the Shell header during editing. Inventory opens by default, followed by Contacts / **Farms** / Communications / Notes / Files; on a company page every one of them covers all the company's locations and **tags each entry with the farm it belongs to**. **Farms** lists each location as a card with the same editable field grid the header has, plus a link to that farm's own page, and is offered only where there is more than one location (`?tab=farms` on a single-site supplier falls back to Inventory). Inventory height (ft), width (in) and caliper (in) ranges are sent to the server before its 100-row pagination; desktop uses column headers and mobile shows the same three controls under the supplier-list search. Mobile inventory cards also show the supplier's raw caliper text when present. Desktop keeps details expanded, its back link visible and its pencil in the header. |
| `/plants` | client | Plant search, **one card per company**, with every matching row from every one of its farms beside it and a **Branch** column naming the farm each row is at. Every plant retains its original `supplier_id` and source; the card links to the company page. The generic Shell title is hidden on mobile; the search toolbar carries natural size tokens, available-size/cultivar/type/city/state controls and pagination through the whole match set 300 plants at a time. Desktop keeps the resizable company panel and plant columns; mobile starts each company collapsed and lets each plant expose its branch, notes, dates and source inline. |
| `/photos` | client | Photo catalogue: a responsive thumbnail grid (2 up on mobile, to 5 on a wide screen) over `plant_photos`, with the same search toolbar shape as Plant search — one query box plus searchable multiselects for supplier, size, **cultivar** and tag. **50 photos at a time behind a Load more button**, which appends rather than flipping pages — a wall of photos is scanned downwards, and a pager loses everything already looked at. The button carries the remaining count so it isn't a mystery box. Each card carries a **delete** control in its top corner (always visible, not hover-only — this grid is used on touch screens): it confirms, then soft-deletes through `DELETE /api/rows`, and says plainly that the image file itself is kept in storage. **A blank query browses**, newest first, rather than showing an empty prompt: browsing is the normal way to use a photo catalogue. Each card shows plant name, supplier, size/dimension line and the captured (or received) date. Tapping one opens an in-page lightbox — full image, ←/→ and Esc, every identity/size/tag/provenance field, and a link to the supplier — so closing it returns to the same search, filters and page with no refetch. The lightbox's pencil turns that panel into a **form**: the three name parts, size, height/width/caliper, tags (comma separated) and caption/notes, staged locally and written as one atomic update on Save, exactly as the supplier profile does. While editing, Esc backs out of the form rather than closing the lightbox and the arrows belong to the text fields, so a draft can't be lost by reaching for the next photo. |
| `/requests` | client | **Job Requests**, from the Order Requests design comp. One **collapsed card per request** carrying everything it is judged on without opening it — `JR-<id>`, status pill, a **Needs input · N** badge, customer/company, contact routes, ship-to address, created/updated dates, `N lines · $total`, and a per-status count pill row (`2 available`, `1 unavailable`, …). Clicking the card expands its line-item table: Item / Size / Demand / Avail / Unit price / Total / Status / Notes, colour-keyed by status down a left edge, with a **Needs input** row tint. **The counts on a collapsed card always describe the whole request**, never the filtered subset the expanded table draws — so a card can honestly read `4 lines` while showing one. A search or an item-level filter auto-expands the cards it matched, since the question was about lines. **Expand all / Collapse all** in the toolbar. The line table scrolls sideways below ~960px rather than crushing its columns, and each card is `flex-none` so the card list scrolls vertically instead of the card being shrunk and clipping its own contents. **Fields are edited inline**: click a line's name, size, demand, avail or unit price to edit it (Enter or blur commits, Esc abandons, an unchanged value is never written), pick a status from the pill's dropdown, toggle the needs-input flag from its badge, and edit the ship-to/bill-to parts and the shared note in the expanded detail block. Every write goes through `PATCH /api/rows`, and the page refetches afterwards because `total` and every count are derived. **Not editable, deliberately:** `total` (generated), `customer_notes` (the customer's own words) and `internal_notes` (an append-only sourcing log — overwriting it from a grid cell would destroy the record); the notes popover says so and offers only the shared note. |
| `/agents` | client | Know your Agents: one card per entry in `lib/agents.ts` — avatar, role, Active / Coming soon badge, and the full profile banner image. |
| `/settings` | client | Responsive Settings page containing Chat appearance: live preview, per-agent colors, shared wallpaper and Reset. Available from desktop Settings and mobile More. |
| `/a/:agent/private/artifacts/:slug` | server | An agent-published page, for signed-in users, with the public/private toggle above it. See *Agent artifacts*. |
| `/a/:agent/public/artifacts/:slug` | route | The same page for anyone with the link, and **the app's only ungated path besides `/login`** — served only while the artifact is flagged public. |

| API route | Purpose |
|---|---|
| `GET /api/suppliers?q=&page=` | Runs the location-level `search_suppliers` result and filters first, attaches each location's `head_branch_id`, groups before pagination, and returns `companies` (50 per page). Each carries the **`head` row** — read from `suppliers`, so it is present whether or not it matched — the matching farms under it, `matchedCount`, `locationCount` and `locationIds`. The head row's source list is the whole company's, newest first, so its **Last ingestion** is the company's. `total`/`pageCount` are company counts. `?counts=1&ids=` is still the per-location active-item second pass, now asked for **every** location id so the company row's `# Items` is the company's. |
| `GET /api/suppliers/:id` | The whole profile as one payload (`getSupplierProfile`): `subjectId`, `company` (`{id, name, locationCount}`) and `locations` — head branch first, each with its own row, contacts, active sources and item count. On a head-branch id that is every active location of the company; on a farm id it is that farm alone. |
| `GET /api/plants?q=&page=` | Plant search is still paged at inventory-row grain (300), then grouped into **company** `groups`: `companyId`, `companyName`, the head-office `company` row carrying the aggregates, `locationCount`, `matchedLocations` and the plants themselves, each with `values.branch` naming its farm. Plant and location filters — including city/state — run before the page and the grouping. `sort=&dir=` orders the whole inventory match set ahead of relevance. `?supplierId=&page=` is the profile's inventory and takes a **comma-separated set** of farm ids — the profile's whole scope — so a company page pages through its farms as one list. |
| `GET /api/photos?q=&offset=` | Photo catalogue, 50 per batch, with the match `total`. **An `offset`, not a page number** — the grid appends, so it asks for "the next batch after what I hold", which stays correct after a photo is deleted out of the middle; a page number would skip the row that moved up. An offset past the end returns an **empty batch with the true total**, not an error. `p.supplier` / `p.size` / `p.cultivar` / `p.tag` filter in SQL over the result (or over the table when `q` is blank). `?facets=1&q=` returns the option lists — sizes, tags, cultivar display names and `{id,name,city,state}` suppliers — for that search without its filters. |
| `GET /api/photos/:id/image` | Redirects to a 1-hour signed URL for one photo. Takes a **photo id**, never a storage path: the path is read from the row, so this cannot be used to sign arbitrary objects in the private bucket. |
| `GET /api/requests?q=&page=` | Job requests, 25 per page, each with **all** of its active line items, its per-status counts, `lineTotal` and `attentionCount`. `q` matches a plant name on the request, the customer's name/company/email, or the request id (`7` or `JR-7`) — a plant match narrows the lines returned, a customer or id match keeps them all. `status` / `itemStatus` are whitelisted against the CHECK vocabularies (an unknown value is dropped, not an error); `size`, `customer`, `created`/`updated` (days back) and `needs=1` filter too. **`needs=1` means the request's own flag *or* a line waiting on someone** — flagged by hand, or with no availability answer yet — resolved in SQL so the page and its `total` describe the same set. `?facets=1` returns the size and customer option lists plus the header totals. |
| `GET /api/file?path=` | Redirects to a 1-hour signed URL for a source file. |
| `GET /api/auth/*` | Not ours — rewritten to the harness (`login`, `logout`, `me`). |
| `GET·POST /api/chat/:agent/:action` | Pass-through to that agent's `webchat` plugin inbox. See *Agent chat*. |
| `GET /a/:agent/private/artifacts/:slug/raw` | The artifact HTML for the page's iframe, fetched from the harness with the shared secret. |
| `POST /a/:agent/private/artifacts/:slug/share` | `{"public":bool}` — flips which of the artifact's two links works. |
| `PATCH /api/rows` | One inline cell edit, or a whitelisted set of changed fields in one row update. |
| `DELETE /api/rows` | Soft delete (`is_active = false`). `inventory_sources` cascades to the rows it sourced and returns `retired`. |

Pages are client components that fetch from these routes — the workspace is
interaction-heavy (column layout, filters, editing), so there is one data path
rather than a server-rendered one and a client one that drift apart.

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

The photo catalogue runs the same machinery against `search_plant_photos`, which
is `search_inventory`'s algorithm over a photo's name, size, caption, tags and
notes — so everything below about ranking, aliases and typed sizes applies there
too, and a search for `Chusan Palm` finds a photo catalogued as *Trachycarpus
fortunei*. It differs in one way that matters to the page: a blank query
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

Wrapping the entire plant identity in straight double quotes switches the same
API to exact mode: `"Italian Cypress"` compares complete common, botanical and
composed identity parts (plus exact cultivar keys and one direct reviewed alias
hop), ignoring punctuation/case/word order but refusing extra tokens. It
therefore excludes Arizona Cypress and Blue Ice while the unquoted query keeps
the broad discovery tail. Quotes are preserved in the URL and local storage.
Use the existing Size selector with an exact query; text outside the closing
quote deliberately means the query is no longer fully wrapped and stays broad.

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
in the catalogue, and a row's `relevance` is the sum over the groups it matched.
Rare terms therefore dominate — searching `Crape Myrtle Muskogee` puts the
Muskogee rows on top (10.38) above rows matching only the rare word (5.82) and
the 567 generic crape myrtles (4.55).

Matching is **typo tolerant** (`Mexican Sycamoer` finds the same top row as the
correct spelling) and **partial at both ends** (`sycamor` *and* `ycamor` find
`sycamore`). Query terms are **expanded through aliases** before any of this, so
`Paperbark Maple` and `Acer griseum` return the same 66 rows.

**A size typed into the query ranks rather than filters.** `15g Live Oak` puts
15 G live oaks on top and keeps every other size below them; all of `15g`,
`15 gal` and `15 gallon` behave identically, as does `24 inch box`. The browser
does nothing for this — there is no longer a size chip, no `parseSizeQuery`, and
no client-side size test. Filtering by size is still the Size multiselect's job.

Retrieval is OR across groups, so result sets are long and the tail is weakly
matched — that is deliberate, and why ranking rather than a filter decides what
you see first. The app pages 300 at a time in relevance order, and orders
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
the individual cultivar and trade names the matched rows carry. It writes the `plants` table's own
`cultivar` column filter, so the toolbar control and the column header's filter
are one piece of state — set either and both show it.

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
naming its branch above the size line. The underlined company name opens the
company profile; the chevron only discloses the rows.

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

### Job requests

`job_requests` and `job_request_items` are written through the same
`PATCH /api/rows` whitelist as every other table, with three columns held back
on purpose:

- **`total`** is `GENERATED ALWAYS AS (quantity * unit_price)`. Postgres rejects
  a write to it outright; the whitelist refuses first, with a sentence.
- **`customer_notes`** is what the customer said. It is evidence, and the
  workspace has no business rewriting it.
- **`internal_notes`** is an append-only sourcing log (`job-requests` skill).
  A grid cell overwrites, so offering it here would destroy the log the moment
  someone edited a stale copy of it. Appending needs its own control; until
  there is one, the column is read-only in the app and only Rosie appends.

`status` on both tables is checked against the CHECK vocabulary **server-side**
(`ENUMS` in `lib/queries.ts`), so a bad value comes back naming the allowed ones
rather than as a constraint-violation string, and the server does not depend on
the dropdown having been honest. `quantity > 0` and `available_quantity >= 0`
are likewise reported as sentences.

Every write — from this app or from Rosie — is recorded by the
`job_request_changelog` trigger with the actor that made it: `service_role` for
the app, `rosie` for the agent (which sets the `app.actor` GUC). Nothing in the
write path has to cooperate for that to happen, which is the point of it being
a trigger.

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
preference.

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
Each agent's messages route to **the same thread its Telegram uses** (Daisy's
`main`, Nova's `default`), so the panel and Telegram are one conversation per
agent.

`lib/agents.ts` is the single list of agents (id, display name, role, avatar,
profile banner, empty-state intro, starter suggestions). It drives the
collapsed rail, the mobile tab, the `/agents` page and the `/api/chat/<id>/…`
allowlist. Entries with `upcoming: true` (Rosie) appear everywhere but are
disabled — the UI greys them out as "Coming soon" and the chat proxy answers
404 for them; `CHAT_AGENTS` is the filtered chattable subset. Activating one is
removing the flag plus `mkdir harness/agents/<id>/plugins/webchat` (with a
`config.json` naming the thread its Telegram routes to — see the plugin doc).
There is no selector in the panel header — switching agents happens from the
collapsed rail on desktop and the tab bar's agent tabs on mobile (`shell.tsx`
owns the mobile selection and passes it down as `mobileAgentId`).

**Transport.** `app/api/chat/[...path]/route.ts` forwards to
`<harness>/webhook/<agent>/webchat/api/<action>`, passing the cookie and
streaming the body (uploads need `duplex: 'half'`). The browser can't call the
harness directly — different origin, no CORS, and the plugin authenticates with
`pi_sid`, which is scoped to this app's domain. `proxy.ts` gates the route
before it runs, and the plugin re-checks the session on its side; the agent and
action are both checked against allowlists, since the path comes from the
browser. A harness that is down answers 502 rather than hanging the poll.

The panel **polls** `api/messages?since=<cursor>` every 2s while it is open —
no SSE, no websocket. A sent message is added optimistically and then adopts
the id the server returns, so the next poll doesn't duplicate it.

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

**Busy state.** The plugin reports `pending`; the panel shows a bouncing-dot
"Daisy is working…" bubble, an amber status dot in the header, and a dot on the
collapsed rail avatar. See the plugin doc for what does and doesn't clear it.

**Markdown.** Agent replies render through a ~30-line subset renderer (bold,
inline code, links, bullet lists) rather than a markdown dependency. It also
normalizes literal `\\n` sequences from CLI replies into line breaks, including
in existing transcript entries. Tables are not supported — the plugin's seed
prompt tells Daisy to use bullet lists.

Panel open/closed and width persist to `localStorage` under `lps.chat.v1`,
written from an effect behind a `hydrated` ref — the same pattern, and the same
reason, as the table layout.

### Chat appearance

**Settings → Chat appearance** is a responsive route, reached from desktop
Settings or mobile **More → Settings**, with a live bubble preview,
independently configurable agent colors and
six scoped chat palettes. Profile-matched defaults are Daisy Forest Green,
Rosie Coral Rose and Nova Electric Violet; Garden Green, Fuchsia Bloom and
Agave Blue remain optional choices. Wallpaper choices are None, the original
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
apply to the desktop chat panel. The wallpaper field is an id (`none`,
`line-art`, or `desert-night`); legacy boolean `true` migrates to `line-art`.
Agent/incoming bubbles use an 18% accent-tinted card surface with a 28%
accent-tinted border, separating them from black wallpaper; outgoing bubbles
stay solid accent with explicit white text. Chat messages, the composer and the
appearance preview use Roboto at 16px with a compact 1.35 line height, approximating native
Telegram typography while leaving the rest of the app on Inter.

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

## Notes vs Communications

The profile has two text tabs, backed by two different columns that must not be
mixed (see [the schema doc](../supabase-schema.md#notes-vs-communication_notes--dont-mix-them)):

| Tab | Column | Behaviour |
|---|---|---|
| **Notes** | `suppliers.notes` | What is **true about** the supplier — quirks, preferences, ordering constraints. A textarea, **edited in place**. |
| **Communications** | `suppliers.communication_notes` | What was **said to** them. **Append-only**: pick a channel, write what and why, and it appends a timestamped entry. Rendered newest-first; the column itself stays in append order. |

Both columns are per location, so on a company page both tabs are per location
too: **Notes** renders one tagged editor per farm, and **Communications** merges
every farm's log into one list ordered by the `[YYYY-MM-DD HH:MM …]` stamp each
entry opens with, tagging each entry and asking which farm a new one is about.
Entries without a stamp have no position to claim and fall to the end.

Daisy writes to `communication_notes` in the same format every time she contacts
a supplier, so app-entered and agent-entered history read as one log.

Both columns are hidden by default in the suppliers table (long free text would
blow up the row height) and available from the column picker.

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

Adding a filter is now a line in the spec, not a migration, because the RPC
already projects the columns. Two consequences worth knowing:

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

Credentials belong to the **cognisphere harness** (`harness/.secrets/users.json`,
from `config`'s `APP_USER` / `APP_PASS`). `next.config.ts` rewrites
`/api/auth/*` to the harness so the browser stays same-origin and the harness
sets its `pi_sid` cookie.

`proxy.ts` (Next 16's replacement for `middleware`) gates every route except
`/login`, `/api/auth/*` and the public artifact path (*Agent artifacts*), and
**verifies the session rather than just looking for the cookie**: `pi_sid` is a
signed stateless token, so it calls the harness `/api/auth/me` with the incoming
cookie and only proceeds when a user comes back. That call lives in
`lib/session.ts` so the gate and the private artifact routes share one
definition of a real session rather than each carrying its own.

That check is load-bearing. Pages read Supabase with the project's **secret**
key and can now *write*, and the harness is no longer in the path to reauthorize
each call — a presence-only gate would let a hand-set `pi_sid=anything` read and
edit the whole catalogue. `/api/auth/me` answers `200 {"user":null}` for a bad
session, so the status code alone is not the answer. If the harness is
unreachable the check **fails closed**.

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
| `public/manifest.json` | Static manifest: `start_url: /suppliers`, `scope: /`, `display: standalone`, brand green `theme_color`, and versioned 192/512 cactus-logo icons. |
| `public/sw.js` | Service worker. Its *existence* plus a `fetch` handler is what makes Chrome consider the app installable. |
| `components/pwa/pwa-provider.tsx` | Registers the worker, captures the install event, exposes `usePWA()`. Wraps the root layout. |
| `components/pwa/install-popup.tsx` | The unprompted offer — Chrome only, once per session. |
| `components/pwa/install-app-button.tsx` | The manual entry point, rendered in the desktop rail and mobile ⋯ More. |
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

**Things that quietly break it:**

- **A LAN IP never fires the event** — only HTTPS or `localhost`. The install
  button detects this and says so rather than doing nothing.
- **Already installed → no event either.** Same fallback message.
- `proxy.ts`'s matcher must keep excluding `/manifest.json`, `/sw.js` and the
  icons (it does, via the trailing-extension rule). Chrome's check follows no
  redirect and reports no error — a gated manifest just means the event never
  arrives.
- The manifest is linked through `metadata.manifest`; `theme_color` lives in
  **both** the manifest and `viewport.themeColor` in `app/layout.tsx`.
- `viewport.viewportFit: 'cover'` is what gives the mobile tab bar's
  `env(safe-area-inset-bottom)` a non-zero value once the app runs full screen.

## File map

```
app/
  api/           suppliers, suppliers/[id], plants, photos, photos/[id]/image,
                 file, rows, chat/[...path]
  a/[agent]/     agent artifacts: public/ pass-through, private/ page +
                 ShareToggle + raw + share
  suppliers/     list (one row per company) + [id] profile (one page per company)
  plants/        plant search, one card per company
  photos/        photo catalogue grid + lightbox
  agents/        Know your Agents — profile banner cards
  login/
  globals.css    design tokens — the theme's source of truth
public/
  daisy.png, rosie.png, nova.png    avatars (cropped from the banners) —
                                    panel header, rail, selector, mobile tab
  *_profile.png                     full profile banners, shown on /agents
  manifest.json, sw.js              PWA manifest + service worker
  lps-cactus-icon-{192,512}.png      install icons (purple flowering cactus)
  lps-cactus-icon-maskable-512.png   Android safe-zone variant
  lps-cactus-apple-touch-icon.png    iOS Add to Home Screen icon
components/
  ui/            lps-ui primitives (button, input, label, card, alert, badge)
  pwa/           install: provider (SW + beforeinstallprompt), auto popup,
                 rail/menu button, iOS instructions modal
  workspace/
    shell.tsx        nav rail, header, mobile tab bar, theme, session user, toasts
    chat.tsx         agent chat: docked panel / rail / mobile sheet, polling,
                     composer (attach, paste, voice), markdown subset
    table-parts.tsx  column picker, column head (sort/filter/resize/drag),
                     FilterControl (the head's filter widget, reused on mobile),
                     cell (plain/link/badge/list/file/url), MultiFilter
    plant-table.tsx  the plant sub-table, shared by search + profile
    toolbar.tsx      search box, filter chips, count summary
    search-loader.tsx  sprouting-seedlings loader + overlay for ongoing searches
    icons.tsx        the design's icon set
lib/
  agents.ts        the agents (id, name, role, avatar, profile, upcoming flag,
                   intro, suggestions) + CHAT_AGENTS, the chattable subset
  columns.ts       column definitions mapped to schema columns + websiteHref()
  rows.ts          row shapes (SupplierRow, SupplierCompany, SupplierProfile,
                   SupplierScopeLocation, PlantRow, PlantGroup, SourceLink,
                   PhotoCard, PhotoFacets)
  queries.ts       every database read, the whitelisted writes, file signing
  photos.ts        the photo catalogue's reads, facets and image signing
  table-config.ts  column layout state + localStorage persistence + reorder()
  table-config.check.mjs  self-check for reorder()
  size-std.ts      the size_std vocabulary and the order the filter offers it in
  size-std.check.mjs      self-check for that order
  server-filters.ts       the filter spec: state -> query string -> SQL
  server-sort.ts          the sort spec, same shape: which columns SQL orders
  use-debounced.ts query + filter/sort state debounced as one request
  format.ts        money / number / date formatting
  supabase.ts      server-only client
  session.ts       resolveUser() — the one definition of a real session,
                   shared by proxy.ts and the artifact routes
  artifacts.ts     agent allowlist, upstream URLs, signedIn(), header relay
  utils.ts         cn()
proxy.ts           session gate
artifacts-routes/  the harness's own route template, refreshed on upgrade and
                   excluded from the build — reference only, see its LOCAL.md
```

## Environment

`app/.env.local` is **generated from the repo-root `config`** by
`scripts/server.sh` — do not hand-edit it. `HARNESS_URL`, `HARNESS_USER`,
`HARNESS_PASS`, `DOMAIN`, `PORT` from the stock script; `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `ARTIFACTS_AGENTS` and `ARTIFACTS_APP_SECRET` appended by
the `scripts/app/secrets.sh` deploy hook. Both `config` and `.env.local` are
gitignored — keep it that way.

## Scripts

`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm typecheck`.

There are standalone checks, run directly rather than through a test runner:

```sh
node lib/table-config.check.mjs     # column reordering
node lib/size-std.check.mjs         # size_std ordering
```
