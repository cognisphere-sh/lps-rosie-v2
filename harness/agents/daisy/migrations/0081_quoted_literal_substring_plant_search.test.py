#!/usr/bin/env python3
"""Static regression checks for migration 0081 (no database required)."""

from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
MIGRATION = HERE / "0081_quoted_literal_substring_plant_search.sql"
BASELINE = HERE / "0057_quoted_exact_plant_search.sql"


class QuotedLiteralSearchMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text()
        cls.baseline = BASELINE.read_text()
        cls.quoted = cls.sql[
            cls.sql.index("  if exact_mode then") : cls.sql.index("  if q = '' then")
        ]

    def test_quoted_predicate_is_identity_only(self):
        for field in (
            "inv.name",
            "inv.common_name",
            "inv.botanical_name",
            "inv.cultivar_variety_trade_name",
        ):
            self.assertIn(f"coalesce({field}, '') ilike exact_pattern", self.quoted)
        self.assertEqual(self.quoted.count(" ilike exact_pattern escape E'\\\\'"), 4)
        self.assertNotIn("coalesce(inv.size, '') ilike", self.quoted)
        self.assertNotIn("coalesce(inv.notes, '') ilike", self.quoted)
        self.assertNotIn("coalesce(inv.internal_notes, '') ilike", self.quoted)

    def test_like_metacharacters_are_escaped_in_data_order(self):
        backslash = "replace(exact_text, E'\\\\', E'\\\\\\\\')"
        percent = "'%', E'\\\\%'"
        underscore = "'_', E'\\\\_'"
        self.assertLess(self.quoted.index(backslash), self.quoted.index(percent))
        self.assertLess(self.quoted.index(percent), self.quoted.index(underscore))
        self.assertEqual(self.quoted.count("escape E'\\\\'"), 4)

    def test_contract_fixtures(self):
        def matches(identity_fields, size, notes, term):
            del size, notes  # Deliberately outside quoted identity matching.
            needle = term.casefold()
            return any(needle in (value or "").casefold() for value in identity_fields)

        fixtures = (
            (("Search Term", "", "", ""), "", "", "search term", True),
            (("", "Search Term", "", ""), "", "", "search term", True),
            (("", "", "Search termensis", ""), "", "", "search term", True),
            (("", "", "", "Search Term Gold"), "", "", "search term", True),
            (("", "", "", ""), "Search Term", "", "search term", False),
            (("", "", "", ""), "", "Search Term", "search term", False),
            (("100%_\\ specimen", "", "", ""), "", "", "100%_\\", True),
            (("100XXa\\ specimen", "", "", ""), "", "", "100%_\\", False),
        )
        for identity, size, notes, term, expected in fixtures:
            self.assertEqual(matches(identity, size, notes, term), expected)

    def test_unquoted_body_is_byte_identical_to_0057(self):
        start = "  if q = '' then"
        end = "COMMENT ON FUNCTION public.search_inventory"
        old = self.baseline[self.baseline.index(start) : self.baseline.index(end)]
        new = self.sql[self.sql.index(start) : self.sql.index(end)]
        self.assertEqual(new, old)


if __name__ == "__main__":
    unittest.main()
