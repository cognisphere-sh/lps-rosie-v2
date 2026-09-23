### Customer-facing quote notes

`note_for_customer` on jobs and items holds information meant for the customer
and included in the quote. It can come from Chris/LPS's sourcing work or
submitted AR `note_from_supplier`: relevant conditions, care/handling details,
timing, options or special requests. `job-requests` owns
[audience and scope](../../job-requests/artifacts/notes.md); split mixed supplier
notes before saving, keeping internal costs, comparisons and follow-ups in
`note_internal`. Customer-supplied requirements stay in `note_from_customer`;
save a separate external note only when useful to communicate back.

Use concise wording without losing meaning; notes need not be exceptions.
Omit information already evident in the row/grouping and leave NULL when none
is needed. Do not treat a supplier suggestion as an approved offering or copy
raw supplier/customer/internal notes at render time.

- No phase names in item notes for customer. Preserve phases in customer/original-demand
  context and group output separately when requested; never merge phases.
- No pricing-identity explanation, price-sheet reference or supplier name. An
  approved Purple Pixie pricing basis for unspecified dwarf loropetalum is not
  a customer note or cultivar substitution; retain the dwarf demand and resolve
  identity later. Keep the evidence internal.
- Size/color exceptions can be `5 G instead`, `Yellow instead of Red`, or
  `5 G $25.00`. Use `Only 5G available`, `Red NA, only Yellow`, or
  `5G NA, Only 7G` only when actual supplier-confirmed evidence supports each
  availability claim. Missing price-list entries establish neither stock nor
  physical unavailability. For pricing-only gaps use neutral `7 G price pending`
  where useful, never `NA` or `Only ... available`.
- For two requested sizes, quote the lowest-priced supported requested option
  and note the other supported size price. If the other size is confirmed
  unavailable, its brief `NA` note is appropriate; if merely unpriced, use
  neutral `price pending`. Do not infer availability from pricing evidence.

- Where the row or nearby label identifies the plant, list size and price only:
  `30 G $395.00; 45 G $595.00`. For just the larger option: `45 G $595.00`.
  Avoid “Also requested”, “Quoted at” and repeated plant names. These are
  formatting examples, not price evidence; include only supported options.
- Shared/customer-facing notes must not start with `Quoted for ...` or restate
  the quoted selection already evident in the row (Chris, 2026-09-11).
  Omit redundant introductions and selection statements. Keep only necessary
  concise options/questions, e.g. `Does this variety work?` when the row
  identifies the variety and makes the change clear. If the original-versus-
  offered distinction is not otherwise visible, retain the minimum meaningful
  clarification, e.g. `Podocarpus instead of Taxus—OK?`.
  Do not remove a necessary actual-offering distinction or caveat merely to
  shorten a note; a pricing proxy is not an actual substitution.
- Retain material qualifications such as unconfirmed availability or excluded
  tax/delivery; shorten wording, never remove necessary meaning. Do not imply approval/availability from brevity.
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
