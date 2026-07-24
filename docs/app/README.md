# App documentation

The user-facing web app (`app/`). Owned by whoever changes the code — the
developer agent (`dory`) or a human — and updated **after every change** under
`app/` (see `CLAUDE.md` §7).

## What it is

A single **Next.js 16** app (App Router, React 19, Tailwind 4) that is a
same-origin UI **and proxy shell** in front of the CogniSphere harness. It has
**no database and no backend of its own** — every read/write goes through the
harness HTTP API, and the files under `harness/agents/rosie/workspace/` are the
single source of truth. Direct data edits write the file (last-write-wins,
polled every 4s); the app does **not** ping Rosie on every edit — she reads the
files on her next turn.

The one live surface is the **Austin Plant Supply supplier workspace**, driven
by the agent **`rosie`** (hard-coded `AGENT = "rosie"` in `lib/harness.ts`).
Customer/Sourcer surfaces on the home page are unbuilt stubs.

## Routes (`app/app/`)

| URL | File | Kind | Purpose |
|---|---|---|---|
| `/` | `page.tsx` | server page | Home hub listing persona surfaces; only Supplier is `ready`. |
| `/login` | `login/page.tsx` | client page | Sign-in form → POSTs `/api/auth/login` (proxied to harness), redirects to the supplier page. |
| `/supplier/austin-plant-supply` | `supplier/austin-plant-supply/page.tsx` | server page | The main workspace: `V2Header` + `SupplierWorkspaceView`. |
| `/stock-check/:customerId/:orderId/:token` | `stock-check/[customerId]/[orderId]/[token]/page.tsx` | client page | Public grower stock-check form; autosaves via PATCH, submits via POST. |
| `/api/stock-check/:customerId/:orderId/:token` | `api/.../route.ts` | API route (GET/PATCH/POST) | Backend for the public form. The **only** real Next route handler — everything else proxies. |

Dynamic segments: `customerId` = customer folder slug, `orderId` = job dir,
`token` = generated request id. Segments are validated against
`/^[A-Za-z0-9_-]+$/` in the route handler.

## How it talks to the harness

**Proxy / rewrites** (`next.config.ts`): everything is same-origin, so the
browser never makes a cross-origin call and the harness auth cookie rides
along. `HARNESS_URL` env, default `http://127.0.0.1:7331`.

- `/api/:path*` **except** `/api/stock-check/*` (negative lookahead) → `${HARNESS_URL}/api/:path*`
- `/admin/:path*` → `${HARNESS_URL}/admin/:path*`

The `/api/stock-check` exclusion lets the real route handler win over the proxy.

**Auth** (`middleware.ts`): the harness session cookie is `pi_sid`. Middleware
gates the shell — no cookie → redirect to `/login` (HTML) or `401` (for
`/api`/`/admin`). Public prefixes (no session required): `/login`, `/api/auth`,
`/stock-check`, `/api/stock-check`. The harness is the real authority;
middleware only keeps the shell from rendering.

**Harness endpoints used** (`lib/harness.ts`, all relative to agent `rosie`):

| Op | Endpoint |
|---|---|
| Read file | `GET /api/agents/rosie/fs/file?path=…` → `{content}` |
| Write file | `PUT /api/agents/rosie/fs/file?path=…` body `{content}` |
| Delete path (recursive) | `DELETE /api/agents/rosie/fs/path?path=…` |
| Directory tree | `GET /api/agents/rosie/fs/tree?path=…` → `{entries}` (404 → `[]`) |
| Upload | `POST /api/agents/rosie/fs/upload?dir=…` (multipart) |
| Raw serve | `GET /api/agents/rosie/fs/raw?path=…` |
| Wake / message agent | `POST /admin/rosie/send` body `{text, threadId?, channelId?}` |
| Sessions | `GET /api/agents/rosie/sessions`, `GET …/sessions/:threadId/:sessionId` |
| Events (busy state) | `GET /api/agents/rosie/events?status=queued,in_flight&limit=1` |

Every `send` triggers an agent turn — the app uses it sparingly. Chat threads
are one-per-customer, keyed by customer slug (used as both `threadId` and
`channelId`).

**Public stock-check route** (`api/stock-check/.../route.ts`) runs server-side
with **no visitor session**: it logs into the harness with `HARNESS_USER` /
`HARNESS_PASS`, caches the `pi_sid` in module scope, and re-logs-in on 401.
`GET` overlays live `job.json` values onto the request snapshot; `PATCH` = partial
save (stays "open", no agent ping); `POST` = submit (marks "submitted" and
best-effort `POST /admin/rosie/send` with a `<stock-check-response>` block routed
to the customer thread so Rosie reconciles per SOP).

## Workspace files the app reads/writes

Under the agent dir, paths start with `workspace/`:

- `workspace/inventory/<category>.json` — `InventoryEntry[]` (positional `section:idx` ids)
- `workspace/customers/<slug>/customer.json` — `Customer`
- `workspace/customers/<slug>/profile.md` — free-text profile
- `workspace/customers/<slug>/jobs/<jobDir>/job.json` — `Job` (items edited by `id`)
- `workspace/customers/<slug>/jobs/<jobDir>/stock-check/<token>.json` — `StockCheckRequest`
- `uploads/` — default upload dir
- Sessions/events under `sessions/**` (chat feed + busy state)

## `lib/`

- `harness.ts` — typed same-origin client for the harness fs/send/sessions/events API.
- `data.ts` — client React hooks (`usePolled` @ 4s: `useInventory`, `useCustomers`, `useChat`, `useAgentBusy`, `useLatestEvent`); parses session JSONL into chat bubbles (strips `<harness-metadata>`).
- `types.ts` — TS interfaces mirroring the workspace file schemas exactly (`InventoryEntry`, `JobItem`, `Job`, `Customer`, `CustomerWithJobs`); no rename layer.
- `ws-adapter.ts` — bridge mapping real workspace JSON ⇄ the mock's `Ws*` view-model; read-modify-write by id, add/delete rows, `createStockCheck`/`listStockChecks`, `addWsCustomer`, `useWorkspace()` (reloads on the busy→idle edge of Rosie's event count).
- `stock-check.ts` — pure shared types/consts for the stock-check flow (`StockCheckRequest/Item/Response`, `ITEM_FROM_WS`/`ITEM_TO_WS` status maps, path helpers); imported by both client and server route.
- `statuses.tsx` — status enums + visual metadata (icons, Tailwind tokens) for availability/demand.
- `quote-email.ts` — builds an inline-styled HTML quote table and copies it to clipboard for pasting into Gmail.
- `utils.ts` — `cn()` (clsx + tailwind-merge).
- `chat-parse.check.mjs` — standalone self-check pinning `data.ts`'s chat-parse assumptions against a real session JSONL; fails loudly on harness format change. Run: `node app/lib/chat-parse.check.mjs`.

## `components/`

- **`components/supplier/`** — the workspace UI. `supplier-workspace-view.tsx`
  is the whole thing (inventory/orders/customers tabs + chat panel, plus the
  reusable `WorkspaceTable<T>` and `orderItemColumns` shared with the
  stock-check page). `status-editor.tsx` (status-pill cell/menu),
  `supplier-workspace-data.ts` (`Ws*` view-model types + status metadata),
  `chat-markdown.tsx` (react-markdown + remark-gfm, no raw HTML), `supplier.ts`
  (static APS identity), `ui.tsx` (`StatusPill`, `V2Header`, format helpers).
- **`components/ui/`** — shadcn-style Radix primitives + `data-table/` cells.
  `theme-provider.tsx` is a custom light/dark provider.

## Scripts & env

Scripts: `dev` = `next dev`, `build` = `next build`, `start` = `next start`
(no test script — the `.mjs` self-check runs manually).

`.env.local` keys (names only): `HARNESS_USER`, `HARNESS_PASS`, `HARNESS_URL`,
`DOMAIN` (dev HMR origin), `PORT`.

## Deploy

Co-located with the harness, **not** Vercel: the harness is a stateful,
file-backed, localhost-bound service. Run `next start` on the same box as
`cognisphere serve` (port 7331), with the `rosie` agent up and a harness auth
session available.

```sh
HARNESS_URL=http://127.0.0.1:7331 pnpm --filter web dev   # or build && start
```
