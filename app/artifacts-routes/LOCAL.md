# Reference copy — not the live routes

This directory is the **harness's** drop-in template for the `artifacts`
plugin, vendored verbatim so `cognisphere-upgrade` refreshes it (step 4b) and
upstream changes — especially to the auth and header handling — show up in the
upgrade diff. It is excluded from `tsconfig.json`; nothing here is compiled or
routed.

**The live routes are adapted from it and live elsewhere:**

| Template | This app |
|---|---|
| `lib/artifacts.ts` | `lib/artifacts.ts` (+ `lib/session.ts`) |
| `public/artifacts/[slug]/route.ts` | `app/a/[agent]/public/artifacts/[slug]/route.ts` |
| `private/artifacts/[slug]/*` | `app/a/[agent]/private/artifacts/[slug]/*` |

Two deliberate departures, both explained in `lib/artifacts.ts`:

1. **The agent is a path segment.** Daisy and Nova both publish, and the plugin
   builds share links as `<appBaseUrl>/<public|private>/artifacts/<slug>`, so
   each agent gets its own `appBaseUrl` (`https://$DOMAIN/a/<agent>`) and one
   route tree serves them all. The template's single `ARTIFACTS_AGENT` becomes
   the `ARTIFACTS_AGENTS` allowlist.
2. **`signedIn()` verifies the session** against the harness rather than
   checking that a cookie exists, sharing `lib/session.ts` with `proxy.ts`.

**On upgrade:** after this directory is refreshed, diff it against the live
files above and port anything security-relevant (auth checks, forwarded
headers, the CSP pass-through). The paths differ, so the drift check in the
`cognisphere-upgrade` skill won't do it for you.
