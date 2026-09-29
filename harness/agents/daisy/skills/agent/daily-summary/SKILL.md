---
name: daily-summary
description: Write the 9 AM daily summary for Chris and Bhoumik from yesterday's daily note. Includes what to read, the short format, what to leave out, and the hand-off to main for Telegram. Use when the daisy-daily-9am-checkin schedule fires, or when asked for a summary of a day. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Daily summary

Runs on `daily-9am-checkin`. Do it in this thread: no task thread.

1. Read yesterday's note once: `workspace/daily_notes/<YYYY-MM-DD>.md`
   (America/Chicago calendar day; work after midnight belongs to the next
   summary). Open a thread's `notes.md` only to check whether a blocker or
   approval is still open. Check this thread's `notes.md` for items main asked
   to include and for things already resolved (don't repeat those).
2. Write it for Chris: plain business words, numbers, no tool or process
   talk, no tables, no standing caveats. At most about 12 short lines:

   ```
   Daisy — <Mon Sep 28>
   Lists loaded: <N> suppliers, <plants> plants (<new> new). Biggest: <Supplier> <n>.
   Unchanged lists skipped: <N>.
   New suppliers/contacts: <…>
   Waiting on you: <question — link> (one line each, oldest first)
   Problems: <failed or parked lists, one line each>
   Next: <what Daisy will do today, if anything notable>
   ```

   Leave out empty lines. Nothing happened → one line saying so.
3. Send it to `main`:
   `bash scripts/agent-msg/send --to-agent daisy --thread-id main --message '<summary>'`
   with the first line "Daily summary — send to Telegram as-is." Main sends
   the text unchanged; it doesn't rewrite it.
4. Update this thread's `notes.md`: remove items now reported or resolved.
