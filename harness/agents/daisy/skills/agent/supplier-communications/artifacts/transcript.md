# Supplier contact → the web panel

**Every supplier contact on a supplier thread is posted to that thread's own
web panel, in the same task it happens** — inbound and outbound, email and
relayed text. **That transcript is the contact history**; `notes.md` is not.
Post with `bash scripts/webchat/webchat-cli send --text "…"` — no
`--thread-id` (it defaults to the current thread) and **never `--portal`**,
which would show it to the supplier. None of this reaches `main` or Telegram,
so the bar for messaging Chris is untouched.

**How much you post depends on which of two kinds it is.**

**Broadcast** — an availability drop, price list, newsletter: anything sent to
a list rather than to us. Header only, never the body:

```
**[<Subject>](https://mail.google.com/mail/u/0/?authuser=chris.r@localplantsupply.com#all/<MessageId>)**
From: <From>
<first line of their text>
Attachments: <name>, <name>
```

**Direct communication** — anything actually addressed to us, **either
direction**: their reply or question, and every email you send. Same header,
then the **complete text, quoted**. A summary never stands in for it:

```
**[<Subject>](…#all/<MessageId>)**
From: <From>

<the complete message text>
```

Use `To:` for one you sent. Drop `Attachments:` when there are none. Two parts
of the link are load-bearing: `?authuser=` pins it to the LPS mailbox rather
than the reader's default Google account, and `#all/` survives the `Daisy/*`
labelling that moves mail out of the inbox — `#inbox/` 404s once labelled.
`MessageId` and `From` come off the `email_received` metadata, and a router
forward carries them too; a message *you* sent has no inbound id, so link it
only if you know its id.

**When you have finished with it** — one or two sentences, **with the
numbers**: what changed in the database, or what it turned out to be if
nothing did. No preamble, no restating the email:

```
Ingested 142 rows across 2 locations — 118 updated, 24 new, 6 aliases added.
Not an availability drop — a delivery question; replied and logged.
```
