# Daisy audit and instruction rewrite — 2026-09-29

## Scope

- **Sessions:** every Daisy session with records from 2026-09-22 to
  2026-09-29: 158 threads, 105 of them task threads.
- **Feedback:** every human message in Daisy's history (about 440 from Chris
  and 176 from Bhoumik), plus relays from Rosie and Lily.
- **Rewritten:** the deployment prompt, `knowledge/index.md` and all agent
  skills. Harness `0-*` prompts, plugin prompts and plugin skills were not
  edited.

## How she operated last week

- **Volume:** $218, 399M tokens, 4,783 model turns.
  - About 80 supplier emails; 64 reached supplier threads through Gmail
    routing rules and 16 went through `router`.
  - 8 web and 6 Telegram messages from Chris and Bhoumik.
  - 7 daily summaries and 12 interrupted-turn resumes.
- **Work mix:** almost all automated list ingestion. Human requests were:
  - an Austin Plant Supply (APS) re-ingest ("one page at a time");
  - a CSV export;
  - a typo fix (Spineless Prickly Pear);
  - "price X like Y" requests (Carolina Cherry Laurel, Leopard Plant, Texas
    Sage, Texas Sedge);
  - a substitute question (Scaevola);
  - a photo with a price (Giant Hesperaloe $695).
- **Where the money went:**

  | Item | Cost | Status |
  |---|---|---|
  | The expensive `gpt-6-astra` model until Sep 23 | $82 (37% of spend on 10% of turns) | Already switched to `gpt-6-sol`. |
  | Task threads | $133 | Chains of 3–6 hops, see below. |
  | Supplier parent threads waking to start a task | $22 | |
  | Supplier parent threads relaying their tasks' reports | $19 | |
  | `gws:main` answering "No action needed" to Gmail settings notices on a 188K-token session | $15.7 ($66 since Aug 18) | Needs a platform fix. |
  | Daily summary (task thread, then main rewrote it) | ~$9 | |

  - **Task-thread chains:** tasks nested 3–6 levels deep (Everde ran 6
    parallel region tasks that applied the rules differently; American
    Native Plants had a "review" grandchild).
  - **Loen Sep 23:** a hold loop cost $18.5 over 1h50m. The same list was
    matched by item code in 8 minutes on Sep 25.
- **Repeated work:**
  - Each ingestion task read 10–20 skill files (1,123 reads).
  - `workspace/index.md` (115 KB) was read 65 times.
  - Gmail `labels list` ran 848 times.
  - 137 one-off parse/stage/SQL scripts were written from scratch.
- **Tool errors:** 144 bash, 21 read and 21 ls errors, and 19 failed edits.
  Main causes:
  - guessed schema topic names (`farms`, `sources`);
  - `$` expanded inside double quotes;
  - tracebacks in the one-off scripts;
  - reading task notes before creating them;
  - stale edits of the daily note and index.

## What the humans kept correcting

Rules that did not stick:

- APS price lookups missing a requested name (about 7 times).
- Search missing exact matches or filtering them out (5).
- Alias or cultivar leakage (5).
- Robotic or wordy drafts (4).
- The "Keep me in To" footer (3).
- "Use the hosted list as a placeholder" (6).
- Over-engineering (3).
- Jargon (Bhoumik 09-25: "Can you explain…").

Root causes in the instructions:

- About 180K characters of hedged prose split over 53 files.
- Rules that forbade what the humans had explicitly asked for.
- Stale lines saying "you never change this skill".
- The base prompt's "delegate aggressively", with nothing limiting nesting.
- No home for one-off requests (fixes, prices, exports).

## What changed

- **Size:** skill text went from 180K to 96K characters (53 files → 37).
  - Ingestion went from 20 references (85K) to 8 (38K). A normal ingest now
    reads about 33K instead of about 75K.
  - `1.1-supabase.md` was merged into `database-access`.
  - The ingestion photo rules moved to `plant-photo-catalogue`, so each rule
    has one owner.
- **Delegation (`1-agent.md`):**
  - Work happens in the thread that owns it.
  - One task thread per email at most, and task threads never start task
    threads.
  - A task finishes its own label, panel post and daily note, and sends one
    `--silent` report.
  - No progress messages.
  - Main answers lookups itself.
- **Approval table** in `1-agent.md`. Fixes, aliases and prices that Chris or
  Bhoumik ask for, plus routine enrichment, need no further yes.
- **Helpers** (offline tests; the SQL was checked live with `EXPLAIN` and
  read-only runs, and no writes were made):
  - `ingest-context`: company, locations, supplier notes and recent sources
    in one read.
  - `match-candidates --plan`: a decision file. Every suggested insert is
    first checked with `search_inventory`.
  - `apply-plan`: a guarded single-transaction write. It is a dry run unless
    `--commit`, keeps "silence is not a value", appends `internal_notes`,
    requires a `size_std` for every size, and checks counts exactly.
  - `qa-check`: all the mechanical QA in one read.
  - `daily-note` and `index-add`: shared with Rosie. The checker fails if
    Daisy's copies drift.
  - The `schema` selector now suggests close names for an unknown topic.
  - Labels are applied by name with the existing
    `scripts/gws/email label … --add 'Daisy/<Status>'`.
- **New skill `daily-summary`:** runs on one thread in a fixed short format;
  main posts it unchanged.
- **Learning loop (`create-skill` 2.0.0):**
  - Explicit feedback is applied immediately.
  - Supplier facts go to `suppliers.notes`, same-plant names to aliases,
    "priced alike" rules to Rosie, task rules to their skill, and behaviour
    to `1-agent.md`.
  - The newest instruction wins and the old text is removed.
  - A helper is written on the third repeat.
- **Feedback that was missing and is now captured:**
  - no fax numbers, and LLC/Inc are the same company;
  - no Keep-me-in-To footer, and Bhoumik can also approve drafts;
  - say "plants", not "offerings";
  - find the exact plant before filtering by geography;
  - a search miss is not a confident "no";
  - suggest substitutes only from listed plants, APS first;
  - no tables on Telegram;
  - link the app rather than an expiring signed URL;
  - the newest email decides the primary contact;
  - brokers are not farm contacts;
  - don't over-model.

## Contradictions and how they were resolved

Each was resolved in favour of the humans' latest explicit words. Revert any
you disagree with.

| # | Conflict | Now |
|---|---|---|
| 1 | The alias rule said pairs must be printed in the source. Bhoumik (08-19, 09-25) and Chris (09-11) asked for aliases directly. | Pairs Chris or Bhoumik ask for are allowed. Their words go in `source_line`; the quality checks still run, and a risk is raised once. |
| 2 | Daisy created 11 copy rows to carry prices under other names. Bhoumik (09-25): "add other plant names as Alias. Do not create a new entry." | No copy rows. Same plant → alias. Different plants priced alike ("not interchangeable") → Rosie's price rules. **The 11 existing rows are still active: see open questions.** |
| 3 | Daily research said to skip static or undated hosted lists. Chris (six times) and Bhoumik's job spec said to load them as placeholders. | Load once as a confirmation-required placeholder; skip if unchanged; supplier-specific instructions win (County Line "sign up and wait"). |
| 4 | The default draft opened "We are updating our supplier availability records…", which Chris rejected (08-17, 08-20). | Bhoumik's 08-19 sample wording. The prior-qualified question uses Chris's 08-28 wording. |
| 5 | `1-agent.md` said explicit feedback authorises skill edits. Two skill files and `knowledge/index.md` said "you never change this skill". | The stale lines were removed; `create-skill` rules. |
| 6 | Webchat plugin: "MCQs for next steps". Humans: batch questions and ask only real decisions. | MCQs only for a real decision (noted as an override in `1-agent.md`). |
| 7 | Base prompt: "delegate aggressively", "main is only a coordinator". Cost data: relays and nesting cost about $65 a week. | Work in the owning thread; one task per email, depth 1 (override noted in `1-agent.md`). |
| 8 | The approval rule named Chris only. Bhoumik (07-15): "Chris or I". | Chris or Bhoumik. |
| 9 | `verify.md` still referred to category `Other`. Chris (08-21) set four values. | Four values or NULL. |
| 10 | "Hold on ambiguity" produced week-long hold loops (Loen). Newest-source-wins was already the rule. | Park only rows with two materially different readings; finish your own parked rows; match item codes first. |

Minor items were also fixed: the Keep-me-in-To footer was only in the daily
draft rules, and 7-day signed links were the default for review material.

## Decisions (Bhoumik, 2026-09-29) and what was done

| # | Question | Decision | Done |
|---|---|---|---|
| 1 | 11 price-copy rows (Berkeley Sedge, 4 Leopard Plant, 6 Carolina Cherry Laurel) | Deactivate | Deactivated with a dated `internal_notes` line. Their prices live in Rosie's `knowledge/files/price-rules.md`; the Carolina Cherry Laurel → APS Compact Cherry Laurel rule was added there (sedge and Leopard Plant rules already existed). 22 AR lines (ARs 19–48) still map to these rows as history. |
| 2 | Filling missing botanical names | Keep as is | Botanical names only from the source; aliases from a source or a human request. |
| 3 | Retiring empty old sources | Retire | Rule added: a source with no inventory rows is retired once a newer source with rows exists for the same farm; the newest source and any source a pending schedule names are kept (`write.md`, `finish.md`). One-time cleanup retired 403 sources across 66 suppliers (ids in `harness/agents/daisy/workspace/threads/main/files/retired-empty-sources-2026-09-29.csv`); 0 active rows point at an inactive source; 42 empty "newest" sources kept. |
| 4 | "No location named → copy to every location" | Keep, with supplier exceptions | `locations.md`: a supplier-specific instruction in `suppliers.notes` wins (Cherrylake is already one supplier there). |

Still open: Daisy vs Rosie for sourcing questions (Chris's "why rosie?",
08-28; split unchanged), the Mexican Fence Post split, and the Giant
Hesperaloe $695 container size.

## Recommended platform changes (not made)

1. **`gws_settings`:** stop delivering the settings notice to the model, or
   deliver it silently (`harness/plugins/gws/index.ts`,
   `announceSettings`). Also rotate the `gws:main` session. Saves about $16 a
   week.
2. **Long sessions:** compact or rotate `main` (126–152K),
   `daily-9am-checkin` (120–133K) and the big supplier sessions (95–171K).
   Each cold wake costs $0.20–0.40.
3. **Silent task deaths:** the harness should tell the parent when a task
   thread ends without reporting. The Chauncey Sep 21 task committed but
   never reported; the parent noticed 5 days later.
4. **Docs:** `docs/harness/README.md` lists Daisy's model as `gpt-5.6-terra`.
   `agent.json` says `gpt-6-sol`. Not changed here.

## Verification

- `scripts/check-agent-instructions.py`: 0 errors.
- Offline helper tests all pass:
  - Daisy: `helpers.test.py`, `match-candidates.test.py` and
    `source-check.test.py`;
  - Rosie: `schema.test.py` and `helpers.test.py`.
- Checked against the live database without writing anything:
  - `ingest-context` and `qa-check` ran read-only;
  - `match-candidates --plan` ran read-only;
  - `apply-plan`'s generated SQL was run with `EXPLAIN` only, so nothing
    executed.
- **Existing `source-check` receipts:** the fingerprint includes the skill
  text, so they no longer match. Each recurring list will be ingested once
  more in full; this is intended.
- **First live use:** run `apply-plan` without `--commit` and compare the
  counts with the page ledger.
- **Harness restarted** 2026-09-29 07:20 UTC (`scripts/server.sh restart
  harness`): Daisy, Lily and Nova running with no failed plugins. Rosie's
  `gws` plugin failed with "missing secrets:
  GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE", as on the earlier starts
  (2026-09-28, 2026-09-29 06:50). That is pre-existing and not related to
  this change.
