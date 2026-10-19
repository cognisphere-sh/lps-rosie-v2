# Job stages and closing

| Shown as | Stored `status` | When |
|---|---|---|
| Quote | `quoted` | New job. A quote document is not required. |
| Availability | `availability` | An AR was actually delivered to the supplier (`availability_sent`). Optional stage. |
| Committed | `committed` | The customer committed and the supplier order exists. Set by order creation, never by hand. |
| Won | `closed_won` | Chris closes it as won. |
| Lost | `closed_lost` | Chris closes it as lost. |

- Don't make a quote just because the status says Quote.
- Stages don't have to run in order. Ordinary work can skip the quote and go
  to an AR; committed work skips both.
- `archived` is legacy. `sourcing`, `active` and job `confirmed` are retired.
  Never set `confirmed` or use the `supplier_confirmed` job event.
- Old customer-confirmed jobs moved to Committed without orders. Check their
  evidence before preparing any missing order.

## Workflow events

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, '<event>');
```

| Event | Record when |
|---|---|
| `pricing_fetched` | A price lookup was done (even with no match). |
| `quote_shared` | The customer actually received the quote. A draft doesn't count. |
| `availability_sent` | The AR was actually delivered (a partner AR sent from draft, or the public-link email sent). Moves Quote → Availability. |

Events never move a job backward or reopen a closed job.

## Closing

- Only on Chris's explicit won/lost word. Silence is not a lost sale.
- Order: `close_order(orderId, 'closed_won' | 'closed_lost')`. A closed
  order's outcome can't be changed.
- A job can be closed directly if it was lost before any order. Closing the
  last open order closes the job too: Won if any of its orders was won, else
  Lost (0146). Unordered lines don't hold it open, so close an order only
  when the job is really done with that supplier.
- Don't close another customer's order because one job ended. A job's own ARs
  close with it.
- Closed ARs can't be edited. Reopening a job doesn't reopen its ARs; reopen
  an AR only when told (`SELECT public.reopen_availability_request($arId);`:
  submitted, processing, or closed on an open job → New, with a fresh public
  link for a non-partner), and never reuse a public link revoked by closing.
  Nothing returns an AR to New by itself.

## Deleting

- Deleting an AR = `is_active = false` only. Keep its status, submission date
  and token. Inactive ARs are ignored and hidden from the supplier; reopening
  the job doesn't bring them back.
- Restore an AR (`is_active = true`) only when told, after checking its jobs
  and supplier; it keeps its saved state. `hidden` is not a status.
- A public link needed again after reopening gets a fresh token through
  normal publishing, never a revoked one.
- Deleting a whole job retires its ARs (each AR belongs to one job).
- Deleting or deactivating anything needs Chris's explicit word.
