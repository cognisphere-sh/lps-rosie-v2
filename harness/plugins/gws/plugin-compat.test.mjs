// Run with the installed tsx loader and GWS_UPSTREAM_ROOT pointing at the
// read-only harness package. Constructors/registry only: NEVER start plugins.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const upstream = process.env.GWS_UPSTREAM_ROOT;
const candidate = dirname(fileURLToPath(import.meta.url));

test("installed registry selects user fork; manifest remains exactly upstream-compatible", { skip: !upstream }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "gws-registry-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(upstream, "src/plugins/gws"), join(dir, "builtin/gws"), { recursive: true });
  cpSync(candidate, join(dir, "user/gws"), { recursive: true });
  const { PluginRegistry } = await import(pathToFileURL(join(upstream, "src/core/plugin-registry.ts")));
  const { default: Bundled } = await import(pathToFileURL(join(upstream, "src/plugins/gws/index.ts")));
  const log = { debug() {}, info() {}, warn(...args) { assert.fail(JSON.stringify(args)); }, error(...args) { assert.fail(JSON.stringify(args)); } };
  const registry = new PluginRegistry(join(dir, "builtin"), join(dir, "user"), log);
  await registry.scan();
  const selected = registry.get("gws");
  assert.equal(selected.scope, "user");
  assert.equal(selected.sourceDir, join(dir, "user/gws"));
  assert.deepEqual(selected.manifest, new Bundled().manifest);
  assert.equal(typeof new selected.ctor().start, "function");
  assert.equal(typeof new selected.ctor().stop, "function");
});
