# plant-and-supplier-search — changelog

## 3.1.0 — 2026-09-29

- Candidates (migration 0119): an exact match (including same plant under another name) is the selected candidate; other listed sizes become their own candidates; an unfound plant keeps an unpriced original-ask candidate. Listed names no longer go in `note_internal`.
- No questions about substitutes or alternatives (Bhoumik 2026-09-29): another variant, another-name or substitute listings become candidates without asking; aliases are requested from Daisy only after Chris says the names match.

## 3.0.0 — 2026-09-28

- Rewrite. New `scripts/aps-price` helper (rules + aliases + all sizes with EXACT / nearest smaller / nearest larger in one call). Plant-specific price rules moved to `knowledge/files/price-rules.md`. Same-plant names become aliases via Daisy (Bhoumik 2026-09-25, Chris JR-78/JR-82) instead of refusing aliases. pricing-equivalents and report merged into search.md and SKILL.md.

## 2.28.1 — 2026-09-25

- Corrected Chris's JR-82 message 54 Texas Sedge pricing rule to **1 G only**: recheck current exact and APS generic Sedge 1 G listing (inventory `60960bc6-c56f-40c8-8b70-4727572b2cb6` / PDF `7d950004-0940-4582-a44d-9cbf9ebb1c2a`), not 4-inch or other sizes. Internal notes may state `Texas Sedge 1 G priced from APS Sedge 1 G`, never `proxy pricing`; no identity or stock assertion.

## 2.28.0 — 2026-09-25

- Chris's explicit JR-82 webchat message 54 (18:03:17 CDT) identifies APS generic Sedge 1 G $6.50 as the Texas sedge price and requests future reuse without asking again. Added same-size current generic Sedge pricing rule when the exact listing is absent; no botanical alias, permanent price, stock or exact AR mapping is inferred. Inventory/alias maintenance remains Daisy's domain.

## 2.27.0 — 2026-09-25

- Chris's JR-82 webchat message 40 (17:07:39 CDT) permits generic Texas Sage pricing at other sizes only when current positive APS Green Cloud **and** Compact listings share that exact size and identical price. Check both complete size lists on each use; absent or unequal sizes remain unsupported by this proxy. Preserve generic identity, accepted terms and exact generic listings; no alias, stock, substitution, AR mapping or inventory-row change follows from price parity.

## 2.26.0 — 2026-09-25

- Chris's explicit JR-82 webchat message 38 (17:05:34 CDT): remember his $21 manual pricing guidance for generic 3 G Texas Sage. Keep generic Texas Sage distinct from Green Cloud and Compact despite the matching $21 prices; do not infer cultivar synonymy, an exact APS generic listing, permanent supplier price, live stock or AR mapping. Supplied/accepted terms take precedence.

## 2.25.0 — 2026-09-25

- Chris's explicit JR-82 webchat message 31 (16:53:05 CDT): Lantana price is color-agnostic within the same size and form, but trailing and regular/upright forms are distinct. Clarified that an unqualified generic APS `Lantana` listing alone does not establish a requested form or species price; preserve requested identity and ask for specific price direction when no same-form evidence exists. JR-79's Gold Rush 3 G proxy is not a blanket form permission.

## 2.24.0 — 2026-09-25

- Chris explicitly approved in JR-82 webchat message 17 (16:47:36 CDT): when APS lacks the requested size, find the nearest listed smaller and larger same-plant sizes with positive prices and include both in the reply. Pass both through the job handoff to the original Chris-facing chat rather than reducing the gap to a generic unpriced count. If one direction has no supported listing, say so. These are unrequested options, not automatic substitutions, price proxies or stock confirmation.

## 2.23.0 — 2026-09-25

- Chris's explicit JR-82 webchat messages 3–4 approve current same-size/form APS generic Prosopis Mesquite pricing for Chilean or Honey Mesquite on future requests. Retain requested identity, prefer supplied/accepted terms, recheck current positive APS price, and do not treat this as botanical alias, fixed-dollar price, stock proof, substitute acceptance or exact AR mapping.

## 2.22.1 — 2026-09-25

- Chris's explicit Telegram feedback (message 235): standalone price-only answers no longer need routine “availability unconfirmed” boilerplate. Report price/source and material identity or size qualifications; retain stock caveats when asked or needed to avoid a misleading offer/commitment. Inventory listings still do not prove stock or authorize sourcing commitments.

## 2.22.0 — 2026-09-24

- Chris's explicit JR-79 webchat feedback (message 16, 18:19 CDT): search reordered common-name terms (`Southern Magnolia` / `Magnolia Southern`) before treating the price as missing; verify complete plant identity and requested size, and treat a supported match as naming equivalence, not substitution or stock evidence. This extends the existing name-equivalence procedure rather than creating an alias or proxy permission.

## 2.21.0 — 2026-09-24

- Chris's explicit JR-78 webchat feedback (message 20, 11:08 CDT): when botanical/common-name supplier pricing fails, research other documented names on the internet and retry the selected supplier's price list under them. Preserve identity/size and evidence boundaries; propose each persistent `plant_aliases` relationship to Chris and have Daisy store it only after he explicitly confirms alias identity, not merely a price proxy.

## 2.20.0 — 2026-09-24

- Chris's explicit JR-78 webchat feedback (message 11, 10:47 CDT): document scoped persistent proxy-price permission in the selected proxy inventory item's internal note when he chooses `Use this proxy price always`. Recheck exact match and current same-size positive price on future use; keep cultivar identity, alias, mapping and availability distinct.

## 2.19.0 — 2026-09-24

- Chris's JR-78 webchat message 9 authorizes a reusable same-size APS generic yaupon *pricing proxy* for Pride of Houston when its own size listing is absent. Preserve cultivar identity and live price evidence; do not encode this as a botanical `plant_aliases` equivalence or exact AR mapping.

## 2.18.1 — 2026-09-24

- Bound candidate search output to 20 rows with deterministic ordering; narrow or page before interpreting a capped result as a missing exact match.

## 2.18.0 — 2026-09-23

- Chris's JR-69 clarification: APS's non-exhaustive price list only indicates carried items, not live availability. Neither an absent listing nor a listed quantity proves supplier availability; missing catalogue evidence must not replace or block the original customer plant/size on an approved AR.

## 2.16.0

- Use singular directional note fields: `note_from_customer`, `note_from_supplier`, `note_internal`, `note_for_customer`, and `note_for_supplier`, according to table and audience. Preserve customer/supplier authorship and restrict external rendering to the appropriate recipient.

## 2.15.0

- Let the job owner retain useful research progress in job/item sourcing notes under the simplified note definitions; remove the old no-note-until-eligible restriction. General lookups still create no jobs or outreach.

## 2.14.0

- Separate ordinary search from occasional pricing-equivalence rules and remove duplicated note/quote policy.

## 2.13.0 — 2026-09-21

- Preserve Chris-directed APS manual price, size and supplier-useful note inputs during catalogue research while APS is exclusive; research can corroborate but cannot overwrite the stated scope.
- Clarify that manual/proxy pricing does not prove availability, identity/cultivar or authorize an AR mapping.

## 2.12.0 — 2026-09-18

- Preserve supplied/accepted prices and offerings on committed requests and accepted quotes; search APS for missing prices without requiring an AR or new quote.
- Scope cheapest-requested-option research to unaccepted alternatives so catalogue searches do not replace an already accepted offering.

## 2.11.0 — 2026-09-17

- Chris-approved simpler note default: research findings stay in chat; no every-APS-row entry or duplicate summary. Preserve material proxy/cultivar/source qualifications and pending decisions, not routine catalogue spelling/price restatements; alternative approval gates unchanged.

## 2.10.0 — 2026-09-17

- Chris explicitly asked to remember color-independent rose quote pricing: use a supported same-size generic/color-unspecified rose-series listing without repeated color approval. Preserve demand and distinguish pricing from stock, actual substitution and AR identity.

## 2.9.0 — 2026-09-17

- Chris-authorized concise shared notes: only additional customer-useful exceptions; no phase labels, supplier/price-sheet references or pricing-identity explanations. Preserve phase grouping elsewhere.
- Replace fixed substitution sentences; approved dwarf loropetalum/Purple Pixie pricing retains demand identity. Availability/NA wording needs actual evidence, never missing catalogue pricing; other requested sizes carry supported prices or neutral pricing gaps.

## 2.8.1

- Align research handoffs with Chris's sourcing-note rule: the JR maintains an unlabelled plain-text current summary and latest facts only.

## 2.8.0

- Search every clear requested size/variant option and return the cheapest supported requested option plus all other supported requested-option prices for shared notes, per Chris's updated pricing authorization.

## 2.7.0

- Reference the canonical current sourcing snapshot and row outcome; do not turn research or search history into a notes log or inferred supplier selection.

## 2.6.0

- Scope current job quotes and sourcing exclusively to APS price-list evidence unless Chris explicitly authorizes an exception; preserve research-only and quote-first availability approval boundaries.

## 2.5.0

2026-09-11 — Research all requested sizes and choose the smallest with supported
pricing, not the cheapest or assumed in-stock option, per Chris. Return larger
requested-size prices for shared notes; preserve gaps and unrequested-size gates.

## 2.4.0

2026-09-11 — Add Chris-authorized likely-name-equivalence pricing procedure,
evidence checks and concise sourcing mapping. Explicitly permit his Agave
parryi truncata / Artichoke Parry’s Agave / Agave Parryi pricing example without
claiming botanical identity or availability. Preserve genuine-substitution gates.

## 2.3.0

2026-09-11 — Implement Chris-authorized APS job-row evidence and gap-alternative
research: 1–2 closest supported options, no invented candidates or unauthorized
supplier expansion. Route mandatory APS row notes to the job owner and require
action-specific confirmation before alternative quotes/ARs; standalone and
research-only supplier lookups remain chat-only.

## 2.2.0

2026-09-11 — Include explicit supplier selections and other plant-sourcing
decisions in the note-eligibility rule. Research alone remains chat-only.

## 2.1.0

2026-09-11 — Answer supplier lookups in Chris's original chat first, including
existing-job searches. Research alone creates no sourcing notes or outreach;
apply the job skill's sent-request, required-action or explicit-note rule.

## 2.0.0

2026-09-10 — Focus on pricing evidence and exact matches; APS is default and broader sourcing requires instruction. Remove duplicated job/approval policy.

## 1.2.1

2026-08-29, Bhoumik-approved correction before migration 0081 is applied.
Quoted literal matching is identity-only: composed/common/botanical/cultivar
name can qualify, while size-only and notes-only hits cannot. This keeps the
availability-request price seeder from accepting an unrelated row merely
because its public notes repeat the requested phrase.

## 1.2.0

2026-08-29, with migration 0081. Adds quoted literal plant search: one
outer pair of straight double quotes selects a case-insensitive, escaped literal
substring over identity fields, size, and public notes, bypassing aliases,
normalization, token/spelling variation, and fuzzy matching. Clarifies that this
contract belongs only to `search_inventory`; broad discovery remains the
default and is unchanged.

## 1.1.4

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.1.3

2026-08-19, alongside `job-requests` 1.14.0. **A search answers price, not
availability** — every row is a line off a published price list and its
`quantity` is what that sheet claimed on ingest day, so a hit is reported as a
listing and never as availability. The description drops "availability
question" for "sourcing question" for the same reason.

## 1.1.2

2026-08-18. **Description rewritten short** — coverage in a clause or two, then
when to use it, keeping what makes rosie's copy hers (Austin-Plant-Supply
scoping, the read-only framing). No change to the procedure.

## 1.1.1

2026-08-18. Findings go into a job-request item's `sourcing_notes` — the column
`internal_notes` was renamed to by migration 0061.

## 1.1.0

2026-08-18. Austin Plant Supply (`suppliers.id = 1`) is now the default source
for job-request sourcing (`job-requests` §5), so §1 gains the scoped look-up:
filter `search_inventory`'s result to supplier 1, read the whole size range
that comes back — the closest thing they carry is what gets recommended when
they don't have the ask — and widen past them only on the ladder's terms.

Corrected in the same pass, because the new example rests on it: the RPC takes
only `search` and `fuzzy_ratio`. It has no `supplier_ids` parameter; scoping
and sorting are the caller's, applied as SQL over the result.

## 1.0.0

2026-08-17. Adapted from daisy's `plant-and-supplier-search` v1.6.0 for the
rosie agent: same RPCs, ranking model and answering guidance, plus the
read-only framing — these are daisy's tables; findings go into job-request
`internal_notes` and data problems are reported to daisy rather than fixed.
Track daisy's copy for search-behaviour changes (they ship with migrations) and
fold them in here on approval.
