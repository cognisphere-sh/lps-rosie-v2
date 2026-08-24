# daily-supplier-availability-onboarding — changelog

## 2.1.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 2.1.0

2026-08-23 — category vocabulary updated to Chris's target tag set (migration
0067): the §2 out-of-state retained-future-market exception now names
`Wholesale Supplier` (previously `Wholesaler` or `Nursery`, both retired).

## 2.0.0

2026-08-23 — Bhoumik's agent restructure: ingestion and supplier-side writes
are no longer dispatched to generic task threads or the retired
`availability-drop-intake` path — they go to each supplier's dedicated thread
(`suppliers.daisy_thread_id`, migration 0064), which runs
`availability-ingestion` itself. Also folds in two 2026-08-20 directives:
placeholder-supplier holds (Devil Mountain pattern — special-material
placeholders get no routine effort) and Bhoumik's regenerate-on-correction
rule for the batch artifact. The draft rule no longer references the dropped
`supplier_messages` table — contact recording follows
`supplier-communications`. The 3 AM schedule stays paused pending the
category-tag migration.

- Chris-approved Texas-first policy: prioritize Growers, require explicit Texas-service evidence before availability work becomes actionable, retain out-of-state wholesale nurseries without routine outreach, and audit/hold drafts rather than reviving them.

## 1.2.0

- Bhoumik-approved change: best-effort signup now checks required consent and attempts normally solvable CAPTCHA before holding; unresolved CAPTCHA, email verification and technical failures retain exact evidence.

## 1.1.0

- Bhoumik-approved correction: every detected subscription form now requires a recorded attempted success, precise human/CAPTCHA hold, or technical-failure outcome; a detected form alone is not complete.

## 1.0.0

- Initial Bhoumik-approved 3 AM daily routine for safe, idempotent review of 100 suppliers without availability data.
