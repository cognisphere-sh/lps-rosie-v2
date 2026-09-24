# Rosie session review — 2026-09-24

## Scope and method

Reviewed the 35 most recently modified JSONL session files under
`harness/agents/rosie/sessions`, filtering diagnostic counts to records dated
September 22–24, 2026 UTC. Older records in long-lived main/supplier threads
were not counted. Inspected user corrections, failed tools and their preceding
calls, large outputs, and the corresponding current skills. Evidence indices
below are zero-based JSONL record indices, matching `session-reader`.

The sample contains 1,391 tool results, including 50 marked `isError`: 16
schema/query-reference failures, 12 missing paths, 10 shell-quoting failures,
9 stale text edits, and 3 other failures. These are tool failures, not 50
business mistakes. Some counted schema failures occurred after earlier
statements in a batch had succeeded.

38 tool results exceeded 20,000 text characters, totaling 1,470,433 characters.
This is context volume, not a token-savings estimate; some evidence reads were
necessary. No production before/after token measurement was performed.

## Findings and changes

| Evidence (thread, record) | Finding | Action |
|---|---|---|
| `jr-69-§-[TASK]-§-correct-diff-size-price` #32; `jr-71` #140; `jr-69-§-[TASK]-§-reconcile-elaeagnus-confirmation` #35 | SQL embedded in shell double quotes expanded `$25`, `$1.95`, and `$65`, causing failures. | Database skill now gives a literal file/stdin recipe and explains SQL versus shell escaping and partial-batch retry risks. |
| `jr-69` #102 and #69 | Broken quoted handoff; invented webchat `edit-message` command. | Added `message-routing/scripts/send-text`, which reads a text file and passes it as one argument to existing messaging CLIs without shell evaluation or automatic retries. Documented supported correction behavior. |
| `jr-55-§-[TASK]-§-handle-ar36-submission` #28; `supplier-austin-plant-supply-§-[TASK]-§-ar39-submission` #22 | Queries guessed obsolete `record_name`; other sessions guessed thread columns and a `jobs` schema topic. | Strengthened exact-topic/current-schema guidance, including thread evidence; use projected columns and bounded transcript windows. |
| `jr-59-§-[TASK]-§-ar39-empty-submission` #8–10; `supplier-austin-plant-supply-§-[TASK]-§-ar39-submission` #25 | Whole skills/schema and wide JSON rows produced tens of thousands of characters per result. | Retained existing split skills/schema selector; added bounded handoff/recall guidance and capped inventory candidate examples with explicit narrowing/pagination before declaring gaps. |
| `jr-69-§-[TASK]-§-price-rule-feedback` #219/#279; `jr-69-§-[TASK]-§-ar40-accepted-alt-proxies` #60 | Stale replacement targets caused retry work on skills/shared notes. | One writer per record/field or skill scope; reread exact shared-note sections after mismatch; avoid whole-file replacement and repeated transcript copies. |
| `jr-71` #137–143 | One flat of frogfruit had demand 1 and a per-pot price of $1.95; Rosie subsequently cleared that price. | Explicit unit-basis rule: keep unresolved flat/tray prices NULL, retain per-pot evidence internally, and update conversion/quantity/price together after clarification. |
| `jr-69-§-[TASK]-§-correct-diff-size-price` #3, #29–35 | Correction brief reported old 1 G/$8 despite approved 5 G/$25. Fresh read found price already changed to $25 but size still 1 G. | Existing new-offering pricing rule retained; now require coupled offering/price updates and verification, preserving newer UI edits and original demand. |
| `jr-69` #21/#40/#53/#81 | Two screenshot project headings led to JR-70 creation before Chris clarified one combined job, followed by moving items and retiring the extra job. | Keep section labels within an established job; resolve ambiguous boundaries before creating extra jobs or assigning separate intake writers. |

## Already addressed before this review

Current skills already include Chris's app-first job handoff, original-plant AR
scope, non-exhaustive catalogue/stock distinction, concise note audiences,
new-offering pricing, and a scoped schema selector. Historical failures do not
mean those fixes were absent today. This review extends their execution details
without restating the full procedures or changing communication approvals.

## Validation and limits

- 3 messaging-helper tests: literal currency/apostrophes/backticks/substitutions
  and newlines; explicit portal scope; failure propagation without retry;
  invalid/empty/missing input rejected before invoking a CLI. Sends are mocked.
- Existing schema-selector tests: 4 passed.
- Existing quote-renderer tests: 9 passed.
- Skill description/metadata versions bumped together with changelog entries;
  local links and `git diff --check` verified.

No live database changes, customer/supplier messages, agent messages or harness
restart were performed. Helpers preserve existing CLI identity and authorization
requirements. The pricing safeguards are procedural; the renderer cannot infer
unit basis or price approval from persisted IDs alone. Future sessions must be
observed to measure adoption and actual error/token reduction.
