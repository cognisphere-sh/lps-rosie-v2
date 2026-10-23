# Chapter template for script.md (Part 2)

`parse-script.py` reads the `### Chapter N.` heading, each `**N.M** "…" (~s)`
line and the first `- Caption: "…"` under it. Everything else is notes for the
recorder. Keep beats 3–10 s of narration; 6–12 beats per chapter (45–85 s).

```markdown
### Chapter N. <Title in sentence case> (<target> s, about <words> words)

**Goal:** <what the viewer can do afterwards, one or two lines>.
**Start state:** <checkpoint S1–S5 or a new one>. <D (desktop) / P (phone)>.

**N.1** "<Spoken narration, second person, short sentences.>" (~5 s)
- Shot: <device> `<route>`. <exact actions with exact UI labels in quotes>.
- Focus: <what to ring or zoom>.
- Caption: "<≤ 6 words, **UI label** in bold>".
- SFX: `click` / `whoosh` / `ding` …

**N.2** "…" (~6 s)
- Shot: …
- Caption: "…"

---
```

Part 4 write-up (copied into the page's `CHAPTERS` array):

```markdown
### N. <Title>
<One paragraph: what this part of the portal is for.>
1. <Step with **Exact label**.>
2. …

**Tip:** <one practical tip>.
```
