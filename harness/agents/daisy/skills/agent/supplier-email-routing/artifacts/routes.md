# Direct routing rules

When a sender reliably maps to one supplier (routed there before, or their
own domain / newsletter sender), add a rule so their mail skips the router:

```bash
bash scripts/gws/routes add --name "route-<slug>" --thread-id "<daisy_thread_id>" --from "<address or @domain>"
bash scripts/gws/routes add --name "router-all" --thread-id "router" --from "."
```

- First match wins and `add` appends, so re-add the `router-all` catch-all
  after every new rule, every time.
- `@domain` only when the whole domain is the company's; an exact address for
  shared services (never all of `mailchimp.com`). A second pattern for the
  same supplier → `route-<slug>-2`.
- Mail on a direct route arrives on the supplier thread as a raw
  `email_received` with no `Daisy` label; that thread adds both labels.
- Wrong rule → `bash scripts/gws/routes remove --name "route-<slug>"` the same
  day a supplier thread reports foreign mail.
- Only the router thread manages rules.
