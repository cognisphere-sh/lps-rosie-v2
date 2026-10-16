-- Run after 0142 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0142 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
-- Reads the live plant_aliases (Japanese Maple = Acer palmatum, Whale's
-- Tongue Agave = Agave ovatifolia, Spatterdock = Nuphar lutea).
DO $$
DECLARE got text;
BEGIN
  IF public.plant_word_distance('mapel', 'maple') <> 1
     OR public.plant_word_distance('japanse', 'japanese') <> 1
     OR public.plant_word_distance('palmatum', 'falcatum') <> 2 THEN
    RAISE EXCEPTION 'plant_word_distance is wrong';
  END IF;

  -- Each query, with the alias names it must (or must not) add.
  SELECT string_agg(f.q, ', ') INTO got FROM (VALUES
      ('japanese maple',        'acer palmatum',    'exact'),
      ('japanse maple',         'acer palmatum',    'close'),
      ('japanese mapel',        'acer palmatum',    'close'),
      ('acer palm',             'japanese maple',   'close'),
      ('bloodgood japanse maple 15 gal', 'acer palmatum bloodgood', 'close'),
      ('whale tongue',          'agave ovatifolia', 'close'),
      ('whale''s tongue 15 g',  'agave ovatifolia', 'close'),
      ('spaterdock',            'nuphar lutea',     'close'),
      ('palmatum',              'japanese maple',   'partial'),
      ('palmatun 15 gal',       'japanese maple',   'partial')
    ) f(q, alias, how)
  WHERE NOT EXISTS (SELECT 1 FROM public.search_query_groups(f.q) g
                    WHERE g.t = f.alias AND g.alias_match = f.how
                      AND cardinality(g.alias_ids) > 0);
  IF got IS NOT NULL THEN RAISE EXCEPTION 'alias missing for: %', got; END IF;

  SELECT string_agg(f.q, ', ') INTO got FROM (VALUES
      ('japanese'),                     -- 32 pairs: too common for a partial
      ('pyrus bradford pear'),          -- not prickly pear
      ('salvia coccinea'),              -- not scarlet oak
      ('rosemary prostrata trailing'),  -- not Yucca rostrata
      ('salvia may night'),             -- `night` is not an unfinished `nightglow`
      ('rake')                          -- four letters take no typo
    ) f(q)
  WHERE EXISTS (SELECT 1 FROM public.search_query_groups(f.q) g
                WHERE g.alias_match IN ('close', 'partial'));
  IF got IS NOT NULL THEN RAISE EXCEPTION 'unwanted alias for: %', got; END IF;

  IF EXISTS (SELECT 1 FROM public.search_query_groups('palmatum') g WHERE g.t = 'holly fern') THEN
    RAISE EXCEPTION 'palmatum read as a typo of falcatum';
  END IF;

  -- Sizes still parse as one phrase group.
  IF NOT EXISTS (SELECT 1 FROM public.search_query_groups('whale tongue 15 gal') g
                 WHERE g.is_size AND g.t = '15 g') THEN
    RAISE EXCEPTION 'size group lost';
  END IF;

  -- End to end: a misspelt alias finds the rows listed only by the other name.
  IF NOT EXISTS (SELECT 1 FROM public.search_inventory('japanse maple') s
                 WHERE s.name ILIKE 'acer palmatum%' AND s.name NOT ILIKE '%japanese%') THEN
    RAISE EXCEPTION 'japanse maple misses Acer palmatum rows';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.search_inventory('whale tongue') s
                 WHERE s.supplier_id = 1 AND s.name ILIKE 'agave ovatifolia%') THEN
    RAISE EXCEPTION 'whale tongue misses APS Agave ovatifolia';
  END IF;
  -- Quoted search stays literal.
  IF EXISTS (SELECT 1 FROM public.search_inventory('"japanse maple"') s
             WHERE s.name NOT ILIKE '%japanse maple%' AND coalesce(s.common_name, '') NOT ILIKE '%japanse maple%'
               AND coalesce(s.botanical_name, '') NOT ILIKE '%japanse maple%'
               AND coalesce(s.cultivar_variety_trade_name, '') NOT ILIKE '%japanse maple%') THEN
    RAISE EXCEPTION 'quoted search expanded';
  END IF;
  RAISE NOTICE '0142 asserts passed';
END $$;
