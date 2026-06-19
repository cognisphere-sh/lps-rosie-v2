# LPS · Rosie

A pnpm monorepo with two co-located services:

- **`web/`** — Next.js app hosting the persona surfaces (`/seller` live;
  `/customer`, `/sourcer` planned). No DB of its own; it reads/writes Rosie's
  workspace files through the harness HTTP API. See [`web/README.md`](web/README.md).
- **`lps-harness/`** — the [cognisphere](https://github.com/cognisphere-sh)
  agent harness: a stateful, file-backed, localhost-bound service that runs
  Rosie and serves a built-in admin/console UI.

```
browser ──https──> nginx ──┬─ $DOMAIN          → web  (Next.js, :3000)
                           └─ $CONSOLE_DOMAIN  → harness UI (cognisphere, :7331)

web ── /api,/admin ──> 127.0.0.1:7331 (harness)   # proxied in next.config.ts
```

The web app proxies `/api` and `/admin` to the harness, so the browser only
ever hits its own origin. The harness binds to localhost; nginx is the only
public entry point.

## Local development

```sh
pnpm install
# harness backend + Vite UI (separate ports):
pnpm --filter cognisphere-harness-lps-harness exec cognisphere dev
# web app, pointed at the harness:
HARNESS_URL=http://127.0.0.1:7331 pnpm --filter web dev
```

## Deploy (Ubuntu/Debian prod server)

Two scripts at the repo root. They use **systemd** to run both services
(restart-on-crash, boot persistence, `journalctl` logs) and **nginx +
Let's Encrypt** for HTTPS.

1. **DNS** — point two A records at the server's public IP: one for the app
   (`$DOMAIN`) and one for the console (`$CONSOLE_DOMAIN`).
2. **Config** — `cp config.example config`, then edit domains, email, and ports.
3. **Creds** — set real `HARNESS_USER` / `HARNESS_PASS` in `web/.env.local`.
4. **Run setup** (once, as root):

   ```sh
   sudo ./setup-server.sh
   ```

   Installs Node + pnpm + nginx + certbot, builds the web app, writes the
   `rosie-harness` and `rosie-web` systemd units, configures nginx for both
   domains, and obtains the TLS cert. Re-running rebuilds and refreshes
   everything.

5. **Manage** the running services:

   ```sh
   sudo ./server.sh start|stop|restart|status|logs
   ```

Cert auto-renewal is handled by certbot's own systemd timer.

### Files

| File                | Purpose                                              |
|---------------------|------------------------------------------------------|
| `config.example`    | Template for deploy params; copy to `config` (gitignored). |
| `setup-server.sh`   | One-time provision: deps, build, units, nginx, HTTPS. |
| `server.sh`         | Start/stop/restart/status/logs for both services.    |
