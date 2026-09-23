# Storage

```sh
scripts/agent/supabase/upload --bucket lps --path daisy_shared/YYYY-MM-DD/file.pdf --file /tmp/file.pdf
scripts/agent/supabase/sign-url --bucket lps --path daisy_shared/YYYY-MM-DD/file.pdf --expiry 604800
```

Upload guesses MIME unless `--content-type` is supplied. It upserts by default;
`--no-upsert` refuses overwrite, `--public-url` adds the public URL. Success
prints a JSON Key. Inspect status before retrying. `sign-url` prints a URL,
default expiry seven days; share it rather than a bare object key.

The `lps` bucket is public: signing a URL does not make its object private.
Do not upload confidential material there. Plant catalogue files use the private
bucket through `plant-photo-catalogue` (Daisy). Source provenance stores object
keys or original public URLs, never expiring signed URLs; follow ingestion.
The wrappers read credentials from environment; don't echo or pass secrets.
