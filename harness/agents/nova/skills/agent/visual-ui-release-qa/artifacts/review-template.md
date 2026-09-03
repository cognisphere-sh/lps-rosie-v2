# Visual UI release QA

- Candidate commit: `<full SHA>`
- Reviewer task thread: `<thread id>`
- Implementer/technical reviewer: `<identity or task thread; must differ>`
- Evidence directory: `<workspace/threads/<parent>/files/visual-qa/<sha-or-release>/`>
- Requirement: `<path/link>`
- Reference: `<path/link, or “none supplied — assessed against requirement”>`
- Preview: isolated worktree on non-production port (no live deploy)
- Result: **PENDING**

## Scope and state matrix

| Screen | Route | State | 320 | 390 | 480 | Desktop | Reference |
|---|---|---|---|---|---|---|---|
| `<screen>` | `<path>` | `<collapsed/open/etc>` | `<file>` | `<file>` | `<file>` | `<file>` | `<reference/none>` |

Every affected collapsed/expanded, open/closed, empty/loading/error, selected/unselected, or otherwise changed rendered state belongs in this matrix. Remove states only with a written scope reason.

## Findings

| Severity | Viewport/state | Criterion | Finding | Required correction |
|---|---|---|---|---|
| `<blocker/major/minor/note>` | `<width/state>` | `<spacing/hierarchy/truncation/labels/placement/touch/state/reference>` | `<specific observation>` | `<action or none>` |

## Required assessment

- Spacing and density: `<pass/fail + observation>`
- Visual hierarchy: `<pass/fail + observation>`
- Truncation and wrapping (including long/empty data): `<pass/fail + observation>`
- Labels and meaning: `<pass/fail + observation>`
- Control placement: `<pass/fail + observation>`
- Touch targets at phone widths (usable target about 44×44 CSS px unless the requirement specifies otherwise): `<pass/fail + observation>`
- Every affected state transition: `<pass/fail + observation>`
- Reference comparison: `<pass/fail/not supplied + concrete similarities/differences>`

## Decision

**PASS / FAIL** — `<concise rationale>`

- A FAIL blocks app restart/deploy. Fix the candidate, commit it, create a new exact-commit preview, and repeat affected captures/review.
- PASS covers visual acceptance only. Technical/code review, tests, typecheck/build, accessibility and deployment health remain separately required.
- Reviewer attestation: `I did not implement this candidate and reviewed the rendered evidence in a real browser.`
- Reviewed at: `<YYYY-MM-DD HH:MM timezone>`
