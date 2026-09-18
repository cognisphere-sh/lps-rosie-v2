# Google Workspace (`gws`) — local fork

## Provenance and compatibility

`harness/plugins/gws/` is forked verbatim from
`@cognisphere-sh/cognisphere-harness` **0.12.0**, `src/plugins/gws/`, with the
local deltas below. It shadows the bundled `gws`: the installed
`src/core/plugin-registry.ts` scans builtin then user roots, with the later
entry winning. Its default-export class, manifest, polling, routing, OAuth
credential handling, settings, notification metadata and labeling behavior
are retained. No agent config, credentials, routing state or inbox migration
is required. The private relative harness type import is replaced by the
minimal local duck-typed context it uses; 0.12.0 has no public plugin type
entrypoint. The installed library is not modified.

Local deltas:
- Collision-safe, byte-bounded attachment filenames and explicit MIME mapping.
- Refuse different existing files and symlinks rather than silently overwrite;
  pin directory descriptors across asynchronous fetches to prevent ancestry
  replacement from redirecting writes or existing-file comparisons.
- Invoke the Node executable `scripts/gws/email` directly (never `bash`) in
  canonical notification hints, seed prompt and read/search skills.
- Regression tests and this deployment documentation.

On future harness upgrades, compare this fork with the new bundled `gws`;
user-space precedence means upstream improvements do not apply automatically.

## Downloads and output

Run from the agent directory:

```sh
scripts/gws/email read <MessageId> --attachments
scripts/gws/email thread <Channel> --full --attachments
```

Every collected attachment receives a deterministic, one-based MIME-traversal
slot prefix: two parts named `image` become `1-image` and `2-image` under
`plugins/gws/inbox/<MessageId>/`. All names are prefixed, including unique
ones, so sender-created suffixes cannot collide with allocated names. The
safe original-name component is ASCII and at most 160 bytes; ordinary final
extensions (1–20 alphanumeric characters) survive truncation. Extensionless
files remain extensionless; MIME type is in the mapping. Message IDs are
validated as 1–128 ASCII letters, digits, underscores or hyphens. Original
names, CIDs and part/attachment IDs are never path components.

The existing `<fileName>[<path>]` link format is preserved. An additional
`Attachment: { ... }` JSON line records:

- `originalFilename`: exact original name, including Unicode.
- `contentId`: raw case-insensitively collected Content-ID, including angle
  brackets; `null` when absent. Use it to resolve HTML `cid:` references.
- `mimeType`, `partId`, `attachmentId`: original MIME/API association, or
  `null` when missing.
- `filename`, `path`: actual safe download name and agent-relative path.
- `status`: `downloaded` or `failed`; failed paths must not be ingested.

No-download reads remain lazy and unchanged. Collection remains limited to
named MIME parts with `body.attachmentId`; this fix does not add support for
unnamed attachments or `body.data`-only inline parts. Download errors remain
per-file output (the CLI continues other files, as before); directory/ID
validation errors abort the read. Consumers must inspect per-file status,
not just exit code.

Repeated reads of the same immutable Gmail MIME structure reuse identical
regular files without updating their modification time. Different existing
bytes are an explicit failure. Existing legacy unnumbered downloads are
untouched, not renamed or cleaned up. No manifest is written to the inbox;
the output itself carries the mapping.

Secure download preparation opens the trusted working directory once, then
creates and opens each child relative to its pinned parent descriptor using
Linux `/proc/self/fd/<fd>/<component>`. Child directory opens require
`O_DIRECTORY | O_NOFOLLOW`: a replacement symlink between mkdir/open is
rejected, while renaming an already-open ancestor cannot redirect subsequent
mkdir/open operations. The final directory handle stays open across the whole
asynchronous attachment fetch loop. Exclusive writes and existing-file
comparisons use that handle plus the safe basename, never the ordinary inbox
pathname. Existing files open with `O_NOFOLLOW` and must be regular files.
Ancestors, probe handles, files and the final pin are closed on success/error.

This implementation requires **Linux, O_DIRECTORY/O_NOFOLLOW and working
procfs fd resolution**. Preparation checks the fd anchor resolves to the same
device/inode as its trusted root before any mkdir. Unsupported/missing procfs
fails closed; there is no pathname fallback. Offline tests verified these
capabilities on the deployment runtime without starting a plugin or making a
network call. The shared `fetchAttachment` helper now takes the pinned
FileHandle and safe filename instead of a path; its only runtime caller is
the updated email CLI, and its declaration was updated in the same seed.

The guarantee is a secure **I/O target**, not permanent integrity of a pathname
owned by the same OS user. Another authorized local process can rename an
already-pinned directory (the download still goes into that directory), or
change where a printed relative link resolves during/after a read. It cannot
redirect this operation's writes/reuse by swapping ancestor symlinks. Printed
links are ordinary filesystem references, not persistent capabilities; later
same-UID tampering with their contents/names cannot be prevented by this CLI.
A process interrupted during an exclusive write can leave a partial file;
a later read reports a conflict rather than silently replacing it.

## Ownership and activation

Canonical resources are under `harness/plugins/gws/seed/`; do not patch
`agents/*/scripts/gws`, `agents/*/skills/gws` or `plugin-gws.md` generated copies.
The seed's `read-email` and `search-email` skills have version/changelog bumps.
Deployment-owned Daisy skills `supplier-email-routing` and
`availability-ingestion` also contained `bash scripts/gws/email` at audit time;
those need their owner's separate skill updates. No deployment prompt edits
are part of this change.

After review/integration, the **operator** must restart the harness service
only (`sudo systemctl restart lps-harness.service` on this deployment).
Avoid `server.sh restart`, including its `harness` target, while unrelated app
work is dirty: that wrapper unconditionally builds the app/generates secrets.
Registry discovery happens at boot. In 0.12.0,
`agent-manager.ts:startPluginInstance` copies the selected entry's `seed/`
recursively into the agent directory **on every plugin start**, overwriting
matching generated files, then reasserts executable bits under `scripts/`
before config validation/plugin startup. Thus starting Daisy/Rosie reseeds
the corrected scripts, new helper, prompt and skills even if auth later fails.
Verify `gws` loads with `scope: user` and both agents' plugin status. No app restart, OAuth reconnection, software install, new
secret or config change is introduced. This candidate was tested offline;
no live restart or mailbox/inbox operation was performed.

## Offline checks

```sh
node --test harness/plugins/gws/attachment-files.test.mjs \\
  harness/plugins/gws/attachment-files-security.test.mjs
node --check harness/plugins/gws/seed/scripts/gws/email
node --check harness/plugins/gws/seed/scripts/gws/attachment-files.mjs
```

Tests execute the real CLI with a fake `gws` executable and synthetic MIME
fixtures in disposable temporary directories. The fake rejects any command
other than message/thread/attachment reads; it never connects to Gmail.
They cover duplicate names/IDs, sanitization collisions, extension retention,
Unicode/long names, CID and nested MIME association, repeated read/thread
output, no-clobber conflicts, legacy files, symlink/path escapes and lazy reads.
Deterministic fake-fetch pause gates pivot each of the four ancestors for
new writes, correct existing-file reuse and conflicting reuse. Additional
helper tests pivot parents during mkdir/open, swap new children before open,
check descriptor cleanup on preparation/fetch/decode/write errors, simulate
missing procfs, and exercise concurrent 4 MiB identical/different writes,
0600 permissions and partial-file conflicts.

`plugin-compat.test.mjs` additionally loads the actual installed registry and
compares the fork manifest to the bundled one, using constructors only (no
plugin `start`, bootstrap, OAuth, polling or network). Run using the already
installed tsx loader; no software installation is needed:

```sh
GWS_UPSTREAM_ROOT=/absolute/path/to/installed/cognisphere-harness \\
  node --import /absolute/path/to/installed/tsx/dist/loader.mjs \\
  --test harness/plugins/gws/plugin-compat.test.mjs
```

The compatibility test is skipped unless that explicit upstream path is set.
Strict standalone TypeScript checking of `index.ts` also passed with the
existing app TypeScript compiler and Node types; app build/lint and the live
harness restart were not run for this isolated harness-only candidate.
