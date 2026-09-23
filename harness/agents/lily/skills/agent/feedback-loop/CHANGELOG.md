# feedback-loop — changelog

## 1.2.0

- Apply or route explicit procedural feedback without repeat approval; keep inferred SOP/skill changes proposed until Chris approves, preserving ownership and harness base prompts.

## 1.1.0

- Split capture, understanding, proposal and routing; add locked idempotent feedback capture and a standalone requirement template.

## 1.0.0

2026-08-25 (Chris). Initial version: the four stages of lily's job — logging
every input from Chris to `knowledge/files/feedback.md` as it arrives, keeping
the business picture in `knowledge/files/business/`, promoting a repeated
signal into a requirement, and routing it (UI/UX to nova now, DB and workflow
changes staged for Bhoumik, skills and scripts to the owning agent) through to
`shipped` or `dropped`.

Supersedes the unreleased `requirement-intake` draft written earlier the same
day, which treated lily as an intake desk for formal feature requests. Chris's
correction — she is there to record continuous feedback and understand the
business — made capture and understanding the first two stages, with
requirements as what falls out of them rather than the whole procedure.
