# Rosie configuration and integrations

## Configuration and plugins

`agent.json` uses `openai-codex` / `gpt-6-sol`, medium thinking,
`plugin_channel` thread strategy, ten concurrent slots, three attempts and
subprocess runtime. Supabase schema keys are `SUPABASE_PROJECT_ID`,
`SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD` and `SUPABASE_URL`; the first
two are required by the declared schema. Never include their values in docs.

| Plugin | Deployment role |
|---|---|
| `admin`, `scheduler`, `agent-messaging` | Core coordination and harness controls. |
| `webchat` | Internal per-thread panel plus authenticated supplier portal chat. Only `--portal` replies reach suppliers. Transcripts use `threads` / `thread_messages`. See [webchat](plugin-webchat.md). |
| `telegram` | Chris/Bhoumik coordination on main via the configured bot/chat route. |
| `supplier-events` | AR draft/submission notifications to the supplier thread, main as fallback. See [supplier events](plugin-supplier-events.md). |
| `artifacts` | Customer-safe HTML sharing under the configured Rosie app origin. |
| `gws` | Order email; direct correspondent/conversation routes with main catch-all. |

The checked-in gws configuration has `pollIntervalSec: -1` (passive),
`gmailQuery: in:inbox is:unread`, `firstOfThreadOnly: false`,
`allowedSenders: *`, `requireAgentInTo: false`, and empty extra OAuth scopes
(Gmail modify is always requested). Passive polling does not establish
whether sign-in currently exists or whether a send will succeed. The deployment
check on 2026-09-10 found Rosie’s gws plugin missing
`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`; her mailbox must be connected through
Settings before email can be sent or received. The app, agent and updated
webchat/supplier-events plugins were running.

To enable inbound email, use Rosie's **Settings → gws → Sign in with Google**
for her mailbox, verify the plugin is running, then set polling to `300`
through plugin settings. Credentials are managed by the OAuth callback;
never copy them into prompts or use a different agent's mailbox as fallback.
Preserve existing specific routes when changing the legacy catch-all to main.

SQL/storage helpers are `scripts/agent/supabase/{query,upload,sign-url}`.
Final customer files use `lps/rosie_shared/YYYY-MM-DD/`; intermediates use
`/tmp`. Migrations remain in the shared sequential record at
`harness/agents/daisy/migrations/`. See the shared
[schema](../supabase-schema.md) for lifecycle functions and trigger details.
