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
