# supplier-email-routing — changelog

## 1.2.0

2026-08-23 (Bhoumik) — the router labels every email it processes: primary
`Daisy` on everything (a forwarded drop's status sub-label stays the dedicated
thread's, per `availability-ingestion` §7), `Daisy/Escalated` on
needs-human-review mail sent to `main`, `Daisy/Not Availability` on
no-action non-supplier mail. New *Labels* section points at the shared
label-ID artifact.

## 1.1.0

2026-08-23 (Bhoumik) — §4 clarified: an email that is not supplier
availability and **needs human review** is forwarded to `main`; one that
needs no human review and is not from a supplier gets **no action at all**
(the previous version labelled such mail in Gmail — dropped).

## 1.0.0

2026-08-23 — Initial version (Bhoumik's restructure). The email-router thread
replaces the main-thread half of the retired `availability-drop-intake` skill:
a catch-all `gws` route pins every inbound email to `email-router`, which
identifies the supplier from sender/subject/attachment names alone (reading
body or attachments only when identification fails), forwards a pointer to the
supplier's dedicated `daisy_thread_id` thread, mints `supplier-<slug>` thread
ids for brand-new suppliers, and hands non-supplier mail to `main` or labels it
away. All reading, onboarding, ingestion and labelling belong to the dedicated
threads.
