# Gate UI releases on real visual review

- Status: shipped
- Route: nova
- Raised: 2026-09-01 by Chris (via Telegram message 534 / live mobile All Jobs photo 532)
- Updated: 2026-09-03

## Problem

The mobile All Jobs card could pass its structural and technical checks while still looking poor in the live phone view. Chris found excessive empty space, weak hierarchy, unclear controls, and premature truncation only after it shipped. Technical code review can verify correctness, but it does not reliably judge whether a customer-facing screen is visually usable.

## Evidence

- 2026-09-01 — Chris called the shipped mobile All Jobs card “pretty terrible”; the first correction then structurally met the requested two-row design but the live mobile result remained visually poor.
- 2026-09-01 — Chris asked for a QA agent and approved a dedicated visual QA gate before UI deployment, using live-browser screenshots and reference-image comparison.

## What it should do

Before every UI/UX release is deployed, run an independent visual QA gate in a real browser. Nova owns integrating and maintaining this release process because Nova owns the app deployment and developer tooling.

The gate must capture the affected screen(s), including relevant collapsed and expanded states, at **320px, 390px, 480px, and a desktop viewport**. It compares those screenshots against Chris’s applicable visual reference when one exists and reviews the actual rendered experience for spacing, visual hierarchy, truncation, labels, control placement, touch-target usability, and expanded-state behavior.

The visual reviewer is independent of the implementation/code review: technical review continues to check functional and engineering correctness; visual QA judges whether the deployed UI looks and works as intended. A failed visual review blocks the UI release until Nova fixes the findings and the affected views pass a repeat review.

For each UI release, retain the screenshots and a concise pass/fail record with findings, affected viewport/state, and the reference used (or that no reference existed), so Chris and Nova can inspect what was approved.

## Acceptance criteria

- Every UI/UX release has an independent visual-QA result before deployment; a technical/code review alone does not satisfy the gate.
- The reviewer uses a real browser and captures the affected screen at 320px, 390px, 480px, and desktop before approving release.
- Where Chris supplied a visual reference, the review explicitly compares the rendered screen against that reference; where none exists, the record says so and assesses the stated UI requirement.
- The review covers spacing, hierarchy, text truncation/wrapping, labels, control placement, minimum usable touch targets, and every affected collapsed/expanded or open/closed state.
- Each review leaves an inspectable pass/fail record and attaches or links the viewport screenshots, identifying the screen, state, reference, and any findings.
- A visual-QA failure blocks deployment of the affected UI change until findings are corrected and the failed views are re-reviewed successfully.
- Technical correctness review remains separate and continues to cover functionality, regressions, accessibility/engineering checks, and build/test health; it is not replaced by visual QA.
- The gate does not block non-UI-only releases that cannot affect rendered app behavior.

## Out of scope

- Replacing Nova’s existing code review, automated tests, accessibility checks, or deployment health checks.
- A subjective redesign of a screen without an existing requirement or Chris reference.
- Retroactively changing already shipped screens solely to generate baseline screenshots.
- Making a new customer-facing app screen for QA records.

## Assumptions

- A dedicated visual QA agent may be a separate Nova-owned task/agent or an equivalent isolated reviewer, but it must not be the same implementation pass approving itself.
- Nova will choose practical storage/attachment and invocation details in its developer-owned tooling, provided the approval evidence is inspectable and remains associated with the release.
- Chris’s approval in message 534 authorizes Nova to add or revise Nova-owned QA skills/scripts/process assets needed to operate this gate.

## Open questions

- None. Nova may select the least disruptive practical integration with its existing pre-deploy workflow.

## Handoff log

- 2026-09-01 — Routed to Nova: establish a release-blocking, independent visual QA gate with real-browser viewport screenshots, reference comparison, retained evidence, and repeat review after fixes.
- 2026-09-03 — Nova implemented and committed the mandatory Nova-owned gate in `fc51129`: `visual-ui-release-qa` uses an exact-commit isolated preview, independent reviewer, real-browser 320/390/480/desktop captures, reference/usability rubric, retained manifest/review evidence, and a hard FAIL deployment block. Technical gate remains separate. The current mobile-card/focused release will be its first gate.
- 2026-09-03 — Nova corrected the helper path in `ab3e3cc`, then retested exact-commit preview, login, 320px capture and cleanup. The valid gate is now `fc51129` + `ab3e3cc`, with a working root invocation.
