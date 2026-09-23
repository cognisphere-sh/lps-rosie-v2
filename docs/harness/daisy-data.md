# Daisy reference data and tools

## Knowledge (`knowledge/`)

`index.md` indexes the reference docs, which live under `files/` (harness
0.8.18 moved them there from the `knowledge/` root):

- `files/SCHEMA.md` — **a symlink to [`docs/supabase-schema.md`](../supabase-schema.md)**,
  the single source of truth for the Supabase schema shared by every agent and
  the web app. Daisy reads relevant sections through `database-access` and makes verified
  schema corrections through the symlink; it must never be
  replaced with a copy.
- `files/suppliers.md` — pointer stub: supplier quirks live in
  `suppliers.notes` in Supabase; the `workspace/suppliers/[<id>]:<Name>/`
  dirs are read-only legacy since 2026-08-23.
- `files/brand/` — LPS logo assets.
- `files/credentials/` — **sensitive**, mode `0700`: supplier portal logins
  (currently Garden Center Plants LLC / Buchholz, supplier 22). Values are never
  printed or forwarded.
- `files/plans/` — long-lived plan documents.
- `files/templates/` — reusable output templates, with their own `index.md`.
- `files/plant-reference-photos/` — Chris-provided plant reference intake, one
  dated dir per drop, each with an `index.md` manifest. Reference photos only:
  not supplier availability, and not linked to `inventory` rows.

The last five moved here from the `workspace/` root on 2026-08-16 — reference
material that is neither thread- nor supplier-scoped belongs in `knowledge/`,
leaving `workspace/` to `index.md`, `threads/`, `suppliers/` and `daily_notes/`.

Moving the other way on the same date: the **Gmail label ID table** left
`files/gmail-labels.md` for
`skills/agent/availability-ingestion/artifacts/gmail-labels.md`. Only that one
skill reads it, so it travels with the skill rather than sitting in shared
knowledge — the rule being that `knowledge/` holds what several threads or
skills consult, and a single skill's lookup table is one of its artifacts.

`knowledge/memory.md` is Daisy's cross-thread memory — one grep-able file of
sections separated by `-----$-----$-----$-----`, each with `name`,
`lastUpdated` and `description`. It replaced `workspace/memory/*.md` in harness
0.8.18. Since 2026-08-15 it holds **episodic events and facts only**: every
standing rule that had accumulated in it moved to the place that governs the
behaviour — `1-agent.md` when it holds everywhere, the relevant skill when it
governs one procedure (see the agent page's skill links). One record remains, the 2026-07-22
harness-upgrade validation. The file's own header states the rule, so a memory
written later doesn't reintroduce procedure.

`knowledge/SOPs/` is gone: procedures live in skills.

## Scripts & extensions

`scripts/agent/` (shared toolset) plus:

- `scripts/agent/supabase/` — `query` (psql; SELECT/INSERT/UPDATE/WITH/EXPLAIN
  plus function/procedure creation; destructive SQL and other DDL are blocked
  by a lexical guard that masks PostgreSQL strings, quoted identifiers, and
  comments without mistaking source-note words such as `DO`/`DROP` for code),
  `sign-url` (pre-signed Storage URL), `upload` (upload to a Storage bucket).
- `scripts/agent-msg/send` — inter-/intra-agent messaging CLI (seeded by
  agent-messaging).
- `scripts/gws/` — `email` CLI (`read`/`thread`/`search`/`labels`/`label`) +
  `format-email-lib.mjs`/`.d.mts` (decode Gmail message JSON to plain-text body
  + attachments), `routes` (thread-routing rules), and `settings` (her own
  notification overlay).
- `scripts/scheduler/scheduler-cli`, `scripts/telegram/telegram-cli`,
  `scripts/webchat/webchat-cli`.

Extensions: the four shared ones.
