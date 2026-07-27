# App documentation

The user-facing web app (`app/`). Owned by whoever changes the code — the
developer agent (`dory`) or a human — and updated **after every change** under
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
- **`--destructive-foreground`** ships equal to `--destructive` upstream, which
  makes destructive text invisible on a destructive surface. `globals.css` sets
  it to white, as the lps-ui README instructs.

Fonts: Inter (`font-sans`), Playfair Display (`font-serif`) via `next/font`.

### Deliberate deviations

Everything below differs from the mock **on purpose**. If you are "restoring
fidelity", start here rather than reverting one of these by accident:

| Deviation | Why |
|---|---|
| `--destructive-foreground` set to white | Upstream ships it equal to `--destructive`, making destructive text invisible. |
| No agent chat; `Job Requests` and `Settings` rendered disabled | Out of scope for this build. The frame keeps its shape without offering dead routes. |
| No "list is 7+ days old" staleness flag anywhere | Removed at the owner's request, along with the panel tint that went with it. |
| Signed-in user read from `/api/auth/me` | The mock hardcoded a name and initials into the markup. |
| **Communications** tab added; **Notes** edits in place | The schema has two distinct columns; the mock's threaded notes map onto neither. See below. |
| Profile inventory is paginated | The mock had a fixed list; real suppliers carry thousands of rows. |
| Column reorder is direction-aware | The mock's algorithm makes an adjacent rightward drag a no-op. See *Column layout*. |
| Source/website cells are links; source lists scroll | The mock rendered them as plain text. |

## Shell and responsive behaviour

`components/workspace/shell.tsx` renders the frame for every page:

- **Desktop** (≥900px): a collapsible left nav rail (196px ↔ 56px), a header
  with the page title + subtitle, and a collapsed agent-chat rail on the right.
- **Mobile** (<900px, the design's own breakpoint): the rail is replaced by a
  bottom tab bar, and both list pages swap their tables for card lists.

`Job Requests`, `Settings` and the chat rail are **rendered disabled** — they exist
in the design but are out of scope for this build, so the frame keeps its shape
without offering routes that go nowhere. Agent chat is deliberately not wired.

## Routes

| URL | Kind | Purpose |
|---|---|---|
| `/` | server | Redirects to `/suppliers`. |
| `/login` | client | Harness sign-in → `/api/auth/login`, then `/suppliers`. |
| `/suppliers` | client | Master table: column picker, per-column filters, sort, drag-reorder, resize, inline edit. Cards on mobile. |
| `/suppliers/:id` | client | Profile: editable field grid, then Notes / Communications / Inventory / Files tabs. |
| `/plants` | client | Plant search **grouped by supplier**: a sticky supplier panel per group (resizable, 200–480px) with its matching plants beside it, plus a supplier multiselect in the panel head. Grouped cards on mobile, with a collapsible **Filters** card (supplier + the same per-column filters the column heads carry). |

| API route | Purpose |
|---|---|
| `GET /api/suppliers?q=` | `search_suppliers` RPC + source file names. `?counts=1&ids=` is the "# Items" second pass. |
| `GET /api/suppliers/:id` | One supplier + its active sources. |
| `GET /api/plants?q=` | Plant search grouped by supplier. `?supplierId=&page=` for one supplier's paged list. |
| `GET /api/file?path=` | Redirects to a 1-hour signed URL for a source file. |
| `GET /api/auth/*` | Not ours — rewritten to the harness (`login`, `logout`, `me`). |
| `PATCH /api/rows` | Inline cell edit. |
| `DELETE /api/rows` | Soft delete (`is_active = false`). |

Pages are client components that fetch from these routes — the workspace is
interaction-heavy (column layout, filters, editing), so there is one data path
rather than a server-rendered one and a client one that drift apart.

## Search

Every search box is **debounced** (`lib/use-debounced.ts`, 300ms) before it hits
`search_suppliers` / `search_inventory` — the pgroonga RPCs are far too
expensive to fire per keystroke. In-flight responses are discarded if a newer
query has started, so a slow early request can't overwrite a later result.

`search_inventory` **cannot be called with an empty search** (it walks all ~74k
active rows and exceeds the statement timeout — see the schema doc). With no
term, `searchPlantGroups` instead picks the suppliers behind the newest
availability files and reads a capped page per supplier. Both parts matter: a
single shared limit gets eaten by whichever supplier sorts first — two suppliers
with 150 rows each would consume a 300-row budget on their own and the page
would show two groups instead of eight.

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

Inline edits **write to Supabase**, and row delete is a **soft delete**
(`is_active = false`, the schema's convention). Row *hide* is view-only, with a
Restore bar.

Editing happens in two places: table cells, and the **supplier profile's detail
card**, whose fields edit in place (`poc_*`, `phone`, `email`, `city`, `state`).
`website`, `Active items` and `Last updated` are not editable — `website` isn't
editable in the design either, and the other two are derived.

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

## File map

```
app/
  api/           suppliers, suppliers/[id], plants, file, rows
  suppliers/     list + [id] profile
  plants/        grouped plant search
  login/
  globals.css    design tokens — the theme's source of truth
components/
  ui/            lps-ui primitives (button, input, label, card, alert, badge)
  workspace/
    shell.tsx        nav rail, header, mobile tab bar, theme, session user, toasts
    table-parts.tsx  column picker, column head (sort/filter/resize/drag),
                     FilterControl (the head's filter widget, reused on mobile),
                     cell (plain/link/badge/list/file/url), MultiFilter
    plant-table.tsx  the plant sub-table, shared by search + profile
    toolbar.tsx      search box, filter chips, count summary
    icons.tsx        the design's icon set
lib/
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
