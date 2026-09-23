## 4. Route it

Chris's standing rule (2026-08-25). One route per slice of work:

| The change is… | Route | What you do |
|---|---|---|
| UI or UX — layout, copy, fields, screens, panels, what the app shows | **nova** | Agent-message nova to build it now. Status `routed`. |
| Database or workflow — a table/column, a migration, how a process actually works, statuses, money | **bhoumik** | Status `staged`. Tell Bhoumik it's waiting. **Never hand it to nova to build.** |
| An agent's SOP, skill, script or deployment prompt | **that agent** | Update your own via `create-skill`; send other owners Chris's explicit feedback or approval of the proposed change. Inferred changes wait for his approval. Harness base prompts stay unchanged. |

**When it mixes, split it** — the UI slice to nova, the structural slice
staged, and the file says which is which. **When you can't tell**, ask Bhoumik:
one question naming the two readings.

To nova (or another agent):

```bash
bash scripts/agent-msg/send --to-agent nova --thread-id main \
  --subject "Requirement: <title>" \
  --message "<the requirement in full — problem, behaviour, acceptance criteria, out of scope. Path: knowledge/files/requirements/<slug>.md on lily.>"
```

Send it **in the body**, not just a path — the receiving agent shouldn't have
to read another agent's dir to know what to build. Name the file too, so it
can check for updates.

For instruction changes, include Chris's source feedback or approval and the
exact scope; a clear correction needs no separate requirement document. Report
completion only after your own verification or the owning agent's confirmation.

To Bhoumik on Telegram: what it is, why Chris wants it, why it's staged rather
than shipping, what you need from him. Technical language is fine.

To Chris on Telegram: one line — going out to nova, or waiting on Bhoumik and
why. No jargon, no file paths.

## 5. Close the loop

- **`routed`** — the builder has it. On their report, set `shipped` and tell
  Chris what changed, in his terms. **Closing the loop is what earns the next
  piece of feedback** — an input that visibly went nowhere teaches him not to
  bother.
- **`staged`** — Bhoumik's. It waits. If staged items start blocking things
  Chris raises again, surface them once, as a list.
- **`dropped`** — Chris decided against it. Keep the file, set the status, and
  record *why*; the reason stops it being re-raised in three weeks.

Never close on your own judgment: `shipped` needs the builder's confirmation,
`dropped` needs Chris's.

## 6. Failure modes

- **Feedback that only lives in Telegram scrollback.** Compaction eats it and
  the pattern never forms. This is the failure that matters — log first.
- **Turning capture into an interview.** Chris is running a nursery. Record
  what he said and ask at most one sharpening question.
- **Handing a DB or workflow change to nova.** Staging exists so Bhoumik
  decides. If it's already sent, tell nova to hold and stage it properly.
- **Writing implementation instead of behaviour.** If the file names columns
  or components, cut it back to what the system should do.
- **A requirement with no acceptance criteria or no evidence.** It comes back
  as a question. Finish [propose](propose.md) first.
- **Agent-message failed** (`send failed …`). It did not arrive — read the
  error. `403` means that inbox doesn't accept you: don't retry, tell Chris.
  Never mark anything `routed` on a failed send.
