# LPS · Rosie

A cognisphere **app home** (pnpm workspace) with two co-located services:

- **`app/`** — Next.js app for browsing the supplier and plant catalogue
  (`/suppliers`, `/suppliers/:id`, `/plants`), plus a **chat panel** for talking
  to `daisy`. Reads **Supabase** directly, server-side; it uses the harness for
  the operator login and to reach the agent (via the `webchat` plugin).
  See [`docs/app/README.md`](docs/app/README.md).
- **`harness/`** — the [cognisphere](https://github.com/cognisphere-sh)
  agent harness data dir: a stateful, file-backed, localhost-bound service
  that runs the agents (`daisy`, `dory`) and serves the operator console UI.
- **`docs/supabase-schema.md`** — the single source of truth for the database
  schema, shared by the app and every agent.
- **`scripts/`** — lifecycle scripts (`setup-server.sh`, `server.sh`,
  `build.sh`) plus AWS provisioning/backup under `scripts/aws/`.

```
browser ──https──> nginx ──┬─ $DOMAIN          → app  (Next.js, :3000)
                           └─ $CONSOLE_DOMAIN  → harness console (cognisphere, :3142)

app ── /api,/admin ──> 127.0.0.1:3142 (harness)   # proxied in next.config.ts
```

The app proxies `/api` and `/admin` to the harness, so the browser only
ever hits its own origin. The harness binds to localhost; nginx is the only
public entry point.

## Local development

```sh
pnpm install
# harness backend + operator console and the app together:
./scripts/server.sh dev
# or individually:
cd harness && pnpm exec cognisphere dev
pnpm --dir app run dev
```

## Deploy (Ubuntu/Debian prod server)

The scripts under `scripts/` use **systemd** to run both services
(restart-on-crash, boot persistence, `journalctl` logs) and **nginx +
Let's Encrypt** for HTTPS.

1. **DNS** — point two A records at the server's public IP: one for the app
   (`$DOMAIN`) and one for the console (`$CONSOLE_DOMAIN`).
2. **Config** — `cp config.example config && cat scripts/app/config.example >> config`,
   then edit domains, email, ports and the Supabase keys.
3. **Run setup** (once, as root):

   ```sh
   sudo ./scripts/setup-server.sh
   ```

   Installs Node + pnpm + nginx + certbot, builds the app, writes the
   `rosie-harness` and `rosie-app` systemd units, configures nginx for both
   domains, and obtains the TLS cert. Re-running rebuilds and refreshes
   everything.

4. **Manage** the running services:

   ```sh
   sudo ./scripts/server.sh start|stop|restart|status|logs
   ```

   Typical deploy loop: `git pull && sudo ./scripts/server.sh restart`.

Cert auto-renewal is handled by certbot's own systemd timer.

### Files

| File                       | Purpose                                              |
|----------------------------|------------------------------------------------------|
| `config.example`           | Template for deploy params (harness-owned); copy to `config` (gitignored). |
| `scripts/app/`             | **Deployment-owned deploy hooks** — `config.example` documents this app's extra `config` keys; `secrets.sh` writes the Supabase pair into `app/.env.local`. See `scripts/app/README.md`. |
| `scripts/setup-server.sh`  | One-time provision: deps, build, units, nginx, HTTPS. |
| `scripts/server.sh`        | Start/stop/restart/status/logs/secrets/dev for both services. |
| `scripts/build.sh`         | Install deps + build the app (run by server.sh).     |
| `scripts/aws/setup.sh`     | One-time AWS provisioning (run locally); params in `scripts/aws/config`. |
| `scripts/aws/backup.sh`    | Whole-dir zip → S3 (cron written by setup-server.sh). |
