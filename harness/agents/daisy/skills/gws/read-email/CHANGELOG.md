# read-email — changelog

## 1.2.1

- Harden attachment I/O with pinned no-follow directory handles across fetch/write/reuse. Document the Linux procfs requirement and fail-closed behavior without overstating the lifetime of a printed path.

## 1.2.0

- Use deterministic numbered attachment paths and JSON MIME/CID mappings; document no-clobber rereads. Invoke the Node email executable directly, not with bash.

## 1.1.1

- Wording: delivery is governed by the agent-owned gws settings
  (`scripts/gws/settings`), not a fixed you-in-`To` rule — Cc/Bcc-only mail is
  skipped only when `requireAgentInTo` is on.

## 1.1.0

- §4 now points at `scripts/gws/email search` instead of raw
  `gws gmail users messages list` — searching, narrowing a query and filing
  results moved to the `search-email` skill, which this one now names.

## 1.0.0

- Initial version: reading a full body with `scripts/gws/email read`, quoted
  reply history (`--strip-quotes`), skimming a thread before fetching
  (`email thread`), reaching older / Cc-only messages, downloading and
  converting attachments, and searching for mail the poller never delivered.
