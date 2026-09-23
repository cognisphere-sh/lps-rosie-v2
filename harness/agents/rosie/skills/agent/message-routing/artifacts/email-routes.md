## 4. Email routing

Stable known senders and Gmail conversations should route directly to the
customer/supplier thread using the `route-email` skill. First match wins and
`routes add` appends, so the catch-all must stay last. The canonical
catch-all is **main**. Existing `router-all` entries pointing to legacy
`router` should be replaced during routing maintenance; already queued
router messages follow [inbound routing](inbound.md).

Do not auto-forward mail to an external mailbox merely because another agent
cannot read it. Send internal identifiers/evidence to the right agent, then
obtain any required authorization for an actual email forward. Preserve a
single external reply owner for mixed-topic messages.

Track only open decisions/ambiguous routing in thread notes. Contact history
belongs on the customer/supplier thread; job state belongs on the job.
