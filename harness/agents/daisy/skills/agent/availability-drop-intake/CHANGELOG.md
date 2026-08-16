# availability-drop-intake — changelog

## 2.2.2

Approved by Bhoumik, 2026-08-16. Asset-location change: the Gmail label ID
table moved from `knowledge/files/gmail-labels.md` into this skill as
`artifacts/gmail-labels.md`, and §5 names the new path.

Everything a procedure needs travels with the skill — the table is a lookup
this skill alone reads (`supplier-communications` defers here for labelling
rather than labelling itself), so it is a supporting artifact, not cross-thread
knowledge. This walks back the 1.0.0 split, which kept the IDs in `knowledge/`
when it migrated the label-*application* steps out of that same file. No change
to what this skill does or does not write.

## 2.2.1

2026-08-16. Harness 0.8.22 made `email_received` a preview instead of the mail:
the body is now the header plus the first two lines of the sender's own text,
and attachments are named but no longer downloaded at poll time.

- **§2 says how to get the source material for an email drop.** The contract
  asked for "attachment paths … and the relevant email body text", which the
  notification used to carry and now doesn't. It now says to read the message
  with `scripts/gws/email read <MessageId> --attachments` first — full body,
  files written to `plugins/gws/inbox/<MessageId>/` — and to pass the
  `MessageId` along so the task thread can re-read the mail itself. No change
  to what this skill does or does not write.

## 2.2.0

2026-08-15. Closes the last overlap between this skill and the ingestion side:
§1 and §2 were asking for a list this skill cannot build and the task thread
derives anyway. No change to what this skill does or does not write.

- **§2 stops demanding the company's other locations.** The brief asked for
  "every other active location of the same company with their ids", but §1's
  lookup joins `contacts` → `supplier_contacts` → `suppliers` and returns only
  the locations the *sender* is linked to — it never fanned out on
  `head_branch_id`, so the contract asked for something the step above it
  couldn't produce. Nothing broke only because `availability-ingestion` §0 step 1
  re-derives the set from the head branch regardless. The brief now carries the
  matched ids and the `head_branch_id`, and says why the fan-out belongs to the
  thread: its query also returns city and state, which is what resolving a tab
  label like `Ft Pierce` against a real row depends on, and a lookup by sender
  address never carries. A half-list is worse than none — it can be mistaken for
  the whole company.
- **§1 says which lookup to use for which input, and why.** It hand-wrote an
  `ILIKE` for the name path, which is the query shape `plant-and-supplier-search`
  exists to discourage. Names now go through `search_suppliers` (typo tolerant,
  partial matching); addresses stay on the exact `contacts` join, because an
  email matches the RPC's contacts branch but **scores 0** and ranks below every
  name match. The step also notes that the RPC does not return `head_branch_id`,
  which the brief still has to carry.
- **§1 no longer re-explains the multi-location model.** It kept its own copy,
  fleet counts and all, of what `availability-ingestion` §0 explains — two
  places to update, one of them wrong the next time a company adds a farm. What
  stays is the part that governs coordination: several rows for one company is
  normal, pass them all, never pick or merge.
- **§4's update/insert check says what it can actually do.** It restated the
  thread's §5 sanity check almost verbatim, but this skill reads a report about
  a committed transaction — it cannot roll anything back, so "raise it rather
  than filing it" was the only real instruction in it. It is now framed as the
  backstop for a §5 that didn't fire, alongside the report-consistency check
  that the locations written match the ones the report says the source named.

## 2.1.0

2026-08-15. `supplier-onboarding-and-ingestion` was split into
**`availability-ingestion`** (the inventory side) and **`supplier-onboarding`**
(the supplier side), so every reference here moves. **No change to what this
skill does or does not write, and the brief still dispatches one task thread.**

- **§2 names `availability-ingestion`**, and only that one. The ingestion skill
  follows `supplier-onboarding` itself when a drop's sender matches no supplier
  or its file names a farm with no row, so the brief never has to decide whether
  onboarding is in scope — which is what kept this a single dispatch rather than
  a branch the main agent has to evaluate before writing the brief.
- **The boundary paragraph says which of the two owns which tables**, so the
  "you never write" list stays exhaustive now that the writes are split across
  two skills.
- **§4 points at the report contract in `availability-ingestion`**, and notes
  that it folds in the *Onboarding* block from `supplier-onboarding` — the main
  agent still digests one report, not two.

## 2.0.4

2026-08-15. Two corrections found by comparing this skill against
`supplier-onboarding-and-ingestion` side by side. No change to what this skill
does or does not write.

- **§2 no longer carries a skill version in the brief, and forbids one.** The
  bullet asked for "name and current version" and illustrated it with
  `(v2.0.0)` while the ingestion skill was at v3.6.2 — a stale literal inside
  the one instruction whose whole purpose is pinning a procedure, and the line
  most likely to be copied verbatim into a brief. The task thread's own
  `<available_skills>` is rebuilt at spawn, so it resolves the name to the
  current version by itself; a quoted version can only be redundant or wrong.
  The base prompt's **Task threads** guidance changed the same way.
- **The boundary list names `supplier_contacts`.** The ingestion skill writes
  that table throughout its §0.3, but this skill's "you never write to …" list
  named only `suppliers`, `contacts`, `inventory`, `inventory_sources` and
  `plant_aliases`, so a literal reading left the link table unclaimed.

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
