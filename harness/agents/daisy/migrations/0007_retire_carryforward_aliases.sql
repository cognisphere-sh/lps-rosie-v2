-- 0007: retire the 0005 alias carry-forward, which was a net negative
-- Applied 2026-07-31 as migration 046a.
--
-- 0005 step 042e copied each base name's "clean" aliases onto the new
-- cultivar-bearing name so alias lookups would survive the name_key change.
-- Two flaws made it the single largest source of search false positives:
--
--   1. It ran BEFORE the 0006 cultivar cleanup, so it snapshotted a graph that
--      was still full of cultivar aliases.
--   2. Its "clean" filter only excluded quoted epithets and patent/trademark
--      markers. Unquoted cultivar compounds ("Redbud Pink Pom Pom", "Merlot
--      Eastern Redbud") passed straight through, and so did sibling *species*
--      -- "Redbud [Forest Pansy]" inherited "Cercis mexicana", "Cercis
--      texensis" and "Cercis chinensis" from the generic hub "Redbud", making
--      one cultivar reachable from every relative of its base name.
--
-- 48,269 of the 64,044 inserted pairs were still active and are retired here.
-- Nothing is re-added: re-deriving even the botanical link needs a trustworthy
-- epithet dictionary, and the one available is polluted (see 0006's residue
-- note). The durable fix is to reparse sources so inventory.name carries the
-- printed common-first identity itself -- "Redbud, Forest Pansy [Cercis
-- canadensis, Forest Pansy]" -- which needs no alias hop at all.
--
-- Cost, recorded honestly: of 40,715 active bracketed rows only 4,378 are still
-- reachable through the alias graph. Rows whose name already contains the
-- botanical name are still found by text search; rows whose common name was
-- never stored in inventory are not, and only a reparse can recover it.

UPDATE public.plant_other_names p
SET is_active = false
FROM public.name_consolidation_map m
WHERE m.new_name = p.name AND p.is_active;
