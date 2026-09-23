## 2. Default text quote

Present the complete text quote inside a fenced code block using triple
backticks and the `text` language tag, ready to copy. Include only the quote
in that block; any explanation or question for Chris belongs outside it.
Apply this rule to any other text prepared for copying, including message
drafts, and to text quotes with a custom format.

When saved job `note_for_customer` is nonblank, render it once as a concise line
before the items, followed by one blank line. Otherwise start with the first
item. Never fill that line from customer, sourcing or raw AR supplier notes.

Unless Chris specifies another format, output **one line per item**. Chris's
latest correction (2026-09-11): use ` x ` between quantity and size, then a
space before the plant name; follow with dash-separated brief note, unit
price and line total:
`Qty x Size Plant - Brief note - $Unit Price - $Line Total`.
Use a minimal customer-safe note only from the item's existing nonblank shared
`note_for_customer`; omit redundant content under [shared-note rules](shared-notes.md). If no shared
note exists, use `Qty x Size Plant - $Unit Price - $Line Total` without an empty
note field or extra separator. Never derive an inline note from internal
sourcing, customer notes, raw AR notes or chat while rendering the quote.
Follow the items with exactly one blank line and the subtotal as the final line:

```text
4 x 15 G Wax myrtle - $105.00 - $420.00
10 x 30 G Mountain laurel - $375.00 - $3,750.00

Subtotal: $4,170.00
```

An item whose existing note for customer is `45 G $595.00` uses this shape
(formatting example only):

```text
10 x 30 G Eagleston Holly - 45 G $595.00 - $395.00 - $3,950.00
```

These are formatting examples, **not a price list**. Fetch actual prices.
Use `G` for gallons, ` x ` between quantity and size, one space between size
and plant name, and ` - ` before each following field (optional note, unit
price, line total). No commas separate quantity/size/name. Use `$` and exactly
two decimal places for each monetary value, and a
comma as the thousands separator. Calculate each line total as requested
quantity × customer unit price and verify the subtotal as their decimal sum;
never use `available_quantity`. Preserve meaningful non-gallon size/form
specifications rather than converting them without evidence. No heading,
pipes, internal commentary or supplier names in the quote block; only the
applicable saved job note and customer-safe inline item notes described above. Only an explicit
format instruction changes this. A line whose quantity or customer unit price
is unknown stays out of a final priced quote and is stated separately to Chris.
