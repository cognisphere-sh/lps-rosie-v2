# House style for app videos

Implemented in `video/partner-onboarding/src/` (`ui.tsx`, `Chapter.tsx`,
`Cards.tsx`, `data.ts`). This file describes it so a change request can be
checked against it; the code is the source of truth.

## Frame

- 1920×1080, 30 fps, H.264 (crf 18) + AAC 192 kHz. Poster at 40 % in.
- Background `#F9FCF7`. Header strip: leaf mark + "Local Plant Supply" (Playfair)
  on the left, "N / total · Chapter title" on the right (teal number).
- Slim teal progress bar along the bottom edge, filling over the chapter.

## Palette (the app's light tokens, `app/app/globals.css`)

| Token | Hex | Use |
|---|---|---|
| ink | `#1E3B28` | text |
| bg | `#F9FCF7` | canvas |
| card | `#FFFFFF` | caption cards, message card |
| teal | `#087F8C` | rings, accents, eyebrows, progress |
| secondary | `#E4F1F2` / `#17646C` | highlight sweeps |
| tint | `#E6F1E7` | soft fills |
| muted | `#48594B` | secondary text |
| accent | `#BDE7E5` | home-screen wallpaper card |
| line | `#DDEBDD` | borders |

## Type

Playfair Display (500/600) for titles and the wordmark; Inter (400–700) for
captions and UI text. Captions ≤ 6 words, UI labels in bold.

## Footage

- **Desktop** (1440×900 CSS at 2×): inside a browser window (rounded 18 px, thin
  top bar with three dots and a pill "Local Plant Supply · Partner portal"),
  caption as a lower-third card with a teal accent bar.
- **Phone** (390×844 CSS at 3×): inside a dark-bezel phone mock-up left of
  centre; the right side shows "CHAPTER N", the chapter title and the current
  caption in large type.
- Zooms: spring ~0.6 s, framing the whole target (≥ 1.15× push-in), clamped to
  the footage. Rings: 3 px teal, rounded, soft glow, pop in, hold ~1.8 s,
  dropped if shown < 0.6 s, end on navigation.
- Device switch: ~270 ms fade of the whole layout; same-device take change:
  hard cut.

## Cards

Chapter intro 1.6 s (sprout, "CHAPTER N", title, whoosh + chime), outro 1.2 s
("Next: …" or "You're all set"). Motion-graphic beats (title card, message
card, home screen, end card) follow `Cards.tsx`.

## Sound

- Narration: Kokoro `af_heart` (American), speed 0.98, about -19 LUFS after
  the mix. Supplier voice notes: Kokoro `am_michael`.
- Music: `public/sfx/bed.wav` (synthesized pad), ducked under the voice.
- SFX (synthesized with ffmpeg): `click` per click/tap, `tick` while typing,
  `whoosh` on navigation and intros, quiet `pop` on rings, `chime` on success
  beats, `ding` when an LPS reply or alert lands.
