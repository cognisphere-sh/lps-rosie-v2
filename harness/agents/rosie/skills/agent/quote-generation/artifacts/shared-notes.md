### Customer-facing quote notes

`note_for_customer` on jobs and items holds **only** these customer-useful
outcomes from Chris/LPS or submitted supplier evidence (Chris, 2026-09-23):

- Unavailable original plant → a recommended alternative, if any, only after
  the relevant alternative approval. Do not infer unavailability from a missing
  price-list entry.
- An actual difference in size, quantity or variant → a short factual
  description of the difference. Prefer the confirmed offered-versus-requested
  fact to a speculative or unsolicited choice question; a customer question
  still requires the relevant communication approval.
- Supplier can order it → ETA or other relevant supplier details, such as
  meaningful conditions or handling requirements.
- Available as requested → usually no note. If the original quantity/unit was
  ambiguous and has now been verified, a short confirmation such as
  `140 x 4" correct` can clarify the specific request without repeating stock
  status or treating a pricing proxy as availability.

`job-requests` owns [audience and scope](../../job-requests/artifacts/notes.md).
Split mixed supplier notes before saving; preserve useful external supplier
conditions already present where they fit these outcomes, but keep internal
costs, comparisons, follow-ups, unverified cultivar/pricing-proxy caveats and
supplier-directed questions in `note_internal` or the appropriate supplier ask.
For example, `Plum Delight cultivar not confirmed` and `RED Avail?` are **not**
customer notes. Customer-supplied requirements stay in `note_from_customer`;
never delete or relocate them to enforce the external-note rule.

Use concise wording without losing meaning. Omit information already evident
in the row/grouping and leave NULL when none is needed. Do not treat a supplier
suggestion as an approved offering or copy raw supplier/customer/internal notes
at render time.

- No phase names in item notes for customer. Preserve phases in customer/original-demand
  context and group output separately when requested; never merge phases.
- No pricing-identity explanation, price-sheet reference or supplier name. An
  approved Purple Pixie pricing basis for unspecified dwarf loropetalum is not
  a customer note or cultivar substitution; retain the dwarf demand and resolve
  identity later. Keep the evidence internal.
- Approved actual size/color exceptions can be `5 G instead`, `Yellow instead
  of Red`, or `5 G $25.00` for a different supported requested option. Use
  `Only 5G available`, `Red NA, only Yellow`, or `5G NA, Only 7G` only when
  supplier-confirmed evidence supports each availability claim. Missing
  price-list entries establish neither stock nor physical unavailability;
  leave a pricing-only gap out of customer notes unless it describes an actual
  customer-useful size/quantity/variant choice.
- For two requested sizes, quote the lowest-priced supported requested option
  and note the other supported size price as a useful different-size choice.
  If the other size is confirmed unavailable, its brief `NA` note is
  appropriate; if merely unpriced, preserve that pricing gap internally and
  report it to Chris rather than implying supplier unavailability.

- Where the row or nearby label identifies the plant, list size and price only:
  `30 G $395.00; 45 G $595.00`. For just the larger option: `45 G $595.00`.
  Avoid “Also requested”, “Quoted at” and repeated plant names. These are
  formatting examples, not price evidence; include only supported options.
- Shared/customer-facing notes must not start with `Quoted for ...` or restate
  the quoted selection already evident in the row (Chris, 2026-09-11).
  Omit redundant introductions and selection statements. Keep only necessary
  concise facts/options, e.g. `5 G only` when supplier evidence confirms that
  size. If the original-versus-offered distinction is not otherwise visible,
  retain the minimum meaningful clarification, e.g. `Only 7 G available;
  15 G NA`. A customer-choice question is not a default quote note.
  Do not remove a necessary actual-offering distinction or caveat merely to
  shorten a note; a pricing proxy is not an actual substitution.
- Preserve material customer-useful supplier conditions (such as ETA or
  meaningful handling requirements) and necessary actual-offering distinctions;
  keep unsupported availability/cultivar uncertainty internal rather than
  publishing an internal caveat as a customer note. Do not imply approval or
  availability from brevity.
- Include saved job `note_for_customer` once before the item rows, separated
  from them by one blank line. Keep job-wide conditions there, not repeated
  on every item. Omit this line and separator when the job note is blank.
- In plain-text quotes, include a brief inline note **only when the item's
  existing shared/customer-facing `note_for_customer` is nonblank** (Chris,
  2026-09-11). Concisely render that note; do not invent or reconstruct an
  inline note from customer notes, internal notes, raw AR notes or chat.
  Populate the appropriate external field under `job-requests` before rendering.
  If absent, omit the note and its extra separator. Place the note after the
  plant name and before the unit
  price, separated by dashes, as specified in [text format](text-format.md). Explanations
  for Chris remain outside the copyable quote. Do not duplicate a size option
  in both item comments and general notes unless needed for clarity.
