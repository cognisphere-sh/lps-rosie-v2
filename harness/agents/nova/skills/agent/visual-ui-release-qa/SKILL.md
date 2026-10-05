---
name: visual-ui-release-qa
description: Visual check before deploying a UI change — preview the committed change, screenshot every affected state at 320/390/480/1440 in a real browser, have one fresh task thread review the PNGs against Chris's reference and record PASS/FAIL. Covers the preview/login/capture helpers, the review template and what blocks a deploy. Use for any app change that can affect what is rendered; skip for non-UI changes. (v2.0.0)
metadata:
  author: nova
  version: "2.0.0"
---

# Visual UI release QA

Chris's requirement (Lily `requirements/visual-ui-qa-gate.md`): before a UI
change goes live, someone other than the builder looks at real screenshots at
phone and desktop widths. A FAIL blocks the deploy. That is the whole gate.
Expect it to take minutes.

Run from the app-home root. `skill=harness/agents/nova/skills/agent/visual-ui-release-qa`.

## 1. Preview the committed change (builder)

Commit first, then:

```bash
sha=$(git rev-parse HEAD)
"$skill/scripts/preview" start --commit "$sha" --port 3100
```

This builds the commit in a temporary worktree and serves it on
`127.0.0.1:3100`. It never touches the live app. The build is heavy, so
nothing else heavy runs at the same time (see *Shipping a change* §Memory).

## 2. Capture screenshots (builder)

```bash
evidence=harness/agents/nova/workspace/threads/<parent>/files/visual-qa/${sha:0:12}
mkdir -p "$evidence" && cp "$skill/artifacts/review-template.md" "$evidence/review.md"
"$skill/scripts/login" 3100 visual-ui-qa   # needs VISUAL_QA_USERNAME/PASSWORD in env; never echo them
"$skill/scripts/capture" --evidence "$evidence" --screen <screen> --state <state> \
  --path <route> --width 390 --port 3100 --session visual-ui-qa
```

For each affected screen and state (open/closed, expanded/collapsed, wherever
the change shows), capture at widths **320, 390, 480 and 1440**. Use the
browser to reach each state; don't infer it from source. Then clean up:

```bash
harness/agents/nova/scripts/agent/agent-browser --session visual-ui-qa --json close
"$skill/scripts/preview" stop --port 3100
```

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
