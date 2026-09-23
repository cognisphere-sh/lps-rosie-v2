---
name: create-skill
description: Update reusable agent procedures. Covers feedback authorization, task menus, scripts, references, versions and verification. Use for Chris's procedural feedback or skill changes. (v1.5.0)
metadata:
  author: lps
  version: "1.5.0"
---

# Create or update a skill

1. Chris's explicit feedback authorizes updating the relevant SOP, deployment
   prompt or skill without reconfirmation. For implicit feedback or
   inferred improvements, propose the concrete change and reason; apply it only
   after Chris approves. Other edits need Chris/Bhoumik authorization; reuse it
   when already granted.
   Keep the source feedback/approval with the change; route edits outside your
   ownership to the owning agent with that evidence.
2. Own the procedure in `skills/agent/<kebab-slug>/`. Keep `SKILL.md` a short
   workflow/task menu; split unrelated detail into `artifacts/<task>.md` and
   load it only when that branch applies. Put executable repeatable work in
   `scripts/`; describe inputs, output, failure behavior and retry safety.
   Reference files relative to the skill directory. Don't author plugin scopes.
3. Frontmatter needs `name`, `description`, `metadata.author`, `metadata.version`.
   Description briefly states purpose, included tasks/helpers, trigger and
   `(vX.Y.Z)` matching metadata. Names are lowercase kebab-case ≤64 characters;
   descriptions ≤1024 characters. Avoid repeating policy in discovery metadata.
4. Every edit bumps both versions: patch for corrections, minor for changed/
   added steps, major for incompatibility. Add the newest entry to `CHANGELOG.md`.
   New skills start at 1.0.0. The version makes running agents notice changes.
5. Update relevant deployment-owned `1-*` prompts when policy/routing changes;
   keep procedural detail in its skill and retain a trigger/pointer in prompts
   or knowledge. Preserve harness base and plugin-owned prompts. Keep each rule
   with its owner and link to it, rather than copying it.
6. Verify frontmatter, links, executable helpers and meaningful failure/retry
   cases offline. No live sends or business writes as tests. Skills are discovered
   on the next session spawn without a harness restart.
