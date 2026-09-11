# Give Rosie turquoise and reference blue reusable accent palettes

- Status: routed
- Route: nova
- Raised: 2026-09-09 by Chris (via Nova handoff; Telegram message 562 / photo 562)
- Updated: 2026-09-09

## Problem

Chris wants the visual language in his reference preserved: Rosie reads in turquoise, while the CR label and its left-rail marker read in a light blue. Today those colours are not a named, reusable app palette, so future UI work could approximate them inconsistently or accidentally overload them as statuses.

## Evidence

- 2026-09-09 — Chris supplied message 562 / photo 562 and asked that the screenshot's Rosie turquoise and CR/left-rail light blue be added to the palette. The dark reference shows a bright turquoise Rosie label and a distinct light-blue CR label and vertical rail accent.
- Current app audit — the app already has a user-selectable global app accent and status-tone palette. This request is for additional reusable visual accents, not a replacement for either.

## What it should do

Create two **semantic-neutral accent families**, visually sampled from photo 562:

- `turquoise` — the Rosie-reference hue (approximately the screenshot's bright aqua/turquoise).
- `light-blue` — the CR/left-rail-reference hue (approximately the screenshot's clear light sky blue).

For each family, expose the same named roles in both light and dark themes:

- `--lps-accent-<family>-text` — readable accent text/icons on the normal page or card surface.
- `--lps-accent-<family>-border` — a restrained outline, rule, or rail marker.
- `--lps-accent-<family>-soft` — a subtle non-text surface/tint.
- `--lps-accent-<family>-solid` and `--lps-accent-<family>-on-solid` — an optional stronger fill and its readable foreground when a component genuinely needs one.

Nova may tune the exact values from the JPEG reference to meet contrast in each theme; the reference hue and the visible distinction between turquoise and light blue must remain recognizable. Accent text and `on-solid` foregrounds must meet normal-text contrast requirements in their actual rendered pairings. Soft fills and borders must not be the sole way a user learns meaning.

Use these palette names as color-family names only: they do not imply a job, plant, availability, customer-review, error, success, warning, selected, or workflow state. A component may deliberately use turquoise for Rosie identity cues and light-blue for an informational/reference or rail cue like the reference, but must still supply words, icons, or other non-color context where meaning matters.

Make the tokens available for future component work without globally recoloring existing screens. Preserve the saved App header & accent setting, default app accent, existing chat themes, and all current status/destructive palettes and mappings unless separately required.

## Acceptance criteria

- The app has documented, reusable `turquoise` and `light-blue` accent families with the exact role names above in both light and dark themes.
- In a dark rendered reference/swatch view, turquoise reads like the photo's Rosie label and light blue reads like its CR label/rail marker; they are visibly distinct rather than two near-identical blues.
- Each family provides a usable accent-text pair, subtle border, soft surface, and solid/on-solid pair in both themes; normal-size rendered text meets contrast requirements against its actual surface.
- A component can use Rosie turquoise or reference light blue without introducing a status/workflow meaning, and any meaningful use remains understandable without color alone.
- Existing global app-accent choices, per-agent chat themes, existing status tones, destructive treatment, and unrelated UI retain their present colors and behavior.
- Before release, Nova's visual UI QA records light and dark captures at 320px, 390px, 480px, and desktop, including the rendered turquoise/light-blue reference uses; it compares the dark result with photo 562 and checks text, border, and soft-surface legibility.

## Out of scope

- Assigning either accent a plant, job, availability, customer-review, error, warning, success, selected, or workflow status meaning.
- Changing saved status values, status mappings, workflows, or database behavior.
- A global recolor of the app, replacing the user-selected App header & accent option, or changing existing chat-theme choices.
- Retrofitting every existing component to use either new accent family.

## Assumptions

- The JPEG is a visual hue reference, not a demand for pixel-exact reproduction; Nova will select contrast-safe theme values.
- `turquoise` and `light-blue` are deliberately hue-based names so they remain reusable and do not encode business semantics.
- Initial visible use may be limited to the requested Rosie and CR/rail-style cues; token availability is the requested foundation for later deliberate use.

## Open questions

- None.

## Handoff log

- 2026-09-09 — Routed to Nova: add contrast-safe light/dark semantic-neutral `turquoise` and `light-blue` accent families; preserve existing global accents and status semantics; run reference visual QA.
- 2026-09-09 — Nova acknowledged and assigned the work to its palette audit/implementation owner. Scope remains token definitions plus representative component evidence only; technical checks and independent visual QA are required before deployment.
- 2026-09-09 — Nova reports implementation landed in commit `9751f5d` after Focused (`092348d`), Plant (`0fc8155`) and Portal (`d14157e`): 20 light/dark tokens with reviewed Rosie/Job-Request representative accents. Independent technical release gate and exact-commit visual QA are pending; it is not deployed.
- 2026-09-11 — Nova reports exact-stack `9751f5d` passed independent visual QA (120 states/screenshots, no blockers) and technical gate/build (257/257 tests). Awaiting Bhoumik’s explicit app-only restart authorization; not deployed, so status remains routed.
