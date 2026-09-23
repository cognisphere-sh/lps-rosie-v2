## 5. Promote a stable sender to a direct route

When a sender **reliably** maps to one supplier thread — you've routed the
same address or domain there before, or the match is unambiguous (the
company's own domain, their newsletter sender) — add a `gws` routing rule so
future mail skips you and lands straight on the dedicated thread:

```bash
bash scripts/gws/routes add --name "route-<slug>" \
  --thread-id "<daisy_thread_id>" --from "<address, or @domain>"
# The catch-all must stay LAST — first match wins and `add` appends, so
# re-add it after every rule you add:
bash scripts/gws/routes add --name "router-all" --thread-id "router" --from "."
```

- **One rule per sender pattern.** Use `@domain` when the whole domain is the
  company's own; the exact address when it's a shared service (never route all
  of `mailchimp.com`). A second pattern for the same supplier gets its own
  name (`route-<slug>-2`).
- **Never skip the catch-all re-add** — without it the new rule sits after
  `router-all` and never fires.
- A promoted sender's mail arrives on the supplier thread as a raw
  `email_received`, with no router forward and **no `Daisy` label** — the
  dedicated thread applies the labels itself ([availability-ingestion: completion](../../availability-ingestion/artifacts/completion.md)).
- A mis-promoted rule is undone with
  `bash scripts/gws/routes remove --name "route-<slug>"`. If a supplier
  thread reports mail that isn't theirs, remove or narrow the rule the same
  day.
