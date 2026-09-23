## 2. Insert the `suppliers` row

INSERT with whatever you have (`name` is required; add address parts when
present) and **capture the returned `id`**.

- `suppliers` has **no `email` or `phone` column** — the company's own
  switchboard is a `contacts` row like any other ([contacts](contacts.md)).
- **Set `daisy_thread_id` and `rosie_thread_id`** (the same value in both) —
  the company's one dedicated thread per agent. A new
  company gets **this thread's own id** (the router minted it as
  `supplier-<slug of the company name>`; if you are onboarding from a thread
  that isn't shaped that way, mint the value per [supplier-email-routing: dispatch](../../supplier-email-routing/artifacts/dispatch.md)).
  A **new location of a known company copies its head branch's existing
  values** — one thread per head branch, never one per location. (Thread ids
  are per-agent namespaces: the shared string names daisy's thread and rosie's
  order-coordination thread separately.)
- Set `category` only under **Category classification** below. The allowed values
  are exactly `Grower`, `Wholesale Supplier`, `Retail`, and `Broker/Platform`;
  otherwise leave it null.
- If this is a **new location of a company already in the database**, set
  `head_branch_id` to that company's head branch and name the row for the site
  (`<Company> - <City or farm name>`). Leave `head_branch_id` alone otherwise — a
  new supplier is its own head branch by default. If it is a new company that
  turns out to run several sites, report it ([identify](identify.md)).

### Category classification

Classify the **location's primary operating model and customer reach**, not its
name. Collect and weigh multiple, consistent pieces of evidence from the
supplier's site, catalog, delivery/service area, stated customers, and direct
supplier materials. Record the evidence in the report. A company-wide statement
can support a location only when it explicitly applies to that location or all
locations; otherwise classify each location from its own evidence.

- **`Grower`** — evidence shows plant production at scale — fields, growing
  grounds, or greenhouse production — for wholesale trade, often a
  broader/multi-state market. A site called “Green Valley Nursery” that
  documents 200 acres of tree production and supplies wholesale nurseries in
  several states is a `Grower`.
- **`Wholesale Supplier`** — evidence shows a business primarily supplying a
  regional trade market from a nursery, sales yard, or distribution operation.
  It may grow some material, but primarily serves landscapers, contractors, and
  regional trade buyers; growing alone does not make it a `Grower`.
- **`Retail`** — evidence shows a business primarily serving retail/end
  customers: higher-touch operations, pricing, staffing, and buying patterns
  generally not aligned with recurring wholesale sourcing.
- **`Broker/Platform`** — a broker, marketplace/platform, or similar
  intermediary rather than a primary grower or wholesale supplier. Do not
  classify one as a `Grower` solely because it lists plant inventory.
- **Ambiguous or insufficient evidence** — leave `category` null and report the
  competing/missing evidence. Never infer a category from a company name (words
  such as “Nursery,” “Farms,” or “Wholesale”) or from one clue alone (one
  greenhouse, one field, one interstate shipment, or one customer type).

These are operating classifications, not legal labels. A nursery name on a
large interstate grower remains `Grower`; a grower-branded business that serves
regional landscape professionals remains a `Wholesale Supplier` according to
its documented primary model.
