# quote-generation — changelog

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
