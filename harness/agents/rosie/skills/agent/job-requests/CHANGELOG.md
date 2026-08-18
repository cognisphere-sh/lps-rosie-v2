# job-requests — changelog

## 1.2.0

2026-08-18, with migration 0058. `job_request_items.status` narrows from seven
words to four: `pending → available | alternative_proposed | unavailable`.
`sourcing` is gone because it described an activity rather than a state, and
the activity is already in `internal_notes` in more useful detail — §7 now says
so outright and shows the log entries that replace it. `confirmed` and
`cancelled` are gone: acceptance is a note plus `job_requests.status =
'closed_won'`, a dropped line is `unavailable` with the reason in the notes,
and a line entered in error is deactivated rather than statused.

## 1.1.0

2026-08-18. §4 now states what `customer_notes` is *for*: the remainder of what
a customer said, never a transcript. Everything a structured column already
holds — plant, size, quantity, address, identity — belongs in that column and
only there; the note column carries constraints, preferences, deadlines and
reasons that have nowhere else to live. Added a where-it-goes table, the rule
that restating the ask adds nothing, and the observation that a note
duplicating a column means the column was filled wrong. Intake step 3 now
points at the rule. Written alongside the app change that surfaces an item's
note as a sub-line under its name.

## 1.0.0

2026-08-17, with migration 0055 (which created `customers`, `job_requests`,
`job_request_items` and `job_request_changelog`). Initial version, written
alongside the rosie agent itself: intake incl. anonymous requests, the
concurrency discipline for UI-shared tables, the last-5-changelog fetch rule,
the three-notes split with the customer-visibility rule for quantity changes
and substitutions, sourcing via daisy by agent-message, `needs_attention`
conventions, both status lifecycles, and the Chris-approved customer-contact
flow.
