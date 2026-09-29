# Create the supplier row

```sql
INSERT INTO suppliers (name, address, city, state, zip, head_branch_id, daisy_thread_id, rosie_thread_id)
VALUES (...) RETURNING id;
```

- `name` is required; add address parts you have. No email or phone columns:
  the switchboard is a `contacts` row ([contacts](contacts.md)).
- `daisy_thread_id` and `rosie_thread_id`: the same value. A new company gets
  this thread's id (`supplier-<slug>`, made as in `supplier-email-routing` →
  dispatch). A new location copies its head branch's values: one thread per
  company.
- New location of a known company: `head_branch_id` = the company's head
  branch; name it `<Company> - <City or farm>`. A new company is its own head
  branch (leave `head_branch_id` to its default/self).

## Category

Classify each location by its main business and who its customers are, never
by its name. Use several consistent facts (site, catalogue, delivery area,
stated customers, their own materials). A company-wide statement counts for a
location only if it says it covers all locations. Record the evidence.

| Category | Evidence |
|---|---|
| `Grower` | Production at scale (fields, growing grounds, greenhouses) selling to the trade, often to other nurseries and several states. |
| `Wholesale Supplier` | Mainly supplies a regional trade market (landscapers, contractors) from a nursery, yard or distribution site. May grow some; growing alone doesn't make it a Grower. |
| `Retail` | Mainly retail/end customers. |
| `Broker/Platform` | Broker, marketplace or other middleman. Listing plants doesn't make it a Grower. |
| NULL | Evidence is thin or conflicting. Report what is missing. |

Only these four values exist. Never decide from one clue (one greenhouse, one
field, one out-of-state shipment, one customer type) or from words like
"Nursery", "Farms", "Wholesale". Example: a grower that sells to other
wholesalers is a `Grower` (Chris, Chauncey Nichols, 2026-08-24).
