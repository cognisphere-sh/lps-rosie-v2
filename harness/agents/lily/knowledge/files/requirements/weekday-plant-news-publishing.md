# Curate weekday news for morning briefs and the inspiration page

- Status: staged — Bhoumik notified of baseline via Telegram 324; morning-delivery option added, approval pending
- Route: bhoumik
- Raised: 2026-09-12 by Chris (via Telegram 315, 317–319, 322, 325)
- Updated: 2026-09-12T11:59:25-05:00

## Problem

Chris wants a daily brief followed by interesting articles, updated Monday–Friday: inspiring public content that attracts LPS prospects and helps him discover market developments, relevant players and standout projects. He now proposes someone handling the research and sending him morning briefs and article links in Telegram or the app. This is a lightweight ownership/delivery option, not a final choice of channel, a request for mandatory new agent architecture or permission to schedule. Neither layout nor a private delivery establishes editorial ownership or public publishing permission.

## Evidence

- Feedback **Weekday plant news page**, **Inspiring design comes first**, **Public and team audience**, **News serves lead generation** (2026-09-12; Telegram 315, 317–319): “Updated daily mon-fri”; “Inspiring landscape design is priority”; “Both”; “Lead gen and content.”
- Feedback **Daily brief and market discovery** (Telegram 322, 2026-09-12T11:08:44-05:00): “And daily brief and then interesting articles.” / “Good for me to discover what's happening in a market and who the relevant players with the best projects are.”
- Feedback **Morning brief delivery option** (Telegram 325, 2026-09-12T11:58:42-05:00): “Perhaps a sub agent that handles this sends me morning briefs and article links in telegram or on app?”
- App/public-boundary audit: `workspace/threads/main/tasks/weekday-plant-news-page/notes.md`. Existing public artifact hosting is a possible boundary, not an approved news or lead-intake process.

## What it should do

- Under an approved owner/process, curate one shared set of source-backed news Monday–Friday, selecting inspiring landscape design first with plant and nursery news supporting it. Reuse that curation for the proposed personal brief and, separately when approved, the app/public page rather than requiring duplicate research feeds.
- If the morning-delivery option is approved, send Chris the concise market/design brief and worthwhile original article links in the chosen channel (Telegram or app) at the agreed weekday morning time. A lightweight research task is Lily’s recommendation; Chris has not selected it, a channel or a time, and a new standalone agent is not a prerequisite.
- Use legitimately accessible published stories and permitted reuse; supply original links, publishers, actual article dates where known, category, curated order and brief original summaries. Imagery is optional and rights-dependent. No source service/acquisition method is selected here.
- Supply a concise original daily brief explaining the design inspiration and market relevance, followed by interesting articles. Within that brief and the story summaries, identify relevant designers/firms/players and standout projects when supported by the sources. Keep editorial interpretation separate from reporting, without invented facts, freshness or unsupported “best” rankings.
- Publish publicly only through the owner and publication approval/control Bhoumik approves. A private morning brief may be approved independently of public launch; sending it does not authorize automatic public publication or copying private notes. Only deliberately publishable news may reach public readers—never private customer, supplier, Job, agent or operational information.
- Preserve the real successful edition/update date. If a refresh fails or no suitable material is ready, keep the prior edition honestly dated rather than relabelling it or publishing unverified filler.
- Reuse a verified existing public contact destination for the lead-generation invitation if suitable. Any genuinely new inquiry/data or public-access contract needs Bhoumik’s approval; no lead handling is created by this requirement.

## Acceptance criteria

- An approved owner/process can provide the weekday daily brief, design-led interesting articles, categories and source details. The brief/articles help Chris discover what is happening and relevant players/projects, where source evidence supports that context; they are not marketing-only copy.
- If approved for personal delivery, Chris receives the brief and original article links in the selected channel at the agreed weekday morning time. Delivery expectations reflect actual source/update dates, not a claim that archived prototype samples are current.
- One curation process can support that delivery and an approved page edition without duplicate research. A delivered private brief or internal note never becomes public automatically; public approval and content boundaries remain separate.
- Readers can verify stories at original sources and distinguish article publication dates from LPS’s real edition/update date; older inspiration is not presented as newly reported news.
- Failed/missed updates leave the preceding edition honestly dated. Content, summary accuracy and media reuse are checked under the approved publication process before becoming public.
- Before launch, signed-out and staff readers receive only the same public content, without exposing private data, staff controls or operations access.
- The contact invitation reaches a verified legitimate public destination before activation, with no hidden lead creation, subscription, tracking or automated follow-up.
- Research/delivery ownership, legitimate sources and the initial channel/morning time are approved before recurring personal delivery is enabled. Public publication controls and contact-destination approval are separate launch gates, not prerequisites to an independently approved private brief. Nothing in this staged requirement enables either delivery or public publishing.

## Out of scope

- UI presentation (`weekday-plant-news-page-ui.md`); selecting/building a CMS, schema, paid feed, scraping system, asset pipeline or new agent role/procedure.
- Public release, scheduling or auto-publication before the applicable approval; new-agent creation/configuration, lead CRM/forms, tracking, newsletters, social publishing, people/project databases or rankings, full-article/image copying or separate private research feeds.
- Reopening other sourcing, order-management, pricing or mobile priorities.

## Assumptions

- Monday–Friday remains the requested cadence, not breaking-news ingestion. “Morning” is the proposed personal delivery window, not a chosen clock time. Timezone/holiday handling, geography/market boundary and story volume are unspecified.
- Lily recommends a lightweight weekday research task sending to this Telegram conversation first, with the same curated content reusable by the app/page. This is a recommendation only; Chris has not chosen Telegram over app or approved an agent/schedule.
- The public page remains one shared edition for visitors and staff. Personal morning delivery may precede that launch without requiring a second research feed. Lead generation remains useful public content plus an invitation to contact LPS, not a new lead-management product.

## Open questions

- Bhoumik: approve lightweight weekday research/delivery ownership and legitimate sources, and choose Telegram or app initially plus the morning time. No new standalone agent or architecture decision is demanded.
- Separately, Bhoumik: approve public publication ownership/control and whether existing public hosting/contact paths suffice before launch. Any genuinely new public-access/inquiry contract stays staged; private delivery does not settle it.
- 2026-09-12T11:31:15-05:00 — Nova’s private static prototype does not settle publication control: standard signed-in artifact readers can manually change visibility. Point-in-time private verification is not policy approval or a durable release gate; legitimate contact destination and public launch remain unresolved.

## Handoff log

- 2026-09-12T11:09:14-05:00 — Staged internally with daily-brief/market-discovery refinement; no workflow implementation, source choice, outreach, public release or schedule performed.
- 2026-09-12T11:14:18-05:00 — Parent confirmed Bhoumik notified in Telegram 324: Nova’s private labelled-sample preview is separate from staged weekday sourcing/editorial/publishing. Prefer existing hosting; publication ownership/control and a legitimate LPS contact destination are required before public launch. Await approval; no automation or release enabled.
- 2026-09-12T11:31:15-05:00 — Parent relayed Nova’s completed private static prototype, sample content and QA report. Workflow status remains staged; no source/updater/schedule/lead-data or public-release changes reported. Preview evidence/attribution is in the separate UI requirement.
- 2026-09-12T11:59:25-05:00 — Captured Chris’s tentative morning-brief/sub-agent option in this existing requirement. Lily recommends lightweight weekday research and Telegram-first delivery with shared curation, not a mandatory new agent; no final channel/time choice or authorization received. Parent to take the revised ownership/delivery decision to Bhoumik. No agent/configuration/skill/API/schedule change, external delivery or public publication performed.
