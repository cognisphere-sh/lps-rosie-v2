# visual-ui-release-qa — changelog

## 2.0.0

- Cut to Chris's requirement: preview the commit, capture at 320/390/480/1440, have one fresh reviewer thread record PASS/FAIL, and a FAIL blocks the deploy. Dropped the exact-commit identity proofs, the separate technical-review thread, the exhaustive state matrix and the dual-approval naming. Between Oct 2 and Oct 3 2026, the old process kept a 38-line UI change undeployed for 30+ hours across 45 task threads (`docs/harness/nova-session-review-2026-10-05.md`). Helper scripts unchanged.

## 1.0.1

- Corrected login/capture browser-wrapper resolution so documented app-home-root invocations work independently of the caller's current directory.

## 1.0.0

- Initial release-blocking visual QA process: independent real-browser review at four required viewports, isolated exact-commit preview tooling, secret-safe login, retained evidence template, and explicit PASS/FAIL handling.
