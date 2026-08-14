---
name: share-file-with-user
description: Hand a file (CSV, PDF, report, export) to Chris, Bhoumik or another user without exposing a public URL. Covers the lps-bucket path convention daisy_shared/YYYY-MM-DD/<filename>, the upload step, generating a pre-signed URL with an expiry, and the rule that only pre-signed URLs are ever shared. Use when asked to send, export, or share a file, or when a reply needs to carry an attachment-like link. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Sharing a file with a user

Never share a publicly accessible URL. Always share a pre-signed one.

1. **Upload** to the `lps` bucket under `daisy_shared/YYYY-MM-DD/<filename>`,
   where `YYYY-MM-DD` is today's date (America/Chicago):

   ```
   scripts/agent/supabase/upload --bucket lps \
     --path daisy_shared/YYYY-MM-DD/<filename> --file <local-file>
   ```

2. **Sign it:**

   ```
   scripts/agent/supabase/sign-url --bucket lps \
     --path daisy_shared/YYYY-MM-DD/<filename> [--expiry 604800]
   ```

   `--expiry` is in seconds; the default is 604800 (7 days).

3. **Share the pre-signed URL** in your reply.

This is for files handed to a *user*. Durable assets belong elsewhere: a
supplier's source price list goes under `suppliers/<slug>/rate-cards/` and is
referenced from `inventory_sources.file_path` (object key, no scheme); a plant
photo's URL goes in `inventory.image_url`. Intermediate files (converted
markdown, page images, parse chunks) go to `/tmp` and are not uploaded at all.
