1. Read every linked job, active item list and this supplier's existing ARs. Reject
   new work against closed/inactive jobs. Reuse the existing active open
   request for the same sourcing ask; a retry must not create duplicates.
   A closed AR cannot be edited. Shared requests remain open while another
   linked job still needs them; never close one based only on its legacy job
   anchor. Follow database lifecycle hooks on reopening and never reuse a
   revoked link.
2. Include every active job line in the default APS ask, including unlisted
   plants, unless Chris explicitly selects/excludes items. For a targeted
   supplier handoff, use the item scope the job thread specified. Snapshot
   requested `name`, `size`, total `quantity` and every job-item allocation; a
   later job edit must not silently rewrite an ask already sent. A combined
   grower ask can serve multiple jobs, and a job item can span multiple asks.
   Combine compatible lines only within Chris's approved scope and record
   each original job-item id and its allocated quantity. Keep unknown demand
   NULL; known allocations must be positive. Never duplicate one combined
   total onto each linked job.
   Chris's cheapest-supported-requested-option rule selects the quoted
   size/variant based on supported price data, not confirmed stock. The JR's
   quoted-offering `name`/`size` contain only that actual offered plant and one
   actual size; the original demand and any customer-visible substitution note
   stay on the JR. Shared notes follow `quote-generation`: only necessary
   short customer-useful exceptions, no phases or pricing-basis explanations.
   Approved pricing proxies do not establish identity or exact AR mappings.
   Missing price entries never mean physical unavailability; `NA`/`available`
   wording requires actual supplier evidence. The quote does not
   silently narrow the supplier ask to that option:
   preserve original requested alternatives and single total quantity unless
   Chris separately resolves AR scope. Do not infer extra quantities, allocation
   or availability from shared notes recording other supported-option prices. A clear either-option request
   can retain its alternatives without redundant quote clarification; genuinely
   unresolved AR scope still needs resolution before publication.
   If a demand mentions multiple sizes or plants, check that the handoff
   resolves separate requirements versus alternatives and quantity allocation.
   Route unresolved choices to the job thread for clarification before
   creating/sending the affected ask; do not pick an option, combine lines
   or repeat a total quantity across options yourself.
3. **Resolve mappings, prices and allocations before writing.** Use the atomic
   creation RPC after quote completion, send approval and scope clarification:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_availability_request(
     $supplierId,
     '[{"name":"Live Oak","size":"15 G","quantity":20,"mapped_inventory_id":null,"unit_price":null,"lps_notes":null,"allocations":[{"job_request_item_id":7,"quantity":12},{"job_request_item_id":9,"quantity":8}]}]'::jsonb,
     $shareDetails, $publicToken
   );
   ```

   Use real ids and supported values from the handoff. Known positive
   allocations must sum to the item's requested quantity. If any allocation
   is unknown, preserve it as NULL and keep the combined quantity NULL too;
   do not invent quantities to satisfy the RPC. Orders later require explicit
   positive allocations. The RPC creates
   `availability_request_jobs` and `availability_request_item_jobs` atomically
   with the request and snapshots. These junctions are authoritative; legacy
   scalar job/item fields are compatibility anchors only. Use a NULL token for
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
   the pricing equivalence is established, leave mapping and seed price NULL
   rather than representing the generic listing as an exact requested item.
   Known differences or unsupported equivalence still require action-specific
   approval before any alternative ask or supplier-visible alternative hint.
   The mapping/price supplied to the RPC must come from this supplier's
   exact plant/size inventory row. **Do not insert empty items and UPDATE
   prices afterward**: an answer-field update is supplier work and would
   incorrectly move the new request to Processing. Use the inventory UUID
   in the job thread's handoff. A mapping with no price may remain unpriced. A near
   size or cultivar is not an exact mapping: leave the mapping NULL. Only
   describe an alternative in supplier-visible `lps_notes` after Chris has
   explicitly approved requesting availability for that alternative. Keep
   unapproved candidates in internal research chat (a material pending decision
   may qualify for concise sourcing notes) and relay the approval question to
   the original request chat; do not leak internal notes into the AR.
   Never replace a supplier-selected mapping with a later search result.
5. Never seed answer `status`, `available_quantity` or supplier `notes`.
   NULL answer status means unanswered even with a prefilled price. Request
   and item `lps_notes` contain only short, specific statements or keywords
   that help this supplier answer: additional context, constraints or useful
   hints. Examples, only when supported by the ask/evidence: `Needed by Sep 18`,
   `Single trunk only`, `30 G acceptable`, `Is listed Muskogee suitable?`.
   Put shared context at request level and plant-specific details on the
   relevant item. Do not repeat request notes on every line or restate the
   plant/size/quantity already shown. No generic or repeated boilerplate such
   as `Please confirm availability`, `Provide any additional information`,
   or `Let us know if you have questions`. Leave `lps_notes` NULL/blank when
   there is nothing useful to add. No internal source comparisons and no
   customer identity unless sharing was authorized.
6. Partner requests become visible in their portal. Non-partner public links
   use the **configured app origin** plus
   `/public/availability/<public_token>`; never invent the host. Creating a
   public link is not email delivery. Use [email](email.md) for the actual send.
7. Relay AR id, items, allocations, current state, mappings and delivery outcome
   to every affected job thread so each updates qualifying supplier entries under [job note rules](../../job-requests/artifacts/notes.md). Unsent requests qualify only for a concrete pending action or
   explicit note instruction or a material sourcing decision;
   label any pending action accurately, never as a delivered request. Include
   `[Open AR-<id>](ar:<id>)` in internal chat updates. Record
   `availability_sent` only after actual portal delivery/email send, through
   `public.record_job_workflow_event(jobId, 'availability_sent')`. This moves
   each linked Quote job to **Availability**; it does not regress Committed
   or reopen Won/Lost jobs. A prepared public link alone does not advance the
   job. Job Availability is separate from [AR status](responses.md).

Do not silently add lines to an already answered request: coordinate the
changed scope with the job thread. A new line is new work for the supplier;
keep the changed request and sourcing notes in sync.
