---
name: create-skill
description: Learn from feedback and keep procedures current. Includes where each kind of feedback goes (supplier notes, aliases, skills, prompt, memory, other agents), resolving conflicts, when to write a helper script, and skill file rules (versions, changelog, limits, tests). Use when Chris or Bhoumik gives feedback or a correction, says "remember this", or a skill or script needs changing. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Learning from feedback

## 1. Permission

- Chris's or Bhoumik's explicit feedback **is** the permission. Apply it now,
  in the same thread; don't ask whether to update your rules.
- Something you worked out yourself: propose it in one plain sentence; apply
  after a yes.
- Changes for another agent, the app, plugins or docs: send the owner the
  request with Chris's exact words (Rosie, Lily for app/design, Nova for code).
- Doing what was said is not the same as agreeing: if you see a real risk,
  say it once in one line, then follow the instruction.

## 2. Where it goes

| Feedback | Put it in |
|---|---|
| About one supplier ("treat Cherrylake as one supplier", "PDF is the source of truth", "big specimens only") | That supplier's `suppliers.notes`. No version bump. |
| Two names for the same plant | `plant_aliases` (`availability-ingestion` → aliases). |
| A misspelled or wrong row | Fix the row (`availability-ingestion` → repairs). |
| "Price X like Y" for different plants | Rosie's price rules: send her Chris's words. |
| How to do a task (parsing, matching, notes, drafts) | The one skill file that owns it. |
| How to behave everywhere (tone, questions, speed, reporting) | `system_prompts/1-agent.md`. |
| A fact or event (who someone is, a market decision) | `knowledge/memory.md`. |
| A decision for this one case only | Just do it. Store nothing. |

## 3. How to write it

1. `grep -rn '<keyword>' skills/agent system_prompts knowledge` first. Change
   the existing rule; never add a second one.
2. One short plain sentence, plus an example in Chris's own words when it
   helps, with the date: `Say "plants", not "offerings" (Chris, 2026-08-05).`
3. Newest explicit instruction wins. Delete or rewrite the old text in the
   same edit so only one version remains. Can't tell which he means? Ask him
   one plain question.
4. Don't narrow or widen what was said ("only this supplier", "every
   supplier") unless they did.
5. Tell them in one line what you saved: `Saved: page-by-page reading for
   every PDF list.`

## 4. Repeated work → a script

The third time you write the same kind of throwaway script or query, make it
a helper in the owning skill's `scripts/`: `--help` with inputs, output,
failure and retry behaviour; compact output; read-only unless it must write
(then guarded, dry run by default); an offline `*.test.py` that never touches
live data. Add it to the skill's menu. Prefer extending an existing helper.

## 5. Skill file rules

- `skills/agent/<kebab-name>/SKILL.md` is a short menu (max 6,500
  characters); detail in `artifacts/<task>.md`; scripts in `scripts/`. Links
  relative to the skill folder.
- Frontmatter: `name`, `description` (what it covers + when to use +
  `(vX.Y.Z)`, max 400 characters), `metadata.author`, `metadata.version`.
- Every edit bumps the version in both places (fix = patch, changed or new
  step = minor, rewrite = major) and adds a dated entry at the top of
  `CHANGELOG.md` with the source (who, when, their words).
- Never edit plugin skill folders (`skills/<plugin-id>/`) or harness prompts
  (`0-*`, `plugin-*`).
- Check from the agent folder: `python3 ../../../scripts/check-agent-instructions.py`
  and the helpers' tests. No live sends or business writes as tests.
- Changed skills load on the next session start.
