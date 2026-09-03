---
name: visual-ui-release-qa
description: Gate every UI/UX app release on an independent real-browser visual review before deployment. Covers exact-commit isolated Next.js preview start/stop, secret-safe browser login, 320/390/480/desktop state screenshots, reference and usability assessment, retained manifest/evidence, blocking PASS/FAIL rules, and the separate technical gate. Includes safe preview/login/capture scripts and a review template. Use before restarting/deploying any change that can affect rendered app behavior, and when repeating visual review after fixes. (v1.0.0)
metadata:
  author: nova
  version: "1.0.0"
---

# Visual UI release QA

This is a **mandatory pre-deploy gate** for changes that can affect rendered app behavior. A visual PASS does not replace technical review; a technical PASS does not replace this gate. Non-UI-only changes that cannot affect rendering are exempt, but record that scope decision in the release notes.

## Non-negotiable safety boundaries

- Review an exact committed candidate, never a dirty working tree. Preserve unrelated work.
- Preview only in the `scripts/preview` temporary detached git worktree under Nova's private cache, with its own `app/.next`, on loopback and a non-production port. Port 3000 and the live `app/` path are refused.
- Never restart the app or harness while preparing/reviewing evidence. A FAIL blocks any restart/deploy.
- Never put credentials, cookies, browser state, environment files, build/server logs, or secret values in evidence. The preview script exports the existing `app/.env.local` in-process but never copies it.
- The visual reviewer must be an independent Nova task thread that did not implement the candidate or perform the technical approval.

## 1. Decide scope and protect the candidate

1. From the app-home root, inspect `git status --short`. Commit only the intended UI release paths; do not stash, reset, clean, or include unrelated changes.
2. Record the full candidate SHA with `git rev-parse HEAD`. If the intended UI paths are not all in that commit, stop: an uncommitted candidate cannot pass.
3. List every affected screen/route and rendered state. Include collapsed/expanded, open/closed, selected/unselected, empty/loading/error, long-text/truncation, and breakpoint-specific variants wherever the change can affect them. State why any plausible state is out of scope.
4. Locate Chris's applicable reference image/path. If there is none, explicitly use `none supplied — assessed against <requirement path>`.
5. Keep technical review as a separate checklist/task thread: functionality, regressions, automated tests, accessibility/engineering checks, typecheck/build, and deployment health.

## 2. Create inspectable evidence and delegate independent review

Use a release-specific directory under the parent thread's durable files, for example:

```bash
candidate=$(git rev-parse HEAD)
evidence="harness/agents/nova/workspace/threads/<parent>/files/visual-qa/${candidate:0:12}"
mkdir -p "$evidence"
cp harness/agents/nova/skills/agent/visual-ui-release-qa/artifacts/review-template.md "$evidence/review.md"
printf 'screen\tstate\twidth\theight\tpath\tfile\n' > "$evidence/manifest.tsv"
```

Spawn an independent task thread and point it at the candidate SHA, evidence directory, affected route/state matrix, requirement and reference. Name this skill in the brief. Require it to inspect the actual browser rendering, complete `review.md`, and report PASS or FAIL. Do not ask the implementation or technical-review thread to self-approve visuals.

## 3. Start the isolated exact-commit preview

From the app-home root:

```bash
skill=harness/agents/nova/skills/agent/visual-ui-release-qa
"$skill/scripts/preview" start --commit "$candidate" --port 3100
```

The helper:

- resolves the commit and creates `$XDG_CACHE_HOME/nova-visual-ui-preview-3100/worktree` (or `~/.cache/...`) detached at that exact SHA;
- seeds a hard-linked, worktree-local dependency tree, verifies it against the candidate lock in offline mode, and keeps build output in the worktree's isolated `app/.next`;
- binds Next to `127.0.0.1:3100`, refuses port 3000/live paths/occupied ports, and leaves runtime logs only in that private temporary cache;
- cleans the worktree on build/start failure.

Check the printed JSON or run `scripts/preview status --port 3100`; its full commit must equal the candidate. If build or startup fails, the gate cannot pass.

Always clean up, including after failures or interruption:

```bash
"$skill/scripts/preview" stop --port 3100
```

`stop` is idempotent, terminates the recorded server, force-removes the temporary worktree, and deletes runtime files.

## 4. Authenticate without recording credentials

Use a dedicated ephemeral `agent-browser --session` name. Credentials must already be present in the reviewer's process environment as `VISUAL_QA_USERNAME` and `VISUAL_QA_PASSWORD`; never write them inline in a task brief, command, note, screenshot, manifest, or review. Then run:

```bash
"$skill/scripts/login" 3100 visual-ui-qa
```

The helper suppresses browser command output and writes no state file. Do not use `--session-name` or `state save`, because those persist cookies. After review, run:

```bash
scripts/agent/agent-browser --session visual-ui-qa --json close
unset VISUAL_QA_USERNAME VISUAL_QA_PASSWORD
```

If credentials are not safely available in the environment, stop and ask the operator to establish them outside chat/evidence. Never improvise by printing or recording them.

## 5. Exercise and capture every state in a real browser

For **each state at each width** 320, 390, 480 and desktop 1440:

1. Set the viewport before navigating: `agent-browser --session visual-ui-qa --json set viewport <width> <height>` (recommended heights: 800, 844, 900, 1000).
2. Open the exact loopback preview route.
3. Use snapshots and real clicks/keyboard input to establish that state. Do not infer an expanded/open state from source code. Use representative long and empty data where available; do not mutate production data merely to manufacture evidence.
4. Confirm state and page content in the browser, then capture it:

```bash
"$skill/scripts/capture" \
  --evidence "$evidence" --screen all-jobs --state collapsed \
  --path /jobs --width 390 --height 844 --port 3100 --session visual-ui-qa
```

The helper refuses non-required widths, port 3000, the wrong origin/route, writes the PNG under `screenshots/`, and appends a row to `manifest.tsv`. Repeat the interaction independently at every viewport; do not resize an already-open disclosure and assume equivalent behavior.

Inspect the actual PNGs, not just DOM snapshots. Ensure the manifest has one row/file for every route × state × required viewport, files are non-empty, and no screenshot contains a visible credential or unrelated sensitive view.

## 6. Review against reference and usability criteria

The independent reviewer completes `review.md` with concrete viewport/state observations for:

- spacing and excess/insufficient whitespace;
- visual hierarchy and reading order;
- truncation/wrapping, including premature clipping and long/empty values;
- accurate, understandable labels;
- control placement and discoverability;
- usable phone touch targets (normally about 44×44 CSS px unless the requirement says otherwise);
- every affected state transition and its resulting layout;
- explicit similarities/differences to Chris's reference, or the named requirement when no reference exists.

A subjective redesign is out of scope: judge the candidate against the requirement/reference and basic usability. Findings identify exact screen, state and viewport.

## 7. Enforce the decision

- **PASS** only when all scoped state/viewport files exist, the manifest and assessment are complete, no blocking visual findings remain, and the independent-review attestation is signed.
- **FAIL** for any missing required capture, material mismatch, unusable hierarchy/spacing/truncation/labels/placement/touch/state behavior, preview uncertainty, or incomplete evidence.
- On FAIL: do not restart/deploy. Fix the UI in a new commit, start a new exact-commit preview, and repeat all affected captures. Preserve prior failed evidence; use a new candidate directory so the audit trail remains inspectable.
- On PASS: retain the screenshots, `manifest.tsv`, and `review.md` under the parent thread files. Then—and only if the separate technical gate also passes—deployment may proceed through the normal app restart process.

Before deployment, the coordinating thread must be able to name both approvals: **technical PASS** and **visual PASS at `<candidate SHA>`**. A later commit invalidates the visual PASS if it can affect the reviewed rendering.
