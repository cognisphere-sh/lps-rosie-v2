# quote-generation — changelog

## 2.19.0

- Remove Confirmed from job-stage rules. Clarify that supplier confirmation advances Orders only; linked Job Requests stay Committed.

## 2.18.0

- Use the canonical compact supplier snapshot and row outcome when recording quote prices or gaps; replace superseded price updates without accumulating quote history.

## 2.17.0

- Generate APS price-list quotes before availability requests; stop quote-only work after output and let the job thread obtain Chris send approval for ordinary jobs. Distinguish customer commitment from supplier confirmation.

## 2.16.0

2026-09-11 — Route explicitly requested compact Gmail-copy HTML tables to the
new Chris-authorized html-quote skill. Pricing/intake/approval and customer-safe
note rules stay here; the approved APS document template remains unchanged.

## 2.15.0

2026-09-11 — Chris directed shared/customer-facing notes to omit “Quoted for”
and selections already evident in the row. Keep necessary concise questions,
options and meaningful substitution/availability caveats. Inline text notes
may render only existing nonblank item shared `external_notes`; absent means
omit the note/extra separator, never reconstruct from sourcing or chat.
Audited cumulative
feedback: minimum words, size/price-only options, Qty x Size Plant followed by
dash-separated optional note/unit price/line total, subtotal last. No PDF or
unrelated operational-note changes.

## 2.14.1

2026-09-11 — Chris corrected the comma interpretation: use Qty x Size Plant,
then dash-separated brief note, unit price and line total. No commas separate
the first fields. Updated optional/no-note shapes and examples; subtotal stays
last. Supersedes the immediately preceding delimiter interpretation only.

## 2.14.0

2026-09-11 — Chris clarified the exact plain-text format: comma-separated
quantity, size and plant name, followed by dash-separated brief note, unit
price and line total; subtotal stays at the bottom. Replaced the earlier x
format and examples. Omit the note field when unnecessary; minimal-word notes,
copyable blocks, pricing checks and PDF layout remain unchanged.

## 2.13.0

2026-09-11 — Chris directed plain-text quote notes to appear after the plant
name and before unit price, separated by dashes. Updated the default optional
note shape and reconciled prior outside-block guidance. No-note lines retain
their format; notes remain minimal, customer-safe and within the complete
copyable quote. No change to HTML/PDF layout or approval gates.

## 2.12.0

2026-09-11 — Chris requested minimum-word quote notes: size/price only where
plant context is clear, no redundant row/general notes, and concise variety
questions and material caveats. Applies only to quote-facing notes and shared
size options; does not broaden to operational notes or change template layout.

## 2.11.0

2026-09-11 — Chris authorized quoting the smallest priced requested size without
redundant choice approval. Preserve original options and larger requested-size
prices in shared item notes, without duplicating quote quantities or changing
the default text format. Price evidence does not confirm physical stock.

## 2.10.0

2026-09-11 — Use supported likely equivalent catalogue-name pricing directly
per Chris, with internal mapping evidence and no unnecessary alternative label,
approval or customer substitution comment. Includes authorized Agave example;
real differences/unsupported identity remain approval-gated alternatives.

## 2.9.0

2026-09-11 — Chris authorized mandatory APS sourcing entries on all APS-scoped
quick-quote/job rows, including gaps and 1–2 supported alternatives when found.
Require explicit confirmation before quoting a specific alternative, including
partial/draft quotes; distinguish quote approval from AR approval and keep
unapproved candidate prices out of requested-line values.

## 2.8.0

2026-09-11 — Chris clarified that every quick quote, including a partial quote or draft, must create or reuse its job, JR thread and all supplied item rows before quote output. Pricing-only questions remain exempt.

## 2.7.0

2026-09-11 — Chris approved a new default text quote: `Qty x Size Plant Name Unit Price - Line Total` per priced item, then a subtotal. Require requested-quantity arithmetic, customer unit prices, verified line totals, exactly one blank line before the subtotal, and customer-safe copyable output.

## 2.6.0

2026-09-11 — Record explicit supplier selections and plant-sourcing decisions
under the job skill's note rule; quote research alone still adds no entries.

## 2.5.0

2026-09-11 — Use the job skill's Markdown supplier-entry format for sourcing
notes: bold, underlined names and concise keywords/numbers, without tables.

## 2.4.0

2026-09-11 — Keep research-only supplier/price findings in internal chat.
Quick-quote pricing alone creates no sourcing notes; follow the job skill's
sent-request, required-action or explicit-note rule while saving supported
structured prices as before.

## 2.3.0

2026-09-11 — Create/reuse the job/thread and item rows, gather pricing and
save supported updates before asking for clarification. Only work dependent
on the missing answer waits, including the affected quote output.

## 2.2.0

2026-09-11 — Gather and post pricing evidence first, then ask any remaining
order questions before generating a quote, including quick quotes. Preserve
independent preparation and avoid questions about already known or unneeded
fields.

## 2.1.0

2026-09-11 — Present text quotes and other text intended for copying inside
fenced code blocks, with only the copyable content inside and explanations
outside. Applies to custom text-quote formats as well as the default.

## 2.0.1

2026-09-11 — Align quick quotes and customer delivery with the Quote stage; skip Availability for quick quotes and preserve later job stages.

## 2.0.0

2026-09-10 — Merge text-quote-format into this skill with the requested size/plant/em-dash/unit-price shape. Quick quotes use a job/thread without ARs. Move approved APS HTML into skill artifacts and preserve retired format history.

## 1.3.2

2026-08-25 (Bhoumik). §4 no longer says the send is logged in
`customers.communication_notes` — migration 0073 dropped the column; the
customer thread's own web chat is the record.

## 1.3.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.3.0

2026-08-24, approved by Chris. The approved modern Austin Plant Supply branded template (logo and current header) is now the default for APS quotes; the unbranded LPS template is legacy and the older APS template remains stale.

## 1.2.2

2026-08-19, alongside `job-requests` 1.14.0. A filled `unit_price` no longer
means a line may be quoted: priced-and-`pending` is what a sourced but
unconfirmed line looks like now, so §2 says so where it handles `pending`, and
the description asks for a request that is priced *and confirmed*.

## 1.2.1

2026-08-19, from Bhoumik. The customer-safe-fields rule names price lists
alongside supplier names and prices, and carries the explicit-instruction
exception that `job-requests` §4.2 now states — a quote's Comments cell is
filled from `external_notes`, so the two had to say the same thing.

## 1.2.0

2026-08-18, from Bhoumik. Comments for alternative-proposed quote lines now
read `Quoted for <offering>.` and are omitted for catalogue-name-only
variations, matching job-requests 1.9.0.


## 1.1.0

2026-08-18, from Bhoumik. Quote Size columns now render gallons as `G` (`3 G`,
never `3 gal`), matching the normalized job-request item value.


## 1.0.4

2026-08-18, alongside `job-requests` 1.7.0. §2 says why an unpriced line may be
unpriced on purpose: `unit_price` carries an Austin Plant Supply price, so a
line sourced elsewhere holds its price in `sourcing_notes` and is quotable only
once Chris sources it there. The description is rewritten short in the same
bump — coverage in a clause, plus when to use it.

## 1.0.3

2026-08-18, alongside `job-requests` 1.6.0. A substituted line's Comments cell
carries the `external_notes` line as written — which now names the substitution
and not the reason for it.

## 1.0.2

2026-08-18, alongside `job-requests` 1.3.0. §2 states where a line total comes
from now that rosie fills only `unit_price`: asked quantity × unit price,
generated by the database, with `available_quantity` never in the arithmetic.
Pricing an unpriced line points at the Austin Plant Supply ladder.

## 1.0.1

2026-08-18. §2's quotable-item rule follows migration 0058's four-word item
status vocabulary: `confirmed`, `sourcing` and `cancelled` no longer exist, so
quotable is `available` + `alternative_proposed`, held is `pending`, and
mentioned-if-useful is `unavailable`.

## 1.0.0

2026-08-17. Initial version, written alongside the rosie agent: templates in
`knowledge/files/templates/` (starter `lps-quote-template.html`), the
customer-safe-fields-only rule, filling and quotable-item selection, PDF via
agent-browser + upload/sign-url under `rosie_shared/`, HTML via the artifacts
plugin, and the Chris-approval gate before anything reaches the customer.


# Retired text-quote-format history

Merged into quote-generation in 2.0.0. The current format is defined above in its SKILL.md.

# text-quote-format — changelog

## 1.0.2

- Correct item lines to always include quantity, size, plant, unit price, and validated line total; require copy/paste-ready output with no Rosie commentary and the subtotal as the final line after exactly one blank line.

## 1.0.1

- Require exactly one blank line between the final item and the subtotal, per Chris's approved formatting correction.

## 1.0.0

- Initial version: concise, customer-safe plain-text quote formatting, price validation, and approval gate.
