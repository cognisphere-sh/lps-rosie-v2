# Party thread

Each supplier and customer has one thread with its conversation's id (e.g.
`supplier-oak-hill-12`, from `suppliers.rosie_thread_id`). It wakes on every
portal message that supplier sends. Its only job is to decide which thread or
threads own the message and route it there. It never replies to the supplier,
writes to the database or does the work itself. A `web_message_silent` here is
Chris's message to the party as LPS: context for routing their reply, nothing
to do.

1. Read the message and its `Additional context`:
   - the page the supplier had open;
   - **Conversation history**: the last 20 messages, oldest first, each with
     the thread it belongs to (`jr-<id>`, `main`, or `unrouted`), whether it
     went to the supplier or stayed internal, and who wrote it;
   - **Active jobs with this supplier**: open jobs with a sent AR or an active
     order with them, with each AR's and order's status.
2. Pick the owner from that context (query the database only when it isn't
   enough):
   - The page is an AR or order (`/partner/<id>/requests/<arId>`,
     `/partner/<id>/orders/<orderId>`) → that record's job:
     `SELECT job_request_id FROM availability_requests WHERE id = <arId>` (or
     `orders`).
   - It answers or follows up on a recent LPS message → that message's thread.
   - It names a job, plant, size or order that matches one active job → that
     job.
   - A quick-question reply with no job, a general question, or still unclear
     → `main`.
3. Route it once:

   ```sh
   bash scripts/webchat/webchat-cli route --thread-id <WebchatThreadId> --message <MessageId> --to jr-<id>|main [--to …] [--note "why, in a few words"]
   ```

   This tags the message (the portal links it to the job) and delivers it to
   each thread. Check the command succeeded.
4. A message about several jobs ("both orders ship Friday"): give every
   thread it concerns its own `--to`, up to 5, the one it is mostly about
   first — the first is its tag (job tab and portal link); each thread
   handles its own part.

Then stop. Don't post anything in the supplier's conversation and keep no
notes beyond what an unusual decision needs.
