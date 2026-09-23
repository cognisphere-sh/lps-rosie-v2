---
name: supplier-onboarding
description: Create or enrich supplier companies, farms and contacts. Includes identity checks, classification, enrichment and QA. Use for supplier-side writes, new locations or contact corrections. (v2.5.0)
metadata:
  author: lps
  version: "2.5.0"
---

# Supplier onboarding

Run on the supplier's dedicated thread. Own `suppliers`, `contacts` and
`supplier_contacts`; inventory/source/alias writes use `availability-ingestion`.
Read relevant schema through `database-access` before queries. Supplier discovery
does not authorize email; `supplier-communications` owns approved sends.

1. Read [identity checks](artifacts/identify.md) before creating or changing a
   company/farm. Reuse verified entities; preserve head-branch relationships.
2. For new rows read [creation and classification](artifacts/create.md).
   For existing-row research/corrections read [enrichment](artifacts/enrich.md).
3. For people/email/phone changes read [contacts](artifacts/contacts.md).
   People belong in contacts, not supplier notes; preserve cross-location links.
4. Run [verification and reporting](artifacts/verify.md). Return supplier IDs,
   head branch, dedicated thread, evidence and remaining gaps to the caller.
   Continue ingestion only after supplier/location scope is resolved.

Read only references needed for the change. Preserve current facts on retries;
record durable quirks once in `suppliers.notes`, contact history in the transcript.
