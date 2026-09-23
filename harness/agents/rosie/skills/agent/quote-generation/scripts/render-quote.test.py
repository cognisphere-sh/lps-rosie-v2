import copy
from pathlib import Path
import runpy
import unittest

render = runpy.run_path(str(Path(__file__).with_name("render-quote")))["render"]


class QuoteTests(unittest.TestCase):
    def job(self):
        return {"job_id": 42, "items": [
            {"id": 7, "name": "Wax myrtle", "size": "15 gal.", "quantity": 4,
             "unit_price": "105.00", "external_notes": None,
             "available_quantity": 900, "sourcing_notes": "INTERNAL"},
            {"id": 8, "name": "Mountain laurel", "size": "30 G", "quantity": 10,
             "unit_price": "375.00", "external_notes": "45 G $595.00"}]}

    def test_default_copyable_quote_uses_requested_quantity_and_shared_notes_only(self):
        output = render(self.job())
        self.assertEqual(output, "```text\n4 x 15 G Wax myrtle - $105.00 - $420.00\n"
                         "10 x 30 G Mountain laurel - 45 G $595.00 - $375.00 - $3,750.00\n\nSubtotal: $4,170.00\n```")

    def test_decimal_totals_round_lines_then_sum(self):
        job = self.job()
        for item in job["items"]:
            item.update(quantity="0.5", unit_price="0.01")
        self.assertIn("Subtotal: $0.02", render(job))

    def test_exponent_quantity_is_rendered_plainly(self):
        job = self.job()
        job["items"][0]["quantity"] = "1e2"
        self.assertIn("100 x 15 G", render(job))

    def test_invalid_lines_never_return_partial_quote(self):
        for field, value in [("quantity", None), ("unit_price", "NaN"),
                             ("unit_price", "Infinity"), ("unit_price", "0"),
                             ("unit_price", "1.001"), ("quantity", True),
                             ("size", "15 G or 30 G"), ("external_notes", "```oops"),
                             ("name", "Live oak\nINTERNAL"), ("job_request_id", 99)]:
            with self.subTest(field=field, value=value):
                job = self.job()
                job["items"][1][field] = value
                with self.assertRaises(ValueError):
                    render(job)

    def test_duplicate_or_unsaved_rows_are_rejected(self):
        job = self.job()
        job["items"].append(copy.deepcopy(job["items"][0]))
        with self.assertRaises(ValueError):
            render(job)
        job = self.job()
        job["job_id"] = None
        with self.assertRaises(ValueError):
            render(job)


if __name__ == "__main__":
    unittest.main()
