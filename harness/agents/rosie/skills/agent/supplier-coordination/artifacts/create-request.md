1. Read every linked job, active item list, their `note_for_customer` and this
   supplier's existing ARs. Reject
   new work against closed/inactive jobs. Reuse the existing active open
   request for the same sourcing ask; a retry must not create duplicates.
   A closed AR cannot be edited. Shared requests remain open while another
   linked job still needs them; check every `availability_request_jobs` link
   before closing one. Reopening a job leaves its ARs closed; reopen an AR only
   when explicitly instructed and never reuse a token revoked by closure.
   Exclude deleted requests (`is_active=false`) from active work.
2. Include every active job line in the default APS ask, including unlisted
   plants, unless Chris explicitly selects/excludes items. Almost always request
   availability for the **original customer-requested plant and size**, not a
   catalogue proxy, quoted pricing basis or nearest listed size/variant, unless
   Chris specifies a different ask. The APS price list is non-exhaustive and
   merely indicative of items carried; neither a missing catalogue listing
   nor a listed plant/quantity establishes actual supplier availability or
   prevents asking APS about the original plant. For a targeted supplier
   handoff, use the item scope the job thread specified. Snapshot
   requested `name`, `size`, total `demanded_quantity` and every job-item allocation; a
   later job edit must not silently rewrite an ask already sent. A combined
   grower ask can serve multiple jobs, and a job item can span multiple asks.
   Combine compatible lines only within Chris's approved scope and record
   each original job-item id and its allocated quantity. Read customer demand
   from `job_request_items.demanded_quantity`; allocation JSON and
   `availability_request_item_jobs` still use `quantity`. Keep unknown demand
   NULL; known allocations must be positive. Never duplicate one combined
   total onto each linked job.
   Chris's cheapest-supported-requested-option rule selects the quoted
   size/variant based on supported price data, not confirmed stock. The JR's
   quoted-offering `name`/`size` contain only that actual offered plant and one
   actual size; the original demand and any customer-visible substitution note
   stay on the JR. Customer-facing quote notes follow `quote-generation`.
   Select relevant information from `job_requests.note_for_customer` for the AR
   header's `note_for_supplier`, and from each `job_request_items.note_for_customer` for
   that AR line's `note_for_supplier`, under [note ownership](line-notes.md). Preserve
   useful color, alternatives and special requests within the approved ask.
   For shared requests, retain each requirement's job/allocation scope and
   keep incompatible requirements on separate lines.
   Approved pricing proxies do not establish identity or exact AR mappings.
   Missing price entries never mean physical unavailability; `NA`/`available`
   wording requires actual supplier evidence. The quote does not
   silently narrow the supplier ask to that option:
   preserve original requested alternatives and single total quantity unless
   Chris separately resolves AR scope. Do not infer extra quantities, allocation
   or availability from notes for customer recording other supported-option prices. A clear either-option request
   can retain its alternatives without redundant quote clarification; genuinely
   unresolved AR scope still needs resolution before publication.
   If a demand mentions multiple sizes or plants, check that the handoff
   resolves separate requirements versus alternatives and quantity allocation.
   Route unresolved choices to the job thread for clarification before
   creating/sending the affected ask; do not pick an option, combine lines
   or repeat a total quantity across options yourself.
3. **Resolve mapping evidence, supported seed prices or explicit price gaps,
   and allocations before writing.** Check the job handoff and current in-scope
   job rows for a best-effort pricing pass across every row before AR creation:
   retain supplied/accepted prices; save supported APS prices through the job
   owner; for a listed same-size color/variant proxy without standing pricing
   permission, ensure the job owner has presented the actual listed price to
   Chris in the original request chat for a scoped choice before seeding it.
   If rows were skipped, return them to the job owner
   for the pricing pass; a completed pass can still leave explicit NULL gaps
   or a pending proxy choice. Do not invent a price, silently select a proxy,
   or indefinitely block an approved original-plant ask solely on unresolved
   pricing. For an ordinary non-quick-quote request, no quote need be generated.
   Use the atomic creation RPC only after Chris's scoped send approval and
   resolution of supplier-ask scope; an unlisted original plant may have a
   NULL mapped inventory id and NULL price:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_availability_request(
     $supplierId,
     '[{"name":"Live Oak","size":"15 G","demanded_quantity":20,"mapped_inventory_id":null,"unit_price":null,"note_for_supplier":null,"allocations":[{"job_request_item_id":7,"quantity":12},{"job_request_item_id":9,"quantity":8}]}]'::jsonb,
     $shareDetails, $publicToken
   );
   ```

   Use real ids and supported values from the handoff. Known positive
   allocations must sum to the item's requested quantity. If any allocation
   is unknown, preserve it as NULL and keep the combined quantity NULL too;
   do not invent quantities to satisfy the RPC. Orders later require explicit
   positive allocations. The RPC creates
   `availability_request_jobs` and `availability_request_item_jobs` atomically
   with the request and snapshots. These junctions are the only job relationships:
   headers have no `job_request_id` and items have no `job_request_item_id`.
   Header links preserve history even after individual job items are deleted. Use a NULL token for
   private requests and a new UUID for a public request. The app's
   `POST /api/availability-requests` also creates structured requests. Inspect
   current allocations before retrying to avoid duplicate requests or demand.
4. Distinguish genuine substitutions from likely equivalent catalogue names
   using `plant-and-supplier-search`. A supported likely name match may price
   the job directly with a concise internal mapping note; it needs no needless
   alternative label or substitution approval. Preserve the requested name/size
   in the supplier ask. Chris's Agave parryi truncata / Artichoke Parry’s Agave /
   generic Agave Parryi example authorizes pricing, not automatic exact AR mapping
   or availability. Verify actual identity/size for the AR independently; if only
   the pricing equivalence is established, leave mapping NULL rather than
   representing the generic listing as an exact requested item. Seed the proxy
   price only when Chris has accepted it for this AR's scope; otherwise leave
   the price NULL. Known differences or unsupported equivalence still require
   action-specific approval before any alternative ask or supplier-visible
   alternative hint. An exact `mapped_inventory_id` must come from this
   supplier's verified exact plant/size inventory row. An original plant
   without that row remains unmapped, not omitted. Its seed `unit_price` may
   be Chris's accepted proxy price for this AR or another authorized manual
   APS price; otherwise it remains NULL. Keep the original customer-requested
   plant/size/cultivar on the AR line with `mapped_inventory_id = NULL` for a
   proxy. Price acceptance is not acceptance of an alternative offering or
   confirmation of identity/stock. Keep the price basis internal; supplier-
   visible notes must not misrepresent a proxy as an exact match. See
   [manual inputs](manual-inputs.md) for already-open AR corrections.
   **Do not insert empty items and UPDATE
   prices afterward**: an answer-field update is supplier work and would
   incorrectly move the new request to Processing. Use the inventory UUID
   in the job thread's handoff. A mapping with no price may remain unpriced. A near
   size or cultivar is not an exact mapping: leave the mapping NULL. Only
   describe an alternative in supplier-visible `note_for_supplier` after Chris has
   explicitly approved requesting availability for that alternative. Keep
   unapproved candidates in internal research chat and relevant sourcing
   progress notes, and relay the approval question to
   the original request chat; do not leak internal notes into the AR.
   Never replace a supplier-selected mapping with a later search result.
5. Never seed answer `status` or `available_quantity`, or invent supplier response facts.
   Seed only sourcing requirements in the shared `note_for_supplier`.
   NULL answer status means unanswered even with a prefilled price. Request
   and item `note_for_supplier` carry additional information LPS/Chris shares with the
   supplier: customer details, variety/cultivar, special requests, constraints
   and other useful instructions from the job/item `note_for_customer` and Chris.
   Preserve the necessary detail in brief positive supplier-facing wording;
   describe requested specs or genuine questions without forbidding the supplier
   to suggest other sizes/cultivars. See [line note ownership](line-notes.md).
   Examples, only when supported by the ask/evidence: `Needed by Sep 18`,
   `Single trunk only`, `30 G acceptable`, `Is listed Muskogee suitable?`.
   Put only sourcing-relevant shared requirements at request level and
   line-specific requirements on the relevant item. Do not add nonessential
   project headings/customer names (e.g. Radia/Wilkinson), repeat request
   notes on every line, or restate plant, size, quantity or seed price already
   shown by the structured row. An unpriced line needs no `Please price Gilt
   Edge 15 G` note: leave its seed price NULL and use notes only for a real
   sourcing detail or question not conveyed by the row. No generic boilerplate such
   as `Please confirm availability`, `Provide any additional information`,
   or `Let us know if you have questions`. Leave `note_for_supplier` NULL/blank when
   there is nothing useful to add. No internal source comparisons and no
   customer identity unless sharing was authorized. Persist the prepared
   header `note_for_supplier` with a guarded request update after the creation RPC
   (which accepts line notes only), then verify header and line notes before
   sending a link or reporting completion. Creation itself still requires
   publication approval.
6. Partner requests become visible in their portal. Non-partner public links
   use the **configured app origin** plus
   `/public/availability/<public_token>`; never invent the host. Creating a
   public link is not email delivery. Use [email](email.md) for the actual send.
7. Relay AR id, items, allocations, current state, mappings and delivery outcome
   to every affected job thread so each updates useful sourcing progress under
   [job note rules](../../job-requests/artifacts/notes.md). Label a pending
   action accurately, never as a delivered request. Include
   `[Open AR-<id>](ar:<id>)` in internal chat updates. Record
   `availability_sent` only after actual portal delivery/email send, through
   `public.record_job_workflow_event(jobId, 'availability_sent')`. This moves
   each linked Quote job to **Availability**; it does not regress Committed
   or reopen Won/Lost jobs. A prepared public link alone does not advance the
   job. Job Availability is separate from [AR status](responses.md).

Do not silently add lines to an already answered request: coordinate the
changed scope with the job thread. A new line is new work for the supplier;
keep the changed request and internal notes in sync.
