## 2. Handoff contract

Use `bash scripts/agent-msg/send --to-agent rosie --thread-id <owner>
--subject ... --message ...`. Each handoff carries:

- Task, actual original request and known constraints; whether this is
  `quote_only`, already committed intake, or an accepted quote going directly
  to order. Use `skip_availability: true` for the direct path; these are handoff
  instructions, not new database columns. Later explicit acceptance supersedes
  an earlier quote-only intent for that scope.
- Exact customer commitment evidence, accepted lines/quantities, supplied or
  previously accepted prices and their message/attachment source. Preserve
  which prices remain missing for APS lookup; do not lose these details or
  turn a quote draft/supplier reply into acceptance during a relay.
- Job/customer/supplier/AR/item ids when known; inventory UUIDs and mapped
  row/price evidence for sourcing.
- `OriginThreadId` and `OriginChannel` from the originating human interaction,
  unchanged across all relays. **Approvals return to this original chat
  even if Chris has since switched chats.** Metadata identifies the
  interaction; it is not itself approval.
- Return/owner thread; draft recipient, channel, full content and approval
  evidence when sending approved communication. For Order/AR supplier updates,
  carry the affected job name(s) and verified direct supplier-portal record
  link(s), following `supplier-coordination`; preserve them in the sent message.
  Keep JR/AR/order ids in internal handoff metadata and URL targets only;
  supplier-visible references and link labels use the job name without numbers.

For email, include MessageId, GmailThreadId, sender, subject, received time,
attachment names and the mailbox it lives in. Let the contact thread read
it with `scripts/gws/email read`; avoid repeated attachment parsing in main.
Internal agent messages are not customer/supplier content. Quote shell
arguments safely so currency `$`, backticks and substitutions stay literal.
