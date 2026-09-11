# message-routing — changelog

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
