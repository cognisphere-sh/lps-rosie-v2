import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { planAttachmentFiles } from "./seed/scripts/gws/attachment-files.mjs";
import { collectAttachments } from "./seed/scripts/gws/format-email-lib.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const cli = join(root, "seed/scripts/gws/email");
const part = (filename, id, extra = {}) => ({
  filename, partId: `0.${id}`, mimeType: "image/png",
  headers: [{ name: "Content-ID", value: `<cid-${id}>` }],
  body: { attachmentId: `att-${id}` }, ...extra,
});

function fixture(t, parts, id = "abc123") {
  const dir = mkdtempSync(join(tmpdir(), "gws-attachments-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "bin"));
  const message = { id, threadId: "def456", payload: { parts } };
  writeFileSync(join(dir, "fixture.json"), JSON.stringify(message));
  writeFileSync(join(dir, "bin/gws"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const params = JSON.parse(args[args.indexOf('--params') + 1]);
const msg = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (args.slice(0, 4).join(' ') === 'gmail users messages get') {
  console.log(JSON.stringify(msg));
} else if (args.slice(0, 5).join(' ') === 'gmail users messages attachments get') {
  if (params.messageId !== msg.id) throw Error('message ID mismatch');
  if (fs.existsSync('fail-fetch')) throw Error('synthetic fetch failure');
  if (fs.existsSync('pause-fetch')) {
    fs.writeFileSync('fetch-paused', 'ready');
    const end = Date.now() + 15000;
    while (!fs.existsSync('resume-fetch')) {
      if (Date.now() > end) throw Error('test fetch gate timed out');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  console.log(JSON.stringify({ data: Buffer.from(params.id).toString('base64url') }));
} else if (args.slice(0, 4).join(' ') === 'gmail users threads get') {
  console.log(JSON.stringify({id: msg.threadId, messages: [msg]}));
} else { throw Error('unexpected command (no Gmail writes allowed): ' + args); }
`);
  execFileSync("chmod", ["+x", join(dir, "bin/gws")]);
  return {
    dir, message,
    runAsync: (...args) => {
      const child = spawn(process.execPath, [cli, ...args], {
        cwd: dir, env: { PATH: join(dir, "bin"), TZ: "UTC" },
      });
      let stdout = "", stderr = "";
      child.stdout.on("data", (data) => { stdout += data; });
      child.stderr.on("data", (data) => { stderr += data; });
      const done = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (status) => resolve({ status, stdout, stderr }));
      });
      t.after(() => {
        // Release the fake subprocess even if an assertion fails mid-pivot.
        if (existsSync(dir)) writeFileSync(join(dir, "resume-fetch"), "resume");
        if (child.exitCode === null) child.kill();
      });
      return { done };
    },
    run: (...args) => spawnSync(process.execPath, [
      ...(existsSync(join(dir, "fd-probe.mjs")) ? ["--import", join(dir, "fd-probe.mjs")] : []),
      cli, ...args,
    ], {
      cwd: dir, encoding: "utf8",
      env: { PATH: join(dir, "bin"), TZ: "UTC" },
    }),
  };
}
const mappings = (text) => text.split("\n").filter((s) => s.startsWith("Attachment: "))
  .map((s) => JSON.parse(s.slice("Attachment: ".length)));

test("duplicate inline image filenames retain distinct data and all MIME/CID associations", (t) => {
  const parts = [part("image", 1), { mimeType: "multipart/related", parts: [part("image", 2)] }];
  const f = fixture(t, parts);
  const result = f.run("read", f.message.id, "--attachments");
  assert.equal(result.status, 0, result.stderr);
  const files = mappings(result.stdout);
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((p) => p.filename), ["1-image", "2-image"]);
  for (const [i, file] of files.entries()) {
    assert.equal(file.originalFilename, "image");
    assert.equal(file.contentId, `<cid-${i + 1}>`);
    assert.equal(file.partId, `0.${i + 1}`);
    assert.equal(file.attachmentId, `att-${i + 1}`);
    assert.equal(file.mimeType, "image/png");
    assert.equal(file.status, "downloaded");
    assert.equal(readFileSync(join(f.dir, file.path), "utf8"), file.attachmentId);
    assert.ok(result.stdout.includes(`${file.filename}[${file.path}]`));
  }
  const before = files.map((p) => statSync(join(f.dir, p.path)).mtimeMs);
  const reread = f.run("read", f.message.id, "--attachments");
  assert.deepEqual(mappings(reread.stdout), files);
  assert.deepEqual(files.map((p) => statSync(join(f.dir, p.path)).mtimeMs), before);
  const thread = f.run("thread", "def456", "--full", "--attachments");
  assert.equal(thread.status, 0, thread.stderr);
  assert.deepEqual(mappings(thread.stdout), files);
});

test("extensions, sanitized collisions, Unicode, truncation, reserved paths and missing metadata are safe", () => {
  const names = ["same.pdf", "same.pdf", "1-same.pdf", "a/b.png", "a\\b.png", "a:b.png", ".", "..", "../../bad", "C:\\bad", "nul\0\r\n[bad]", "🌿".repeat(200) + ".xlsx", "a".repeat(500) + ".pdf", "", "CON", "é", "é"];
  const files = planAttachmentFiles("abc123", names.map((s) => ({ filename: s })));
  assert.equal(new Set(files.map((p) => p.path)).size, names.length);
  for (const [i, file] of files.entries()) {
    assert.equal(file.originalFilename, names[i]);
    assert.match(file.filename, /^[a-zA-Z0-9_.-]+$/);
    assert.ok(Buffer.byteLength(file.filename) <= 180);
    assert.equal(dirname(resolve("/tmp", file.path)), "/tmp/plugins/gws/inbox/abc123");
    assert.equal(file.contentId, null);
    assert.equal(file.partId, null);
    assert.equal(file.attachmentId, null);
  }
  assert.ok(files[0].filename.endsWith(".pdf"));
  assert.ok(files[11].filename.endsWith(".xlsx"));
  assert.ok(files[12].filename.endsWith(".pdf"));
  assert.deepEqual(planAttachmentFiles("abc123", names.map((s) => ({ filename: s }))), files);
  for (const id of ["..", "../other", "/tmp/other", "a/b", "a\\b", "", "a".repeat(129), "a\0b"]) {
    assert.throws(() => planAttachmentFiles(id, []), /unsafe Gmail message ID/);
  }
});

test("duplicate or missing MIME identifiers still get unique slots; Content-ID header is case insensitive", () => {
  const parts = [part("x.jpg", 1), part("x.jpg", 1), part("x.jpg", 3, { partId: undefined, headers: [{ name: "cOnTeNt-Id", value: "<raw-id>" }] })];
  const files = planAttachmentFiles("abc123", parts);
  assert.equal(new Set(files.map((p) => p.path)).size, 3);
  assert.equal(files[2].contentId, "<raw-id>");
  assert.equal(files[2].partId, null);
  // Collection behavior remains unchanged: only named attachmentId MIME parts.
  assert.deepEqual(collectAttachments({ parts: [...parts, { body: { data: "eA" } }] }), parts);
});

test("legacy and conflicting downloads are not overwritten; failures carry explicit mapping", (t) => {
  const f = fixture(t, [part("image", 1)]);
  const dir = join(f.dir, "plugins/gws/inbox/abc123");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "image"), "legacy artifact");
  writeFileSync(join(dir, "1-image"), "other artifact");
  const result = f.run("read", "abc123", "--attachments");
  assert.match(result.stdout, /not overwritten/);
  assert.equal(mappings(result.stdout)[0].status, "failed");
  assert.equal(readFileSync(join(dir, "image"), "utf8"), "legacy artifact");
  assert.equal(readFileSync(join(dir, "1-image"), "utf8"), "other artifact");
  assert.deepEqual(readdirSync(dir), ["1-image", "image"]);
});

test("existing target symlinks and non-regular files are refused", (t) => {
  const f = fixture(t, [part("image", 1), part("image", 2)]);
  const dir = join(f.dir, "plugins/gws/inbox/abc123");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(f.dir, "outside"), "att-1");
  symlinkSync(join(f.dir, "outside"), join(dir, "1-image"));
  mkdirSync(join(dir, "2-image"));
  const result = f.run("read", "abc123", "--attachments");
  assert.deepEqual(mappings(result.stdout).map((p) => p.status), ["failed", "failed"]);
  assert.equal(readFileSync(join(f.dir, "outside"), "utf8"), "att-1");
});

test("directory symlinks and unsafe remote message IDs cannot redirect writes", async (t) => {
  for (const component of ["plugins", "plugins/gws", "plugins/gws/inbox", "plugins/gws/inbox/abc123"]) {
    await t.test(component, (t) => {
      const f = fixture(t, [part("image", 1)]);
      mkdirSync(join(f.dir, "outside"));
      mkdirSync(dirname(join(f.dir, component)), { recursive: true });
      symlinkSync(join(f.dir, "outside"), join(f.dir, component));
      const result = f.run("read", "abc123", "--attachments");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /ENOTDIR|ELOOP/);
      assert.deepEqual(readdirSync(join(f.dir, "outside")), []);
    });
  }
  const f = fixture(t, [part("image", 1)], "../../escape");
  const result = f.run("read", "abc123", "--attachments");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe Gmail message ID/);
  assert.ok(!readdirSync(f.dir).includes("plugins"));
});

test("ordinary read is still lazy (no attachment API requests or inbox writes)", (t) => {
  const f = fixture(t, [part("image", 1)]);
  const result = f.run("read", "abc123");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /not downloaded/);
  assert.equal(readFileSync(join(f.dir, "calls.jsonl"), "utf8").trim().split("\n").length, 1);
  assert.ok(!readdirSync(f.dir).includes("plugins"));
});


test("paused fetch ancestor pivots cannot redirect writes or existing-file reuse", async (t) => {
  const components = ["plugins", "gws", "inbox", "abc123"];
  for (let depth = 0; depth < components.length; depth++) {
    for (const mode of ["write", "reuse", "reuse-conflict"]) {
      await t.test(`${components.slice(0, depth + 1).join("/")}: ${mode}`, async (t) => {
        const f = fixture(t, [part("image", 1)]);
        const original = join(f.dir, ...components);
        const pivot = join(f.dir, ...components.slice(0, depth + 1));
        const suffix = components.slice(depth + 1);
        const outside = join(f.dir, "outside", ...suffix);
        const held = join(f.dir, "held", ...suffix);
        mkdirSync(original, { recursive: true });
        mkdirSync(outside, { recursive: true });
        if (mode !== "write") {
          writeFileSync(join(original, "1-image"), mode === "reuse" ? "att-1" : "inside-conflict");
          writeFileSync(join(outside, "1-image"), mode === "reuse" ? "outside-conflict" : "att-1");
        }
        writeFileSync(join(f.dir, "pause-fetch"), "pause");
        const { done } = f.runAsync("read", "abc123", "--attachments");
        const deadline = Date.now() + 10000;
        while (!existsSync(join(f.dir, "fetch-paused"))) {
          assert.ok(Date.now() < deadline, "fake attachment request must reach pause gate");
          await delay(10);
        }
        // The CLI now owns its final directory handle and is awaiting Gmail.
        renameSync(pivot, join(f.dir, "held"));
        symlinkSync(join(f.dir, "outside"), pivot);
        writeFileSync(join(f.dir, "resume-fetch"), "resume");
        const result = await done;
        assert.equal(result.status, 0, result.stderr);
        assert.equal(mappings(result.stdout)[0].status, mode === "reuse-conflict" ? "failed" : "downloaded");
        assert.equal(readFileSync(join(held, "1-image"), "utf8"), mode === "reuse-conflict" ? "inside-conflict" : "att-1");
        if (mode === "write") {
          assert.deepEqual(readdirSync(outside), []);
          assert.equal(statSync(join(held, "1-image")).mode & 0o777, 0o600);
        } else {
          assert.equal(readFileSync(join(outside, "1-image"), "utf8"), mode === "reuse" ? "outside-conflict" : "att-1");
        }
      });
    }
  }
});


test("actual CLI closes its final directory pin before exit on success and fetch error", (t) => {
  const f = fixture(t, [part("image", 1)]);
  writeFileSync(join(f.dir, "fd-probe.mjs"), `
import fs from 'node:fs';
process.once('beforeExit', () => {
  const root = process.cwd() + '/plugins/';
  const open = fs.readdirSync('/proc/self/fd').filter((fd) => {
    try { return fs.readlinkSync('/proc/self/fd/' + fd).startsWith(root); }
    catch { return false; }
  });
  fs.writeFileSync('cli-fds.json', JSON.stringify(open));
});
`);
  writeFileSync(join(f.dir, "fail-fetch"), "fail");
  const failed = f.run("read", "abc123", "--attachments");
  assert.equal(failed.status, 0, failed.stderr);
  assert.equal(mappings(failed.stdout)[0].status, "failed");
  assert.deepEqual(JSON.parse(readFileSync(join(f.dir, "cli-fds.json"))), []);
  rmSync(join(f.dir, "fail-fetch"));
  const success = f.run("read", "abc123", "--attachments");
  assert.equal(success.status, 0, success.stderr);
  assert.equal(mappings(success.stdout)[0].status, "downloaded");
  assert.deepEqual(JSON.parse(readFileSync(join(f.dir, "cli-fds.json"))), []);
});
