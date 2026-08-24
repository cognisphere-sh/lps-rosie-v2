# message-routing — changelog

## 1.0.0

2026-08-23 — Initial version (Bhoumik's rosie restructure). A `router` thread
for messages with no known target — from `main`, the `supplier-events`
fallback, or future unrouted channels: identify the owning `jr-<id>` /
supplier / customer thread, mint and record missing `rosie_thread_id` values,
forward a pointer, escalate to `main` only what needs a human.

(Restored 2026-08-23 after rosie's `skills/agent/` directory was wiped on
disk between harness restarts, same content.)
