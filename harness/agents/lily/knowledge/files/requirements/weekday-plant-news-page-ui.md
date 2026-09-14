# Design-led news and inspiration for prospects and the LPS team

- Status: routed — PROTOTYPE COMPLETE ONLY (private static presentation); public release held
- Route: nova
- Raised: 2026-09-12 by Chris (via Telegram 315, 317–319, 322)
- Updated: 2026-09-12T11:31:15-05:00

## Problem

Chris wants a daily brief followed by interesting articles: inspiring landscape design that attracts LPS prospects and helps him discover market developments, relevant players and standout projects. This is useful market intelligence as well as public content, not marketing alone. Current app/docs review found no news/editorial capability.

## Evidence

- Telegram 315, 2026-09-12T11:04:15-05:00: “I want to create a page with a collection of news articles on the latest in plants, landscape architecture, and nursery news with an editorial summary at the top, followed by news categories filterable and then top stories in a grid. Updated daily mon-fri.”
- Telegram 317–319: “Inspiring landscape design is priority.” / “Both” (public/customers and team) / “Lead gen and content.”
- Telegram 322, 2026-09-12T11:08:44-05:00: “And daily brief and then interesting articles.” / “Good for me to discover what's happening in a market and who the relevant players with the best projects are.” (Paragraph break preserved in raw log.)
- Raw inputs: `../feedback.md`. Read-only app/public-boundary findings: `workspace/threads/main/tasks/weekday-plant-news-page/notes.md`.

## What it should do

- Present one shared public-facing news/inspiration page for prospects, customers and the team, with the same publishable content for everyone.
- Preserve Chris’s order: short **daily brief** (the editorial summary) → category filters → interesting top stories in a responsive grid. Inspiring landscape design leads the brief and curated story order; plant/nursery news supports it.
- Within the existing brief and story summaries, explain source-backed market developments, relevant designers/firms/other players and standout projects when the story supports them, and why they matter. No new widget is required.
- Start with All, Landscape Architecture, Plants and Nursery News. Filters narrow the curated stories; All restores their curated order.
- Show each story’s headline, brief original summary, publisher attribution, original link and actual publication date when known. Separate LPS editorial interpretation from source reporting.
- Show the actual edition/content-update date separately; reloading or a missed update cannot make old content appear fresh. Do not invent missing dates.
- Include a clear invitation to contact LPS about a project, using an existing verified public destination if available. No such destination was established in the app/docs audit: preview the invitation, but do not invent or activate its link.
- Use relevant imagery only when reuse is permitted and required attribution is provided; the page must also work without images.

## Acceptance criteria

- Phone and desktop previews show the requested hierarchy, with landscape inspiration leading and readable cards without horizontal overflow.
- Each category shows matching stories; All restores the curated view; an empty category says so. Filters and links work with keyboard and touch.
- A reader can distinguish editorial summaries from reporting, identify the publisher and follow the original article. The brief/cards help Chris identify what is happening and relevant people/firms/projects where supported; claims about noteworthy projects are attributable, not an unsupported objective “best” ranking. Missing dates are not represented as today.
- Reloading or simulating a failed weekday refresh does not advance the supplied edition date. Article dates remain separate.
- The contact invitation never points to a guessed address, staff login/internal chat or fake submission. Its preview is explicitly unresolved until a legitimate destination is verified.
- Preview content is clearly labelled sample content or separately approved publishable content, with no private customer, supplier, Job, agent or operational data. Unlicensed imagery is not required for completion.
- Public launch depends on the separately approved publishing/access boundary and verified contact destination; at launch visitors and staff read the same public edition without opening the operations workspace. UI completion alone does not authorize that launch.

## Out of scope

- Public release, auto-publication, scheduling, sourcing/editorial operations, new public-access/security or content-data contracts, CMS/database changes, source-service selection.
- Lead forms/storage, newsletters, tracking, scoring, automated follow-up, separate private feeds, people/project databases or rankings, full-article/paywalled content reproduction, unlicensed image copying or a new asset pipeline.
- Reprioritizing other LPS work: Chris’s “priority” specifies this page’s editorial emphasis.

## Assumptions

- One shared public page is the smallest reading of “Both.” Categories follow Chris’s wording; All is the reset.
- A contact invitation is Lily’s minimal interpretation of lead generation, not approval for new inquiry handling.
- Monday–Friday is the desired cadence; no hour, holiday policy, geography/market boundary, source provider or editorial owner is decided.

## Delivery evidence and limits

- 2026-09-12T11:31:15-05:00 — Parent relayed Nova’s 11:30:53 completion report: **private static presentation prototype only**, not a live daily news product. Archive-labelled sample daily brief → filters → three stories; unresolved contact invitation is text only.
- Preview: https://lps.cognisphere.sh/a/nova/private/artifacts/fieldnotes-private-preview-20260912-9bd49880 . Reported HTML SHA-256: `9bd498802d902c55f8efe2740587b729be691f2a30aa7a33eb83b6df1823b7a7`.
- Nova reports an independent PASS with 45 screenshots at 320/390/480/1440 widths, covering filters, empty/reset states, keyboard, contrast, dates, privacy and sandbox. Lily did not re-test or independently inspect those results.
- New artifact slug was reported verified private at that point in time. A standard signed-in artifact reader can manually change visibility; the private preview is not an approved or enforced publication-control policy and does not complete security/publication approval.
- No auth/app/public-flag/source/updater/schedule/lead-data changes reported. Weekday sourcing/editorial/publishing, public launch and a legitimate LPS contact destination remain staged with Bhoumik. Chris already received the link and keep-private warning from Nova; no resend needed.
- Evidence supplied by Nova: `../nova/workspace/threads/main/tasks/review-news-inspiration-preview/files/review-report.md`; `../nova/workspace/threads/main/tasks/news-inspiration-preview/files/publication-receipt.md`.

## Open questions

- Bhoumik: approve the separate weekday publishing process and any new public-access/inquiry contract (`weekday-plant-news-publishing.md`).
- Parent/approved owner: verify an existing legitimate public contact destination before activation. Audience is settled; do not ask again.

## Handoff log

- 2026-09-12T11:09:14-05:00 — Complete UI-only requirement delivered successfully to Nova `main`, including daily-brief/market-discovery refinement, nonpublic preview boundary and unverified contact destination. Workflow/publication staged separately. No public release authorized.
- 2026-09-12T11:31:15-05:00 — Nova’s private static prototype reported complete via parent; evidence and limits above. Recorded prototype completion only, not public launch or operational weekday publishing. Nova already closed the preview loop with Chris.
