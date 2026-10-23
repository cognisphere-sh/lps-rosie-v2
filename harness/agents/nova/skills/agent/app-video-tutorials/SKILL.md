---
name: app-video-tutorials
description: Create or update narrated video tutorials of the app (partner onboarding, feature demos) in the house style, from real screen recordings of a local demo copy with made-up data. Covers scripting beats, demo data and checkpoints, Kokoro narration, Playwright recording, Remotion rendering, the public onboarding page, and checks. Includes a style guide, script and recorder templates, beat and contact-sheet checkers and schema catalog queries. Use when asked to make, extend, re-record or fix a video, tutorial, walkthrough or onboarding chapter, or when a portal screen in an existing video changes. (v1.0.0)
metadata:
  author: nova
  version: "1.0.0"
---

# App video tutorials

The house pipeline lives in the repo at `video/partner-onboarding/` (read its
`README.md` first). It produced the nine-chapter partner onboarding series on
`/partner-onboarding` (`app/public/docs/partner-onboarding.html`). Every new or
updated video reuses that project, so the styling stays identical: the
composition code in `src/` owns the look. **Never restyle `src/` for one video.**
See `artifacts/style.md` for what that style is.

## Hard rules

- **Never record production.** Footage comes only from the local demo copy
  (local Supabase in Docker, the app built from a copy with no `.env*`, the
  stand-in harness `demo/harness-mock.mjs`). `demo/reset.sh` refuses a non-local
  `API_URL`; keep it that way.
- **Made-up data only.** Hill Country Growers, login `jordan`, Texas jobs,
  `example.com` emails, `512-555-01xx` phones. Never copy a real customer,
  supplier or price into the seed.
- **Say only what the app does.** Every narration line and caption comes from
  the code (exact UI labels), and every claim about LPS behaviour from the
  agents' skills (e.g. Rosie's supplier-coordination skill). Never "LPS does X
  instantly" unless it does.
- **One heavy step at a time on the host** (see "Shipping a change" in your
  prompt): Docker stack, Next build, a recording browser, a Remotion render and
  typecheck each take GBs. Prefer a developer machine. On the host, check
  `free -m`, run stack → record → stop the stack → render one chapter at a time,
  and stop everything before `restart app`. If Docker is missing, ask Bhoumik.
- **Don't use port 3142/3000 for the demo**; the app runs on `localhost:3217`,
  the stand-in harness on `127.0.0.1:4799`.

## 1. Plan the change

1. Decide the scope: a new chapter in the existing series, extra beats in a
   chapter, or a re-take after a UI change. A separate series for another
   audience → copy `video/partner-onboarding/` to `video/<series>/` without
   `node_modules/`, `footage/`, `out/` and `public/vo/`, keep `src/` as it is,
   and replace `script.md` and the page.
2. Read the code of every screen involved and note exact labels, aria-labels
   and states (a subagent/task thread per area works well). Check behaviour
   claims against the agents' skills.

## 2. Script

Edit `script.md` (Part 2) using `artifacts/script-chapter-template.md`: one
`**N.M** "narration" (~s)` line per beat, then its shot list and
`- Caption: "…"` (≤ 6 words, exact UI labels in `**bold**`). Narration rules:
second person, short sentences, never "AR"; say "availability request". Add the
chapter to Part 1 and its write-up to Part 4. Inserting a chapter renumbers the
later ones: rename their `public/vo/N.*.wav`, `rec/chN.mjs` (and the beat ids
inside), and drop their `footage/chN`.

Then `python3 parse-script.py` → `narration.json`, and `node tts.mjs`
(Kokoro `af_heart`; only missing WAVs are generated, `FORCE=1` regenerates) →
`public/vo/*.wav` + `vo.json`. Listen to new lines, or ask a human to.

## 3. Demo data

- Base seed: `demo/seed.sql`. Checkpoints: `demo/reset.sh S1…S5` (S1 fresh,
  S2 password changed, S3/S4 after chapters 3/4, S5 + Zilker Courtyard).
- A chapter that needs new records gets **its own checkpoint** (a `sN.sql`
  file + one line in `reset.sh`) instead of changing the base seed, because
  changing the seed changes every chapter's footage.
- Use the RPCs (`answer_availability_request`, `create_order`,
  `update_partner_order*`) rather than raw inserts, so rows match production.
- Chat media: drawn in `demo/photos/*.mjs`; supplier voice notes are Kokoro
  `am_michael` WAVs in `demo/`.

## 4. Stack

`demo/setup.sh` (first time or after a schema change) → then each session:
`supabase start` in `demo/stack`, `node demo/harness-mock.mjs` with
`SUPABASE_URL`/`SUPABASE_SECRET_KEY` from `demo/local.env` and
`WEBCHAT_APP_SECRET=demo-secret`, and the app copy with
`npx next start -p 3217 -H 127.0.0.1`. If the database schema moved, refresh
`demo/schema.sql` from the live **catalog only** (no rows) with
`artifacts/schema-catalog.sql`, take function bodies from the latest
migrations with `scripts/extract-functions.py`, and compare
`md5(prosrc)` per function with production; fix any mismatch from the live
definition.

## 5. Record

Write `rec/chN.mjs` from `artifacts/chapter-recorder-template.mjs`. The
`rec/lib.mjs` API: `recorder(name)`, `R.device('D'|'P', {ua})`, `d.login()`,
`d.goto()`, `R.start(d, take)` / `R.stop()`, `R.beat(id)` (holds until the
previous beat's narration has played), `R.until(frac)`, `R.settle()`,
`R.card(id)` (a motion-graphic beat with no footage), `R.reply(d, text)` (wait for an LPS chat reply and log it, so its ding lands when it appears), `d.click/moveTo/type/fill/scroll`,
`d.ring(target)`, `d.zoom(target, scale)` / `d.unzoom()`, `d.card(text)`,
`d.span(...targets)`. Stand-in harness cues: `POST /demo/reply` (an LPS reply
now) and `POST /demo/replies` (replace the auto-reply list).

1. Dry run: `FAST=1 node rec/chN.mjs` (no narration holds). A failed step saves
   `footage/chN/error-*.png`.
2. Look at frames: `scripts/contact-sheet.sh footage/chN/a.mp4` and read the
   image. Rings must sit on the element the narration names.
3. Real take: `node rec/chN.mjs`, then `python3 scripts/check-beats.py chN`
   (every beat's footage must cover its narration + 0.3 s).

Known traps (each cost a re-take before):

- **Phone layout shifts when the keyboard closes.** After typing, blur
  (`page.evaluate(() => document.activeElement?.blur())`, wait ~600 ms)
  before tapping Send / Submit.
- **Sticky footers cover rings.** Ring only the visible part; clip the rect
  above the footer.
- **Hidden duplicates** (print sheet, desktop/mobile copies): locators in the
  lib already filter to visible; do the same in ad-hoc `evaluate` code.
- **Short-lived UI** (success overlays ≈ 3 s): trigger it at the end of the
  previous beat with `R.until(0.8)` so it plays during its own narration.
- **Print:** headless Chrome has no print preview; use
  `page.emulateMedia({ media: 'print' })`, zoom, then switch back to `screen`.
- **Microphone:** the fake device never resolves; stub
  `navigator.mediaDevices.getUserMedia` to play a WAV (see `rec/ch8.mjs`).
- **Unread state:** an open chat on another device marks replies read; close
  it before showing the orange dot or the bell row.
- **Desktop home bell popover** draws under the request list (app bug); show
  the bell on the phone or on a request page.

## 6. Render

`node render.mjs chN …` → `out/chN.{mp4,jpg,vtt}` + `out/chapters.json`.
Special cards, the success-chime and reply-ding beat ids are listed at the top
of `src/data.ts` and in `src/Cards.tsx`; add the new chapter's ids there,
nothing else. Check every rendered chapter:
`scripts/contact-sheet.sh out/chN.mp4`, read it, then loudness
`ffmpeg -i out/chN.mp4 -af ebur128=peak=true -f null -` (≈ -19 ±1.5 LUFS,
true peak ≤ -1 dBFS) and the VTT cue count against `narration.json`.

## 7. Publish

1. Copy `out/chN.{mp4,jpg,vtt}` and `out/chapters.json` to
   `app/public/docs/onboarding/`.
2. A new chapter: add it to the `CHAPTERS` array in
   `app/public/docs/partner-onboarding.html` (intro, steps, tip from Part 4) and
   update the chapter counts in its copy.
3. Test the page at 390 px and 1440 px: video plays, progress saves, captions
   load, no sideways scroll (`visual-ui-release-qa` for the screenshots).
4. Docs in the same change: `CHANGELOG.md`, `video/partner-onboarding/README.md`,
   and the handbook page that links to the videos if it names a chapter count.
5. Ship the usual way (commit, `restart app`). The MP4s are large (≈ 5 MB per
   chapter); say so in the report.

## Failure modes

- Login 401 in the demo → `AUTH_EMAIL_DOMAIN` differs between user creation
  and the app (both `demo.invalid`).
- "Chat isn't switched on" → `WEBCHAT_APP_SECRET` unset, or the stand-in
  harness isn't running.
- Port already in use → another project's server; pick a free port, never kill
  a process you didn't start.
- A render collides with another on port 3399 → only one render at a time.
