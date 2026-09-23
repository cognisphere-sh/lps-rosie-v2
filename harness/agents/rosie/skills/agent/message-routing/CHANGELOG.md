# message-routing — changelog

## 2.5.0

- Move routing, handoff and approval detail into independently loaded tasks; shorten discovery metadata.

## 2.4.1 — 2026-09-22

- Keep record numbers internal to handoffs and URL targets; supplier-facing Order/AR update messages use job names only.

## 2.4.0 — 2026-09-22

- Preserve affected job names and direct supplier-portal Order/AR links through supplier-update handoffs and final message delivery.

## 2.3.0 — 2026-09-22

- Route post-placement order-change notifications under standing send authorization while preserving supplier-thread ownership and other communication approval rules.

## 2.2.0 — 2026-09-18

- Route new intake directly to a new job id without searching jobs by matching plants or asking duplicate-job questions based on plant overlap.
- Reuse only explicitly identified jobs, established job context or the same known/reserved id on retry; accepted-quote conversion still follows its identified job.

## 2.1.0 — 2026-09-18

- Preserve committed-intake/direct-order intent, accepted lines/quantities, supplied-price evidence and missing-price scope through handoffs; use `skip_availability: true` for direct ordering.
- Reuse accepted quotes' existing jobs and let later acceptance supersede quote-only intent. Distinguish authorized order creation from optional AR approval and separate message sends.

## 2.0.0

2026-09-10 — Consolidate to main plus job/customer/supplier owners, preserving legacy forwarding. Route by correspondent first and retain original interaction metadata for approvals.

## 1.1.0

2026-08-25 (Bhoumik) — **the router now dispatches rosie's email.** She has her
own mailbox (`chris@localplantsupply.com`), and the `router-all` catch-all in
`plugins/gws/state/routes.json` sends every unclaimed inbound message here.
Adds: identify from sender/subject/attachment names before reading a body, the
email forward shape (MessageId, GmailThreadId, From, Received, Subject,
attachment names), promoting a stable sender to its own `--from` rule while
keeping the catch-all last, and handing **supplier-lifecycle mail** to daisy
rather than routing it to a supplier thread — availability drops, onboarding
and account setup, a changed availability channel, a record correction. The
split with daisy is the subject, not the party: only order and job-request
matters route here. Routing never answers an email.

## 1.0.0

2026-08-23 — Initial version (Bhoumik's rosie restructure). A `router` thread
for messages with no known target — from `main`, the `supplier-events`
fallback, or future unrouted channels: identify the owning `jr-<id>` /
supplier / customer thread, mint and record missing `rosie_thread_id` values,
forward a pointer, escalate to `main` only what needs a human.

(Restored 2026-08-23 after rosie's `skills/agent/` directory was wiped on
disk between harness restarts, same content.)
