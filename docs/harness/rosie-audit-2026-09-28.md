# Rosie audit and instruction rewrite — 2026-09-28

## Scope

All Rosie sessions with records from 2026-09-21 to 2026-09-28 (152 threads,
130 of them task threads; parent threads of JR-72–76 were deleted, their
task briefs were used instead). Every deployment-owned prompt, skill,
knowledge file and the supplier-events plugin prompt were rewritten. Harness
`0-*` prompts and harness plugin prompts were not edited.

## How she operated last week

- **Volume:** ~285M tokens, ~$124. 173 messages from Chris (web + Telegram),
  63 supplier portal events.
- **Work mix:** intake from screenshots/plans (26), line edits (42),
  feedback/"remember this" (43), price lookups (25), quotes (13), orders
  (11), supplier responses (9 + events), AR publishing (3).
- **Biggest cost:** relaying between parent threads and task threads (~$55):
  follow-ups sent into task threads, reports sent back, and the main and
  supplier threads growing to 130–140K tokens per turn. A spawned task was
  slower (1.4 vs 0.95 min) and dearer ($0.47 vs $0.30 per message) than
  inline work.
- **Other waste:** task threads re-reading skills (~60M tokens; job-requests
  SKILL.md read 131 times), notes/daily-note bookkeeping (911 calls), 52
  "saved without submitting" events waking the supplier thread (~$7), 23
  feedback→skill-edit task threads (~$10; job-requests went through 41
  versions in a week).
- **Tool errors:** 162, mostly missing notes files (task threads reading notes
  before creating them), `$` expanded in double-quoted SQL, stale edits of
  daily notes/index, wrong column names, `ON CONFLICT DO` blocked by the
  query guard.

## What Chris kept correcting

Speed ("1hr 20m … this can't take more than 10m"), too many questions
("everything you asked could have been a question in the [notes]"), wordy
notes, the word "proxy", availability caveats on price answers, missing
nearest smaller/larger sizes, re-asking answered questions (flat pot count
asked in JR-71, JR-78 and JR-83; Gaura priced, then asked about again), diff-size
lines left at the old size/price, and aliases not being created. The same
plan was loaded as five jobs (JR-71, 77, 78, 81, 83) with different price
coverage each time.

Root causes in the instructions: ~210K characters of hedged, legalistic
prose (Rosie copied its style into notes); dozens of repeated "not stock / not
alias / not mapping" disclaimers; per-incident plant exceptions; stacked
approval gates; skill text that narrowed Chris's explicit words; note rules
split across three skills; the base prompt's "delegate aggressively".

## What changed

- **Size:** deployment-owned instruction text 209K → ~91K characters
  (−56%). `1.1-supabase.md` merged into `database-access`.
- **Structure:** one owner per rule. All note rules in
  `job-requests/artifacts/notes.md`; plant price rules in
  `knowledge/files/price-rules.md`; approval table in `1-agent.md`.
- **Helpers:** `job-snapshot`, `ar-snapshot`, `set-note`, `aps-price`,
  `quote-job` (+ `--no-totals`, `--status` in `render-quote`), `daily-note`,
  `index-add`, all with offline tests.
- **Learning loop** (`create-skill`): explicit feedback applied in-thread
  immediately; price facts to `price-rules.md` (no version bump), task rules
  to their skill, behavior to `1-agent.md`; newest instruction wins and the
  old text is removed; helper after the third repeat.

## Contradictions found and how they were resolved

Resolved in favour of Chris's latest explicit words; revert any you disagree
with.

| # | Conflict | Now |
|---|---|---|
| 1 | "First APS submission only" (skill) vs Chris JR-78 "use APS AR response as-is … Always do this" | Every explicit APS submission updates linked lines. |
| 2 | JR-75 "keep requested size" vs JR-69/JR-78 "update size and price to the offered size" | Offered size + its own price; original kept in `note_internal`; no price → keep requested and ask. |
| 3 | Skill "missing quantity stays NULL" vs Chris "put one and add 'how many?'" | Quantity 1 + `How many?`. |
| 4 | Skill "never per-pot price on a flat" vs Chris "just quote 4\" price" | Size = pot, price per pot, quantity = pots. |
| 5 | Flat = 18 pots (JR-78) vs 24 pots (JR-83) | Varies; use the count given, else 1 + `How many?`. |
| 6 | Skill refused aliases (Pride of Houston) vs Chris "add as alias" and Bhoumik "add other names as alias, not new entries" | Same-plant names → `plant_aliases` via Daisy; price-only rules → `price-rules.md`. |
| 7 | "Ask which proxy price" vs "never want to ask again" | Ask once in plain words with "Yes, always" first; "always" becomes a rule. |
| 8 | "proxy" banned only in internal notes | Never used anywhere Chris reads. |
| 9 | Default quote has line totals vs "don't do the line total" / "per-unit bid" | `--no-totals` variant for bids and quantity-one quotes. |
| 10 | "Past options need no internal note" vs "include changes/substitutions in internal notes" | Line changes go in `note_internal`. |
| 11 | Customer questions discouraged vs Chris writing `how many?`, `height?` | Short customer questions allowed; supplier-directed questions not. |
| 12 | Plan remarks ("Sub soft leaf yucca") turned into questions | Saved word for word. |
| 13 | Order change log in `orders.notes` | Column was renamed by migration 0111; now appended to `orders.note_for_supplier`. |
| 14 | `record_name` rules vs live DB | Migration 0104 not live as of 2026-09-25; check first, else use ids. |
| 15 | Webchat plugin "MCQs for next steps" vs Chris's "too many questions" | Rosie asks only for real decisions (override noted in `1-agent.md`). |
| 16 | supplier-events prompt edited only in the agent copy (reverted on restart) | Seed edited; copy matches. |
| 17 | Lantana: "form matters" vs Chris pricing Texas lantana from plain Lantana at $7 | Same form when listed; a plain `Lantana` listing is used when it's the only one. |

## Open questions for Chris or Bhoumik

- Job name format: Chris's September 2 examples add a contact person
  (`Land Water Light | Ox Eye Phase II | Dior Goodwin`); the rule is still
  `Customer | Slug` (Lily asked in Telegram 359).
- Pride of Houston → generic Yaupon as a database alias may widen search
  matches for other yaupon cultivars; confirm.
- Should a supplier's AR price be used as the customer price directly (the
  rules now require it to be clearly a per-unit selling price)?

## Recommended platform changes (not made)

1. `harness/plugins/supplier-events/index.ts`: send `availability_updated`
   with `isSilent: true` (context only, no turn). Needs a harness restart to
   verify.
2. The query guard strips `--` comments before dollar-quoted strings, so note
   text containing `--` plus a word like "drop" can be falsely rejected.
3. Compact the long-lived `main` and `supplier-austin-plant-supply` threads.
4. App: the Jobs list's default filter hides Quote-stage jobs and a
   signed-out deep link loses `?jr=` (both hit Chris on JR-71).

## Verification

Offline tests for all helpers pass; `scripts/check-agent-instructions.py`
reports 0 errors. The new SQL was checked against `docs/supabase-schema.md`
and the query guard, but not run against the live database (no credentials
in this workspace). First live use should be read-only: `job-snapshot`,
`ar-snapshot`, `aps-price`.
