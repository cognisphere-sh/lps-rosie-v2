---
name: visual-ui-release-qa
description: Visual check before deploying a UI change — preview the committed primary checkout, screenshot affected states at 320/390/480/1440 in a real browser, and have one fresh task thread review the PNGs against Chris's reference and record PASS/FAIL. Covers the primary dev preview, login/capture helpers, browser-only synthetic states, the review template and what blocks a deploy. Use for any app change that can affect what is rendered; skip for non-UI changes. (v2.1.0)
metadata:
  author: nova
  version: "2.1.0"
---

# Visual UI release QA

Chris's requirement (Lily `requirements/visual-ui-qa-gate.md`): before a UI
change goes live, someone other than the builder looks at real screenshots at
phone and desktop widths. A FAIL blocks the deploy. That is the whole gate.
Expect it to take minutes.

Run from the app-home root. `skill=harness/agents/nova/skills/agent/visual-ui-release-qa`.

## 1. Preview the committed primary checkout (builder)

Finish the targeted checks, then commit only your changes in the primary
checkout. Coordinate overlapping operator edits first: do not include them in
your commit or silently preview/deploy a different dirty app. Run the existing
dev command on an unused local preview port in a terminal you own:

```bash
sha=$(git rev-parse HEAD)
pnpm --dir app dev --hostname 127.0.0.1 --port 3100
```

Keep that terminal running for capture. Next's development output is
`.next/dev`; this is not a separate production build. Do not create a worktree,
install dependencies, override production environment/fonts, or run
`server.sh dev` (it also generates secrets and starts the harness). The old
`scripts/preview` helper is retained for history, **not the current procedure**:
neither its start nor stop command is used.

Run one heavy step at a time: no typecheck, other build or operator test suite
alongside preview startup/compilation. Check actual available memory rather
than forcing past pressure (see *Shipping a change* §Memory).

## 2. Capture screenshots (builder)

```bash
evidence=harness/agents/nova/workspace/threads/<parent>/files/visual-qa/${sha:0:12}
mkdir -p "$evidence" && cp "$skill/artifacts/review-template.md" "$evidence/review.md"
# Skip login if this preview already has a legitimate authorized session.
"$skill/scripts/login" 3100 visual-ui-qa   # supplied QA credentials in env; never echo them
"$skill/scripts/capture" --evidence "$evidence" --screen <screen> --state <state> \
  --path <route> --width 390 --port 3100 --session visual-ui-qa
```

Reuse a legitimate authorized browser session or use the normal login helper
with supplied QA credentials; never forge a cookie or record credentials.
For synthetic states, use existing browser/CDP request interception with a
finite set of synthetic responses. Fulfill only expected mocked business
writes and deny all unexpected business POST/PATCH/PUT/DELETE requests before
interaction. Do not edit real jobs/orders, add production fixture routes, or
expose private data in screenshots. Keep disposable setup under `/tmp`.
If the existing tools cannot safely intercept the needed states, report the
concrete limitation rather than building a new QA framework.

For each affected screen and state (open/closed, expanded/collapsed, wherever
the change shows), capture at widths **320, 390, 480 and 1440**. Use the
browser to reach each state; don't infer it from source. Then close the browser:

```bash
harness/agents/nova/scripts/agent/agent-browser --session visual-ui-qa --json close
```

Stop **only your preview dev server**, with Ctrl-C in its owned terminal (or
terminate its known owned process group if launched in the background).
Do not stop the live app/harness or another operator's process. The preview
and browser must both be stopped before the deployment build.

## 3. Independent review (one fresh task thread)

Spawn one task thread that did not build the change. Give it the evidence dir,
the requirement and Chris's reference image (if any). It looks at the PNGs and
fills in `review.md`: spacing, hierarchy, truncation, labels, control
placement, touch targets of about 44px on phones, and match to the reference.
It replies **PASS**, or **FAIL** with a list of fixes. It does not run builds
or tests.

## 4. Decide

- **PASS:** deploy (`sudo ./scripts/server.sh restart app`). Keep the evidence
  dir and attach one screenshot to the report.
- **FAIL:** fix, commit, re-capture only the affected views, and send them to
  the same reviewer thread. Escalate to the human after a second FAIL.
- A preview that won't build or start is a FAIL. Fix the build; don't skip
  the check.
