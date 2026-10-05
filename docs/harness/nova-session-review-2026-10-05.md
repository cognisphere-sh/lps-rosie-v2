# Nova session review — 2026-10-02 to 2026-10-05

Why a small UI request took 30+ hours and never deployed, and what changed.
Source: `harness/agents/nova/sessions/` (main + 45 task threads active since
Friday 2026-10-02).

## The request

Fri 2026-10-02 10:46 CDT, Chris on Telegram (photos 766/767): center the AR
Status dropdowns, center the Submit button, and give it the purple botanical
chat-wallpaper flair.

The change was coded by 11:13 the same day: **17 lines in
`availability.tsx` and 21 in `availability-request-view.tsx`**, plus a
223-line test file.

## What happened next

| CDT (Oct 2–3) | Human | Nova |
|---|---|---|
| Fri 11:13 | — | "Coded in an isolated candidate… may I validate the bounded runner with one tiny synthetic test?" |
| Fri 23:15 | Bhoumik: "Validate and then deploy as well" | Preflight STOP: bounded runner "UNVALIDATED", needs serial-slot/HOLD clearance |
| Fri 23:49 | Bhoumik: "Do it!" | Proposes controller/payload scripts with hash manifests and execution windows |
| Sat 02:34 | Bhoumik: "Push to live" | "Build and browser validation not complete, so I can't safely call it ready" |
| Sat 04:16 | — | Typecheck attempt killed by its own pressure guard, which tripped on any rise in the memory-stall counter |
| Sat 06:18 | Bhoumik: "What was the cause?" | Guard too strict; builds a new threshold model, rewindows, refreezes |
| Sat 07:43 | Bhoumik: "Now push changes to live" | "Window already expired… needs a fresh window" |
| Sat 10:33 | — | Next typecheck attempt killed by guard: a 1110 ms monitor heartbeat gap > 1000 ms |
| Sat 14:06 | — | "Validation held: available memory below safety threshold" |
| Sat 18:23 | — | Stopped at "read-only protection check"; cause unknown; paused. **Nothing deployed.** |

Over that period the main thread received **~330 agent-to-agent messages and
9 human messages**. The 45 task threads included reviewers of reviewers
("guardian-audit", "promotion-audit", "materialize-m1-review"), stage
preparers ("prepare-build-stage", "prepare-promotion-adapters",
"prepare-materialization-stage" with m2/m3 sub-threads), and repeated typecheck
qualification threads ("qualify-type-t2c/t2d/t2e"). Main-thread messages
degraded into run-together jargon ("784PUSHLIVEgoal acknowledged
no newroutineconfirmation…"). The main session file is 43 MB, has 14
compactions, and stopped mid-turn 6 times.

## Root causes

1. **Real constraint, wrong response.** The host had 7.8 GB RAM, **no swap** (4 GB added 2026-10-05),
   and ~3 GB free while the app, harness, browsers and IDE sessions run. Next
   builds and test runs peak around 3–3.5 GB, so the kernel OOM-killed node
   processes on Sep 18, 25, 30 and Oct 1. `/tmp` is RAM-backed tmpfs and holds
   ~1.9 GB of stale build copies (`/tmp/lps-*`), which makes this worse.
   Nova responded by authoring its own safety apparatus: the
   `bounded-offline-tests` skill (systemd units, cgroup caps, PSI and heartbeat
   guards, hash-pinned manifests, execution windows). Its own text says it is
   "UNVALIDATED — STOP normal runtime use". Then it treated that apparatus as an
   **operator HOLD** that only a human could clear. **No human imposed a
   HOLD.** Each guard tripped on noise, and each trip spawned a new round of
   source fixes, reviews and rewindowing.
2. **The visual gate doubled the memory load.** `visual-ui-release-qa` (Chris's
   2026-09-01 requirement) was implemented as a second full `next build` in a
   worktree. That is the heaviest step, run next to the live app. On top, Nova
   required exact-commit identity proofs and a separate technical-review thread.
3. **Delegation without a stop.** The harness base prompt tells a main thread to
   delegate aggressively. Nova applied that recursively: task threads spawned
   task threads, and every artifact got an "independent review". Nothing capped
   depth, and nothing said a human's "deploy" was sufficient authorization.
4. **Gate-making was self-authorized.** Nova could add gates and stages
   ("source GO", "runtime GO", "activation", windows) whenever it wanted, but it
   would not remove one without approval.
5. **Status messages hid the problem.** The Telegram updates were polite but
   kept saying "next gate pending". Nobody was asked for a decision that would
   have unblocked it, such as adding swap.

## What changed (2026-10-05)

- `nova/system_prompts/1-agent.md` § **Shipping a change**: one builder thread
  with no nested threads, edit on `main`, typecheck plus the relevant tests,
  `restart app`, one report. A human's "deploy" is the authorization. Run heavy
  steps one at a time; retry an OOM once, then tell Bhoumik. Only humans add
  gates. Status updates are plain language.
- `visual-ui-release-qa` 2.0.0 (`SKILL.md`): same requirement (real browser,
  320/390/480/1440, independent reviewer, FAIL blocks deploy) in four short
  steps. It drops the identity proofs and the separate technical-review thread.

## Follow-up (done 2026-10-05)

- Added 4 GB swap (`/swapfile` in `/etc/fstab`, `vm.swappiness=10`).
- Cleared `/tmp/lps-*` build copies and `~/.cache/nova-*` worktrees, which
  freed about 1 GB of RAM. Commits that no branch contained are kept on
  `archive/nova/*` branches. Uncommitted worktree diffs are saved in
  `~/nova-worktree-archive-2026-10-05/`.
- Removed `bounded-offline-tests`. `visual-ui-release-qa` 2.0.0 has its
  changelog entry and a trimmed review template.
- Restarted the harness. Nova's Telegram thread was not reset; new messages
  pick up the new prompt.
- Shipped the Status/Submit polish change (see `CHANGELOG.md`, 2026-10-05).
