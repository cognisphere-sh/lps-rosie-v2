# Render a text quote

Read current job/items and approval evidence under `job-requests`. Write only
the intended saved rows, in customer/phase order, to `/tmp/<thread>-quote.json`:

```json
{"job_id":42,"items":[{"id":7,"name":"Wax myrtle","size":"15 G","quantity":4,"unit_price":"105.00","external_notes":null}]}
```

These are formatting examples, not prices or IDs to reuse. Input `items` must
contain the supported scope; include `job_request_id` when exporting rows so
the helper also checks ownership. Customer-safe `external_notes` comes only
from the existing shared field, never sourcing notes. Resolve or concisely
edit shared notes before rendering, under [shared notes](shared-notes.md).

```sh
skills/agent/quote-generation/scripts/render-quote --input /tmp/<thread>-quote.json
```

Output is a fenced `text` block with one line per item and the subtotal.
Decimal arithmetic rounds each line to cents, then sums those totals. Only
requested `quantity` is used; `available_quantity` and internal fields are ignored.
The helper preserves order, normalizes gallon tokens and copies existing shared
notes. It cannot verify persistence, sourcing evidence, approval or note safety.

Exit 2 gives a compact error and no partial quote for missing/nonpositive values,
duplicate/mismatched IDs, alternative sizes or unsafe multiline text. Resolve the
error from evidence. Do not invent values or silently omit unknown lines to make
it pass. For an authorized partial quote, explicitly choose the supported scope
and tell Chris what remains outside the block. Custom formats follow
[text format](text-format.md); the standard helper emits no phase headings.
