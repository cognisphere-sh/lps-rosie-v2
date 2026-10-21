# Quick questions to a supplier

For points only the supplier can settle: a conflicting or incomplete answer
Chris couldn't resolve (`job-requests` → supplier responses), a missing price,
quantity or ETA. Never ask what the answer, its note or Chris already
settled, and never ask the same thing twice.

## Approval

Questions about another size, plant or a price need Chris's yes on the exact
questions (asked in his origin chat).
Routine clarifications on an open AR (which line, quantity, ETA) are standing.

## Portal suppliers (`is_lps_partner`)

In the supplier's conversation, as a webchat MCQ questionnaire the supplier
answers in their portal chat (from `jr-<id>`, so it is tagged with the job):

1. One `--portal` line naming the job with its link:
   `Pine Street: a few quick questions about your answers. View availability request: <URL>`
2. Then the questions:
   `bash scripts/webchat/webchat-cli ask --thread-id <conversation> --portal --questions-file /tmp/q.json`

   ```json
   { "title": "Pine Street: quick questions",
     "questions": [
       { "question": "Elaeagnus 5 G: marked available, but your note says only 3 G. Which is right?",
         "options": ["3 G only", "5 G available as marked", "Neither available"] },
       { "question": "Which other Elaeagnus sizes can you supply?",
         "options": ["3 G", "7 G", "15 G"], "multiSelect": true } ] }
   ```

   One question per point, naming plant and size. Two to four short,
   concrete options, the likeliest first; the portal adds "Something else"
   for free text. `"multiSelect": true` when several can be true (sizes,
   delivery days): checkboxes, answered as `3 G; 7 G`. No "(Recommended)", internal notes, other suppliers'
   prices, or JR/AR numbers. All of one AR's points in one questionnaire.
3. The supplier's answers come back as one portal message. Acknowledge
   simply, relay them to the job thread and confirm the proposed AR/JR
   changes with Chris before writing. Do not ask the supplier to Submit
   ([responses](responses.md#supplier-availability-updates-in-chat)).

## Other suppliers

No portal chat: the same questions as a short numbered list with their
options, in an approved email ([email](email.md)).
