# web

The LPS · Rosie web app. One Next.js app hosting multiple persona surfaces as
route segments under `app/`:

- `/seller` — Austin Plant Supply's seller console (live)
- `/customer` — buyer-facing quotes & orders (planned)
- `/sourcer` — supplier sourcing (planned)

All surfaces share `lib/` (the harness client + data hooks) and `components/`.
The app reads and writes Rosie's workspace files **through the harness HTTP
API** — there is no database and no backend of its own. The files in
`lps-harness/agents/rosie/workspace/` are the single source of truth.

## How it talks to the harness

`next.config.ts` rewrites proxy `/api/*` and `/admin/*` to the harness
(`HARNESS_URL`, default `http://127.0.0.1:7331`). The browser only ever hits
this app's own origin, so there's no CORS and the harness stays on localhost.

- Read a file:  `GET /api/agents/rosie/fs/file?path=workspace/...`
- Write a file: `PUT /api/agents/rosie/fs/file?path=workspace/...` `{content}`
- Wake Rosie:   `POST /admin/rosie/send` `{text}` (used sparingly)

Direct data edits (inventory price/comment, a job item's availability/price/
status) write the file directly — last-write-wins, polled every 4s. We do
**not** notify Rosie on every edit; she reads the files on her next turn.

## Deploy

Co-located with the harness, **not** Vercel: the harness is a stateful,
file-backed, localhost-bound service. Run `next start` on the same box as
`cognisphere serve`.

```sh
# from the monorepo root
pnpm install
HARNESS_URL=http://127.0.0.1:7331 pnpm --filter web dev   # or build && start
```

The harness must be running (`cognisphere serve`, port 7331) with the `rosie`
agent and an auth session cookie (log into the harness once in the browser).

## Status

- [x] Orders — review job items (availability / price / status / customer note)
- [x] Inventory — edit unit price + comment, search
- [x] Customers — read `customer.json`
- [ ] Chat with Rosie — needs the `/api/agents/rosie/sessions` shape captured
      from a running harness
- [ ] Port the polished mock UI (`supplier-workspace-view.tsx`) over this data
      layer

The views here are deliberately plain — they prove the read/write seam against
live files. The richer mock components drop onto the same `lib/data.ts` hooks.
