# Memory

Cross-thread memory. One section per memory, separated by
`-----$-----$-----$-----`. Grep for what you need instead of reading the whole
file:

    grep -i -B2 -A10 '<term>' knowledge/memory.md

Format:

    name: <short-kebab-name>
    lastUpdated: YYYY-MM-DD HH:MM:SS
    description: What to remember, why it matters, where it came from, the
      reasoning behind it, and how long it stays relevant.

**What belongs here: episodic events and facts** — what happened, what was
found, what is true. **Procedural guidance does not.** A rule about *how to do
something* goes in `system_prompts/1-agent.md` if it holds everywhere, or in the
skill for the procedure it governs if it only applies there. If you catch
yourself writing "always…" or "never…" into a memory, it belongs in one of those
two places instead.

-----$-----$-----$-----

name: design-led-news-and-market-discovery
lastUpdated: 2026-09-12 11:59:25
description: Chris’s September 12 news direction is inspiring landscape design first, with a daily brief followed by interesting articles Monday–Friday. Audience is both public/customers and the team; goals combine lead generation/content with his own discovery of market developments, relevant players and standout projects. This is not marketing alone, and no geographic market was specified. He later tentatively proposed a sub-agent handling morning briefs and article links delivered in Telegram or the app; that indicates interest in research/delivery help, not a final channel/time choice, mandatory new agent or authorized schedule. Source: Telegram 315, 317–319, 322, 325; business/news-and-inspiration.md and the two weekday-plant-news requirements. Relevant while this content initiative is active; not a reprioritization of other LPS work.

-----$-----$-----$-----

name: chris-prefers-proportionate-operational-complexity
lastUpdated: 2026-09-17T09:23:07-05:00
description: Chris has repeatedly preferred the narrow solution that fits the actual work over unnecessary structure: the September 3 APS Berkeley Sedge price-sheet correction instead of an alias mechanism; September 11 simple grower email/text replies versus a collaborative link for whole-list nursery requests; September 16 Cherrylake intake, when branch questions drew “You may not make this harder that needed” and “I should be treated like one supplier”; and September 17 photo cleanup, when he offered to use his own Pixel Magic Eraser and limited the need to “only big specimen materials, not small bread and butter items.” The photo example is willingness to do selective manual work rather than need an immediate paid editing integration; it is not a blanket anti-automation preference or a size/value threshold. Daisy reported Cherrylake resolved as one company-level supplier/catalogue while retaining true pickup restrictions, without claiming HQ stock or creating branch records; Lily did not independently audit it. These cases support a durable preference for low-friction, proportionate handling, not a universal supplier policy or authority to change schemas, skills, routing or processes. Sources: knowledge/files/feedback.md (named dates), business/friction.md, business/photos-and-sharing.md; Daisy handoff September16 09:35:38 CDT and direct Chris Telegram342 September17 09:21:02 CDT. Relevant to understanding Chris’s priorities; task/implementation state remains in the requirements, not this memory.
