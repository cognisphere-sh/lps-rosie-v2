---
name: supplier-communications
description: Everything about talking to a supplier about their lifecycle, and recording it. Covers the split with rosie (lifecycle is yours, orders are hers), the standing authorization rule (never email one unbidden), Chris's email style, composing and sending as Chris on the supplier's own thread, how replies come back, and where a supplier fact belongs. Use when asked to reply to, chase or first contact a supplier, whenever you or they make contact, when initial outreach to a Texas wholesale nursery comes up, and when deciding where to record something a supplier told you. (v6.1.0)
metadata:
  author: lps
  version: "6.1.0"
---

# Supplier communications

Two halves: **replying to a supplier** (only when told to), and **recording
the contact** (always).

## What is yours to say, and what is rosie's

You own **supplier lifecycle management** and the communication about it:
onboarding and account setup, credit and tax paperwork, how availability
reaches us (a new channel, a new format, a new contact for it), corrections to
the supplier's own record, and anything about a price list or availability
drop itself. You say those from `chris.r@localplantsupply.com`.

**Rosie owns every communication about an order or a job request** — an
availability ask for a specific job, pricing on it, a substitute, a delivery
date, a follow-up — from her own mailbox, `chris@localplantsupply.com`.

**The line is the subject, not the party.** A lifecycle matter is yours even
while rosie is mid-order with that supplier; an order matter is hers even on
first contact. When mail reaching your inbox is really an order matter, **do
not answer it** — quote it to the supplier thread's panel and hand it to rosie:

```bash
bash scripts/agent-msg/send --to-agent rosie --thread-id router \
  --subject "email: order matter for you — <supplier>" \
  --message "Reached daisy's inbox (chris.r@localplantsupply.com); yours to answer.
MessageId: <MessageId>
GmailThreadId: <Channel>
From: <sender>
Subject: <subject>
Matched supplier row(s): <id(s) + name(s)>"
```

She cannot read this mailbox. If she needs the message itself rather than the
gist, `gws gmail +forward` it to `chris@localplantsupply.com` and say that is
where it went. When a single email carries both — an availability drop *and* a
question about an open order — ingest the drop and hand the order half over.

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
2. **Draft first, send second.** Put the draft to Chris **on this thread's own
   web panel** (`webchat-cli send`, never `--portal`) and wait for his
   approval of that exact text. This is a minor approval and it belongs here —
   not on `main`, which is for urgent escalations over Telegram only.
3. Send **as Chris** (not Daisy), with Chris's approved signature. When including
   the approved transparent LPS logo, render it **250px wide** so it roughly
   matches the width of "Chris Runyon".
4. Keep it plain-text and short.
5. **Reply in the same Gmail thread** — never start a new thread for an existing
   topic.
6. Record the contact (below) in the same task.
7. The quoted send on this thread's panel (step 6) is the report — `main`
   hears nothing about a routine exchange.

Sending as Chris rather than Daisy is Chris's instruction (2026-07-14); the
250px logo width is his correction of 2026-07-25.

### How the supplier's reply comes back

**Don't add `gws` routing rules from this thread** — rule management is the
`router` thread's job (`supplier-email-routing` §5: it keeps the catch-all
last, since first matching rule wins and `routes add` appends). The reply
reaches this thread either as the router's forward or directly, when a rule
already routes this supplier's sender here.

**A reply is direct communication, so it is quoted in full to this thread's
web panel** the moment it lands — subject as a Gmail link, sender, complete
text — and a short numeric close goes up when you have dealt with it
(*Supplier contact → the web panel* in your prompt). Internal: **no
`--portal`**, or the supplier reads the team's notes about them.

## Recording the contact

**Every exchange with a supplier is recorded in the same task it happens — in
this thread's own web panel, quoted in full**, both directions (*Supplier
contact → the web panel*). **That transcript is the contact history.** It is
not a summary of one: a paraphrase never stands in for the text, because the
panel is where the team reads what was actually said without going to Gmail.

**`notes.md` gets no communication log.** It is for what must outlive the
exchange — an open loop still owed an answer, a commitment made. A closed
exchange leaves nothing behind there. Durable facts about the supplier go to
`suppliers.notes`, and the day's work still gets its daily-note entry. Never
write `suppliers.communication_notes`: it is a frozen pre-2026-08-19 archive
(its `supplier_messages` successor was dropped 2026-08-23).

**A routine availability drop is not direct communication.** A price list or
availability email is a **broadcast** — it gets the header-only panel block
(subject link, sender, first line, attachment names), never its body quoted,
and no contact record. The correspondence *around* it — a reply you sent, a
question they asked — is direct, and is quoted in full.

## Which place does this fact belong?

- **The supplier thread's web panel** — what was *said*: the full text of
  every direct exchange, both directions, with its Gmail link. The transcript
  is the contact history; nothing about it is copied into `notes.md`.
- **The supplier thread's `notes.md`** — only what must outlive the exchange:
  an open loop still owed an answer, a commitment made. Never a contact log.
- **`suppliers.notes`** — what is *true about* them: **every supplier quirk
  lives here** — preferences, price-list format, parsing tricks, ordering
  constraints, anything durable with no dedicated column. Edited in place as
  facts change. Never put contact history here, and never put a person's
  name, email or phone here — people are `contacts` rows. (The old
  `workspace/suppliers/[<id>]:<Name>/notes.md` dirs are legacy — read-only;
  promote anything durable to `suppliers.notes`.)
- **Nowhere** — task updates, progress notes, minor observations. Persist only
  what long-term consistency depends on.
