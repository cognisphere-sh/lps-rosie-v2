# plant-and-supplier-search — changelog

## 1.6.1

2026-08-18. **Description rewritten short** — coverage in a clause or two, then
when to use it. No change to the procedure.

## 1.6.0

2026-08-15 — new §4, *HQ is not stock location*, migrated out of
`knowledge/memory.md` (the memory file is for episodic facts; procedures are
skills). A geographic question may not be answered from `suppliers.state` alone:
check the farm/region evidence on the inventory row too, and state which one the
answer rests on. Everde — Houston HQ, Bunnell FL farm — is the worked example.
Applies until inventory location becomes a structured column. *Answering* renumbers
to §5.

## 1.5.0

2026-08-15, with migration 0050 — **Also known as** and `alias_type` are gone.

Listing now selects from `inventory`; `inventory_enriched` no longer exists. The
view's only contribution over the table was the derived `other_names` column,
which was NULL for 90% of active rows and could not be indexed, so it and the
`plant_alias_names()` function behind it were dropped.

Nothing about matching or ranking changed. The query expander never consulted
`alias_type` — since 0045 it substituted the opposite endpoint of every active
incident edge regardless of type — so the same rows come back in the same order.
The *Also known as* paragraph is removed and the note about alias typing not
restricting reach is restated without reference to a type that no longer exists.

## 1.4.0

2026-08-14, with migration 0046 — search is now ranked rather than gated, and
§1 gains *How it matches and ranks* to say what that changes for an answer.

Two habits have to change. **The row count is no longer "how many we have"**:
retrieval is OR, so `Crape Myrtle Muskogee` returns ~755 rows of which only the
top ~178 match both parts — read `relevance` and the first screen. And **an
unavailable cultivar no longer comes back empty**; it returns the generic plant
ranked below it, so check the returned `cultivar_variety_trade_name` before
telling anyone a supplier carries the selection they asked for. §2's
"empty means nobody carries it" advice is corrected to match.

Also: an empty search returns nothing instantly rather than timing out, so the
standing warning about it is gone.

## 1.3.0

2026-08-14, with migration 0045. Aliases expand the query
(`((live oak) OR (quercus virginiana)) boardwalk`) rather than matching identity
columns, so an alias-reached row is scored like any other text match instead of
ranking below every direct hit. §1 rewritten to match, and gains the diagnosis
to reach for when a cultivar search comes back with the whole species: the alias
type no longer restricts what a pair reaches, so that shape is a bad pair in the
directory, not a search bug.

## 1.2.1

2026-08-14, following migration 0043. `inventory.name` joins its parts with
` - ` rather than bracketing the tail; §1's description of the identity follows.

## 1.2.0

2026-08-14, following migrations 0041 and 0042.

`cultivar_variety_trade_name` holds every selection name the printed name
carries (comma-separated), so its key is now the array `cultivar_keys` — one per
name. §3's fallback-query rule says to test it with `&&` / `= any` rather than
`=`.

§1 gains the fact that **aliases enrich the query per term**: an alias edge is
reached by any contiguous run of query words, not only by the whole query, so
`Live Oak Boardwalk` finds `Quercus virginiana [Boardwalk]` through the
`Live Oak` ↔ `Quercus virginiana` edge. Before 0042 that only worked when the
trigram fallback happened to fire, and it failed through the common name while
working through the botanical one — worth knowing when a search result looks
inconsistent between two names for the same plant on older sessions.

## 1.1.1

2026-08-14, harness 0.8.18 upgrade. Path-only change: the schema doc is now
read from `knowledge/files/SCHEMA.md`. No behaviour change.

## 1.1.0

2026-08-14, following migration 0040. Adds *What a plant's identity is made of*
to §1: the identity lives in three columns (`common_name`, `botanical_name`,
`cultivar_variety_trade_name`) with `inventory.name` composed from them, so a
search can match on any one of the three and the RPC's output says which. Alias
edges are typed — a `cultivar` edge reaches a row only through its cultivar
column, so a trade-name search cannot return generic rows of the same species —
and **Also known as** lists only names not already inside the row's own name.

§2 gains the reading that an empty cultivar result is usually correct: the RPC
fails closed rather than falling back to the species, so confirm by searching
the species alone. §3's key rule is restated for the derived columns: `name` and
all four `*_key` columns are maintained by the database and must never be
written; write the parts.

## 1.0.0

- Initial version: migrated from the *Conventions* section of
  `system_prompts/1-agent.md` and the empty-search gotcha in
  `system_prompts/1.1-supabase.md` when harness 0.8.12 made skills the home for
  procedural memory.
