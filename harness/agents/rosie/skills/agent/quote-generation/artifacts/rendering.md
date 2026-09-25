# Render a text quote

Read current job/items and approval evidence under `job-requests`. Write only
the intended saved rows, in customer/phase order, to `/tmp/<thread>-quote.json`:

```json
{"job_id":42,"note_for_customer":"Delivery date to be confirmed","items":[{"id":7,"name":"Wax myrtle","size":"15 G","demanded_quantity":4,"unit_price":"105.00","note_for_customer":null}]}
```

These are formatting examples, not prices or IDs to reuse. Input `items` must
contain the supported scope; include `job_request_id` when exporting rows so
the helper also checks ownership. Top-level `note_for_customer` comes from the
saved job; each item's `note_for_customer` comes from that saved item. Use NULL
or omit either optional field when blank. Read both scopes and include their
meaningful customer-facing notes, never internal or raw AR notes. Resolve
or concisely edit customer-facing notes before rendering, under
[notes for customer](shared-notes.md).

```sh
skills/agent/quote-generation/scripts/render-quote --input /tmp/<thread>-quote.json
```

Output is a fenced `text` block with any job external note once before the
item rows, then one line per item with any item note inline, and the subtotal.
Decimal arithmetic rounds each line to cents, then sums those totals. Only
requested `demanded_quantity` is used; `available_quantity` and internal fields are ignored.
The helper preserves order, normalizes gallon tokens and copies existing shared
notes at both scopes, flattening merged note paragraphs with semicolons. It cannot verify persistence, sourcing evidence, approval
or note safety.

Exit 2 gives a compact error and no partial quote for missing/nonpositive values,
duplicate/mismatched IDs, alternative sizes or unsafe multiline text. Resolve the
error from evidence. Do not invent values or silently omit unknown lines to make
it pass. For an authorized partial quote, explicitly choose the supported scope
and tell Chris what remains outside the block. Custom formats follow
[text format](text-format.md); the standard helper emits no phase headings.
