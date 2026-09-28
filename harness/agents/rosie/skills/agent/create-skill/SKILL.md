---
name: create-skill
description: Learn from feedback and keep procedures current. Includes where each kind of feedback goes (price rules, skills, prompt, memory), how to resolve conflicts, when to write a helper script, and skill file rules (versions, changelog, limits, tests). Use when Chris or Bhoumik gives feedback, says "remember this", or a skill/script needs changing. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Learning from feedback

## 1. Permission

- Chris's (or Bhoumik's) explicit feedback **is** the permission. Apply it
  now; don't ask whether to update your rules, and never ask in process
  jargon ("May I update my sourcing procedure...?").
- Something you inferred yourself (not said by them): propose the change in
  one plain sentence and apply it after a yes.
- Changes to another agent, the app, plugins or docs: send the request and
  Chris's words to the owner (Daisy, Nova, Lily).

## 2. Where it goes

| Feedback | Put it in |
|---|---|
| A plant price or name rule ("Texas sedge is the sedge price", "use always") | `knowledge/files/price-rules.md` (+ alias via Daisy if same plant). No version bump needed. |
| How to do a task (notes wording, AR scope, quote format) | The one skill file that owns that task. |
| How to behave everywhere (speed, questions, tone) | `system_prompts/1-agent.md`. |
| A decision for this job only ("for JR-83 only", "quantity 1 for now") | Just apply it to the job. Store nothing. |
| A fact or event worth remembering (who someone is, what happened) | `knowledge/memory.md`. |
| App or design feedback | Lily (and Nova for a bug), with Chris's words. |

## 3. How to write the rule

1. Search first (`grep -rn '<keyword>' skills/agent knowledge/files`). Update
   the existing rule; don't add a second one.
2. Write it as one short plain sentence plus one example taken from Chris's
   own words: `Missing size: "3 G not listed; American Beauty Berry 5 G @
   $23"`. No message ids, timestamps or "this does not mean..." lists in the
   rule; the source goes in the changelog.
3. Conflicts: Chris's newest explicit instruction wins. Delete or rewrite the
   old text in the same edit so only one version remains. If you truly can't
   tell which he means, ask him one plain question.
4. Do what Chris says. If you see a real risk, say it once in one line, then
   follow his instruction. Don't narrow his words ("only this plant", "only
   the first time") unless he did.
5. Do it in the same thread, right away; no task thread. Collect several
   feedback points from one conversation into one edit.
6. Tell Chris in one line what you saved: `Saved: diff-size answers update
   the JR size and price.`

## 4. Repeated work → a script

If you run the same multi-step lookup or edit three times, turn it into a
helper in the owning skill's `scripts/`: `--help` stating inputs, output,
failure and retry behavior, compact output, read-only
unless it must write (then guarded), and an offline test (`*.test.py`) that
never touches live data. List it in the skill's menu.

## 5. Skill file rules

- `skills/agent/<kebab-name>/SKILL.md` = short menu (max 6,500 characters);
  task detail in `artifacts/<task>.md`; scripts in `scripts/`. Links are
  relative to the skill folder.
- Frontmatter: `name`, `description` (what it covers + when to use +
  `(vX.Y.Z)`, max 400 characters), `metadata.author`, `metadata.version`.
- Every edit bumps the version in **both** places (fix = patch, new or
  changed step = minor, rewrite = major) and adds a dated one-line entry at the
  top of `CHANGELOG.md` with the source. New skills start at 1.0.0.
- Never edit plugin skill scopes (`skills/<plugin-id>/`) or harness prompts
  (`0-*`, `plugin-*`).
- Changed skills load on the next session start; no restart needed.
- Check: `python3 ../../../scripts/check-agent-instructions.py` from the agent
  folder, and the helpers' tests. No live sends or business writes as tests.
