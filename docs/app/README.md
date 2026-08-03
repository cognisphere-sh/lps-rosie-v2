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
| `Job Requests` rendered disabled | Job Requests remains out of scope. Settings is now a real responsive route containing Chat appearance. |
| Chat lists three agents (Daisy, Rosie, Nova); Daisy and Nova are chattable | Rosie is `upcoming` in `lib/agents.ts` — shown disabled ("Coming soon") in the rail and mobile tab, and refused by the chat proxy. |
| No agent selector in the chat header — size presets only | Removed at the owner's request. Agents are picked from the collapsed rail (close the panel to switch). |
| A **Know your Agents** page (`/agents`) added to the rail's bottom section (above the user entry) and the mobile ⋯ menu | Not in the mock; shows each agent's profile banner from `public/*_profile.png` with an Active / Coming soon badge. |
| Chat composer adds attach / voice / paste; panel has a ⋯ → Clear conversation | The mock's composer was a text box and a send button; a real agent channel needs to carry files and be resettable. |
| No "list is 7+ days old" staleness flag anywhere | Removed at the owner's request, along with the panel tint that went with it. |
| Signed-in user read from `/api/auth/me` | The mock hardcoded a name and initials into the markup. |
| **Communications** tab added; **Notes** edits in place; supplier profile fields require explicit edit mode | The schema has two distinct note columns, and tap-anywhere field editing is unsafe on touch screens. Profile changes are staged and saved together. See below. |
| Profile inventory is paginated | The mock had a fixed list; real suppliers carry thousands of rows. |
| Column reorder is direction-aware | The mock's algorithm makes an adjacent rightward drag a no-op. See *Column layout*. |
| Source/website cells are links; source lists scroll | The mock rendered them as plain text. |

## Shell and responsive behaviour

`components/workspace/shell.tsx` renders the frame for every page. Its optional
`headerAction` slot lets detail routes keep a compact, single sticky identity
header rather than repeating the page title inside the content. Its
`hideHeaderOnMobile` option removes redundant generic titles from the Suppliers
and Plant Search lists, where the highlighted bottom tab and primary control
already identify the page:

- **Desktop** (≥900px): a collapsible left nav rail (196px ↔ 56px), a header
  with the page title + subtitle, and the agent chat on the right — a resizable
  docked panel, or a 46px rail when hidden.
- **Mobile** (<900px, the design's own breakpoint): the left rail is replaced by
  a bottom tab bar (which carries a tab per agent — tapping a chattable agent
  opens the chat sheet on that agent, tapping it again closes it, and upcoming
  agents are disabled), and both list pages swap their tables for card
  lists. The chat sheet overlays the page content only — it is rendered inside
  the main column's relative wrapper, above the tab bar, so navigation stays
  visible and usable while chatting. Its compact agent identity/status row
  keeps avatar, name, short role and live status centered on one line and
  replaces the underlying page header while open instead of stacking a second
  header. There is no redundant close icon: tapping the highlighted active-agent
  tab again closes the sheet, while another agent tab switches chats. The bar
  ends in a **⋯ More** menu carrying
  what the desktop rail keeps at the bottom — Settings, the app theme
  toggle, Know your Agents, **Install app**, and the signed-in user with log
  out. All seven tabs
  share the available width, so More stays visible without horizontal scrolling.
  Its popover renders outside the overflow-clipped bar. Settings is a normal
  `/settings` route rather than an overlay, so any bottom-nav selection
  navigates immediately without requiring a Back control.

`Job Requests` remains **rendered disabled** because it is out of scope. Settings
is enabled in the desktop rail and through mobile More.

## Routes

| URL | Kind | Purpose |
|---|---|---|
| `/` | server | Redirects to `/suppliers`. |
| `/login` | client | Harness sign-in → `/api/auth/login`, then `/suppliers`. |
| `/suppliers` | client | Master table: column picker, per-column filters, sort, drag-reorder, resize, inline edit, and view-only row hiding. Cards on mobile; the redundant generic Shell title is hidden there. |
| `/suppliers/:id` | client | Profile: one Shell header carries supplier name/category; the duplicate in-page title is removed. On mobile, a compact **Supplier details** summary with call/email/web/map actions is collapsed by default; expanding it reveals the field grid and its bottom-right pencil, making expand → edit an intentional safety gate. Save/Cancel move into the Shell header during editing. Inventory opens by default, followed by Communications / Notes / Files, with all four tabs on one line. Desktop keeps details expanded, its back link visible and its pencil in the header. |
| `/plants` | client | Plant search **grouped by supplier**; the generic Shell title is hidden on mobile so search controls start at the top: a sticky supplier panel per group (resizable, 200–480px) with its matching plants beside it, natural size tokens in the search query, an available-size selector populated from the current plant matches, a supplier multiselect in the panel head and view-only row hiding. Grouped cards on mobile — each supplier card expands/collapses its plant list, and every plant row shows source size plus height, width/spread and caliper specifications when present; tapping a plant expands its full other names, notes, update date and source link inline — with the same compact result-size selector and a collapsible **Filters** card (supplier, supplier category, state, city, price). |
| `/agents` | client | Know your Agents: one card per entry in `lib/agents.ts` — avatar, role, Active / Coming soon badge, and the full profile banner image. |
| `/settings` | client | Responsive Settings page containing Chat appearance: live preview, per-agent colors, shared wallpaper and Reset. Available from desktop Settings and mobile More. |

| API route | Purpose |
|---|---|
| `GET /api/suppliers?q=` | `search_suppliers` RPC + source file names. `?counts=1&ids=` is the "# Items" second pass. |
| `GET /api/suppliers/:id` | One supplier + its active sources. |
| `GET /api/plants?q=` | Plant search grouped by supplier. `?supplierId=&page=` for one supplier's paged list. |
| `GET /api/file?path=` | Redirects to a 1-hour signed URL for a source file. |
| `GET /api/auth/*` | Not ours — rewritten to the harness (`login`, `logout`, `me`). |
| `GET·POST /api/chat/:agent/:action` | Pass-through to that agent's `webchat` plugin inbox. See *Agent chat*. |
| `PATCH /api/rows` | One inline cell edit, or a whitelisted set of changed fields in one row update. |
| `DELETE /api/rows` | Soft delete (`is_active = false`). |

Pages are client components that fetch from these routes — the workspace is
interaction-heavy (column layout, filters, editing), so there is one data path
rather than a server-rendered one and a client one that drift apart.

## Search

Every search box is **debounced** (`lib/use-debounced.ts`, 300ms) before it hits
`search_suppliers` / `search_inventory` — the pgroonga RPCs are far too
expensive to fire per keystroke. In-flight responses are discarded if a newer
query has started, so a slow early request can't overwrite a later result.

While a search is ongoing, the results area dims under an animated sprouting-
seedlings loader (`components/workspace/search-loader.tsx`; keyframes in
`globals.css`). The "searching" state starts on the first keystroke — it covers
the debounce window as well as the fetch — and each page anchors the overlay so
it never covers its search box: the list pages use the Shell content slot
(below the toolbar), the supplier profile a wrapper around the Inventory tab's
plant list. The caption under the seedlings rotates every 1.6s through a quirky
set per search flavour (`PLANT_SEARCH_LABELS` for the two plant searches,
`SUPPLIER_SEARCH_LABELS` for the suppliers list), both defined in
`search-loader.tsx`.

`search_inventory` **cannot be called with an empty search** (it walks all ~74k
active rows and exceeds the statement timeout — see the schema doc). Plant
Search therefore shows a clean prompt and makes no inventory request until a
term is entered; the API also returns an empty group list for a blank `q`.

The current Plant Search term is mirrored into the URL's `q` parameter and
saved in `localStorage` under `lps.plant-search.query.v1`. Returning to the page
restores the URL term first, then the saved term; results are fetched again so
the saved state cannot serve stale inventory. Clearing the search removes both
the URL parameter and saved term. Browser Back/Forward changes are restored via
`popstate`.

Plant Search treats size as part of the natural question without showing a
permanent filter form. A query such as `15g Agave Americana` is parsed into the
plant-name query (`Agave Americana`) and an independent 15-gallon constraint, so
alias matching cannot silently ignore the size token. Explicit gallon spellings
(`15 G`, `15G`, `15 gallon`) and explicit box notation are normalized; the
supplier's original size text remains unchanged.

For multi-word identities, the broad fuzzy/alias RPC result is refined before
rendering: every query word must occur (or be a word prefix) in the row's own
name or aliases. If that finds nothing, the broad set is retained so typo/fuzzy
searches still work. This keeps `Agave Americana` from including every `Tilia`,
`Ulmus` and `Fraxinus americana`; the same refined rows feed the size selector,
so tree calipers cannot leak into an Agave menu.

The alias RPC matches one whole query and cannot natively combine a species
alias with a separate cultivar term (`Live oak` + `Boardwalk`). If a full
multi-word query returns zero, the server searches its unique words (three or
more characters) in parallel and uses the smallest non-empty result set — the
most selective term. This fallback runs only after zero results, so normal
searches still make one RPC call; both `Live oak boardwalk` and `Boardwalk live
oak` can fall back to the 32-row `Boardwalk` set.

When no size is typed, results add one compact **Size: Any** selector populated
only with conservative commercial categories from the refined matches:
explicit gallons, explicit boxes and context-confirmed plausible calipers.
Equivalent gallon spellings collapse (`15 G`, `15G`, `15 G/17"` → `15 gal`),
and a description range contributes its endpoints (`3–5 G` → 3 gal and 5 gal)
rather than becoming another menu item. Bare inch measurements, height/width
specifications, untyped decimals and other grower-description fragments remain
visible on result rows but never become choices. Calipers require inch/caliper
context and a plausible value (greater than 0 and at most 20 inches), guarding against known source-column
noise such as Agave rows with `caliper = 55/80/215`.

The selector is a checkbox-style multiselect. Selected categories use OR logic
(a row matching any selected size remains), are mirrored as repeated URL `size`
parameters, and are saved as a JSON array under
`lps.plant-search.size-choice.v1`. Filtering applies to the current
`search_inventory` result set (up to 300 rows).

## Source files

Both the suppliers table's "Inventory sources" cell and the plants table's
"Source" cell link to the underlying file. The cell scrolls rather than
stretching the row when a supplier has many sources — Blue Mountain Nursery has
38, and one supplier has 275.

> Each item in that list needs `shrink-0`. Flex children shrink by default, so
> without it 38 rows are squashed to ~2px each to fit the cell's max-height: the
> content disappears *and* never overflows, so no scrollbar appears either.
> Don't remove it.

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
(`is_active = false`, the schema's convention).

Editing happens in two places: table cells, and the **supplier profile's detail
card**. Profile values are inert by default: a deliberate pencil-icon edit
button (accessible label: **Edit supplier**) exposes `poc_*`, `phone`, `email`, `city` and `state`; changes remain local
until one **Save changes** action writes only changed fields in one database
update. **Cancel** confirms before discarding a dirty draft, and reload/close
triggers the browser's unsaved-change warning. `website`, `Active items` and
`Last updated` are not editable — `website` isn't editable in the design either,
and the other two are derived.

The table/column pair is checked against a whitelist in `lib/queries.ts`
(`WRITABLE`), **server-side**. The request body comes from the browser, so a
client asking to write `is_active`, or a column on `users`, must be refused
regardless of what the UI would send. `unit_price` is `NOT NULL` in the schema,
so a blank is rejected rather than being written as null.

Deleting is genuinely destructive in effect: a soft-deleted row disappears from
`search_inventory` and from what the agents see.

## Column layout

`lib/table-config.ts` holds order, visibility and widths per table
(`suppliers`, `plantMaster`, `plants`) and persists all three to `localStorage`
under `lps.tables.v1`, so a reload keeps the arrangement. Sorting and
per-column filters are deliberately **not** persisted — they describe the
current question, not the layout. The `plants` config is shared, so a column
change on Plant search also applies to the profile's Inventory tab, exactly as
in the design.

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
transcript taller after layout.

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
Agave Blue remain optional choices. The sheet also includes an optional
repeating desert-plants wallpaper and Reset.
The wallpaper is original dense, low-contrast cactus/agave/yucca/sun SVG doodle
art at `public/desert-plants-chat.svg`, with green, blue and fuchsia strokes; it
is not a Telegram asset. Color variables are scoped
to `AgentChat`, so changing chat bubbles/buttons does not recolor the workspace.
Preferences persist per browser/device under `lps.chat.appearance.v1` and also
apply to the desktop chat panel. Chat messages, the composer and the appearance
preview use Roboto at 16px with a compact 1.35 line height, approximating native
Telegram typography while leaving the rest of the app on Inter.

## Notes vs Communications

The profile has two text tabs, backed by two different columns that must not be
mixed (see [the schema doc](../supabase-schema.md#notes-vs-communication_notes--dont-mix-them)):

| Tab | Column | Behaviour |
|---|---|---|
| **Notes** | `suppliers.notes` | What is **true about** the supplier — quirks, preferences, ordering constraints. A textarea, **edited in place**. |
| **Communications** | `suppliers.communication_notes` | What was **said to** them. **Append-only**: pick a channel, write what and why, and it appends a timestamped entry. Rendered newest-first; the column itself stays in append order. |

Daisy writes to `communication_notes` in the same format every time she contacts
a supplier, so app-entered and agent-entered history read as one log.

Both columns are hidden by default in the suppliers table (long free text would
blow up the row height) and available from the column picker.

## Paging the profile's inventory

A supplier can carry thousands of rows (Austin Plant Supply has 1,467), so the
profile's Inventory tab pages through them 100 at a time rather than capping the
list. `getSupplierPlants` fetches `PAGE_SIZE + 1` and reports `hasMore` from the
extra row, so there is no second count query; the page count in the header comes
from the supplier's own `item_count`.

## Truncation

Cells truncate to their column width and carry the full value in a `title`, so
hovering shows the whole thing. The source-list cell's tooltip lists every file.

## Performance notes

- **"# Items"** needs one indexed `COUNT` per supplier (PostgREST has aggregate
  functions disabled on this project), ~2s for a page of 50. It loads as a
  second pass so the table renders immediately. A
  `supplier_item_counts(ids bigint[])` RPC would collapse it to one query.
- Master-row aggregates on Plant search (`# Plants`, `Lowest price`,
  `In stock`) describe the **matched** plants, not the supplier's whole
  catalogue — same as the design, and free to compute.

## Auth

Credentials belong to the **cognisphere harness** (`harness/.secrets/users.json`,
from `config`'s `APP_USER` / `APP_PASS`). `next.config.ts` rewrites
`/api/auth/*` to the harness so the browser stays same-origin and the harness
sets its `pi_sid` cookie.

`proxy.ts` (Next 16's replacement for `middleware`) gates every route except
`/login` and `/api/auth/*`, and **verifies the session rather than just looking
for the cookie**: `pi_sid` is a signed stateless token, so it calls the harness
`/api/auth/me` with the incoming cookie and only proceeds when a user comes
back.

That check is load-bearing. Pages read Supabase with the project's **secret**
key and can now *write*, and the harness is no longer in the path to reauthorize
each call — a presence-only gate would let a hand-set `pi_sid=anything` read and
edit the whole catalogue. `/api/auth/me` answers `200 {"user":null}` for a bad
session, so the status code alone is not the answer. If the harness is
unreachable the check **fails closed**.

`lib/supabase.ts` is `server-only`, so importing it from a client component is a
build error rather than a leaked credential. RLS is **disabled** on `suppliers`
and `inventory`, so there is no anon-key path safe for a browser — hence no
`NEXT_PUBLIC_` Supabase variable anywhere.

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
| `public/manifest.json` | Static manifest: `start_url: /suppliers`, `scope: /`, `display: standalone`, brand green `theme_color`, 192/512 icons. |
| `public/sw.js` | Service worker. Its *existence* plus a `fetch` handler is what makes Chrome consider the app installable. |
| `components/pwa/pwa-provider.tsx` | Registers the worker, captures the install event, exposes `usePWA()`. Wraps the root layout. |
| `components/pwa/install-popup.tsx` | The unprompted offer — Chrome only, once per session. |
| `components/pwa/install-app-button.tsx` | The manual entry point, rendered in the desktop rail and mobile ⋯ More. |
| `components/pwa/ios-install-modal.tsx` | Safari has no install API, so iOS gets Share → Add to Home Screen instructions. |
| `public/icon-{192,512}.png`, `apple-touch-icon.png` | Generated leaf mark on the brand green; the 512 doubles as the Android `maskable` icon. |

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
  api/           suppliers, suppliers/[id], plants, file, rows, chat/[...path]
  suppliers/     list + [id] profile
  plants/        grouped plant search
  agents/        Know your Agents — profile banner cards
  login/
  globals.css    design tokens — the theme's source of truth
public/
  daisy.png, rosie.png, nova.png    avatars (cropped from the banners) —
                                    panel header, rail, selector, mobile tab
  *_profile.png                     full profile banners, shown on /agents
  manifest.json, sw.js              PWA manifest + service worker
  icon-192.png, icon-512.png,       install icons (leaf mark, brand green)
  apple-touch-icon.png
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
  rows.ts          row shapes (SupplierRow, PlantRow, PlantGroup, SourceLink)
  queries.ts       every database read, the whitelisted writes, file signing
  table-config.ts  column layout state + localStorage persistence + reorder()
  table-config.check.mjs  self-check for reorder()
  use-debounced.ts search-box debounce
  format.ts        money / number / date formatting
  supabase.ts      server-only client
  utils.ts         cn()
proxy.ts           session gate
```

## Environment

`app/.env.local` is **generated from the repo-root `config`** by
`scripts/server.sh` — do not hand-edit it. `HARNESS_URL`, `HARNESS_USER`,
`HARNESS_PASS`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DOMAIN`, `PORT`. Both
`config` and `.env.local` are gitignored — keep it that way.

## Scripts

`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm typecheck`.

There is one standalone check, run directly rather than through a test runner:

```sh
node lib/table-config.check.mjs   # column reordering
```
