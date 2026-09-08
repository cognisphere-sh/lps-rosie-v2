#!/usr/bin/env python3

import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("configure-nginx-upload-limit.py")
spec = importlib.util.spec_from_file_location("nginx_upload_limit", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)


SITE = """server {
    server_name lps.cognisphere.sh;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
    listen 443 ssl;
}
server {
    server_name lps-harness.cognisphere.sh;
    location / {
        proxy_pass http://127.0.0.1:3142;
    }
}
server {
    listen 80;
    server_name lps.cognisphere.sh;
    return 404;
}
"""


class ConfigureNginxUploadLimitTest(unittest.TestCase):
    def test_scopes_25_mib_to_internal_and_partner_chat_upload_endpoints(self):
        result = module.transform(SITE, "lps.cognisphere.sh", 3000)
        self.assertIn("location ~ ^/api/(?:chat/[^/]+/upload|partner/[^/]+/chat)$ {", result)
        self.assertEqual(result.count("client_max_body_size 25m;"), 1)
        self.assertEqual(result.count(module.BEGIN), 1)
        harness = result[result.index("server_name lps-harness"):]
        self.assertNotIn("client_max_body_size", harness)

    def test_second_run_is_byte_identical(self):
        once = module.transform(SITE, "lps.cognisphere.sh", 3000)
        twice = module.transform(once, "lps.cognisphere.sh", 3000)
        self.assertEqual(twice, once)

    def test_existing_managed_block_is_replaced_without_duplication(self):
        once = module.transform(SITE, "lps.cognisphere.sh", 3000)
        stale = once.replace("client_max_body_size 25m;", "client_max_body_size 10m;")
        repaired = module.transform(stale, "lps.cognisphere.sh", 3000)
        self.assertNotIn("client_max_body_size 10m;", repaired)
        self.assertEqual(repaired.count("client_max_body_size 25m;"), 1)

    def test_refuses_missing_or_ambiguous_app_server(self):
        with self.assertRaisesRegex(ValueError, "found 0"):
            module.transform(SITE, "wrong.example", 3000)
        duplicate = SITE.replace("server_name lps-harness.cognisphere.sh;", "server_name lps.cognisphere.sh;").replace(
            "127.0.0.1:3142", "127.0.0.1:3000"
        )
        with self.assertRaisesRegex(ValueError, "found 2"):
            module.transform(duplicate, "lps.cognisphere.sh", 3000)


if __name__ == "__main__":
    unittest.main()
