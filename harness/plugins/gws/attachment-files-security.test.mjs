import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readlinkSync, readdirSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareAttachmentDirectory, writeAttachmentFile } from "./seed/scripts/gws/attachment-files.mjs";
import { fetchAttachment } from "./seed/scripts/gws/format-email-lib.mjs";

// These serial helper tests only change cwd/builtin bindings in their own
// node:test worker; other test files run in separate processes.
async function sandbox(fn) {
  const cwd = process.cwd();
  const dir = await fs.mkdtemp(join(tmpdir(), "gws-pinned-test-"));
  process.chdir(dir);
  try { await fn(dir); }
  finally { process.chdir(cwd); await fs.rm(dir, { recursive: true, force: true }); }
}
function descriptors(dir) {
  return readdirSync("/proc/self/fd").filter((fd) => {
    try { return readlinkSync(`/proc/self/fd/${fd}`).startsWith(dir); }
    catch { return false; }
  });
}

const components = ["plugins", "gws", "inbox", "abc123"];

test("runtime pins one final directory; concurrent different writes never clobber and handles close", () => sandbox(async (dir) => {
  const a = await prepareAttachmentDirectory("abc123");
  const b = await prepareAttachmentDirectory("abc123");
  try {
    assert.equal(descriptors(dir).length, 2); // root/ancestor/proc-check handles closed
    assert.ok((await a.stat()).isDirectory());
    const left = Buffer.alloc(4 * 1024 * 1024, "a");
    const right = Buffer.alloc(4 * 1024 * 1024, "b");
    const results = await Promise.allSettled([
      writeAttachmentFile(a, "1-image", left), writeAttachmentFile(b, "1-image", right),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const bytes = await fs.readFile("plugins/gws/inbox/abc123/1-image");
    assert.ok(bytes.equals(left) || bytes.equals(right));
    const stat = await fs.stat("plugins/gws/inbox/abc123/1-image");
    assert.equal(stat.mode & 0o777, 0o600);
    await writeAttachmentFile(a, "1-image", bytes);
    assert.equal((await fs.stat("plugins/gws/inbox/abc123/1-image")).mtimeMs, stat.mtimeMs);
    assert.equal(descriptors(dir).length, 2); // failed reuse has no leaked leaf fd
    await assert.rejects(writeAttachmentFile(a, "../escape", bytes), /unsafe attachment basename/);
  } finally { await Promise.all([a.close(), b.close()]); }
  assert.equal(descriptors(dir).length, 0);
  await assert.rejects(writeAttachmentFile(a, "1-image", Buffer.from("x")), /closed attachment directory/);
}));

test("concurrent identical writes and interrupted-file conflicts preserve exact-byte reuse", () => sandbox(async (dir) => {
  const handle = await prepareAttachmentDirectory("abc123");
  try {
    const data = Buffer.alloc(4 * 1024 * 1024, "a");
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => writeAttachmentFile(handle, "1-image", data)));
    assert.ok(results.some((r) => r.status === "fulfilled"));
    assert.ok((await fs.readFile("plugins/gws/inbox/abc123/1-image")).equals(data));
    await fs.writeFile("plugins/gws/inbox/abc123/2-image", "partial");
    await assert.rejects(writeAttachmentFile(handle, "2-image", data), /not overwritten/);
    assert.equal(await fs.readFile("plugins/gws/inbox/abc123/2-image", "utf8"), "partial");
    await fs.symlink(join(dir, "plugins/gws/inbox/abc123/1-image"), "plugins/gws/inbox/abc123/3-image");
    await assert.rejects(writeAttachmentFile(handle, "3-image", data), /ELOOP/);
    assert.equal(descriptors(dir).length, 1);
  } finally { await handle.close(); }
  assert.equal(descriptors(dir).length, 0);
}));

test("fetch and decode failures close the caller-owned pin without any download", () => sandbox(async (dir) => {
  for (const runGws of [async () => { throw new Error("synthetic fetch error"); }, async () => ({ stdout: "not JSON" })]) {
    const handle = await prepareAttachmentDirectory("abc123");
    try { await assert.rejects(fetchAttachment(runGws, "abc123", "att-1", handle, "1-image")); }
    finally { await handle.close(); }
    assert.equal(descriptors(dir).length, 0);
    assert.deepEqual(await fs.readdir("plugins/gws/inbox/abc123"), []);
  }
}));

test("missing proc fd support fails before mkdir and closes trusted-root descriptor", () => sandbox(async (dir) => {
  const original = fs.open;
  fs.open = async (path, ...args) => {
    if (String(path).startsWith("/proc/self/fd/")) throw Object.assign(new Error("synthetic unavailable procfs"), { code: "ENOENT" });
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(prepareAttachmentDirectory("abc123"), /unavailable procfs/); }
  finally { fs.open = original; syncBuiltinESMExports(); }
  assert.equal(descriptors(dir).length, 0);
  assert.deepEqual(await fs.readdir(dir), []);
}));

test("during descent, pinned parent replacement cannot redirect mkdir/open", async (t) => {
  for (let depth = 0; depth < 3; depth++) {
    await t.test(components[depth], () => sandbox(async (dir) => {
      await fs.mkdir("outside");
      const original = fs.mkdir;
      let calls = 0;
      fs.mkdir = async (...args) => {
        if (++calls === depth + 2) {
          const pivot = join(...components.slice(0, depth + 1));
          await fs.rename(pivot, "held");
          await fs.symlink(join(dir, "outside"), pivot);
        }
        return original(...args);
      };
      syncBuiltinESMExports();
      let handle;
      try {
        handle = await prepareAttachmentDirectory("abc123");
        await writeAttachmentFile(handle, "1-image", Buffer.from("pinned"));
      } finally {
        fs.mkdir = original; syncBuiltinESMExports();
        if (handle) await handle.close();
      }
      assert.equal(await fs.readFile(join("held", ...components.slice(depth + 1), "1-image"), "utf8"), "pinned");
      assert.deepEqual(await fs.readdir("outside"), []);
      assert.equal(descriptors(dir).length, 0);
    }));
  }
});

test("child swapped between mkdir/open is rejected at every depth and all descriptors close", async (t) => {
  for (let depth = 0; depth < 4; depth++) {
    await t.test(components[depth], () => sandbox(async (dir) => {
      await fs.mkdir("outside");
      const original = fs.mkdir;
      let calls = 0;
      fs.mkdir = async (...args) => {
        const result = await original(...args);
        if (++calls === depth + 1) {
          const pivot = join(...components.slice(0, depth + 1));
          await fs.rename(pivot, "held");
          await fs.symlink(join(dir, "outside"), pivot);
        }
        return result;
      };
      syncBuiltinESMExports();
      try { await assert.rejects(prepareAttachmentDirectory("abc123"), /ENOTDIR|ELOOP/); }
      finally { fs.mkdir = original; syncBuiltinESMExports(); }
      assert.deepEqual(await fs.readdir("outside"), []);
      assert.equal(descriptors(dir).length, 0);
    }));
  }
});


test("unsupported platform fails closed before creating directories", () => sandbox(async (dir) => {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { ...descriptor, value: "darwin" });
  try { await assert.rejects(prepareAttachmentDirectory("abc123"), /require Linux procfs/); }
  finally { Object.defineProperty(process, "platform", descriptor); }
  assert.equal(descriptors(dir).length, 0);
  assert.deepEqual(await fs.readdir(dir), []);
}));
