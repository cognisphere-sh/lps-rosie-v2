# Supabase

The data is stored in a postgres supabase table, and files are stored in supabase storage. The database schema is available in `knowledge/files/SCHEMA.md`. Read this file before writing any queries. Update the schema file if you find any discrepancy or whenever you learn something new about the database schema.

`knowledge/files/SCHEMA.md` is a **symlink to `docs/supabase-schema.md` at the repo root** — the single source of truth shared by every agent and by the web app. Editing it through the symlink is correct and intended; that is how a correction reaches everyone. Do **not** replace the symlink with a copy, and do not keep a second schema file of your own.

Two things that are easy to get wrong and expensive to rediscover:

- **Never call `search_inventory` with an empty `search`.** With nothing to rank it returns zero rows. To *list* rather than *search*, select from `inventory` with an `ORDER BY` and a `LIMIT`.
- **`job_request_items.total` and `job_request_changelog` are trigger-owned.** `total` is a generated column (a write to it errors), and the changelog is written by an `AFTER` trigger on `job_requests` / `job_request_items` — you read it, never insert into it.

You can read/write to the bound Supabase project's Postgres database via `scripts/agent/supabase/query`, and upload to its Storage buckets via `scripts/agent/supabase/upload`.

## Run query: `scripts/agent/supabase/query`

SQL must be passed via `-c`, `-f`, or stdin — there is no positional-argument form. Passing the SQL bare (e.g. `query "SELECT ..."`) fails with `unknown option` (exit 2).

```
scripts/agent/supabase/query -c "<SQL>"            # single statement
scripts/agent/supabase/query -f path/to/query.sql  # SQL from file
echo "<SQL>" | scripts/agent/supabase/query        # stdin (preferred for multi-line)

# output formats (default is psql aligned table):
--csv        # CSV with header row
--tsv        # tab-separated, no decorations
--unaligned  # psql -A (pipe-separated, terse)
```

Use `--csv` or `--tsv` when piping into other tools.

Requires `psql` on `PATH` and the `SUPABASE_DB_PASSWORD` secret — the script shells out to psql. Missing client → exit 127 with `psql not found on PATH`.

### Allowed statements

`SELECT`, `INSERT`, `UPDATE`, `WITH ...` (CTE wrapping any of the above), `EXPLAIN`, `VALUES`, `BEGIN` / `START TRANSACTION`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`, `SET`, `SHOW`, and `CREATE [OR REPLACE] FUNCTION|PROCEDURE`. Multi-statement input separated by `;` is fine as long as every statement is allowed.

### Blocked statements

`DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, `VACUUM`, `CLUSTER`, `REINDEX`, `REFRESH`, `COMMENT`, `REASSIGN`, `COPY`, `DO`, `LOCK`, `LOAD`, `PREPARE`, `DEALLOCATE`, `EXECUTE`, `CALL`, `LISTEN`/`NOTIFY`/`UNLISTEN`, `CHECKPOINT`, `DISCARD`, `IMPORT`, and any `CREATE` form other than `FUNCTION`/`PROCEDURE` (so `CREATE TABLE`/`INDEX`/`VIEW`/`TRIGGER` are rejected). The tables you need already exist (see SCHEMA.md); you only ever `SELECT`/`INSERT`/`UPDATE`. If you genuinely need a delete or schema change, ask the admin to run it manually.

The guard scans after stripping comments and string literals — hiding a forbidden keyword in `/* ... */`, a CTE body, or a `DO $$ ... $$` block won't slip through.

### Live schema discovery

If SCHEMA.md is stale, query the catalog — then fix SCHEMA.md in the same task:

```sql
-- describe a table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;
```

## Upload files: `scripts/agent/supabase/upload`

Upload one local file to a Storage bucket and print the resulting object key.

```
scripts/agent/supabase/upload --bucket <name> --path <dest/path.ext> --file <local-file>
                 [--content-type <mime>] [--no-upsert] [--public-url]
```

- `--bucket` — target bucket (must already exist), e.g. `lps`.
- `--path` — destination object key. Use forward slashes for folders.
- `--file` — path to the local file.
- `--content-type` — explicit MIME. If omitted, guessed via `file -b --mime-type`.
- `--no-upsert` — refuse if an object already exists at `--path` (default is overwrite).
- `--public-url` — also print the public-URL form (the `lps` bucket is public).

On success prints `{"Key":"<bucket>/<path>"}`.

## Pre-signed URLs: `scripts/agent/supabase/sign-url`

```
scripts/agent/supabase/sign-url --bucket lps --path rosie_shared/2026-08-17/quote.pdf [--expiry 604800]
```

- `--expiry` — seconds until expiry (default 604800 = 7 days).
- Prints the signed URL to stdout. Use this for sharing files with users — upload
  to `rosie_shared/YYYY-MM-DD/<filename>` first, then hand over the signed URL
  rather than the bare object key.
- **A signed URL is a convention, not access control.** The `lps` bucket is
  public, so anything you upload is fetchable by object key whether you sign it
  or not (SCHEMA.md, *Storage buckets*). Don't put something in it that must not
  be world-readable.

## Auth / secrets

The harness exports the agent's declared secrets as env: `SUPABASE_PROJECT_ID`, `SUPABASE_SECRET_KEY` (used by `upload`/`sign-url` over HTTPS), and `SUPABASE_DB_PASSWORD` (used by `query` via psql). Never pass these on the command line — the scripts read them from env.

## Don't

- Don't `SET ROLE` to escalate — the connection user is fixed.
- Don't blindly retry an upload — `upload` upserts by default, so re-running is safe; confirm the previous attempt's HTTP status before assuming you need to.
