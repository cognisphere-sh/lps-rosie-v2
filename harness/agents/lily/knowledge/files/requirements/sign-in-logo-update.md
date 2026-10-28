# Update the sign-in logo

- Status: routed (source + bounded read-only preview QA VERIFIED on6b7cbd564998; NOT SHIPPED, release held)
- Route: nova (sole UI owner)
- Raised: 2026-10-27 by Chris (Telegram)
- Updated: 2026-10-27 10:45:28 CDT

## Problem

The sign-in screen currently presents Local Plant Supply as a plain stacked text wordmark, rather than the new logo Chris supplied. Chris explicitly wants the new artwork on sign-in, not a wider rebrand.

## Evidence

- `telegram:-1004474937526:386`, 2026-10-27 10:19:34 CDT: authoritative new logo image at Lily `plugins/telegram/inbox/ChatGPT Image Aug 20, 2026, 11_47_00 AM.png`. LOCAL PLANT SUPPLY, cactus, Sourcing Made Simple.
- `telegram:-1004474937526:387`, 10:19:51 CDT: exact “Can we update the logo”, with private `plugins/telegram/inbox/photo_387.jpg` showing existing sign-in branding at left and login form at right.
- `telegram:-1004474937526:389`, 10:20:04 CDT: exact “sign in”, answering Lily388 location question. No additional use-location question needed.
- Bounded local source/reference check: `workspace/threads/main/tasks/lps-logo-update/source-check-2026-10-27.md` on Lily. Actual current brand presentation is inline text/artwork, not an existing image file. Shared auth frame also serves change-password; that surface is NOT included.

## What it should do

Use Chris's supplied logo as the main Local Plant Supply branding on the sign-in screen only, in place of the old plain stacked wordmark. Keep the existing sign-in layout, surrounding brand-field/theme treatment, decorative leaf/seedlings and form behavior except for the minimum local logo sizing/spacing needed to fit the artwork. No navigation or authentication redesign.

The authoritative original is a transparent RGBA PNG, 1600×533 (approximately3:1); black viewer surround is not a baked-in black tile. Preserve the artwork, wording, tagline, cactus, colors and aspect ratio. Faithful asset optimization is fine; no redraw, fabricated vector, recoloring/inversion, stretching or content cropping. Check its real compositing/legibility on the existing background; do not solve readability by changing the global theme. If the original cannot be read without a materially different brand-field treatment or altered artwork, report that specific blocker rather than inventing a rebrand.

## Acceptance criteria

- Opening sign-in on desktop shows the supplied logo, including cactus and tagline, replacing the old large stacked text branding without duplicate wordmarks.
- The phone/tablet sign-in band fits the complete logo without stretching, clipping, horizontal scroll or overlap. At narrow320px and representative390/430px, tablet and desktop widths, branding stays recognizably readable and does not push the form out of usable reach; use the available band width rather than forcing a tiny header-sized stamp.
- Actual light/dark supported-theme compositions render transparency correctly, without an artificial black rectangle, illegible dark-on-dark mark or unapproved global palette change. Original raster fidelity is checked at normal and high-DPI display sizes.
- Local branding has an appropriate accessible Local Plant Supply name/heading; decorative imagery does not duplicate speech. Sign-in heading/form labels, keyboard focus order, autofill, error/busy/disabled behavior and existing touch target sizes/44px controls are preserved. Do not turn the logo into a new action/link.
- Initial sign-in fallback and hydrated form use the same branding without old-logo flash or material logo-driven layout shift. Missing/failed image still leaves an accessible brand identity and usable form.
- Username/password processing, safe deep-link return, forced password change, role routing, sessions, permissions and all existing controls/links are unchanged. No backend calls or real login submissions are required merely to validate the branding.
- Change-password and every other existing brand consumer remain visually/behaviorally unchanged; shared-frame defaults must not broaden this sign-in-only request.
- Builder supplies scoped technical verification and actual rendered mobile/desktop visual evidence, plus one independent technical AND rendered responsive review before any live shipment. Private screenshot/form contents are not published as app assets or evidence. Only the user-provided brand artwork is an intended sign-in asset.

## Out of scope

- Change-password, app/sidebar/portal branding, quote/print/email/public marketing branding, favicons, PWA/install/splash icons, Android/browser theme metadata and global color/theme changes.
- Navigation, notification/model/settings changes; authentication/role/session changes; database, workflow, money/status changes; any SOP/script changes.
- Publishing the reference screenshot, extracting its form contents, logging in, altering business records, bypassing approval/safety gates or bundling unrelated pending UI.

## Assumptions

- “sign in” means the existing shared-entry sign-in screen used by staff and partners; no role-specific new logo or second login introduced.
- Minimal local sizing/spacing is part of fitting the supplied asset; redesigning surrounding page colors/brand system is not.
- This clear explicit UI request is ready for Nova source work, behind existing higher-priority incidents/holds and current operator-owned baseline. It is not a new builder assignment outside Nova.

## Current verified outcome / remaining release constraint

2026-10-27 10:45:28 CDT — Parent relays Nova10:45:14 PREVIEW-ONLY validation complete, exact candidate `6b7cbd564998efafc46e0dd707e29c2679aef3e6`, parent67b13c77/six owned paths. Typecheck+15focused PASS; ONE fresh independent technical/visual/overall VALIDATION PASS based on exact six-file diff, rawJSON, test logs, original assetSHA and all17PNGs personally read by reviewer. Full artwork/tagline alpha on Edge Teal light/dark,320/390/430/480/768/1440 and emulatedDPR3, focus/missing-image/short-scroll/form fit/accessibility size reservation/both SSR branches verified within preview scope. Change-password default/source and authentication source unchanged, not change-password rendered QA. No Lily re-review/browser/tests/source audit.

Limits: inherited36px controls were preserved, not increased to44px or claimed44-compliant; this logo change does not fix existing touch sizing. No actual autofill/auth submit/error-busy/backend verification, change-password render, saved-theme persistence, native-device DPR proof or all-timing filmstrip (network-worker limit). Preview browser closed; no836 interception tool, credentials or businessAPI used. Human safe preview photo receipt/message ID is UNCONFIRMED; do not assert852 delivered. Source+read-only QA VERIFIED is not live shipping, full auth verification or general836 clearance. Release CI836/approved operator-baseline HOLD remains; NO deployment/build-restart/CI operations authorized. Await owner/operator release disposition, no new Chris question.

Evidence (Nova root): `workspace/threads/main/tasks/review-sign-in-logo-update/files/review.md`; `workspace/threads/main/files/visual-qa/6b7cbd564998-sign-in-logo/QA.md`. Owner-reported evidence only; Lily did not re-read/re-run.

## QA authorization and baseline boundary

2026-10-27 10:30:58 CDT — Parent relays Nova10:30:45: Pi850 at10:28:56 exact “Yes” answers Nova849 read-only sign-in QA request. Narrow safe scoped typecheck/fixture tests and unauthenticated sign-in PAGE browser are now authorized; same builder may prepare fresh-base own-paths commit candidate only, then checks and ONE fresh independent review. No real credentials/login submit, failed836 interception tool, CI testing, DB audit/tool repair or DEPLOY authorized. Current bounded sign-in QA authorization supersedes only the earlier blanket wait for this path; not a general836 lift or release approval. Await actual checks/review/baseline proof, no sourcePASS implied. Nova851 human acknowledgment delivered; CLI quote failure occurred afterward before internal briefs and was fixed by internal resend only, no duplicate human receipt.

Existing CI candidate a60 is COMMITTED UNVERIFIED and836 incident STOP/disposition remains with Pi/Nova. As of Nova10:28:37, a60 remains an ancestor of operator-evolved HEAD67b13c77fa0c23842a9bf1cdefa5d7ee46363d1e: not byte-equivalent, reviewed or cleared simply because operator changes followed it. This request does not authorize resuming held preview/interception/runtime/QA/deploy cycles or changing their gates. Nova must use a freshly confirmed approved operator base, prevent unrelated unreviewed CI from silently entering a logo release, and resolve current host/safe validation permission constraints before execution. Source UI approval plus Pi850 permits only the bounded sign-in QA described above, not release or a shipped claim. Lily performed only bounded source/image inspection, no app code, tests, browser, backend or DB work.

## Handoff log

- 2026-10-27 10:20:33 CDT — Full sign-in-only approved UI requirement delivered successfully to Nova main, sole existing owner; includes authoritative asset/private-reference paths, shared-frame blast boundary and CI836 stop/fresh-base constraint. No builder completion, rendered QA or release claim.
- 2026-10-27 10:24:10 CDT — Parent relays Nova10:23:55 ACCEPTED sign-in-only scope/asset hash. ONE owner-assigned builder preparing narrow source and test coverage ONLY, preserving change-password/shared frame default/auth. Preparation is not implemented, tested or shipped. No tests/browser/login/build/deploy resumption or unverified CI adoption authorized;836/current operator-baseline constraints intact.
- 2026-10-27 10:28:49 CDT — Parent relays Nova10:28:37 SOURCE-READY ONLY, UNCOMMITTED/UNVERIFIED/UNDEPLOYED at exact HEAD67b13c77fa0c23842a9bf1cdefa5d7ee46363d1e. Owner reports six own paths: auth-frame opt-in default false, login both branches, original PNG, new focused test, README and CHANGELOG bullet. Change-password default untouched. Source/destination SHA2560a6a32c51631ad2f8e6669c8d77ca91a77d7eb3ddcbd5981e842e90a25af2ba5 MATCH,1600×533RGBA/no redraw/flattening. Reports full-width max800/reserved3:1, single accessible h1/empty image alt/no action/form unchanged; these are source facts, not rendered acceptance. SIX focused cases AUTHORED NOT RUN; no parser/test/browser/auth/build/deploy executed. Actual alpha compositing/readability on #087F8C and #42C7C9 OPEN, not PASS. Material backing plate requires approval, not an implied styling fix. CIa60 remains ancestor of operator-evolved HEAD, not byte-equivalent or cleared.836/Pi hold INTACT. Nova already asks Pi ONE baseline plus bounded read-only logo QA path, no failed interception/no credentials submission; no duplicate Lily test/audit/Pi ask or Telegram. Await actual QA authority and baseline proof before execution. Owner notes: Nova `workspace/threads/main/tasks/sign-in-logo-update/notes.md` (not re-read by Lily). Source receipt `nova:main:2026-10-27T10:28:37:sign-in-logo-source-ready`.
- 2026-10-27 10:30:58 CDT — Pi850 exact “Yes” (owner-relayed via Nova10:30:45) clears ONLY safe bounded sign-in QA path: scoped typecheck/fixture tests, unauthenticated sign-in PAGE browser, fresh-base own-paths commit candidate/checks and ONE fresh independent review. No credentials/login submission/failed836 tool, CI testing, DB audit/repair or deployment. Nova851 acknowledgment delivered; internal quoting retry not reason to resend human receipt. Actual checks/review unreported; all release pending836/operator baseline. Stable feedback `nova:main:2026-10-27T10:30:45:sign-in-logo-pi850-qa-approval`.
- 2026-10-27 10:45:28 CDT — Nova10:45:14 owner report verifies source + bounded read-only preview QA on exact6b7cbd564998efafc46e0dd707e29c2679aef3e6, type+15focused PASS and ONE independent technical/visual/overall PASS. Scope/evidence/limits recorded above; NOT SHIPPED,836/operator-base release HOLD unchanged. Human preview-photo receipt ID remains unconfirmed (do not assume852). Stable feedback `nova:main:2026-10-27T10:45:14:sign-in-logo-preview-validation`.
