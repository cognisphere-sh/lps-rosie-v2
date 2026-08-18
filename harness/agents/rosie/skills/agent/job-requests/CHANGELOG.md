# job-requests — changelog

## 1.0.0

2026-08-17, with migration 0055 (which created `customers`, `job_requests`,
`job_request_items` and `job_request_changelog`). Initial version, written
alongside the rosie agent itself: intake incl. anonymous requests, the
concurrency discipline for UI-shared tables, the last-5-changelog fetch rule,
the three-notes split with the customer-visibility rule for quantity changes
and substitutions, sourcing via daisy by agent-message, `needs_attention`
conventions, both status lifecycles, and the Chris-approved customer-contact
flow.
