-- Read-only PostgreSQL fixture for migration 0081's quoted identity predicate.
-- Pass condition: zero rows. It can run before apply because it tests the exact
-- escaped-ILIKE expression over values, without reading or writing catalogue data.
WITH fixtures(
  label, name, common_name, botanical_name, cultivar_name, size, notes,
  term, expected
) AS (
  VALUES
    ('composed identity', 'Search Term - Botanical', '', '', '', '', '',
     'search term', true),
    ('common identity', '', 'Search Term', '', '', '', '',
     'search term', true),
    ('botanical identity', '', '', 'Search termensis', '', '', '',
     'search term', true),
    ('cultivar identity', '', '', '', 'Search Term Gold', '', '',
     'search term', true),
    ('size only excluded', '', '', '', '', 'Search Term', '',
     'search term', false),
    ('notes only excluded', '', '', '', '', '', 'Search Term',
     'search term', false),
    ('literal wildcard positive', '100%_\ specimen', '', '', '', '', '',
     '100%_\', true),
    ('literal wildcard negative', '100XXa\ specimen', '', '', '', '', '',
     '100%_\', false),
    ('apostrophe literal', 'O''Brien Oak', '', '', '', '', '',
     'o''brien', true),
    ('double quote literal', 'A "Quoted" Plant', '', '', '', '', '',
     '"quoted"', true)
), patterns AS (
  SELECT *, '%' ||
    replace(
      replace(
        replace(term, E'\\', E'\\\\'),
        '%', E'\\%'),
      '_', E'\\_') || '%' AS pattern
  FROM fixtures
), checked AS (
  SELECT label, expected,
    (coalesce(name, '') ilike pattern escape E'\\'
      or coalesce(common_name, '') ilike pattern escape E'\\'
      or coalesce(botanical_name, '') ilike pattern escape E'\\'
      or coalesce(cultivar_name, '') ilike pattern escape E'\\') AS actual
  FROM patterns
)
SELECT label, expected, actual
FROM checked
WHERE actual IS DISTINCT FROM expected
ORDER BY label;
