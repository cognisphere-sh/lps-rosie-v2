# Skip an unchanged effective source

Use this before expensive conversion on recurring sources. It is a local
successful-receipt cache, not evidence of current stock or a substitute for the
historical exact-farm check. `check` never writes state. Missing state means
process; malformed state fails rather than granting a skip.

1. Resolve actual farm/location scope first. Use a stable source key, e.g.
   `farm:24|weekly-list|current`; different locations/channels/classifications
   need separate receipts. Follow historical skip decisions before any write.
2. Prepare the complete effective source in `/tmp`: original attachments and a
   text/JSON file containing relevant email body amendments, source dates,
   classification and scope instructions. Include manual receipt time when it
   determines precedence. HTTP metadata may avoid a download, but never skip
   because an attachment alone is unchanged while the body/instructions changed.
   Give files stable distinct names; do not hash only parsed output.
3. Run from the agent directory, repeating `--file` for every source component:

   ```sh
   skills/agent/availability-ingestion/scripts/source-check check \
     --scope 'farm:24|weekly-list|current' \
     --file /tmp/receipt-context.txt --file /tmp/list.pdf \
     --state workspace/threads/<ThreadId>/files/source-receipt.json
   ```

   `process` → normal ingestion. `unchanged` → inspect returned prior source IDs
   for the intended scope, report the skip and reuse known source references;
   claim no newly refreshed stock. If Chris explicitly requests reprocessing,
   proceed despite the cache. The fingerprint also includes this skill's current
   instructions so changed normalization/QA rules invalidate old receipts.
4. After **all** scoped ingestion, photo work and QA succeeds, write a compact
   evidence JSON file: `{"verified":true,"source_ids":["<saved source UUID>"],
   "summary":"<verified per-location outcome>"}`. This is your attestation;
   the helper does not query Supabase. Failed, partial, skipped-historical or
   photo-only work creates no success receipt here.
5. Run the same command with `record` instead of `check`, plus
   `--expected '<fingerprint from check>' --evidence /tmp/ingest-evidence.json`.
   A changed source/rules fingerprint fails. Recording uses a lock and atomic
   replacement. The only write is this local receipt; it never touches the
   database, labels, supplier or inbox. Keep one owner per scope and don't run
   overlapping ingests for that scope.
