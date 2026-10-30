# Partner onboarding video series: script, shot list, demo data and written guide

Audience: new LPS supplier partners who have just been given a portal login.
Built from ui-screens.md, ar-flow.md, order-flow.md, chat-misc.md and local-stack.md, which were checked against the code. Every
on-screen label below is quoted from those notes exactly as the UI renders it (CSS-uppercased labels are given in
code spelling).

Format: 9 chapter videos of 45 to 85 seconds each (about 9.5 minutes in all), plus a written onboarding page with the same chapters (Part 4).

---

## Part 0. Conventions for the whole series

### Narration rules
- Warm and plain, in the second person, with British spelling (colour, catalogue, fulfil, organise). Short sentences.
- Pace is about 140 words per minute (about 2.3 words per second). The `~s` figure after each sentence is its estimated
  spoken length. Leave about 0.4 s of air between sentences, and longer where the footage shows a dialog being filled in.
- Narration is written **as spoken**. Captions show the **exact UI label**. Pronunciation guide for the voice-over:
  - "Partial Qty" is read "Partial Quantity".
  - "Diff Sz/Sub" is read "Diff Size or Sub".
  - "Avail" is read "Available".
  - Never say "AR". Say "availability request" or "request".
  - Do not say "Rosie" (see open questions). Say "we" or "Local Plant Supply".
- Never narrate things the portal does not do:
  - no emails or push alerts for new requests
  - no per-line photos
  - no date picker
  - suppliers cannot decline an order, or change an order's quantities, prices or dates (those go through chat)
  - pull-to-refresh does not load new requests (lists update live by themselves).

### Capture setup (shared)
- App: the local demo stack from local-stack.md, run with `next start` at **http://localhost:3210**. Use `localhost`,
  not 127.0.0.1, so the Secure cookie works and the microphone is allowed. Use a fresh Chrome profile and
  **light mode** (the public request page is always dark, which is by design).
- **D = desktop**: 1440×900 viewport at device scale factor 2.
  - Nav rail **expanded** (click "Expand navigation" once; it is remembered in `lps.nav.open`).
  - Chat panel closed at the start of each chapter unless noted.
- **P = phone**: 390×844 at device scale factor 3, with mobile and touch emulation.
  - Touch emulation makes the pointer coarse, so the note cells need a **long-press** to edit. Avail and Price open with a tap.
  - The bottom bar hides while an input has focus. That is normal.
  - Frame phone footage in a neutral phone mock-up on a 1920×1080 canvas, beside or instead of the desktop footage.
- Output: 1920×1080, 30 fps.
  - Desktop shots: scale the 2880×1800 capture down and use the spare resolution for 1.3× to 2× push-in zooms.
  - Highlights: a soft rounded ring in the brand teal plus a 15% dim on the rest of the frame. Callout lines appear with
    a 200 ms ease-out.
- Captions: at most 6 words, bottom-left lower third, and the exact UI label in **bold** when quoting one.
- Sound:
  - Music: a light acoustic or organic bed at about -28 LUFS under the voice (the voice at about -16 LUFS).
  - The bed ducks a further 4 dB during sound effects.
- Sound-effect palette (use the same SFX for the same meaning every time):
  - `click`: soft UI tick for presses and taps
  - `whoosh`: short airy swish for route changes and view transitions
  - `pop`: subtle bubble pop when a highlight or callout appears
  - `type`: light keyboard patter when typing is shown, kept low
  - `chime`: warm two-note chime for success moments
  - `rustle`: leaf rustle under the "Availability received" leaf burst and the brand title cards
  - `ding`: gentle notification ding for a new alert or reply
- Every chapter opens with a 1.5 s chapter card (number, title, sprout icon, `rustle`) and ends with a 1 s outro card
  that names the next chapter.

### Database checkpoints (re-take safety)
Many shots change data. Snapshot the seeded database (`pg_dump` of `public` plus `auth`, or a docker volume copy) at these
checkpoints and restore before each take:

| Checkpoint | State | Used by |
|---|---|---|
| **S1** | Fresh seed. Jordan's login has `must_change_password = true` and the temporary password | Ch 1 |
| **S2** | S1 with the password already changed to the new one. All other data as seeded | Ch 2, 3, 6, 7 |
| **S3** | S2 after the Ch 3 answers (end of Ch 3) | Ch 4 |
| **S4** | S3 after the Ch 4 submit (Barton Hills request Completed) | Ch 5, 8 |

Ch 7 also needs the chat stub (local-stack.md section 6) running with the scripted replies listed in Ch 7.

---

## Part 1. Chapter list

| # | Chapter | Target length | Main device | Goal in one line |
|---|---|---|---|---|
| 1 | Welcome and signing in | 45 s | P | Sign in for the first time and set your own password |
| 2 | Finding your way around | 60 s | D + P | Read the home screen, the buckets, the menu and Alerts |
| 3 | Answering an availability request | 75 s | D | Set a status for each line, fix prices, and know it all auto-saves |
| 4 | Substitutes, notes and submitting | 65 s | P | Offer substitutes, mark lines unavailable, add a request note and submit |
| 5 | After you submit | 60 s | D | Change an answer and re-submit, share a public link, print, find history |
| 6 | Answering by photo, text or voice | 70 s | P | Answer a request with a photo of the printed sheet, a message or a voice note |
| 7 | Orders: acknowledging, updating and marking ready | 85 s | P + D | Take an order from New to Order Ready, and print a yard sheet |
| 8 | Chatting with Local Plant Supply | 60 s | D + P | Message LPS, send photos and voice notes, spot replies |
| 9 | Settings, the app and handy tips | 65 s | D + P | Install the app, change your password, use By item and By status |

Total: about 505 s, or 8 min 25 s.

---

## Part 2. Chapters: goal, narration and synced shot list

Sentence ids (for example `3.6`) are shared by the narration and the shot, so the editor can cut the footage to each
voice-over line.

---

### Chapter 1. Welcome and signing in (45 s, about 100 words)

**Goal:** the partner knows what the portal is for, where the login comes from, and how the first sign-in works.
**Start state:** S1. Logged out. Phone (P) for sign-in.

**1.1** "Welcome to the Local Plant Supply partner portal." (~3 s)
- Shot: motion title card. Large serif wordmark "Local Plant Supply" with the animated sprout row. Optional live capture:
  D `/login`, where the teal brand panel animates its sprouts.
- Caption: "Partner portal".
- SFX: `rustle`, then `chime`.

**1.2** "It's where you'll answer availability requests, look after your orders and chat with our team, all in one place." (~9 s)
- Shot: three 2 s cuts, each with a caption.
  - D: the Barton Hills request page with its coloured lines (from S3). Caption "Answer availability requests".
  - P: the Riverbend order page. Caption "Look after orders".
  - P: the chat transcript. Caption "Chat with us".
- SFX: `whoosh` on each cut.

**1.3** "Your Local Plant Supply contact will send you a sign-in link, a username and a temporary password." (~8 s)
- Shot: motion graphic of a message card that quotes the real hand-over text from LPS's "Copy message" button:
  ```
  Hill Country Growers — your Local Plant Supply partner portal
  Sign in: [your sign-in link]
  Username: jordan
  Password: k7mq-x2pn-r4tz-w8hd
  Availability requests from us arrive here; answer them and press Submit availability.
  ```
  Animate a highlight sweep over the Sign in, Username and Password rows in turn. (Whether to show the real URL is an open question.)
- Caption: "Sent to you by your LPS contact".
- SFX: `pop` on each row.

**1.4** "Open the link and sign in." (~2.5 s)
- Shot: P `/login`.
  - Tap "Username" and type `jordan`.
  - Tap "Password" and type `k7mq-x2pn-r4tz-w8hd` (shows masked).
  - Tap **"Sign in"**. It reads "Signing in…" while it works.
- Focus: ring the two fields, then the button.
- Caption: "**Sign in**".
- SFX: `type` (low), then `click`.

**1.5** "The first time, you'll be asked to choose your own password." (~5 s)
- Shot: P lands on `/change-password`. Push in on the title **"Choose a password"** and the line "You signed in with a password
  we generated for you…".
- Caption: "First time only".
- SFX: `whoosh`.

**1.6** "Type the temporary one, then a new one of at least ten characters, twice." (~6 s)
- Shot: P.
  - "Current password": `k7mq-x2pn-r4tz-w8hd`.
  - "New password": `Bluebonnet-Row-26`.
  - "Confirm new password": `Bluebonnet-Row-26`.
- Focus: callout on the hint "At least 10 characters. Pick something only you know."
- Caption: "At least 10 characters".
- SFX: `type`.

**1.7** "Press Save and continue, and you're in." (~3.5 s)
- Shot: P. Tap **"Save and continue"** ("Saving…"). The portal home opens (`/partner/2`).
- Caption: "**Save and continue**".
- SFX: `click`, then `chime`.

**1.8** "It works on your phone or your computer, so use whichever is handy." (~5.5 s)
- Shot: split screen of D and P, both on the `/partner/2` home with the same request cards.
- Caption: "Phone or computer: same portal".
- SFX: `whoosh`.

---

### Chapter 2. Finding your way around (60 s, about 134 words)

**Goal:** read the Availability Requests home, the three buckets and a card; find the menu on both devices; know that
Alerts, not email, is where new work shows.
**Start state:** S2. Signed in as jordan. Desktop rail expanded.
Seed counts:
- Requests: New 1, Processing 1, Completed 3.
- Bell badge "2" (one new request plus one unread reply).

**2.1** "You start on Availability Requests." (~2.5 s)
- Shot: D `/partner/2`. Ring the rail item **"Availability Requests"** (filled pill) and the identity block "Hill Country
  Growers / Supplier portal · Local Plant Supply".
- Caption: "Your home screen".
- SFX: `pop`.

**2.2** "An availability request is us asking whether you can supply the plants for a job." (~6.5 s)
- Shot: D. Slow push-in on the two visible cards:
  - "Barton Hills Residence – Front Yard" (New)
  - "Mueller Pocket Park" (Processing)
- Motion text overlay: "Availability request = can you supply these plants?"
- SFX: none.

**2.3** "Across the top are three boxes: New, Processing and Completed." (~5 s)
- Shot: D. Ring the toolbar's three bucket boxes **"New"** 1 (blue), **"Processing"** 1 (orange) and **"Completed"** 3 (green).
- Caption: "Your work buckets".
- SFX: `pop`.

**2.4** "New means it's waiting for you. Processing means you've started. Completed means you've sent your answers." (~7.5 s)
- Shot: D. Highlight each box in turn, synced to each sentence, with a colour-matched caption:
  - "**New**: waiting for you"
  - "**Processing**: you've started"
  - "**Completed**: answers sent"
- SFX: `pop` ×3.

**2.5** "Tap a box to show or hide those requests." (~4 s)
- Shot: D. Click **"Completed"**. Its check mark appears and three more cards slide in:
  - "Riverbend HOA Entry Refresh"
  - "Cedar Park Medical Plaza"
  - "Natarajan Backyard"

  Click **"Completed"** again to hide them.
- Caption: "Tap to show or hide".
- SFX: `click` ×2.

**2.6** "Each card shows the job, the date it's needed, pickup or delivery, the number of items and the value." (~8.5 s)
- Shot: D. Zoom 1.8× on the Barton Hills card. A callout appears on each part in reading order:
  - "New" status pill
  - name "Barton Hills Residence – Front Yard"
  - date chip (for example "Wed, 11/04")
  - "Delivery" pill
  - "7 items"
  - total
- Caption: "One card per request".
- SFX: `pop` per callout (quiet).

**2.7** "On a computer, the menu sits on the left: Orders, Availability Requests, and further down, History and Settings." (~8 s)
- Shot: D. Tilt down the rail and ring in turn:
  - **"Orders"**
  - **"Availability Requests"**
  - foot items **"Order/Request History"** and **"Settings"**
- Caption: "Menu on the left".
- SFX: `pop`.

**2.8** "On a phone, it's the bar along the bottom." (~3.5 s)
- Shot: P `/partner/2`.
  - Ring the bottom bar: **"Alerts"**, **"Orders"**, **"Requests"**, **"More"**, **"Chat"**.
  - Tap **"More"** to show the menu (Light/Dark mode, "Install app", "Order/Request History", "Settings", "Log out").
  - Tap outside to close it.
- Caption: "Menu at the bottom".
- SFX: `click`.

**2.9** "The bell, called Alerts on a phone, shows new requests and replies from us." (~6.5 s)
- Shot: D. Click the bell at the right end of the toolbar strip (badge "2"). The **"Notifications"** popover shows:
  - "Barton Hills Residence – Front Yard": "New availability request — needs your answer."
  - "Local Plant Supply": "Cedar Park Medical Plaza: delivery is now Thursday at 7am…"

  Cut to P: tap **"Alerts"**. The same popover opens upward.
- Caption: "New requests and replies".
- SFX: `ding`.
- Do **not** click the rows: clicking the chat row would mark the reply read.

**2.10** "We don't send emails for new requests, so the bell is the place to check." (~6.5 s)
- Shot: D. Hold on the popover with a soft vignette. Press Escape to close.
- Caption: "No emails: check **Alerts**".
- SFX: none.

---

### Chapter 3. Answering an availability request (75 s, about 162 words)

**Goal:** open a request, read the job header and the lines, set statuses with the quick answers and the Partial and
Can Order dialogs, fill in a missing price, and understand auto-save and the filter counts.
**Start state:** S2. D. The Barton Hills request is New and all 7 lines are Pending.

**3.1** "Let's answer one. Open the Barton Hills request." (~3.5 s)
- Shot: D `/partner/2`. Click the "Barton Hills Residence – Front Yard" card. A view transition goes to
  `/partner/2/requests/{AR-J1}`.
- SFX: `click`, then `whoosh`.

**3.2** "At the top you'll see the job, delivery or pickup, and the date." (~5.5 s)
- Shot: D. Zoom on the header card:
  - job name "Barton Hills Residence – Front Yard" with the "New" chip
  - "Delivery" pill
  - date "Wed, 11/04"
  - "Contact" row "Greenway Landscape Co. · Maria Delgado" with her phone and email
  - "Delivery address" "2201 Barton Hills Dr, Austin, TX 78704"
- Caption: "Job, delivery and date".
- SFX: `pop`.

**3.3** "Below that, each line is a plant we need: the quantity, the size and the name. Our notes sit under the plant." (~9.5 s)
- Shot: D.
  - Pan over the line table. Ring the column headers "Need", "Size" and "Plant".
  - Push in on the Live Oak row: Need 2, Size "30 G", Plant "Live Oak", with the grey note "Single trunk, 2.5 in+ caliper"
    under the name.
- Caption: "Our ask on each line".
- SFX: `pop`.

**3.4** "Prices we already have on file are filled in. Just correct any that have changed." (~6.5 s)
- Shot: D. Ring the hint "Prices we already have on file are filled in — please correct any that have changed." Then
  sweep a highlight down the "Unit price" column ($245.00, $110.00, $135.00, $28.00, [purple empty], $26.00, $7.50).
- Caption: "Prices filled in for you".
- SFX: `pop`.

**3.5** "Now set a status for each line." (~3 s)
- Shot: D. Ring the "Status" column, where every row reads "··· Pending ▾".
- Caption: "**Status** for every line".

**3.6** "If you have them all, choose Available. That's it, it saves straight away." (~6 s)
- Shot: D. Live Oak row:
  - Click its Status pill. The dark list opens.
  - Click **"Available"**. The row turns green and "Avail qty" shows 2.
- Caption: "**Available**: saves instantly".
- SFX: `click`, then a soft `chime`.

**3.7** "Only have some? Choose Partial Quantity, type how many you can supply, and add a note if it helps." (~8.5 s, hold the footage ~10 s)
- Shot: D. Cedar Elm row (Need 5):
  - Status: **"Partial Qty"**. The dialog **"Partial Qty"** opens.
  - "Quantity you can supply" is prefilled with 5. Select it and type `3`.
  - "Notes (optional)": `2 more ready in 3 weeks`.
  - Click **"Save answer"**. The row turns yellow.
- Caption: "**Partial Qty**: how many you have".
- SFX: `click`, `type`, `click`.

**3.8** "Can you get them in? Choose Can Order or Arriving Soon, and tell us when." (~6.5 s, hold the footage ~9 s)
- Shot: D. Dwarf Yaupon Holly row (Need 24):
  - Status: **"Can Order/Arriving Soon"**. The dialog **"Can Order / Arriving Soon"** opens.
  - Choose the radio **"Can Order"**.
  - "ETA / notes": `Ready mid-November from our Tyler farm`.
  - Click **"Save answer"**. The row turns orange.
  - Briefly flick the radio to "Arriving Soon" before saving to show its "Notes" field, then back to Can Order.
- Caption: "**Can Order** / **Arriving Soon**: tell us when".
- SFX: `click`, `type`, `click`.

**3.9** "A line with a purple box still needs a price. Click it and type your unit price." (~7 s)
- Shot: D. Gulf Muhly row (Need 40, price empty, purple box and purple divider):
  - Zoom on the purple cell.
  - Set Status to **"Available"** first (one click).
  - Click the Unit price cell, type `14.00` and press Enter.
  - The purple box clears, "Line total" shows $560.00 and "Subtotal" updates.
- Caption: "Purple box = needs a price".
- SFX: `click`, `type`.

**3.10** "Everything saves as you go, so you can stop and come back any time." (~6.5 s)
- Shot: D. Ring the toolbar counter "7 lines · 3 pending" and the header chip, which now reads **"Processing"**.
- Caption: "Saves automatically".
- SFX: `pop`.

**3.11** "The coloured counts at the top add up your answers, and you can click one to filter the lines." (~8 s)
- Shot: D.
  - Zoom on the summary strip: "7 Total items", "Subtotal $…", and the cells Available 2, Partial Qty 1, Can Order 1,
    Pending 3 (zero cells dimmed).
  - Click **"Pending"**. Only Texas Redbud, Red Yucca and Mexican Feathergrass remain.
  - Click **"Pending"** again to clear the filter.
- Caption: "Tap a count to filter".
- SFX: `click` ×2.
- **Save checkpoint S3 after this take.**

---

### Chapter 4. Substitutes, notes and submitting (65 s, about 140 words)

**Goal:** answer on a phone, offer a substitute, say Unavailable with No Sub, leave a line Pending on purpose, write a
request note, and submit (including the "Submit anyway" check and the leaf-burst confirmation).
**Start state:** S3. P on `/partner/2/requests/{AR-J1}`. 3 lines are pending: Texas Redbud, Red Yucca and Mexican Feathergrass.

**4.0** "On a phone, each line is a card. Tap its status to answer, and tap Available or Price to type." (~8 s)
- Shot: P. Scroll the line cards and ring one card's three cells: "Status", "Avail" and "Price". Then ring the "Supplier
  reply" row.
- Caption: "Tap **Status**, **Avail**, **Price**".
- SFX: `pop`.

**4.1** "Can't supply a line exactly as asked? Choose Diff Size or Sub." (~4.5 s)
- Shot: P. On the card "3 × 15 G Texas Redbud 'Oklahoma'", tap Status and choose **"Diff Sz/Sub"**. The dialog
  **"Diff Sz / Sub"** opens with the sub-line "3 × Texas Redbud 'Oklahoma' · 15 G".
- Caption: "**Diff Sz/Sub**: a different size or plant".
- SFX: `click`.

**4.2** "If we know you grow another size, it's listed with its price. Pick it, press Submit, and the line shows Diff Size or Sub." (~9.5 s)
- Shot: P.
  - Under "Can you offer a substitute?", tap the radio for the **30 G Texas Redbud 'Oklahoma' ($210.00)** option.
  - Tap **"Submit"**. The card turns purple and reads "Diff Sz/Sub".
- Caption: "Pick your substitute".
- SFX: `click` ×2.

**4.3** "Or choose Something else, and describe what you can offer." (~4.5 s)
- Shot: P.
  - On the card "12 × 5 G Red Yucca", tap Status and choose **"Unavailable"**. The same **"Diff Sz / Sub"** dialog opens.
  - Ring the **"Something else…"** field and its hint ("Plant and size you can supply, plus anything we should know — e.g.
    Muskogee Crape Myrtle 30 G, ready in 2 weeks").
  - Do not type.
- Caption: "Or describe your own".
- SFX: `pop`.

**4.4** "If you can't help at all, choose Unavailable, then No Sub." (~4.5 s)
- Shot: P. In the same dialog, tap the red **"No Sub"** button. The Red Yucca card turns red and reads "Unavailable".
- Caption: "**No Sub** = can't supply".
- SFX: `click`.

**4.5** "Not sure yet? Leave the line on Pending." (~3 s)
- Shot: P. Ring the grey "Mexican Feathergrass" card, which shows "··· Pending ▾".
- Caption: "Unsure? Leave it **Pending**".

**4.6** "When you're done, add anything that applies to the whole job, like delivery days, in Note for this request." (~8 s)
- Shot: P.
  - Scroll to the **"Note for this request"** card.
  - Tap the textarea (placeholder "Add any conditions or information that apply to the whole request…") and type
    `We can deliver Tuesday to Thursday, 7am to 3pm. Trees tagged on request.`
  - Ring the hint "Sent with your availability when you submit."
- Caption: "One note for the whole job".
- SFX: `type`.

**4.7** "Then press Submit availability." (~2.5 s)
- Shot: P. Tap the pinned button **"Submit availability"**.
- SFX: `click`.

**4.8** "If any lines are still pending, we'll check with you first. You can answer them, or press Submit anyway." (~8.5 s)
- Shot: P.
  - The bar now reads "1 line still has no answer. Submit anyway, or answer it first." and the button reads
    **"Submit anyway"**. Ring both.
  - Tap **"Submit anyway"** ("Submitting…").
- Caption: "**Submit anyway** is fine".
- SFX: `pop`, then `click`.

**4.9** "And that's it. We have your answers, and the request moves to Completed." (~5.5 s, footage ~6 s)
- Shot: P.
  - Full-screen overlay: the ring and check draw in, a seedling sprouts and the leaves burst, then
    **"Availability received"** with "Thanks! Local Plant Supply has your answers."
  - Let it dismiss itself (~3.2 s).
  - Tap the back chevron ("Back to availability requests"), tap the **"Completed"** box, and show the Barton Hills card with
    the green "Completed" pill.
- Caption: "**Availability received**".
- SFX: `chime` and `rustle` under the leaf burst, then `whoosh`.
- **Save checkpoint S4 after this take.**

---

### Chapter 5. After you submit (60 s, about 117 words)

**Goal:** change an answer after submitting and re-submit; share a public link with a colleague who has no login and
turn it off again; print a paper sheet; find closed requests.
**Start state:** S4. D.

**5.1** "Your request now sits under Completed." (~3 s)
- Shot: D `/partner/2` with **"Completed"** selected. Ring the Barton Hills card's "Completed" pill.
- SFX: `pop`.

**5.2** "Need to change something? You can, until we close the request." (~5 s)
- Shot: D. Click the card to open the request.
- SFX: `click`, then `whoosh`.

**5.3** "Here, the feathergrass count has come in. Set it to Available." (~5 s)
- Shot: D. Mexican Feathergrass row: Status **"Available"**. The row turns green and the counter reads "7 lines · 0 pending".
- Caption: "Change any answer".
- SFX: `click`.

**5.4** "The request goes back to Processing, so press Re-Submit availability to send us the update." (~6.5 s)
- Shot: D.
  - Ring the header chip, which now reads "Processing".
  - Click **"Re-Submit availability"**. The overlay **"Update received"** plays.
- Caption: "**Re-Submit availability**".
- SFX: `click`, then `chime`.

**5.5** "Want a colleague to help, without a login? Press Share, then Make public. The link is copied for you." (~8 s)
- Shot: D.
  - Click **"Share"**. The popover **"Private request"** opens.
  - Click **"Make public"**. The notice "Link copied" appears.
  - The popover becomes **"Public request"** with the URL field and **"Copy public URL"**.
- Caption: "**Share** with your yard team".
- SFX: `click`, then `pop`.

**5.6** "Anyone with it can view and answer this request. Press Make private to switch the link off." (~7 s)
- Shot:
  - Cut to a second, signed-out browser window. Paste the URL to open `/public/availability/{token}`, which shows the dark
    page, the header "Local Plant Supply" and "7 lines · 0 pending". Hold 2 s.
  - Back in the portal: click **"Make private"**. The notice reads "Request is private. Previous link revoked."
- Caption: "**Make private** turns it off".
- SFX: `whoosh`, then `click`.

**5.7** "Prefer paper? The print button gives you a sheet to fill in at the yard. Snap a photo of it and send it to us in chat." (~11.5 s)
- Shot: D.
  - Click the Print icon (tooltip "Print"). The Chrome print preview shows the **"Availability Request"** sheet.
  - Push in on the tick-box "Status" column, "Avail. Qty", "Price", "Notes" and the "Submitted by:" line.
- Caption: "Print, fill in, send a photo".
- SFX: `click`.
- The sheet prints "Request #: AR-<id>". Keep it in frame only briefly, or soften it (see open questions).

**5.8** "Once we close a request, you'll find it under Order/Request History." (~5 s)
- Shot: D.
  - Click the rail item **"Order/Request History"**. The Orders tab opens.
  - Click the tab **"Requests"**: "2 requests", with the cards "Dripping Springs Ranch Entry" and "Hyde Park Bungalow" and
    their grey "Closed" pills.
- Caption: "Closed ones live in History".
- SFX: `click`, then `whoosh`.

---

### Chapter 6. Answering by photo, text or voice (70 s, about 150 words)

**Goal:** show that a supplier can answer a request from the chat instead of the line table: a photo of the printed sheet,
a typed message, or a voice note. LPS checks what was sent and enters it into the request, and the answers then show in
the portal.
**Start state:** S5 (S2 plus job J8 "Zilker Courtyard", a New request with 5 lines). P. The stand-in harness sends the replies below.

**6.1** "You don't always need to fill in the table. You can answer a request by sending us a photo, a message or a voice note in chat." (~8 s)
- Shot: P `/partner/2`. Ring the New cards "Zilker Courtyard" and "Barton Hills Residence – Front Yard".
- Caption: "Answer from the chat".

**6.2** "Printed the request? Tick the boxes at the yard, snap a photo, and send it to us." (~6 s)
- Shot: P. Tap **"Chat"**, tap the paperclip ("Attach a file") and send `zilker-sheet-photo.jpg` (the printed Zilker sheet,
  filled in by hand) with the text `Zilker Courtyard sheet, filled in.`
- Caption: "Send a photo of the sheet".
- SFX: `click`, `type`, `click`.

**6.3** "The request number printed on the sheet tells us which job it's for." (~5 s)
- Shot: P. The photo bubble; the reply arrives: "Got the Zilker Courtyard sheet, thanks! We'll enter it for you."
- Caption: "We match it to the job".
- SFX: `ding`.

**6.4** "Or just type it. For example: Barton Hills, everything's available except the red yucca." (~7 s)
- Shot: P. Type `Barton Hills: everything's available except the Red Yucca, we're out until spring.` and send. Reply:
  "Thanks! Barton Hills: all available except Red Yucca. We'll update it."
- Caption: "Type a quick answer".
- SFX: `type`, `click`, `ding`.

**6.5** "Or tap the microphone and say it." (~3 s)
- Shot: P. Record and send a voice note: "Hi, it's Jordan. For Mueller Pocket Park, the feathergrass is all available,
  sixty ready to go." Reply: "Got your voice note. Feathergrass available on Mueller, thanks!"
- Caption: "Or send a voice note".
- SFX: `click`, `ding`.

**6.6** "We'll check what you've sent and update the request for you." (~5 s)
- Shot: P. A last reply arrives: "All three requests are updated. Have a look in Requests." (LPS enters the answers.)
- Caption: "We update the request".
- SFX: `ding`.

**6.7** "Your answers then show up in the portal, just as if you'd entered them yourself." (~6 s)
- Shot: P. Close the chat. Open "Barton Hills Residence – Front Yard": every line reads Available except Red Yucca (Unavailable).
- Caption: "Answers appear in the portal".
- SFX: `click`, `whoosh`.

**6.8** "If anything's unclear, we'll ask you in chat." (~3 s)
- Shot: P. Hold on the answered lines.
- Caption: "We'll ask if unsure".

---

### Chapter 7. Orders: acknowledging, updating and marking ready (75 s, about 156 words)

**Goal:** find a new order, read the delivery brief, acknowledge it, update plant statuses and send them, mark it ready,
and know that changes to quantities and dates go through chat and appear in the Change log.
**Start state:** S2.
- Orders: New 1 (Riverbend), Processing 1 (Cedar Park), Ready 1 (Natarajan).
- Device: P, with D inserts.

**7.1** "When we place an order with you, it appears under Orders." (~4.5 s)
- Shot: P. Tap **"Orders"** in the bottom bar to open `/partner/2/orders`.
- SFX: `click`, then `whoosh`.

**7.2** "Like requests, orders sit in buckets: New, Processing and Ready." (~4.5 s)
- Shot: P. Ring the boxes **"New"** 1, **"Processing"** 1 and **"Ready"** 1. Point out that "Ready" is not ticked by
  default. Cards: "Riverbend HOA Entry Refresh" (New) and "Cedar Park Medical Plaza" (Processing).
- Caption: "**New**, **Processing**, **Ready**".
- SFX: `pop`.

**7.3** "Open the Riverbend order." (~2 s)
- Shot: P. Tap the Riverbend card to open `/partner/2/orders/{O-J3}`.
- SFX: `click`, then `whoosh`.

**7.4** "Additional details is your delivery brief: the customer, the address, who to contact, and any site notes." (~7.5 s)
- Shot: P. Push in on the **"Additional details"** section (open by default):
  - "Customer"
  - "Delivery address"
  - "Delivery contact"
  - "Site notes"
  - "Payment"
- Caption: "Your delivery brief".
- SFX: `pop`.
- Keep the "Availability request:" link line in the tinted strip out of the zoom, because it can read "AR-<id>".

**7.5** "Quantities, sizes and prices are set by us, so they're read only." (~5 s)
- Shot: P. Scroll to the line cards. Ring "Qty 3 · 30 G" on Live Oak, and its "Unit price" and "Line total".
- Caption: "Qty and price: read only".

**7.6** "First, press Acknowledge Received, then confirm. That tells us you've got it, and the order moves to Processing." (~8 s)
- Shot: P.
  - Tap the footer button **"Acknowledge Received"**. The dialog **"Acknowledge Received · …"** opens with "If anything about
    this order changes, you can send Chris a message from the message sidebar or via email."
  - Tap **"Acknowledge Received"** ("Saving…").
  - The pill turns **"Processing"** and the strip shows "Acknowledged: Fri, 10/23" (that is, the recording day).
- Caption: "**Acknowledge Received**".
- SFX: `click` ×2, then `chime`.

**7.7** "As things change, update each line. Pick a new status, add a note if it helps, and press Save status." (~8.5 s, hold the footage ~12 s)
- Shot: P.
  - Gulf Muhly card (currently "Arriving Soon"):
    - Status select: **"Available"**. The dialog **"Update plant status · …"** opens with "Gulf Muhly · 3 G".
    - "Your note on this plant": `Arrived Tuesday, all 40 tagged`.
    - Tap **"Save status"**.
  - Then the Dwarf Yaupon Holly card (currently "Need to Order"):
    - Status **"Available"**.
    - Note: `In from our Tyler farm`.
    - Tap **"Save status"**.
  - Ring the line "This is staged until you save all order status changes."
- Caption: "Update each plant".
- SFX: `click`, `type`, `click`.

**7.8** "Your changes wait at the bottom until you press Save status changes. We get them all in one update." (~8 s)
- Shot: P. The footer shows **"Save 2 status changes"** with the caption under it. Tap it. The cards settle.
- Caption: "**Save 2 status changes**".
- SFX: `click`, then `chime`.

**7.9** "When everything's ready, press Mark as Ready, then tap again to confirm the date." (~6 s)
- Shot: P.
  - Tap **"Mark as Ready"**. It becomes **"Confirm: ready for Mon, 11/02"**. Tap it again. The pill turns **"Order Ready"**.
  - Tap back ("Back to orders"), tap the **"Ready"** box, and show Riverbend under Order Ready.
- Caption: "Two taps: **Mark as Ready**".
- SFX: `click` ×2, then `chime`.

**7.10** "Need a different quantity or date, or can't fulfil the order? Send us a message in chat, and we'll update it." (~8.5 s)
- Shot: P. Tap **"Chat"** in the bottom bar. The chat opens full screen. Hold 1.5 s, then close it with "×" ("Hide chat").
- Caption: "Changes? Message us".
- SFX: `whoosh`.

**7.11** "Any changes we make are listed in the order's Change log." (~4.5 s)
- Shot: D.
  - Open `/partner/2/orders` and click "Cedar Park Medical Plaza".
  - Expand the **"Change log"** section (collapsed), which shows two bullets:
    - "- 10/19: Live Oak qty 5 → 4"
    - "- 10/21: Delivery moved to Thu 10/29 7am"
- Caption: "See what changed".
- SFX: `click`, then `pop`.

**7.12** "Prefer paper in the yard? Press Print on any order for a pick sheet. Every plant is listed with Ready and Need to Order boxes to tick, and space for notes." (~10 s)
- Shot: D, same Cedar Park order. Click the Print icon (tooltip "Print"). The printable yard sheet shows: the job name as the title,
  "Mode" and "Target date", the Additional details fields, then the line table "Qty", "Size", "Name", "Unit price", "Total",
  tick boxes **"Ready"** and **"Need to Order"**, an empty "Note" column and "Subtotal".
- Focus: push in on the tick-box columns.
- Caption: "Print a yard sheet".
- SFX: `click`.

---

### Chapter 8. Chatting with Local Plant Supply (60 s, about 110 words)

**Goal:** open the chat on both devices, use the job tags, send a photo and a voice note, and spot new replies.
**Start state:** S2.
- The seeded chat has 5 messages. Message 5 (about Cedar Park) is unread, so the orange dot is showing.
- The chat stub must be running, with these scripted replies:
  - About 3 s after the photo: "Lovely, thanks Jordan. We'll let Riverbend know."
  - About 10 s after the voice note: "Monday first thing is perfect. Thanks!"
- Media files you need:
  - `riverbend-oaks-tagged.jpg`, a real photo of tagged trees (own or licensed).
  - Microphone access granted in the profile beforehand.

**8.1** "Got a question, or something to tell us? Open the chat." (~4.5 s)
- Shot: D `/partner/2/orders/{O-J3}`. Ring the right-edge strip "LOCAL PLANT SUPPLY" with its orange dot. Click it. The
  docked panel opens: "Local Plant Supply" with "Availability chat · ● Online".
- SFX: `click`, then `whoosh`.

**8.2** "On a computer, it's the Local Plant Supply panel on the right. On a phone, tap Chat." (~7 s)
- Shot: D holds on the panel. Cut to P and tap **"Chat"** in the bottom bar. The chat opens full screen.
- Caption: "Right panel or **Chat** tab".
- SFX: `click`.

**8.3** "It's one conversation with our team, about any job." (~4 s)
- Shot: P. Scroll the transcript slowly:
  - "Local Plant Supply" bubbles on the left
  - your own bubbles on the right, including the earlier redbud photo
- Caption: "One conversation, every job".

**8.4** "Messages about a job show a tag. Tap it to jump to that request or order." (~6.5 s)
- Shot: D. Ring the tag **"Ref Order: Cedar Park Medical Plaza"** above the newest reply. Click it. The Cedar Park order
  opens behind the docked panel.
- Caption: "Tags link to the job".
- SFX: `click`, then `whoosh`.

**8.5** "To send a photo, tap the paperclip and choose a picture, or a PDF or spreadsheet." (~7 s, hold the footage ~9 s)
- Shot: P, back on the Riverbend order with the chat open.
  - Tap the paperclip ("Attach a file") and pick `riverbend-oaks-tagged.jpg`. Cut out the system file dialog.
  - The file chip appears. Type `Live oaks tagged for Riverbend.` and tap the send button.
  - The thumbnail bubble appears, and the scripted reply arrives.
- Caption: "Photos, PDFs, spreadsheets".
- SFX: `click`, `type`, `click`, then `ding` on the reply.

**8.6** "In a hurry? Tap the microphone and talk. Tap send when you're done, and we'll hear your voice note." (~7.5 s, hold the footage ~9 s)
- Shot: P.
  - Tap the microphone ("Record a voice note"). The recording bar shows the red dot, the timer and the moving level meter.
  - Speak about 4 s: "Hi, it's Jordan. We can load Riverbend first thing Monday."
  - Tap **"Send voice note"**. The waveform bubble appears. Tap Play briefly to show the progress fill.
- Caption: "Voice notes".
- SFX: none while recording. Duck the real voice under the narration, or let it play alone for 2 s in the gap.

**8.7** "When we reply, look out for an orange dot on Chat, and a row in your alerts." (~6.5 s)
- Shot: D.
  - Close the panel ("Hide panel") right after sending, so the scripted reply lands while it is closed.
  - The orange dot appears on the strip avatar and the bell badge goes up.
  - Click the bell. The row "Local Plant Supply · Monday first thing is perfect. Thanks!" is in the popover.
- Caption: "Orange dot = new reply".
- SFX: `ding`.

**8.8** "Whatever you send goes straight to Local Plant Supply." (~4 s)
- Shot: P, a calm final frame of the full chat.
- Caption: "Straight to our team".

---

### Chapter 9. Settings, the app and handy tips (65 s, about 120 words)

**Goal:** install the portal like an app, change the password, use the By item and By status views, find theme and
log out, and build the habit of checking Alerts.
**Start state:** S4 (any later state works). D + P.

**9.1** "A few last things." (~2 s)
- Shot: motion card "Handy tips". SFX: `rustle`.

**9.2** "To keep the portal one tap away, choose Install app. On an iPhone, follow the steps to add it to your home screen." (~9.5 s)
- Shot:
  - D (Chrome on localhost): the in-app popup **"Install Local Plant Supply"** with **"Not now"** / **"Install"**. Ring
    **"Install"** but do not record Chrome's native dialog. Alternatively, click the rail item **"Install app"**.
  - Then P with an iPhone Safari user agent: **"More"**, then **"Install app"**. The modal **"Add to Home Screen"** shows its
    three steps. Tap **"Got it"**.
- Caption: "**Install app**".
- SFX: `click`, then `pop`.
- The popup copy says "opens straight to suppliers" (staff wording). Show it briefly, or use the rail path (see open questions).

**9.3** "To change your password, go to Settings." (~3 s)
- Shot: P. Tap **"More"**, then **"Settings"**. The card **"Password"** shows "Signed in as jordan…". Ring the form. Do not
  submit, unless you are on a disposable checkpoint, where it shows "Password changed.".
- Caption: "**Settings**: your password".
- SFX: `click`.

**9.4** "Working on lots of jobs at once? Switch to By item, at the bottom of the screen, to see each plant across every open request, and answer each one right there." (~12 s)
- Shot: D `/partner/2`.
  - Click **"By item"** in the floating switch at the bottom centre.
  - Click the chevron on "Live Oak" (total demand across requests, "4 requests"). The sub-rows open, one per request:
    "Barton Hills Residence – Front Yard", "Mueller Pocket Park" and so on, each with its own Status picker.
- Caption: "**By item**: one plant, every request".
- SFX: `click`, then `whoosh`.

**9.5** "By status groups everything by your answer, so you can see what's on order or arriving soon." (~7 s)
- Shot: D. Click **"By status"**. The board shows seven cards (Available … Pending). Push in on **"Can Order"** and
  **"Arriving Soon"**.
- Caption: "**By status**: your answers at a glance".
- SFX: `click`.

**9.6** "Light or dark mode, and Log out, live in the menu." (~4.5 s)
- Shot: P. Tap **"More"**. Ring the "Dark mode" row and tap it once. The portal goes dark for 1.5 s. Tap it again to go
  back to light. Ring **"Log out"** but do not press it.
- Caption: "**More**: theme and **Log out**".
- SFX: `click` ×2.

**9.7** "Check the portal each day, or keep the app on your phone, so new requests never wait." (~7.5 s)
- Shot: motion graphic. A phone home screen with the "Plant Supply" cactus icon. Tap it to open the portal, and the
  **"Alerts"** badge pulses "1".
- Caption: "Check **Alerts** daily".
- SFX: `ding`.

**9.8** "Thanks for partnering with Local Plant Supply. We're glad to have you." (~5 s)
- Shot: end card. Wordmark, sprout row, "Questions? Message us in Chat."
- SFX: `rustle`, then `chime`.

---

## Part 3. Demo data (fictional, consistent across all chapters)

This extends the seed plan in local-stack.md section 7 (same ids and shapes), with the changes needed for the story above.
All names, addresses, emails (`example.com`) and phone numbers (`555-01xx`) are fictional.

**Recording day D.** Dates are relative to the seed day. Examples below assume D = **Fri 10/23/2026**. If recording on
another day, pick a D where J3's EDD (D+10) and J1's EDD (D+12) fall on weekdays. The UI shows dates as "Ddd, MM/DD".

### Companies and people
- **Supplier (partner):** Hill Country Growers (short "HCG"), a grower at 1200 Ranch Rd 12, Dripping Springs, TX 78620.
  - Website: hillcountrygrowers.example.com.
  - `suppliers.id = 2`, active, `rosie_thread_id = 'supplier-hill-country-growers'`.
- **Partner login:**
  - username `jordan` (Jordan Reyes, sales and yard lead)
  - temporary password `k7mq-x2pn-r4tz-w8hd` (`must_change_password = true` in S1)
  - new password `Bluebonnet-Row-26`
- **Required other suppliers:**
  - id 1 "Austin Plant Supply". It is required by the job-line trigger and never seen in the portal.
  - Optional id 3 "Blanco River Nursery", which is not a partner.
- **LPS team member** named in chat history: "Chris". This is internal only: every LPS message shows as "Local Plant Supply".
- **Customers** (shown only where shared, or in order details):

  | Customer | Company | Phone | Email |
  |---|---|---|---|
  | Maria Delgado | Greenway Landscape Co. | 512-555-0142 | maria@greenway.example.com |
  | Sam Whitaker | Riverbend HOA | 512-555-0177 | board@riverbend.example.com |
  | Priya Natarajan | (homeowner) | 512-555-0119 | priya.n@example.com |
  | Luis Ortega | Pecan Street Design Studio | 512-555-0163 | luis@pecanstreet.example.com |

### HCG catalogue (`inventory`, supplier 2; it powers By item grouping)

| Plant | Size | Price | Stock |
|---|---|---|---|
| Live Oak | 30 G | $245.00 | 40 |
| Cedar Elm | 15 G | $110.00 | 25 |
| Texas Redbud 'Oklahoma' | 15 G | $135.00 | 12 |
| Dwarf Yaupon Holly | 5 G | $28.00 | 120 |
| Mexican Feathergrass | 1 G | $7.50 | 400 |
| Gulf Muhly | 3 G | $14.00 | 220 |
| Red Yucca | 5 G | $26.00 | 90 |
| Texas Sage 'Compacta' | 5 G | $24.00 | 60 |

### Jobs, requests and orders

| Job | Customer | Mode / EDD | Request (AR) state at S2 | Order state at S2 |
|---|---|---|---|---|
| J1 Barton Hills Residence – Front Yard | Greenway (Maria) | Delivery, D+12 (Wed, 11/04), 2201 Barton Hills Dr, Austin, TX 78704 | **New**, untouched, `share_customer_details = true` | none |
| J2 Mueller Pocket Park | Pecan Street (Luis) | Delivery, D+18 (Tue, 11/10) | **Processing**, one of each answer, private | none |
| J3 Riverbend HOA Entry Refresh | Riverbend HOA (Sam) | Delivery, D+10 (Mon, 11/02) | **Completed** | **New** |
| J4 Cedar Park Medical Plaza | Greenway (Maria) | Delivery, D+6 (Thu, 10/29) | Completed | **Processing**, acknowledged D−3, with change log |
| J5 Natarajan Backyard | Priya | Pickup, D+4 (Tue, 10/27) | Completed | **Order Ready** |
| J6 Dripping Springs Ranch Entry | Pecan Street (Luis) | Delivery, D−10 | Closed | Closed Won (job closed_won) |
| J7 Hyde Park Bungalow | Priya | Pickup, D−20 | Closed | Closed Lost (job closed_lost) |

Resulting counts:
- Requests: New 1, Processing 1, Completed 3. History: 2 requests.
- Orders: New 1, Processing 1, Ready 1. History: 2 orders.
- Bell at S2: 2 (J1 New, plus unread chat message 5).

Do **not** set `record_name` on any request or order. Cards then show job names, and no "AR-" or "O-" string appears
on the list screens.

**J1 Barton Hills request lines** (asked candidates). The LPS note shows under each plant. The prices are catalogue
prefills, so the "Prices we already have on file…" hint shows.

| # | Need | Size | Plant | LPS note | Prefilled price | Answer on camera |
|---|---|---|---|---|---|---|
| 1 | 2 | 30 G | Live Oak | Single trunk, 2.5 in+ caliper | $245.00 | Ch 3: Available |
| 2 | 5 | 15 G | Cedar Elm | Matching canopies please | $110.00 | Ch 3: Partial Qty 3, "2 more ready in 3 weeks" |
| 3 | 3 | 15 G | Texas Redbud 'Oklahoma' | Multi-trunk preferred | $135.00 | Ch 4: Diff Sz/Sub, using the 30 G alternative |
| 4 | 24 | 5 G | Dwarf Yaupon Holly | Full and round, no gaps | $28.00 | Ch 3: Can Order, "Ready mid-November from our Tyler farm" |
| 5 | 40 | 3 G | Gulf Muhly | (none) | **empty (purple)** | Ch 3: Available, then type 14.00, giving a line total of $560.00 |
| 6 | 12 | 5 G | Red Yucca | Blooming size | $26.00 | Ch 4: Unavailable, No Sub |
| 7 | 60 | 1 G | Mexican Feathergrass | (none) | $7.50 | Left Pending in Ch 4, set Available in Ch 5 |

You also need an **un-asked alternative candidate** on J1 line 3:
- Texas Redbud 'Oklahoma', 30 G, $210.00
- `availability_request_id` NULL, `is_original = false`, `hide_from_lps = true`

This is what puts the priced option into the Diff Sz / Sub dialog. The request note (`note_for_supplier`) on J1 is NULL,
so the "Note for this request" box starts empty.

**J2 Mueller Pocket Park request** (Processing; feeds the By item and By status shots). Answer each line through the RPC,
as in local-stack.md step 8:

| Need | Plant | Answer | Price | Supplier note |
|---|---|---|---|---|
| 4 | 30 G Live Oak | Available | $245 | "Tagged in row 4" |
| 6 | 15 G Cedar Elm | Partial Qty 4 | $110 | "4 now, 2 more in spring" |
| 3 | 15 G Texas Redbud 'Oklahoma' | Diff Sz/Sub, 30 G alternative | $210 | "Only 30 G left this season" |
| 24 | 5 G Dwarf Yaupon Holly | Can Order | | "Can pull from our Tyler farm, ~10 days" |
| 40 | 3 G Gulf Muhly | Arriving Soon | $14 | "Truck lands next Tuesday" |
| 18 | 5 G Red Yucca | Unavailable | | |
| 60 | 1 G Mexican Feathergrass | Pending | | |

**J3 Riverbend request (Completed) and order (New).**
- Request note: "All tagged and ready. Can deliver Monday morning."
- Order lines, copied from the selected HCG candidates. Status follows the request answer, and "can_order" becomes
  "Need to Order":

  | Qty | Plant | Unit price | Line total | Status |
  |---|---|---|---|---|
  | 3 | 30 G Live Oak | $245.00 | $735.00 | Available |
  | 40 | 3 G Gulf Muhly | $14.00 | $560.00 | Arriving Soon |
  | 30 | 5 G Dwarf Yaupon Holly | $28.00 | $840.00 | Need to Order |
  | 12 | 5 G Texas Sage 'Compacta' | $24.00 | $288.00 | Available |

  Subtotal **$2,423.00**.
- Additional details:
  - Customer: "Riverbend HOA (Sam Whitaker)"
  - Delivery address: "100 Riverbend Blvd, Round Rock, TX 78664"
  - Delivery contact: "Sam Whitaker, 512-555-0177"
  - Site notes: "Unload at the north entrance island. Call 30 minutes before arrival."
  - Payment: "Net 30 on LPS account"

**J4 Cedar Park order (Processing).**
- Lines:

  | Qty | Plant | Unit price | Status | Note |
  |---|---|---|---|---|
  | 4 | 30 G Live Oak | $245 | Available | "Tagged" |
  | 10 | 15 G Cedar Elm | $110 | Need to Order | "Coming from our Tyler farm" |
  | 50 | 1 G Mexican Feathergrass | $7.50 | Arriving Soon | |

  Subtotal $2,455.00.
- Acknowledged D−3.
- Change log: "- 10/19: Live Oak qty 5 → 4" and "- 10/21: Delivery moved to Thu 10/29 7am". Use D−4 and D−2 if D changes.
- Additional details: Customer "Greenway Landscape Co. (Maria Delgado)", Delivery address "1401 Medical Pkwy, Cedar Park, TX
  78613", Delivery contact "Maria Delgado, 512-555-0142".

**J5 Natarajan order (Order Ready, pickup).**
- Lines: 2 × 15 G Texas Redbud 'Oklahoma' $135, 8 × 5 G Texas Sage 'Compacta' $24, 10 × 5 G Red Yucca $26 (all Available).
  Subtotal $722.00.
- Customer "Priya Natarajan".

**J6 and J7 (history):**
- J6: 6 × 30 G Live Oak and 8 × 15 G Cedar Elm, Closed Won.
- J7: 25 × 3 G Gulf Muhly and 6 × 5 G Red Yucca, Closed Lost.
- Answer and submit their requests **before** closing, because closed requests and jobs refuse writes.

**Chat thread** `supplier-hill-country-growers` (all with `portal = true`):

| # | When | From | Job tag | Text |
|---|---|---|---|---|
| 1 | D−6 | agent | (main) | "Welcome to the Local Plant Supply partner portal, Jordan! New availability requests will appear here." |
| 2 | D−3 | lps "Chris" | J2 (shows "Ref AR: Mueller Pocket Park") | "We've just sent the Mueller Pocket Park request. Shout if any sizes are tight." |
| 3 | D−2 | supplier "Hill Country Growers (portal)" | J2 | Photo `redbud-30g.jpg`: "Here's the 30 G redbud we can swap in." |
| 4 | D−2 +20 min | agent | J2 | "Thanks! The 30 G works. We'll update the customer." |
| 5 | D −1 h | agent | J4 (shows "Ref Order: Cedar Park Medical Plaza") | "Cedar Park Medical Plaza: delivery is now Thursday at 7am. We've added it to the change log." |

- Set `threads.portal_read_id = 4`, so message 5 is unread (orange dot plus a bell row).
- The stub should set `job_request_id` from the page path on supplier sends, so the Ch 7 photo and voice note show
  "Ref Order: Riverbend HOA Entry Refresh".
- Media: `redbud-30g.jpg` and `riverbend-oaks-tagged.jpg`, both real photos you own or have a licence for.

---

## Part 4. Written onboarding page (one section per chapter)

### 1. Welcome and signing in
The partner portal is where Local Plant Supply asks what you can supply, sends you orders and keeps in touch. It runs in
your web browser on a phone or a computer, so there's nothing to download.
1. Open the sign-in link your Local Plant Supply contact sent you.
2. Enter your **Username** and **Password** exactly as sent, then press **Sign in**.
3. On **Choose a password**, enter the temporary password as **Current password**.
4. Choose a **New password** of at least 10 characters and type it again in **Confirm new password**.
5. Press **Save and continue**. You'll land on **Availability Requests**.

**Tip:** each person at your company can have their own login. Ask your LPS contact to add a colleague or to reset a
forgotten password.

### 2. Finding your way around
Your home screen lists the availability requests we've sent you: each one is us asking whether you can supply the
plants for a job. Requests are sorted into three buckets so you can see what needs doing.
1. **New** (blue) is waiting for your answer. **Processing** (orange) means you've started. **Completed** (green) means
   you've submitted.
2. Tap a bucket to show or hide its requests. New and Processing are shown when you arrive.
3. Each card shows the job, the date it's needed, **Pickup** or **Delivery**, the number of items and the value. Tap a
   card to open it.
4. On a computer, use the menu on the left: **Orders**, **Availability Requests**, **Order/Request History** and **Settings**.
   On a phone, use the bottom bar: **Alerts**, **Orders**, **Requests**, **More** and **Chat**.
5. The bell (**Alerts** on a phone) lists new requests and our latest replies.

**Tip:** we don't send emails or text alerts for new requests, so check **Alerts** each day.

### 3. Answering an availability request
Open a request to see the job, how it's being fulfilled and when, and the plants we need. Each line shows our quantity,
size and plant name, with any notes from us underneath. You set a status for each line, and every answer saves as soon
as you make it.
1. Choose **Available** if you can supply the full quantity. It saves at once.
2. Choose **Partial Qty**, enter the **Quantity you can supply**, add an optional note, and press **Save answer**.
3. Choose **Can Order/Arriving Soon**, pick **Can Order** or **Arriving Soon**, say when, and press **Save answer**.
4. Check the **Unit price** on each line. Prices we have on file are filled in, so correct any that have changed. A purple
   box means a price is missing.
5. Use the coloured counts above the lines (for example **Pending**) to filter the list. Tap again to clear the filter.

**Tip:** you don't need to finish in one go. Close the page and come back later; your answers are kept, and the request
shows as **Processing**.

### 4. Substitutes, notes and submitting
If you can't supply a line exactly as asked, you can offer something else or tell us it's unavailable. When you're done,
add a note for the whole job and submit your answers.
1. Choose **Diff Sz/Sub**. If we know you carry another size, it's listed with its price. Pick it, or choose
   **Something else…** and describe what you can offer. Then press **Submit**.
2. If you can't supply it at all, choose **Unavailable**, then **No Sub**.
3. Not sure yet? Leave the line on **Pending**.
4. Add anything that applies to the whole job (delivery days, loading times) in **Note for this request**.
5. Press **Submit availability**. If lines are still pending, you'll be asked to confirm: answer them, or press
   **Submit anyway**.
6. You'll see **Availability received**, and the request moves to **Completed**.

**Tip:** on a phone, tap a card's **Status** to answer, and tap **Avail** or **Price** to type. Press and hold the
**Supplier reply** box to add a note to a line.

### 5. After you submit
You can keep a submitted request up to date until we close it. You can also share it with a colleague who doesn't have
a login, or print it for the yard.
1. Open the request from **Completed** and change any line. It moves back to **Processing**.
2. Press **Re-Submit availability** to send us the update. You'll see **Update received**.
3. To let a colleague answer without logging in, press **Share**, then **Make public**. The link is copied for you.
4. Press **Make private** when they're done. The old link stops working.
5. Press the **Print** icon for a paper sheet. Fill it in and send us a photo in chat. The request number on the sheet
   tells us which job it belongs to.
6. Closed requests are kept under **Order/Request History** on the **Requests** tab.

**Tip:** anyone with a public link can view and answer that request, so share it only with people you trust.

### 6. Answering by photo, text or voice
You don't always need to fill in the line table. You can answer a request by sending us a photo, a message or a voice note
in chat, and we'll check it and enter your answers into the request for you.
1. Print the request (the **Print** icon on the request page), fill it in at the yard, and send us a photo in **Chat**. The
   request number on the sheet tells us which job it's for.
2. Or type a quick answer, for example "Barton Hills: everything's available except the Red Yucca."
3. Or tap the microphone, say your answer, and press **Send voice note**.
4. We'll check what you've sent and update the request. Your answers then show in the portal as usual.

**Tip:** name the job in your message, or send it from that request's page, so we can match it straight away.

### 7. Orders: acknowledging, updating and marking ready
When we place an order with you, it appears under **Orders** straight away. Orders move from **New** to
**Processing** to **Order Ready**, and you move them along as the work gets done.
1. Open the order and read **Additional details**: your delivery brief, with the customer, the address, the contact and
   any site notes.
2. Press **Acknowledge Received** and confirm. The order moves to **Processing**.
3. As things change, pick a new status on a plant line, add **Your note on this plant**, and press **Save status**.
4. Press **Save N status changes** at the bottom to send all your updates to us in one go.
5. When it's all ready, press **Mark as Ready**, then **Confirm: ready for …**. The order moves to **Order Ready**.

6. Press the **Print** icon for a yard sheet: every plant with **Ready** and **Need to Order** boxes to tick, and space for notes.

**Tip:** quantities, sizes, prices and dates are set by us. If any of them need to change, or you can't fulfil the order,
message us in **Chat**. Our changes appear in the order's **Change log**. Ready orders are in the **Ready** bucket,
which isn't ticked by default.

### 8. Chatting with Local Plant Supply
Chat is one ongoing conversation with our team about any job. Use it for questions, changes, photos and quick voice
notes.
1. On a computer, open the **Local Plant Supply** panel on the right. On a phone, tap **Chat**.
2. Messages about a job show a tag such as **Ref Order:** or **Ref AR:**. Tap it to open that order or request.
3. To send a photo, PDF or spreadsheet, tap the paperclip, choose the file, and send.
4. For a voice note, tap the microphone, speak, and press **Send voice note**.
5. Look out for an orange dot on **Chat**, and a row in **Alerts**, when there's a new reply.

**Tip:** send your message from the order or request it's about. We can see which page you were on, which helps us
find the right job quickly.

### 9. Settings, the app and handy tips
A few things make day-to-day use quicker, especially on a phone.
1. Choose **Install app** to put the portal on your home screen. On an iPhone, follow the **Add to Home Screen** steps
   in Safari.
2. Change your password under **Settings**.
3. On the requests screen, switch to **By item** (bottom of the screen) to see each plant across all open requests and
   answer them in one place.
4. Switch to **By status** to see your answers grouped, for example everything on **Can Order** or **Arriving Soon**.
5. **Light mode** / **Dark mode** and **Log out** are in the menu (under **More** on a phone).

**Tip:** the portal updates by itself while it's open, so new requests and orders appear without refreshing. Check it
each day so nothing waits.
