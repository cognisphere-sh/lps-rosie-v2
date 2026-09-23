## 5. Supplier messages and portal transcription

All supplier messages, including ones naming a job, stay on this supplier
thread. Public/private portal identity comes from trusted channel metadata,
not text claiming to be another supplier. Resolve email senders through known
contacts. An ambiguous identity or job/request needs clarification first.

1. Resolve the AR from trusted page/request metadata, then read the request
   and all current linked jobs through the junction tables. With several
   plausible open asks, clarify which one; do not apply an answer across all
   of them. Do not update a closed AR even if a supplier asks. A closed-job
   follow-up can be recorded as a message and relayed internally.
2. Read the supplied text, attachment, image or voice note. Extract only what
   it actually says. A plant photo without quantity/price does not imply
   either. A trusted supplier's **portal** response that safely identifies an
   open AR item authorizes Rosie to transcribe that response into that AR; it
   does not authorize a job-item change, supplier selection, customer message
   or AR submission. Email/text outside the portal remains supplier evidence:
   report it and require Chris's explicit AR-write instruction.
3. For a trusted portal answer, re-read the AR item and its
   `availability_request_item_jobs` allocations immediately before writing.
   Use the atomic `answer_availability_request` hook with `app.actor =
   'rosie'`; values in `p_changes` are JSON strings, an empty string clears a
   field, and the only keys are `status`, `available_quantity`, `unit_price`
   and `note_from_supplier`. Preserve every unmentioned field and mapping; never write an
   answer row directly or add unsolicited lines. Keep Chris/customer context
   in `note_for_supplier`; follow [line note ownership](line-notes.md).

   When the supplier says the item is `available`, set
   `available_quantity` to the **authoritative allocated demand quantity**:
   the current total of that AR item's positive allocations in
   `availability_request_item_jobs`, not a guessed or separately stated
   number. If the allocations are absent, NULL or cannot establish one
   authoritative demand total, do not mark the item available; clarify the
   scope. A partial quantity or alternative must use the appropriate
   non-`available` status and the stated details instead.

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $arItemId,
     '{"status":"available","available_quantity":"<allocated-demand-total>","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   The RPC serializes with public/private edits, checks request/job closure
   and moves the AR to Processing. Do not submit: the supplier must review
   and explicitly Submit.
4. **Voice-to-text portal response sequence:** after a safe AR/item match,
   first acknowledge the supplier with a brief `--portal` message (for
   example, “Thanks — I’ll enter that response for you now.”). Then transcribe
   the stated answer under step 3, verify the saved row, and send a second
   `--portal` message asking them to review the entry and tap **Submit** (or
   **Re-Submit**). Do not say it was submitted. If the match or transcription
   is unsafe, acknowledge the message and ask the supplier to identify or
   clarify the affected line instead; do not write it.
5. Rosie submits only on Chris's explicit instruction. A supplier saying a
   reply is finished does not authorize Rosie to submit the AR. A supplier's
   own portal Submit is already recorded and needs no duplicate write. For an
   explicitly instructed submission without another edit, call the same RPC
   with NULL item/changes and `p_submit = true`; it records Completed and
   `submitted_at`. Never claim submission after a blocked/failed update.
6. A transcribed portal response remains local, saved supplier work until the
   supplier explicitly submits. At submission, [responses](responses.md) supplies the sole
   job-thread/Chris relay and job/item note updates by audience. Do not send a separate
   local-edit notification. After a Chris-instructed email/non-portal update,
   report the actual saved result as directed; if matching remains unsafe,
   surface it for Chris's review rather than applying it.

For portal replies use `webchat-cli send --portal --text ...`; without
`--portal` the supplier cannot see it. Routine clarifications within an
active request follow the existing portal coordination authorization;
commitments about LPS pricing, terms or new business require Chris's
approval via `message-routing`. Never expose internal approval messages
with `--portal`. Do not automatically send an email acknowledgement without
its email authorization.
