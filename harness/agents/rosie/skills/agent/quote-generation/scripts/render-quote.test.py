import copy
from pathlib import Path
import runpy
import unittest

render = runpy.run_path(str(Path(__file__).with_name("render-quote")))["render"]


class QuoteTests(unittest.TestCase):
    def job(self):
        return {"job_id": 42, "items": [
            {"id": 7, "name": "Wax myrtle", "size": "15 gal.", "demanded_quantity": 4,
             "unit_price": "105.00", "note_for_customer": None,
             "available_quantity": 900, "note_internal": "INTERNAL"},
            {"id": 8, "name": "Mountain laurel", "size": "30 G", "demanded_quantity": 10,
             "unit_price": "375.00", "note_for_customer": "45 G $595.00"}]}

    def test_default_copyable_quote_uses_requested_quantity_and_shared_notes_only(self):
        output = render(self.job())
        self.assertEqual(output, "```text\n4 x 15 G Wax myrtle - $105.00 - $420.00\n"
                         "10 x 30 G Mountain laurel - 45 G $595.00 - $375.00 - $3,750.00\n\nSubtotal: $4,170.00\n```")

    def test_decimal_totals_round_lines_then_sum(self):
        job = self.job()
        for item in job["items"]:
            item.update(demanded_quantity="0.5", unit_price="0.01")
        self.assertIn("Subtotal: $0.02", render(job))

    def test_job_and_item_note_for_customer_keep_private_fields_out(self):
        job = self.job()
        job["note_for_customer"] = "Delivery date to be confirmed"
        for record in (job, *job["items"]):
            record.update(note_internal="INTERNAL FOLLOW-UP",
                          note_for_supplier="SUPPLIER INSTRUCTION")
        self.assertEqual(render(job),
                         "```text\nDelivery date to be confirmed\n\n"
                         "4 x 15 G Wax myrtle - $105.00 - $420.00\n"
                         "10 x 30 G Mountain laurel - 45 G $595.00 - $375.00 - $3,750.00\n\n"
                         "Subtotal: $4,170.00\n```")

    def test_blank_note_for_customer_never_fall_back_to_other_note_fields(self):
        job = self.job()
        for record in (job, *job["items"]):
            record.update(note_internal="INTERNAL FOLLOW-UP",
                          note_for_supplier="SUPPLIER CONTEXT")
            record.pop("note_for_customer", None)
        expected = ("```text\n4 x 15 G Wax myrtle - $105.00 - $420.00\n"
                    "10 x 30 G Mountain laurel - $375.00 - $3,750.00\n\nSubtotal: $4,170.00\n```")
        self.assertEqual(render(job), expected)
        for blank in (None, "", "   "):
            with self.subTest(blank=blank):
                for record in (job, *job["items"]):
                    record["note_for_customer"] = blank
                self.assertEqual(render(job), expected)

    def test_merged_multiline_sourcing_notes_render_all_requirements_and_outcomes(self):
        job = self.job()
        job["note_for_customer"] = "Red flowers only\n\nCan order Tuesday"
        job["items"][0]["note_for_customer"] = "Single trunk\nNo substitutes"
        output = render(job)
        self.assertIn("Red flowers only; Can order Tuesday", output)
        self.assertIn("Single trunk; No substitutes", output)

    def test_unsafe_job_notes_never_return_a_quote(self):
        for value in ("```oops", "Delivery\tdate", 42):
            with self.subTest(value=value):
                job = self.job()
                job["note_for_customer"] = value
                with self.assertRaisesRegex(ValueError, "note_for_customer"):
                    render(job)

    def test_exponent_quantity_is_rendered_plainly(self):
        job = self.job()
        job["items"][0]["demanded_quantity"] = "1e2"
        self.assertIn("100 x 15 G", render(job))

    def test_invalid_lines_never_return_partial_quote(self):
        for field, value in [("demanded_quantity", None), ("unit_price", "NaN"),
                             ("unit_price", "Infinity"), ("unit_price", "0"),
                             ("unit_price", "1.001"), ("demanded_quantity", True),
                             ("size", "15 G or 30 G"), ("note_for_customer", "```oops"),
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

    def test_obsolete_quantity_key_cannot_replace_requested_demand(self):
        job = self.job()
        item = job["items"][0]
        item["quantity"] = item.pop("demanded_quantity")
        with self.assertRaisesRegex(ValueError, "demanded_quantity"):
            render(job)


    def test_no_totals_for_bids_and_quantity_one_quotes(self):
        self.assertEqual(render(self.job(), totals=False),
                         "```text\n4 x 15 G Wax myrtle - $105.00\n"
                         "10 x 30 G Mountain laurel - 45 G $595.00 - $375.00\n```")

    def test_status_list_marks_and_common_names(self):
        job = {"job_id": 42, "items": [
            {"id": 1, "name": "Wax Myrtle | Morella cerifera", "size": "15 G", "demanded_quantity": 2,
             "unit_price": "105.00", "status": "available", "note_for_customer": None},
            {"id": 2, "name": "Culinary Sage | Salvia officinalis", "size": "1 G", "demanded_quantity": None,
             "unit_price": "7.00", "status": "unavailable", "note_for_customer": None},
            {"id": 3, "name": "Nolina", "size": "15 G", "demanded_quantity": 3, "unit_price": "175.00",
             "status": "alternative_proposed", "note_for_customer": "15G only"}]}
        self.assertEqual(render(job, status=True),
                         "```text\n2 x 15 G Wax Myrtle - ✅ - $105.00 - $210.00\n"
                         "? x 1 G Culinary Sage - ❌ - $7.00\n"
                         "3 x 15 G Nolina - Diff Sz/Qty/Sub - 15G only - $175.00 - $525.00\n\n"
                         "Subtotal: $735.00\n```")
        self.assertIn("Wax Myrtle | Morella cerifera", render(job, status=True, full_names=True))

    def test_default_quote_still_rejects_unpriced_lines(self):
        job = self.job()
        job["items"][0]["unit_price"] = None
        with self.assertRaises(ValueError):
            render(job)


if __name__ == "__main__":
    unittest.main()
