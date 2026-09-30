# Server restarts

The deployment command remains:

```sh
git pull && sudo ./scripts/server.sh restart
```

`start` and `restart` refresh secrets, prepare the selected services, and then
call systemd. Preparation previously installed dependencies and compiled the
entire Next.js app every time. It now reuses successful work when the inputs
match, so an unchanged restart only refreshes secrets, checks fingerprints,
and restarts services.

`verifyDepsBeforeRun: false` lives in `pnpm-workspace.yaml`, where pnpm 11+
reads it. This prevents `pnpm run` and service `pnpm exec` commands from
performing an additional implicit installation. The older `.npmrc` setting
alone was ignored by the installed pnpm 12; see the
[pnpm configuration migration](https://pnpm.io/blog/releases/11.0#npmrc-is-authregistry-only).

| Command | Preparation | Services restarted |
|---|---|---|
| `server.sh restart` | Install dependencies and build the app only when needed | Harness and app |
| `server.sh restart app` | Install dependencies and build the app only when needed | App |
| `server.sh restart harness` | Install dependencies only when needed; skip app compilation | Harness |
| `server.sh build` | Force dependency installation and app compilation | None |

`start` accepts the same targets and uses the same preparation as `restart`.
If `app/package.json` is absent, only the harness is prepared and restarted.
Invalid targets fail before secrets or builds are changed.

## Cache validity

The first build after this change runs normally to establish success markers.
Subsequent restarts skip `pnpm install --frozen-lockfile` when dependency inputs
match and the harness and Next.js package entry points still exist. Dependency
inputs include package manifests, lockfiles, workspace settings, project npm
configuration, patches, build scripts, Node/pnpm versions, platform, and pnpm's
installed dependency metadata. An install also invalidates the app build marker.

App builds are keyed by those dependency inputs plus the contents and paths of
files under `app/` and shared source under `harness/plugins/`, including public
assets, Next.js configuration, and env files. Exported `NEXT_*` variables and
variables directly referenced through
`process.env.NAME` or `process.env['NAME']` in source/config are also included.
Generated `.next`, `node_modules`, `.build-work`, `next-env.d.ts`, and TypeScript
build info are excluded. Content checks avoid rebuilds when secret generation
rewrites identical env files or when only source modification times change.

Only successful installs and builds receive markers. The app marker also
records its Next.js build ID; missing output directories or a different build
ID force a rebuild. A failed install/build aborts before systemd restarts any
services. If app inputs change during compilation, preparation fails and must
be rerun. Build preparation uses `flock` to serialize concurrent builds.

Markers live in ignored `node_modules/.cache/server-build/` and `app/.next/`;
the lock is the ignored root `.server-build.lock`. Fingerprints contain hashes,
never source or secret values. Force a rebuild after manually altering installed
package contents, or when adding build inputs outside `app/` or environment
variables read dynamically rather than through a direct `process.env` reference:

```sh
sudo ./scripts/server.sh build
sudo ./scripts/server.sh restart
```

The optimization changes preparation time; systemd shutdown/startup time still
depends on the services. Recent app restarts also spent the full 90-second
systemd stop timeout waiting for open browser SSE requests. The app now closes
those streams on `SIGTERM`/`SIGINT`, removing subscriptions and heartbeat timers
so Next.js can finish its graceful shutdown. Browser EventSource connections
reconnect after startup and existing recovery reads reconcile missed updates.
Ordinary requests retain Next.js's graceful handling.

The scripts remain harness scaffold files: review
`scripts/server.sh`, `scripts/build.sh`, and `scripts/lib/build-fingerprint.mjs`
when upgrading the harness so this deployment customization is preserved.

## Verification

```sh
python3 scripts/server-restart.test.py
python3 scripts/deployment-secret-output.test.py
bash -n scripts/server.sh scripts/build.sh
node --check scripts/lib/build-fingerprint.mjs
pnpm --dir app exec tsx --test lib/job-realtime.test.ts lib/server-shutdown.test.ts
```

The restart integration tests run the real shell scripts in a temporary
deployment with fake pnpm and systemd commands. They cover unchanged restarts,
app/harness targeting, source/assets/env/dependency changes, missing output,
forced builds, concurrent restarts/source edits, and failure recovery without
restarting the live services.
The app tests also exercise real signal-driven shutdown of an HTTP server with
an active SSE request, signal listener reuse, and subscription cleanup.

On 2026-09-30, the isolated production Next.js app was also started with fixture
credentials and loopback backend URLs. With an authenticated SSE request held
open, `SIGTERM` completed shutdown in 6.04 seconds (exit 143). Recent live
systemd stops had consistently reached 90 seconds. This check left the live
services and their build output untouched.
