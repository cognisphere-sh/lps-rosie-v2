# Capture one input

Write a small JSON file under `/tmp`, preserving the wording and source:

```json
{"id":"telegram:chat-id:message-id","date":"2026-09-23","source":"telegram","title":"Chasing supplier replies","text":"Chasing suppliers eats my mornings.","destination":"(watching)"}
```

Use the actual originating message ID (include channel/chat to avoid collisions)
and inbound date in America/Chicago. For a relayed message preserve that identity;
otherwise use a stable agent-message ID prefixed by the sender. No random ID on
retry. `source` is telegram/rosie/daisy/nova. `destination` defaults to `(watching)`;
it may be `(answered)`, a requirement slug or `business/topic.md`.

```sh
skills/agent/feedback-loop/scripts/capture-feedback --input /tmp/feedback.json
```

The helper appends to `knowledge/files/feedback.md` under a file lock and fsyncs.
It returns `recorded` or `already-recorded`, never the whole log. Repeating the
same ID/content is safe; changed content or an incomplete prior entry fails. Append a
correction with its own source ID instead of rewriting raw evidence. Use the
helper for all new captures so parallel task threads honor the same lock.
It neither routes messages nor changes requirements. A failed capture needs
repair before claiming the feedback was saved.

Log every substantive business/app remark, including complaints and workarounds.
Don't flatten Chris's words into abstract product language. Operational status
questions go to Rosie/Daisy; log only workflow insight. Answer what you can,
otherwise leave `(watching)` and continue. Ask at most one useful question.

For patterns, search handles/dates/terms and read only matching slices. Don't
scan the whole log on each arrival. When an old input gains a requirement,
append a dated link/correction referring to its original handle; retain the
original text. Update current interpretation in business/requirements files.
