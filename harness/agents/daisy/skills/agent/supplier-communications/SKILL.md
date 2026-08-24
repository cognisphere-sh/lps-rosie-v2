---
name: supplier-communications
description: Everything about talking to a supplier and recording it. Covers the standing authorization rule (never email one unbidden), Chris's email style, composing and sending as Chris on the supplier's own thread, how replies come back, and where a supplier fact belongs. Use when asked to reply to, chase or first contact a supplier, whenever you or they make contact, when initial outreach to a Texas wholesale nursery comes up, and when deciding where to record something a supplier told you. (v4.1.2)
metadata:
  author: lps
  version: "4.1.2"
---

# Supplier communications

Two halves: **replying to a supplier** (only when told to), and **recording
the contact** (always).

## Authorization

Never respond to a supplier's availability email, and never ask a supplier a
follow-up question, unless Chris or Bhoumik explicitly instructs you to. Silently
read and ingest availability by default. A missing price, unclear size, or
incomplete availability is **not** permission to email the supplier — surface it
to Chris/Bhoumik instead.

**LPS is in learning mode** (Chris, 2026-08-21): even the approved outreach
template below needs Chris's explicit per-supplier go-ahead before any send,
and Chris personally handles formal buyer applications for gated high-value
accounts (Southwest Wholesale Nursery is his).

## Chris's email style

Chris rejected a draft as "too wordy" (2026-08-20) and rewrote it. Match his
shape whenever you draft to a supplier: **two to three short, casual lines**, a
concrete question, no preamble or fluff, no restating what they already know —
and **don't mention Texas to a supplier that serves nowhere else**. Assume the
supplier knows what's being asked.

## The Sales & Use Tax permit

Chris stored the **LPS Texas Sales and Use Tax permit** (2026-08-20; `lps`
bucket, `business-documents/local-plant-supply-texas-sales-and-use-tax-permit.pdf`)
to attach to onboarding / account-creation emails: it adds credibility and some
accounts require it. Attach it only on a reviewed, approved send — an attachment is
never a reason to skip the draft-and-approve step.

## Approved light-touch initial outreach — Texas wholesale nursery only

Chris approved this reusable **initial relationship-outreach** template on
2026-08-21. It is **not an availability-list demand**. Use it only for a
**Texas wholesale nursery**, and only after Chris or Bhoumik explicitly
authorizes contacting that particular supplier; template approval does not
replace the standing no-unbidden-email rule. Keep the approved wording except
for `[Name]`, and use the artifact
[`artifacts/texas-wholesale-nursery-initial-outreach.txt`](artifacts/texas-wholesale-nursery-initial-outreach.txt):

```text
Hi [Name],

We’d love to keep you in mind for upcoming projects. What’s the best way to learn about your availability or send plant requests to your team, and is there anything we should know about your delivery areas, minimums, or materials you specialize in?

Thank you,
Chris
```

Follow the composing/sending and recording steps below for any authorized use.

## One thread per supplier

**Each supplier company's conversation is one thread — the
`suppliers.daisy_thread_id` value** (`supplier-<slug>`, one per head branch,
every location row carries it; migration 0064). That is where the email
router forwards their mail and where all onboarding, ingestion and
communication work on that supplier belongs — there are no per-topic
sub-threads. Older `supplier-<id>` and email-subject threads still
exist as history; new work goes to the dedicated thread.

When a request lands somewhere else (`main`, an old thread), redirect it
rather than working it there:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id "<daisy_thread_id>" \
  --from-agent daisy --from-thread-id <ThreadId> \
  --subject "reply request from Chris" \
  --message "<exactly what Chris wants said / conveyed>"
```

The supplier thread composes and sends the reply, then reports what it sent
back via agent-messaging so Chris can be told.

## Composing and sending (on the supplier's thread)

1. **Reread the most recent messages in the Gmail thread** so the reply fits the
   latest sender and conversation state.
2. **Draft first, send second.** Prepare the draft and get Chris's or Bhoumik's
   review and approval **before sending any email**.
3. Send **as Chris** (not Daisy), with Chris's approved signature. When including
   the approved transparent LPS logo, render it **250px wide** so it roughly
   matches the width of "Chris Runyon".
4. Keep it plain-text and short.
5. **Reply in the same Gmail thread** — never start a new thread for an existing
   topic.
6. Record the contact (below) in the same task.
7. Report what was sent back to `main` so Chris can be told.

Sending as Chris rather than Daisy is Chris's instruction (2026-07-14); the
250px logo width is his correction of 2026-07-25.

### How the supplier's reply comes back

**Don't add `gws` routing rules from this thread** — rule management is the
`router` thread's job (`supplier-email-routing` §5: it keeps the catch-all
last, since first matching rule wins and `routes add` appends). The reply
reaches this thread either as the router's forward or directly, when a rule
already routes this supplier's sender here — mention the Gmail thread id in
your notes so the reply is easy to place.

## Recording the contact

**Every exchange with a supplier is recorded in the same task it happens**, in
the supplier thread's `workspace/threads/<daisy_thread_id>/notes.md`: a dated
one-liner per exchange (who wrote, the substance, the Gmail thread id so the
conversation can be found again — `gmailThreadId=<id>`), plus a daily-note
entry. Gmail itself holds the full text — the note is the pointer and the
gist, not a copy. Never write `suppliers.communication_notes`: it is a frozen
pre-2026-08-19 archive (its `supplier_messages` successor was dropped
2026-08-23).

**A routine availability drop is still not a contact event.** A supplier's
price list / availability email gets ingested and labelled — it does **not**
get a contact note. Record the correspondence around it (a reply you sent, a
question they asked), never the drop itself.

## Which place does this fact belong?

- **The supplier thread's `notes.md`** — what was *said*: a dated pointer per
  exchange, both directions, with its Gmail thread id.
- **`suppliers.notes`** — what is *true about* them: **every supplier quirk
  lives here** — preferences, price-list format, parsing tricks, ordering
  constraints, anything durable with no dedicated column. Edited in place as
  facts change. Never put contact history here, and never put a person's
  name, email or phone here — people are `contacts` rows. (The old
  `workspace/suppliers/[<id>]:<Name>/notes.md` dirs are legacy — read-only;
  promote anything durable to `suppliers.notes`.)
- **Nowhere** — task updates, progress notes, minor observations. Persist only
  what long-term consistency depends on.
