# Running SQL

Prefer the helpers in `skills/agent/database-access/scripts/` (they build
safe SQL for you). Paths here are relative to the agent root. For
anything else use the guarded wrapper:

```sh
scripts/agent/supabase/query --csv -f /tmp/<thread>-<task>.sql
scripts/agent/supabase/query --csv <<'SQL'
SELECT id, name FROM job_requests WHERE id = 83;
SQL
```

- SQL comes from `-c '<sql>'`, `-f <file>` or stdin. No positional argument.
  `--csv`/`--tsv`/`--unaligned` keep output small.
- **Never put SQL in double quotes in bash.** Bash turns `$65` into `5` and
  fails with "unbound variable". Use a file (write tool) or a quoted
  heredoc (`<<'SQL'`). SQL apostrophes still need doubling (`Chris''s`), or
  use `$q$Chris's$q$`.
- Allowed: SELECT, INSERT, UPDATE, WITH, SET, SHOW, VALUES, EXPLAIN,
  transactions, CREATE FUNCTION. Blocked anywhere in the text: DELETE, DROP,
  ALTER, TRUNCATE, DO (so no `ON CONFLICT DO NOTHING`; use `WHERE NOT
  EXISTS`), COPY, LOCK, EXECUTE, CALL and similar. Don't try to get around the
  guard; ask the owner for schema or destructive work.
- Pass typed NULLs to functions when needed: `NULL::text`, `NULL::date`.
- Select named columns with a LIMIT. Avoid `SELECT *` and `to_jsonb(row)` on
  jobs, audits and transcripts.
- If one statement in a batch fails, earlier ones may already be saved: read
  the rows before retrying. Put dependent writes in one `BEGIN ... COMMIT`.
- After an unclear write, check what was saved before trying again.
- Credentials come from the environment. Never print or pass secrets, never
  `SET ROLE`.

## Column not found?

Run `skills/agent/database-access/scripts/schema <table>` (exact names from `--list`; e.g. there is no
`jobs` topic, `record_name` only if migration 0104 is live, no
`thread_messages.content`). If the schema doc is wrong, check the catalog:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>' ORDER BY ordinal_position;
```

and fix `knowledge/files/SCHEMA.md` in place (it is a shared symlink; never
copy it).

## Transcript reads

Chat history is in `threads` (`agent`, `thread_id`) and `thread_messages`
(`seq`, `role`, `sender_name`, `portal`, `text`, `files`, `created_at`). Read a
bounded window by thread and `seq`, not whole transcripts.
