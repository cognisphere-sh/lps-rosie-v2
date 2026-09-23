## 7. Quotes and customer updates

Use `quote-generation` for the output, including quick quotes. Send the
customer-safe draft to `customer-coordination`; obtain any required approval
through `message-routing` in the original request thread. The customer thread
sends exactly the approved content and relays the result here. Only actual
customer delivery records `quote_shared`; save the shared quote link in
`external_notes` without exposing internal notes. A customer confirmation
relayed by the customer thread supplies evidence for **New** order creation
and a **Committed** job, including the direct path without an AR. No quote
output or new customer send is required for already committed intake. Use the
[direct](direct-orders.md) or [AR-backed order](allocated-orders.md) procedures; resolve ambiguous or partial acceptance rather than guessing.
