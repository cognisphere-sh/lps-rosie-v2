from pathlib import Path
import runpy
import unittest

select = runpy.run_path(str(Path(__file__).with_name("schema")))["select"]
SOURCE = Path(__file__).resolve().parents[4] / "knowledge/files/SCHEMA.md"


class SchemaTests(unittest.TestCase):
    def test_table_retains_constraints_without_neighbor(self):
        output = select(SOURCE.read_text(), ["inventory"])
        self.assertIn("inventory_size_std_check", output)
        self.assertIn("name_key text GENERATED", output)
        self.assertNotIn("### `inventory_sources`", output)

    def test_rpc_includes_signature_guard_and_grouped_input_contract(self):
        output = select(SOURCE.read_text(), ["rpc:create_order"])
        self.assertIn("p_job_request_item_ids bigint[]", output)
        self.assertIn("The job row lock serialises orders", output)
        self.assertNotIn("RPC `search_inventory`", output)

    def test_search_includes_behavior_and_return_columns(self):
        output = select(SOURCE.read_text(), ["rpc:search_inventory"])
        self.assertIn("empty input returns no rows", output)
        self.assertIn("cultivar_keys", output)

    def test_missing_topic_does_not_return_partial_result(self):
        with self.assertRaises(ValueError):
            select(SOURCE.read_text(), ["inventory", "missing_table"])


if __name__ == "__main__":
    unittest.main()
