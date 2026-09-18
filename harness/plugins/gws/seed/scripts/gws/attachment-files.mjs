/** Local download naming and no-clobber persistence; no Gmail side effects. */
import { constants } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** ASCII disk names keep paths/attachment-link syntax safe and byte-bounded.
 * The original Unicode name is retained in the mapping, not used as a path. */
export function safeAttachmentName(name) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  if (!safe) return "attachment";
  // Keep a normal extension when shortening a long name.
  const ext = safe.match(/\.[a-zA-Z0-9]{1,20}$/)?.[0] ?? "";
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  return stem.slice(0, 160 - ext.length) + ext;
}

/** Gmail's immutable MIME traversal order supplies a unique slot even when
 * part IDs, filenames, or CIDs are absent/duplicated. Prefix EVERY name so a
 * natural suffix/name cannot collide with an allocated one. */
export function planAttachmentFiles(messageId, parts) {
  if (typeof messageId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(messageId)) {
    throw new Error("unsafe Gmail message ID for attachment directory");
  }
  const dir = join("plugins", "gws", "inbox", messageId);
  return parts.map((part, index) => {
    const originalFilename = part.filename ?? "";
    const filename = `${index + 1}-${safeAttachmentName(originalFilename)}`;
    return {
      originalFilename,
      contentId: part.headers?.find((h) => h.name.toLowerCase() === "content-id")?.value ?? null,
      mimeType: part.mimeType ?? null,
      partId: part.partId ?? null,
      attachmentId: part.body?.attachmentId ?? null,
      filename,
      path: join(dir, filename),
    };
  });
}

/** Linux procfs supplies fd-relative open/mkdir without a native dependency.
 * Follow only the kernel-owned fd anchor; every child is opened no-follow.
 * The caller owns the returned FileHandle and MUST close it after all fetches. */
export async function prepareAttachmentDirectory(messageId) {
  planAttachmentFiles(messageId, []); // validate before touching disk
  if (process.platform !== "linux" || !constants.O_DIRECTORY || !constants.O_NOFOLLOW) {
    throw new Error("secure attachment downloads require Linux procfs and no-follow directory opens");
  }
  const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
  const handles = [];
  try {
    const root = await open(".", flags); // trusted cwd, pinned once
    handles.push(root);
    // Verify procfs fd resolution before creating anything; no pathname fallback.
    const anchor = await open(`/proc/self/fd/${root.fd}`, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      const [expected, actual] = await Promise.all([root.stat(), anchor.stat()]);
      if (expected.dev !== actual.dev || expected.ino !== actual.ino) {
        throw new Error("procfs did not resolve the pinned attachment root");
      }
    } finally {
      await anchor.close();
    }
    for (const component of ["plugins", "gws", "inbox", messageId]) {
      const child = `/proc/self/fd/${handles.at(-1).fd}/${component}`;
      try {
        await mkdir(child);
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
      }
      // A swap after mkdir cannot redirect us: a symlink fails this open;
      // a later rename cannot redirect the descriptor we have already pinned.
      handles.push(await open(child, flags));
    }
    await Promise.all(handles.slice(0, -1).map((handle) => handle.close()));
    return handles.at(-1);
  } catch (err) {
    await Promise.allSettled(handles.map((handle) => handle.close()));
    throw err;
  }
}

/** Never re-resolve inbox ancestry after an async fetch. The live directory
 * handle pins the write/reuse target even if a parent pathname is replaced. */
export async function writeAttachmentFile(directory, filename, data) {
  if (directory.fd < 0 || !/^[0-9]+-[a-zA-Z0-9._-]+$/.test(filename) || filename.length > 200) {
    throw new Error("closed attachment directory or unsafe attachment basename");
  }
  const target = `/proc/self/fd/${directory.fd}/${filename}`;
  try {
    await writeFile(target, data, { flag: "wx", mode: 0o600 });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!(await file.stat()).isFile() || !(await file.readFile()).equals(data)) {
        throw new Error(`existing attachment differs or is not a regular file; not overwritten: ${target}`);
      }
    } finally {
      await file.close();
    }
  }
}
