## Labels

**Every email this thread processes gets the primary `Daisy` label** — that is
how the inbox shows nothing slipped through. Status sub-labels split by who
finishes the email: the router applies `Daisy/Escalated` and
`Daisy/Not Availability` for the terminal cases in [dispatch](dispatch.md); a forwarded email's
status (`Daisy/Catalogued`, `Daisy/Failed`, …) is the dedicated thread's to
apply after processing. (Mail a [routes](routes.md) rule routed directly never passed here —
the dedicated thread applies `Daisy` too.) Known label IDs live in
`skills/agent/availability-ingestion/artifacts/gmail-labels.md` — look them up
live if stale, create missing labels first:

```
gws gmail users threads modify --params '{"userId":"me","id":"<Channel>"}' \
  --json '{"addLabelIds":["<DaisyLabelId>"[,"<StatusLabelId>"]]}'
```

## Judgment calls

Route on the best evidence and say so in the forward ("matched by domain
only"). The dedicated thread can correct a mis-route by forwarding onward —
that costs one message. Reach `main` only for a genuine blocker: the same
address is on file for two unrelated companies, or an email that plainly
matters and matches nothing even after [identify](identify.md)'s escalation. Routine ambiguity is
yours to settle, not Chris's.

Keep this thread's notes lean: `workspace/threads/router/notes.md`
records only open oddities (a sender awaiting an answer from main), never a log
of routine forwards. A one-line daily-note entry covers the day's routing.
