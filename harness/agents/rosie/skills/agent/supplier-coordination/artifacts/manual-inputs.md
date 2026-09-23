### Chris-directed APS manual AR inputs

While APS is exclusive, Chris may explicitly direct a manual price, size or
supplier-useful note as an APS quote/AR input. On his stated scope, re-read the
active AR, its lines, allocations and supplier state; for an unanswered,
nonterminal APS line, guardedly correct only the LPS-side snapshot fields
(`size`, seeded `unit_price`, `lps_notes`, and an exact mapping when supported).
Preserve the requested name, quantity and allocations unless he explicitly changes
them. A manual APS seed price can be retained with `mapped_inventory_id = NULL`
when it is generic, proxy-based or otherwise not an exact inventory identity; never
map it merely to justify the price. Do not write supplier-answer fields (`status`,
`available_quantity`, `notes`), create a supplier response, infer stock/cultivar or
availability, or send/publish anew because of the correction. Check the header after
the write: if no supplier answer/submission exists and a field-level edit advanced
it to Processing, restore the truthful New state with a guarded update; otherwise
preserve its actual lifecycle state. This authorization is APS-only while exclusivity
holds and does not generalize to another supplier or authorize a job-line change. Complete all independent
work before requesting clarification, including supplier/request lookup,
validated inventory mappings and supported price preparation. Have the job
thread persist known job/item details and qualifying sourcing updates under
`job-requests`; missing answers must not stall that work. Relay completed
work, pricing, other findings and remaining gaps to the job thread so it can
post them in the original request conversation and clarify with the requester.
You may raise any question about the order that affects the availability ask, not only
plant/size allocation. Wait for needed answers before creating/sending the
affected request; APS publication also requires Chris's send approval. Continue
independent research and preparation while waiting, and do not re-ask details
already supplied. Follow `job-requests` for the full intake sequence.
