# Supplier notes — moved (twice)

Supplier quirks — price-list format, parsing tricks, ordering constraints,
anything durably true about a supplier — live in **`suppliers.notes`** in
Supabase (edited in place; the app and the whole team read it there). Since
2026-08-23 the `workspace/suppliers/[<supplierId>]:<Name>/notes.md` dirs are
read-only legacy: read them when working an established supplier, promote
anything durable to `suppliers.notes`, write nothing new there — and do not
add new content here either.
