# Partner portal onboarding videos

Nine narrated chapter videos that onboard a new supplier partner to the
partner portal (`/partner/<id>`), plus the public page that plays them,
`app/public/docs/partner-onboarding.html`, served at `/partner-onboarding` (and
`/docs/partner-onboarding.html`).

Everything on screen is a **local demo copy** of the app with made-up data
(Hill Country Growers, login `jordan`, seven Texas jobs). Nothing is recorded
from production and no real customer or supplier appears.

## Pipeline

| Step | What | Where |
|---|---|---|
| Script | Chapters, narration, shot list, write-ups | `script.md` (narration and captions parsed into `narration.json`) |
| Voice | Kokoro TTS (open model, runs locally), voice `af_heart` | `node tts.mjs` → `public/vo/<beat>.wav`, `vo.json` |
| Demo stack | Local Supabase + the app built from a copy without `.env.local` + a stand-in harness for chat | `demo/` |
| Footage | Playwright drives headless Chrome at 2×/3× device scale; each beat holds for its narration line | `node rec/chN.mjs` → `footage/chN/` |
| Motion | Remotion composition: device frames, zooms, highlight rings, captions, SFX, music bed | `src/`, `node render.mjs` → `out/` |
| Page | Chapters with progress, write-ups, captions | `app/public/docs/partner-onboarding.html` + `app/public/docs/onboarding/` |

Sound effects and the music bed in `public/sfx/` are synthesized with ffmpeg
(no third-party audio). The two chat "photos" in `demo/photos/` are drawn by
`demo/photos/make.mjs`. Replace them with real photos and re-record chapter 8
for a more natural look. Chapter 6's "photo of the printed sheet" is made by
`demo/photos/sheet.mjs` from the real print sheet of the Zilker Courtyard request
(checkpoint S5, `demo/s5.sql`) with handwritten marks added; the answers LPS
enters afterwards are `demo/chat-answers.sql`. Jordan's voice notes are
`demo/jordan-voice*.wav` (Kokoro, voice `am_michael`).

## Re-recording after a portal change

1. **Stack:** `demo/setup.sh` starts a local Supabase (Docker), loads
   `demo/schema.sql`, copies `app/` without any `.env*` file into `demo/.work/`,
   builds it against the local stack and writes `demo/local.env`. `schema.sql` is
   the production *structure* (tables, functions, triggers, policies; no rows),
   because the migrations in `harness/agents/daisy/migrations` start from an
   existing database. Refresh it from the live catalog when the schema moves.
2. **Serve:** `node demo/harness-mock.mjs` (stand-in for the harness chat on :4799;
   set `SUPABASE_URL`, `SUPABASE_SECRET_KEY` from `demo/local.env` and
   `WEBCHAT_APP_SECRET=demo-secret`) and the app on `http://localhost:3217`.
   Never point the app at the default harness port 3142, which on this machine
   belongs to another project.
3. **Record:** `node rec/chN.mjs` per chapter (with `demo/local.env` exported). Each
   script resets the database to its starting checkpoint (`demo/reset.sh S1..S5`,
   refuses a non-local `API_URL`). `FAST=1` skips the narration holds for a quick
   dry run. A failed step saves `footage/chN/error-*.png`.
4. **Render:** `node render.mjs [ch3 …]`, then copy `out/chN.{mp4,jpg,vtt}` and
   `out/chapters.json` to `app/public/docs/onboarding/`.

If narration changes, edit `script.md`, run `python3 parse-script.py` (rewrites `narration.json`), re-run
`tts.mjs`, then re-record that chapter: the footage timing follows the voice.

## Known app issues seen while recording

- (Fixed 2026-10-23.) On the desktop Availability Requests home and Orders
  list, the bell's Notifications popover used to render under the cards, so
  chapter 2 shows the bell on the phone. A re-take could show it on desktop.
- The Chrome install popup says it "opens straight to suppliers" (staff wording);
  chapter 9 uses the iPhone "Add to Home Screen" sheet instead.

Remotion is free for individuals and companies of up to three people; larger
companies need a Remotion company license (remotion.dev/license).
