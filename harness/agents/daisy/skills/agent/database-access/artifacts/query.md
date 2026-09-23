# Guarded SQL

Use `scripts/agent/supabase/query -c '<SQL>'`, `-f /tmp/query.sql`, or stdin.
There is no positional SQL argument. `--csv`/`--tsv`/`--unaligned` avoid aligned
table overhead. `-f` is preferred for multi-statement SQL and repeatable batches.
The wrapper needs psql and reads credentials from environment; never print/pass
secrets as command-line arguments or use `SET ROLE`.

Normal work uses SELECT/INSERT/UPDATE, CTEs and transactions. The installed
guard also admits EXPLAIN/VALUES/SET/SHOW and function/procedure creation;
permission to execute syntax is not business authorization. DELETE, DDL such
as DROP/ALTER/TRUNCATE and unsupported statements are blocked. Do not bypass
the guard; request required schema/destructive work from the owner.

Read current rows before updating. Use narrow predicates and previous-value
guards (`field IS NOT DISTINCT FROM old_value`); a zero-row update needs reload
and reconciliation. Prefer existing lifecycle RPCs. Never write generated
totals, identity keys, thread refs or trigger-owned audit fields/timestamps.
Write actual newlines with a parameter/file or `E'...\n...'`, not plain `'\n'`.
Inspect committed records before retrying an uncertain mutation.

For a stale table reference:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;
```

Correct the shared schema through its symlink using verified evidence. Don't infer access control
from visible policies or CLI availability. Never call `search_inventory` with
empty input; list inventory with explicit ordering and a limit instead.
