# supplier-email-routing — changelog

## 2.2.0

- Split identification, dispatch, route maintenance and labels; avoid repeated source reads and preserve routing boundaries.

## 2.1.0

2026-08-25 (Bhoumik) — §4 gains the **order/job-request hand-off to rosie**.
She has her own mailbox (`chris@localplantsupply.com`) and owns every
communication about an order; mail of that kind reaching daisy's inbox goes to
her `router` by agent message (forwarded when she needs the message itself),
labelled `Daisy/Not Availability`, never answered here. Supplier **lifecycle**
mail — onboarding, account setup, paperwork, a changed availability channel or
format, a record correction — stays daisy's and routes to the supplier thread
as before. The split is the subject, not the party.

## 2.0.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 2.0.0

2026-08-23 (Bhoumik) — the thread is renamed **`email-router` → `router`**
(catch-all rule now `router-all` → `router`); it is also main's fallback for
anything whose target thread main doesn't know. New §5: the router **promotes
a stable sender to a direct gws routing rule** (`routes add` to the supplier's
thread, then always re-adding the catch-all so it stays last — first match
wins and `add` appends); directly-routed mail bypasses the router, so the
dedicated thread applies the `Daisy` label itself. Notes path moved to
`workspace/threads/router/`.

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
