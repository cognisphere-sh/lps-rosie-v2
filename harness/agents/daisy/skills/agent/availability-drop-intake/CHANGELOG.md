# availability-drop-intake — changelog

## 2.0.3

2026-08-15, following migration 0049. `supplier_groups` and `suppliers.group_id`
no longer exist: a company's locations now share a `head_branch_id`, and the
head branch points at itself. §1's lookup selects it, and the brief carries it
instead of the `group_id`. No change to what this skill does or does not write.

## 2.0.2

2026-08-14, harness 0.8.18 upgrade. Path-only change: reference docs moved to
`knowledge/files/`, so the brief now names `knowledge/files/SCHEMA.md` and the
label IDs live at `knowledge/files/gmail-labels.md`. §4 now files the result
summary into the thread's `notes.md` (`## Context` / `## Decisions`) instead of
the removed `summary.md`. No change to what this skill does or does not write.

## 2.0.1

2026-08-14, following migration 0040. The alias table named in the boundary
rule is now `plant_aliases` — `plant_other_names` no longer exists. No change
to what this skill does or does not write.

## 2.0.0

Approved by Bhoumik, 2026-08-14. Split cleanly from
`supplier-onboarding-and-ingestion` so the two skills are mutually exclusive and
together cover the whole drop.

- **Explicit boundary**: this skill is coordination only and writes no database
  row; the ingestion skill owns every write and never talks to a human. Stated up
  front in both skills.
- **§2 is now the canonical dispatch contract** — the ingestion skill's *Your
  inputs* points here instead of restating it. The brief must carry every active
  location in the group with their ids, and any text in the email body that names
  a farm/branch/ship-from, because that is what the row → location mapping turns
  on.
- **§4 no longer restates the report contract**; it points at the canonical one
  in the ingestion skill and says only what the main agent does with each part.
  Added the check that a repeat drop reporting mostly *inserts* rather than
  *updates* is a data risk (the ingest failed to match existing rows), not a
  routine result.
- **§1** now says explicitly that deciding which rows go to which location is the
  ingestion skill's call, and that the main agent must never narrow the drop to
  one location the file didn't name.

## 1.0.0

- Initial version: migrated from the *Core workflow* section of
  `system_prompts/1-agent.md` and the label-application steps of
  `knowledge/gmail-labels.md` when harness 0.8.12 made skills the home for
  procedural memory.
