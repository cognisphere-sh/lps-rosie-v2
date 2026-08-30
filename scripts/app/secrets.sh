# scripts/app/secrets.sh — sourced by ../server.sh after the stock secrets.
# Appends the Supabase credentials to app/.env.local. The app reads
# suppliers/inventory straight from Supabase; the secret key stays server-side
# (no NEXT_PUBLIC_ prefix) because it bypasses RLS.

if [[ -f "$ROOT/app/.env.local" ]]; then
  printf 'SUPABASE_URL=%s\nSUPABASE_SECRET_KEY=%s\n' \
    "${SUPABASE_URL:-}" "${SUPABASE_SECRET_KEY:-}" >> "$ROOT/app/.env.local"
fi

# ---- workaround: harness/.secrets/app-secret must be readable by RUN_USER ----
# The stock `secrets` step in ../server.sh runs as root and writes
# harness/.secrets/app-secret with write600() — owner root, mode 0600. The
# harness itself runs as RUN_USER, so it cannot read the file and dies on boot:
#
#   EACCES: permission denied, open '.../harness/.secrets/app-secret'
#     at AuthStore.loadOrCreateAppSecret ... "fatal"
#
# It then crash-loops, nothing binds HARNESS_PORT, and every app call to the
# harness fails as "agent unreachable" (2026-08-30). ../server.sh already
# guards against exactly this for the build (`sudo -u "$BUILD_USER"`, so .next
# is not left root-owned); the app-secret block added in harness 0.12.0 did not
# get the same treatment. **This is an upstream bug** — ../server.sh is
# harness-owned and refreshed on upgrade, so the fix lives here in our own hook
# rather than in the file the next `cognisphere-upgrade` would overwrite.
# Remove this block once upstream chowns the file.
_APP_SECRET="$ROOT/harness/.secrets/app-secret"
_SECRET_OWNER="${RUN_USER:-${SUDO_USER:-}}"
if [[ -f "$_APP_SECRET" && -n "$_SECRET_OWNER" && "$(id -u)" -eq 0 ]]; then
  chown "$_SECRET_OWNER" "$_APP_SECRET"
  echo ">> app-secret: owner set to $_SECRET_OWNER so the harness can read it" >&2
fi

# ---- app sign-in: how a username becomes a Supabase Auth email --------------
# The app owns its own sign-in (Supabase Auth, app/lib/auth.ts) and holds no
# credential of its own here: internal accounts are created directly in
# Supabase, partner logins from the supplier page. All this hook passes through
# is the domain that fabricates an auth email from a username without an `@`.
#
# Effectively immutable once accounts exist — changing it orphans every account
# whose username was not a full email address.
if [[ -f "$ROOT/app/.env.local" ]]; then
  printf 'AUTH_EMAIL_DOMAIN=%s\n' "${AUTH_EMAIL_DOMAIN:-lps-app.invalid}" \
    >> "$ROOT/app/.env.local"
fi

# ---- artifacts: the shared app↔harness secret, for SEVERAL agents ----------
# The stock `gen_secrets` block in ../server.sh wires exactly one agent
# (ARTIFACTS_AGENT) and writes its plugin config.json as `https://$DOMAIN`.
# We publish from more than one agent, and each needs its own appBaseUrl
# (`https://$DOMAIN/a/<agent>` — see app/app/a/[agent]/), so ARTIFACTS_AGENT
# stays blank in `config` and the whole thing is wired here instead.
#
# One secret value is shared by every publishing agent: it authenticates *the
# app* to the harness, and there is only one app. Generated once, then reused
# from secrets.json so existing sessions and links survive a restart. The
# agents' config.json files are committed, not generated — they carry a
# per-agent URL that no deploy variable can derive.
if [[ -n "${ARTIFACTS_AGENTS:-}" && -f "$ROOT/app/.env.local" ]]; then
  ROOT="$ROOT" ARTIFACTS_AGENTS="$ARTIFACTS_AGENTS" DOMAIN="${DOMAIN:-}" \
  node <<'NODE' >> "$ROOT/app/.env.local"
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const root = process.env.ROOT;
const agents = process.env.ARTIFACTS_AGENTS.split(",").map((s) => s.trim()).filter(Boolean);

const secretsPath = path.join(root, "harness/.secrets/secrets.json");
let secrets = {};
try { secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8")); } catch {}

// Reuse whichever agent already has one, so a newly added agent joins the
// existing secret rather than rotating it out from under the app.
const shared =
  agents.map((a) => secrets[a]?.artifacts?.ARTIFACTS_APP_SECRET).find(Boolean) ||
  crypto.randomBytes(24).toString("hex");

for (const agent of agents) {
  secrets[agent] = {
    ...(secrets[agent] ?? {}),
    artifacts: { ...(secrets[agent]?.artifacts ?? {}), ARTIFACTS_APP_SECRET: shared },
  };
}
fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + "\n");
fs.chmodSync(secretsPath, 0o600);

// The app resolves <agent> out of the URL, so it needs the allowlist, not one
// agent name. Anything not on this list is a 404 before any fetch is made.
process.stdout.write(
  `ARTIFACTS_AGENTS=${agents.join(",")}\nARTIFACTS_APP_SECRET=${shared}\n`,
);
console.error(`>> artifacts: wired for ${agents.join(", ")} at https://${process.env.DOMAIN ?? ""}/a/<agent>/{public,private}/artifacts/<slug>`);
NODE
fi

# ---- supplier-events: the shared app→agent webhook secret ------------------
# The app notifies an agent about supplier activity (a portal availability
# save) through the supplier-events plugin webhook. Same split as the
# artifacts secret: one value in the agent's secrets bucket and in
# app/.env.local. Enabled on rosie (her restructure, 2026-08-23; the earlier
# daisy incarnation was removed the same day).
if [[ -f "$ROOT/app/.env.local" ]]; then
  ROOT="$ROOT" SUPABASE_URL="${SUPABASE_URL:-}" SUPABASE_SECRET_KEY="${SUPABASE_SECRET_KEY:-}" \
  node <<'NODE' >> "$ROOT/app/.env.local"
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const root = process.env.ROOT;
const agents = ["rosie"];

const secretsPath = path.join(root, "harness/.secrets/secrets.json");
let secrets = {};
try { secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8")); } catch {}
const shared =
  agents.map((a) => secrets[a]?.["supplier-events"]?.SUPPLIER_EVENTS_APP_SECRET).find(Boolean) ||
  crypto.randomBytes(24).toString("hex");
// The webchat portal endpoints (api/app-send / api/app-messages) use their own
// secret, same pattern: the supplier portal's server routes present it.
const webchat =
  agents.map((a) => secrets[a]?.webchat?.WEBCHAT_APP_SECRET).find(Boolean) ||
  crypto.randomBytes(24).toString("hex");
for (const agent of agents) {
  secrets[agent] = {
    ...(secrets[agent] ?? {}),
    "supplier-events": { ...(secrets[agent]?.["supplier-events"] ?? {}), SUPPLIER_EVENTS_APP_SECRET: shared },
    webchat: { ...(secrets[agent]?.webchat ?? {}), WEBCHAT_APP_SECRET: webchat },
  };
}
// The webchat plugin keeps its transcripts in Supabase (threads /
// thread_messages, migration 0078) and needs the project credentials in its
// OWN bucket: secret keys must be unique across an agent's buckets, and the
// agent-level bucket already holds SUPABASE_URL / SUPABASE_SECRET_KEY for
// rosie and daisy — hence the WEBCHAT_ prefix. Every agent that carries the
// plugin gets them, nova included (she has no agent-level Supabase access).
for (const agent of ["rosie", "daisy", "nova"]) {
  secrets[agent] = {
    ...(secrets[agent] ?? {}),
    webchat: {
      ...(secrets[agent]?.webchat ?? {}),
      WEBCHAT_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      WEBCHAT_SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
    },
  };
}
fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + "\n");
fs.chmodSync(secretsPath, 0o600);
process.stdout.write(`SUPPLIER_EVENTS_APP_SECRET=${shared}\nWEBCHAT_APP_SECRET=${webchat}\n`);
console.error(`>> supplier-events + webchat portal: app→agent secrets wired for ${agents.join(", ")}; webchat Supabase for rosie, daisy, nova`);
NODE
fi
