# Make the Android top band black or charcoal

- Status: shipped · builder-confirmed implemented/released LIVE9c57ae821c5d; native Android device/browser/installed-mode verification OPEN, not all acceptance proven
- Route: nova · existing owner only
- Raised: 2026-10-22 by Chris (via Nova)
- Updated: 2026-10-22 14:38:28 CDT

## Problem

The teal Android system/browser band above Chris's dark Global Settings page clashes with the surrounding dark palette. Chris wants that top band black or charcoal, not a change to the model controls shown below it.

## Evidence

- 2026-10-22 14:20:29 CDT — Lily main relays Nova14:20:11: Chris Telegram821 at14:19:21 requests black/charcoal rather than mismatched teal; screenshot819 inspected privately in Nova inbox. This is attributed intent, not a reconstructed verbatim quote. Capture: `nova:main:2026-10-22T14:20:11:android-top-band-chris821` in `../feedback.md`.
- 2026-10-22 14:20:29 CDT — Nova822 acknowledged likely theme-color investigation, model settings unchanged; this initial hypothesis is superseded by the owner finding below.
- 2026-10-22 14:22:18 CDT — Nova14:22:06 owner confirms root viewport + manifest teal `#087F8C` and Shell runtime rewrite of metadata from saved accent during hydration/theme changes. Narrow candidate: existing dark-nav/card charcoal `#1A1A1A` for root/manifest, removing only accent-to-theme-color rewrite and unused helper. Preserve body theme-accent preferences, PWA splash, public availability `#0A0A0A`, iOS choices and model APIs. This is owner source evidence, not Lily re-audit, executed tests, release or physical Android appearance proof. Capture: `nova:main:2026-10-22T14:22:06:android-top-band-source-candidate`.
- 2026-10-22 14:20:29 CDT — Relevant app documentation (README PWA installability notes) describes both document and manifest color consumers, saved-accent behavior and safe-area handling. These describe possible shared scope, not proof of the cause in Chris's session or a mandate to change theme preference policy.

## Release evidence and verification limits

- 2026-10-22 14:38:28 CDT — Nova14:38:14 confirms SHIPPED/LIVE exact `9c57ae821c5d7c8463d93225b288227bc6c203fd`, parent9acca09. Root/manifest charcoal and Shell accent-metadata rewrite removal implemented; body preferences, model APIs, dedicated public availability `#0A0A0A`, iOS choices and PWA splash preserved. No global theme/preference-policy change.
- 2026-10-22 14:38:28 CDT — Five focused tests + typecheck actually builder-PASS; raw transcript not bundled, independent reviewer did NOT rerun. One independent TECH+VISUAL PASS covers source,12 page PNGs and10 hydrated theme cases; page emulation is NOT native OS/browser chrome proof.
- 2026-10-22 14:38:28 CDT — App-only restart exit0, production build/TypeScript PASS, clean source/no heavy overlap/no harness restart. BuildID `Zyr2MX2Cx4z6XYR9V4DCw`; stamped input `6bf638059e143476370b3a46f582f82090d9ede638d61d7a6bfed3bf42c199d7` recomputed MATCH. Local/public login200 serves charcoal meta and matching BuildID; manifest charcoal and six unchanged splash assets byte-match.
- 2026-10-22 14:38:28 CDT — Actual Android hardware/native browser/installed-mode appearance remains UNVERIFIED, including cache/browser-hint limitations. Invalid public AR-token GET307 is NOT live dedicated-override verification; that preservation is source-only. Release is implemented/reported live, not proof that every visible-device criterion is fulfilled.
- 2026-10-22 14:38:28 CDT — Owner evidence pointers (not Lily re-audited): `../nova/workspace/threads/main/files/visual-qa/9c57ae821c5d/deployment.md`; `../nova/workspace/threads/main/tasks/review-android-theme-color/files/review.md`. Capture: `nova:main:2026-10-22T14:38:14:android-top-band-released`. Nova823 already delivered human completion and safe synthetic page photo replying821, with device-confirmation-needed/reopen caption. No duplicate Lily external reply.

## What it should do

Make the pictured top system/browser band visually fit the current dark page using black or existing matching charcoal. Keep the page itself and all functional behavior unchanged. The released owner-confirmed change decouples browser-band color from saved body accent presentation only; users' saved body accents/preferences, PWA splash, public availability dark color and iOS behavior remain intact. This is an approved narrow presentation correction, handled by Nova's existing builder with normal verification/release gates; do not open a second implementation task.

## Acceptance criteria

- Chris's pictured dark-page context no longer has an unrelated teal top band wherever the supported Android browser/display mode honors the app's color hint; use an appropriate existing black/charcoal dark-palette value, not a sampled RGB inferred from the photo.
- Preserve current page colors, content, controls and navigation, including Global Settings model/provider/agent settings. No global header/accent rebrand, new theme framework, saved-preference rewrite or newly invented dynamic theme rule.
- The owner identifies the actual source and bounds the effect across existing document metadata, manifest, runtime styling/color consumers and other affected pages. Preserve shared light/custom-theme behavior where those consumers make it relevant; report genuine conflicts before expanding scope.
- Scope-bounded technical checks and independent technical plus rendered visual review cover the exact candidate and affected contexts, with normal release/provenance confirmation. Metadata or an emulated mobile viewport alone is not proof of Android OS/browser chrome appearance.
- Explicitly report whether actual Android hardware/browser or installed-mode verification occurred, the mode/device/browser tested if known, and remaining gaps. Do not assume all Android browsers honor hints identically, or that Chris used an installed PWA. If hardware verification is unavailable, distinguish source/rendered-page correctness from unverified native-chrome appearance; do not claim the pictured hardware result proved.
- No auth, provider/model enablement, agent settings, permissions, routing, send behavior or operational data change. If the actual source requires policy/provider behavior or an unknown workflow change, stop and split that decision before implementation outside this narrow UI slice.

## Out of scope

- Model/provider/auth configuration or credentials; operational database work.
- Wholesale headers/global palette redesign, theme framework or new preference policy.
- Unrelated All Jobs filter preview, supplier chat contrast, Job price-save UI or zero-price workflow.
- Copying/publishing the private screenshot or personal/settings details.

## Assumptions

- 2026-10-22 14:20:29 CDT — The requested surface is the Android top system/browser band above the app, not the Global tab row/model controls. Existing matching charcoal is acceptable alongside black; no separate approval question is needed.
- 2026-10-22 14:20:29 CDT — Screenshot alone establishes appearance, not cause, browser/installed mode, all-theme behavior or universal Android control.

## Open questions

- 2026-10-22 14:38:28 CDT — Native Android hardware/browser/installed-mode observation remains open; no device-level appearance proof. This is a verification limitation, not a new approval question or blocker to the builder-confirmed release. No duplicate human question, audit or builder; dedicated public override also lacks live verification (invalid-token307), with source preservation reported.

## Handoff log

- 2026-10-22 14:20:29 CDT — Parent reports existing Nova822 acknowledgment and active `android-theme-color` owner. Full focused scope/acceptance successfully delivered Nova main (CLI delivered/ok true), explicitly augmenting that existing owner, not a new builder or repeated approval request. QA/release/native-chrome result pending; not shipped.
- 2026-10-22 14:22:18 CDT — Nova14:22:06 confirms existing builder received focused acceptance, source identified and narrow charcoal/metadata-decoupling candidate scoped as above. At that time no tests/shipment; superseded by release report below.
- 2026-10-22 14:38:28 CDT — SHIPPED on Nova14:38:14 builder confirmation of exact9c57ae821c5d LIVE, with release/QA provenance above. Native-device observation OPEN, not all criteria fulfilled. Nova823 human completion already delivered; no Lily tests/browser/source audit/Telegram or unrelated All Jobs/price bundle.
