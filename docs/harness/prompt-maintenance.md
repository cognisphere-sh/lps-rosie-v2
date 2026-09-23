# Maintaining compact agent instructions

Rosie, Daisy and Lily use short deployment policy plus task-specific skills.
Harness-provided base prompts stay unchanged. `1-agent.md` owns deployment
identity, boundaries and routing. `SKILL.md` selects the current task;
`artifacts/<task>.md` holds its detail. Keep each business rule with one owner
and link to it. Helper scripts perform deterministic mechanics without
implying permission for sends or database writes.

## Size comparison

Measured as characters across the three agents:

| Text loaded | Before | After | Reduction |
|---|---:|---:|---:|
| Deployment-owned prompts | 40,864 | 13,363 | 67.3% |
| All prompts, including unchanged harness/plugin text | 192,751 | 165,250 | 14.3% |
| Agent skill entry points, including new database-access skills | 315,339 | 38,630 | 87.7% |

Detailed task references remain available on demand. These are text-size
comparisons, not measured production token/cost savings.

## Ownership and upgrades

Do not simplify or split harness-provided `0-*` prompts. All three agents retain
their original `0-base_prompt.md` and `0.1-agent-directory.md` byte-for-byte.
The installed harness package, `docs/base-harness/` and plugin-owned prompts and
skills are also outside this refactor. Runtime instructions remain in the
harness base; do not create duplicate skills for them.

Optimize deployment-owned `1-*` prompts and `skills/agent/` procedures. Their
compact `create-skill` copies retain frontmatter/version/changelog requirements
and teach task menus. During a harness upgrade, follow the upstream base-prompt
updates and reconcile local agent-skill changes separately. Nova is unchanged.

## Feedback-driven updates

Chris's explicit feedback authorizes updating the relevant SOP, deployment
prompt or skill without another approval request. Change only the applicable
instructions.
Apply the stated scope through `create-skill`; keep procedural detail with its
owning skill and update prompt policy/routing where relevant. For implicit
feedback or an inferred improvement, propose the concrete change and reason,
then apply it only after Chris approves.

Each agent edits its own instructions. Lily routes other agents' changes with
Chris's source feedback or approval and checks completion with the owner.
Skill edits receive version/changelog updates. Harness base and plugin-owned
prompts remain unchanged.

## Repeatable helpers

Paths below are relative to each agent directory. Each helper has `--help`.

| Agent | Helper | Behavior |
|---|---|---|
| Rosie | `skills/agent/quote-generation/scripts/render-quote` | Validates supplied saved-row input and emits a copyable decimal quote. No query/write/send. |
| Rosie, Daisy | `skills/agent/database-access/scripts/schema` | Prints selected tables/RPCs directly from the shared schema; no second schema copy. |
| Daisy | `skills/agent/availability-ingestion/scripts/source-check` | Read-only fingerprint check; explicit verified-success receipt writes are locked and atomic. |
| Lily | `skills/agent/feedback-loop/scripts/capture-feedback` | Locked append-only capture with stable source IDs; identical retry is a no-op, conflicting retry fails. |

Existing ingestion matching, daily-run state and photo scripts stay in their
owning skills. Full source/QA review remains necessary for changed drops; compact
output does not authorize skipping evidence, approval or allocation checks.

## Verify changes

From the repository root:

```sh
python3 scripts/check-agent-instructions.py
python3 harness/agents/rosie/skills/agent/quote-generation/scripts/render-quote.test.py
python3 harness/agents/rosie/skills/agent/database-access/scripts/schema.test.py
python3 harness/agents/daisy/skills/agent/availability-ingestion/scripts/source-check.test.py
python3 harness/agents/lily/skills/agent/feedback-loop/scripts/capture-feedback.test.py
```

The checker covers local links, stale section references, versions/changelogs,
helper syntax/executable modes and drift between schema helper copies. Its
limits are 6,500 characters per skill entry, 400 per discovery description and
6,500 for deployment-owned `1-*` prompt files combined per agent. Harness base
and plugin prompts are excluded from these limits. It reports actual characters,
not model token counts; dynamically injected context is an additional cost.
Tests run offline in temporary files and never touch live business data/contact.

Skill versions are bumped so running agents notice changed procedures. Skills
load on session spawn; the subprocess runner also assembles prompt files on each
spawn. An already-running process may require a reload to see new prompt text.
When applying through the normal harness lifecycle, verify agent/plugin states. Do not
send fake business messages or perform live database mutations as a smoke test.

Validation on 2026-09-23: 19 helper tests, instruction checks, YAML parsing,
app typecheck and the normal production build passed. The build required network
access for existing Google Fonts. Live reload was not verified in this workspace:
`lps-rosie-v2-harness.service` has `LoadState=not-found`.
