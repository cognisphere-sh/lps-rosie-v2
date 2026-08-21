# scripts/app/secrets.sh — sourced by ../server.sh after the stock secrets.
# Appends the Supabase credentials to app/.env.local. The app reads
# suppliers/inventory straight from Supabase; the secret key stays server-side
# (no NEXT_PUBLIC_ prefix) because it bypasses RLS.

if [[ -f "$ROOT/app/.env.local" ]]; then
  printf 'SUPABASE_URL=%s\nSUPABASE_SECRET_KEY=%s\n' \
    "${SUPABASE_URL:-}" "${SUPABASE_SECRET_KEY:-}" >> "$ROOT/app/.env.local"
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

# ---- supplier-events: the app→agent webhook secret --------------------------
# The app POSTs to the `supplier-events` plugin when a supplier acts in their
# portal (rosie owns availability requests) or someone instructs an agent
# from a supplier's chat view
# (app/lib/notify-agent.ts). Same trust split as artifacts: ONE secret value
# shared by every enabled agent, written to each agent's plugin bucket in
# secrets.json and once to app/.env.local. Generated once, then reused so a
# re-run never rotates it out from under a running app.
if [[ -f "$ROOT/app/.env.local" ]]; then
  ROOT="$ROOT" node <<'NODE' >> "$ROOT/app/.env.local"
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const root = process.env.ROOT;
const agents = ["daisy", "rosie"];
const secretsPath = path.join(root, "harness/.secrets/secrets.json");
let secrets = {};
try { secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8")); } catch {}
const shared =
  agents.map((a) => secrets[a]?.["supplier-events"]?.SUPPLIER_EVENTS_APP_SECRET).find(Boolean) ||
  crypto.randomBytes(24).toString("hex");
for (const agent of agents) {
  secrets[agent] = {
    ...(secrets[agent] ?? {}),
    "supplier-events": { ...(secrets[agent]?.["supplier-events"] ?? {}), SUPPLIER_EVENTS_APP_SECRET: shared },
  };
}
fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + "\n");
fs.chmodSync(secretsPath, 0o600);
process.stdout.write(`SUPPLIER_EVENTS_APP_SECRET=${shared}\n`);
console.error(`>> supplier-events: app→agent webhook secret wired for ${agents.join(", ")}`);
NODE
fi
