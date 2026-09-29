# Supplier panel transcript

Every supplier contact is posted to that supplier thread's panel in the same
turn it happens: inbound and outbound. This is the contact history (not
`notes.md`). Post with `bash scripts/webchat/webchat-cli send --text '…'`
(current thread by default; a task thread passes `--thread-id <parent>`).
**Never `--portal`**, or the supplier sees it.

**Broadcast** (availability list, price list, newsletter): header only.

```
**[<Subject>](https://mail.google.com/mail/u/0/?authuser=chris.r@localplantsupply.com#all/<MessageId>)**
From: <From>
<first line of their text>
Attachments: <name>, <name>
```

**Direct message** (addressed to us, either direction): the same header, then
the complete text, quoted. Never a summary instead. Use `To:` for mail you
sent; drop `Attachments:` when there are none.

Keep `?authuser=` (opens the LPS mailbox) and `#all/` (still works after
labelling; `#inbox/` breaks). Link a message you sent only if you know its id.

**Close** with one or two sentences and numbers:

```
Ingested 142 plants across 2 locations: 118 updated, 24 new.
Not a list — a delivery question; replied and logged.
```
