### Job names and portal links in supplier updates

Every supplier-facing message about an Order or availability request (AR)
update must identify it by the **job name** and include a **clickable direct
link to that Order or AR in the supplier's portal**. Apply this to portal
chat, email, acknowledgments, clarifications and follow-ups. Use only the job
name as the visible reference: do not add JR, AR or order numbers in message
subjects, body text or link labels. Internal ids remain available for record
lookup and may remain in the actual portal URL; do not strip or alter them.

- Read the current job name from `job_requests` through the actual order/AR
  allocations. For shared records, name each job affected by the update and
  make clear which change belongs to which job; do not assume the legacy
  scalar job id is the complete relationship. Do not invent a name. If the
  name is missing, resolve it with the job owner before sending.
- Use the configured app origin and the verified supplier/record ids:
  Order: `/partner/<supplierId>/orders/<orderId>`;
  AR: `/partner/<supplierId>/requests/<arId>`. Send an absolute URL to the
  specific record, not the portal home, an internal admin page or API endpoint.
  For a non-partner AR, use its existing authorized public request URL
  (`/public/availability/<token>`) so the recipient can open it. Never invent
  a token or publish/change access merely to create a link.
- Link text can be `View order` or `View availability request`; use a clickable
  absolute URL in plain-text channels and a proper anchor in HTML email.
  Verify the target belongs to this supplier and matches the record discussed.
  For multiple records, include each relevant link next to its job reference.
- This instruction explicitly authorizes using the affected job name in these
  supplier messages without a separate customer-details approval. It does not
  authorize sharing unrelated customer details or changing the portal's
  `share_customer_details` setting. Keep internal sourcing and approval chatter
  out of the message. Existing authorization rules for the send itself apply.

Message shape: `<Job name>: <brief update>. View order: <absolute order URL>`
or `<Job name>: <brief update>. View availability request: <absolute AR URL>`.
Resolve these placeholders from current records before sending.
