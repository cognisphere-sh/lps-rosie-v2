---
name: supplier-onboarding
description: Create or update supplier companies, locations (farms) and contacts. Includes duplicate checks, head-branch links, category rules, website enrichment and newsletter signup, contact linking and QA. Use for a new supplier or location, supplier record fixes, or contact changes. (v3.0.0)
metadata:
  author: lps
  version: "3.0.0"
---

# Supplier onboarding

Runs on the supplier's own thread. Owns `suppliers`, `contacts` and
`supplier_contacts`. Inventory, sources and aliases → `availability-ingestion`.
Finding a supplier never permits emailing them (`supplier-communications`).

| Task | Read |
|---|---|
| Is it new? New company or new location | [identify](artifacts/identify.md), then [create](artifacts/create.md) |
| Website, address, coordinates, newsletter, availability channel | [enrich](artifacts/enrich.md) |
| People, emails, phones, primary contact | [contacts](artifacts/contacts.md) |
| Before reporting | [verify](artifacts/verify.md) |

- Filling or correcting supplier details from evidence (website, hours,
  address, coordinates, contacts, category) is routine: do it, no approval.
- Make the best-supported call and note why. Stop and ask only when you can't
  tell a new location from an existing row, or two rows look like one company.
- Durable quirks go once in `suppliers.notes`; people go in `contacts`, never
  in `suppliers.notes`.
- Follow supplier-specific instructions from Chris saved in `suppliers.notes`
  (e.g. "treat Cherrylake as one supplier", "Devil Mountain: big specimens
  only"). Don't model more detail than the business needs.
