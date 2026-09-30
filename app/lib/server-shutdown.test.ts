import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (file: string) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function load(source: string, mocks: Record<string, unknown>, signals: EventEmitter, globals: object) {
  const module = { exports: {} as Record<string, (...args: any[]) => any> }
  new Function('require', 'module', 'exports', 'process', 'globalThis', source)(
    (name: string) => name in mocks ? mocks[name] : require(name), module, module.exports, signals, globals,
  )
  return module.exports
}

function runtime() {
  const signals = new EventEmitter()
  const globals = {}
  const shutdown = load(compile('./server-shutdown.ts'), {}, signals, globals)
  const realtime = load(compile('./chat-realtime.ts'), {
    'server-only': {}, './server-shutdown': shutdown,
    '../../harness/plugins/webchat/questions': {},
    '@/lib/supabase': {}, '@/lib/job-events': {},
  }, signals, globals)
  return { signals, globals, shutdown, realtime }
}

test('SIGTERM and SIGINT close every active stream and unsubscribe exactly once', async () => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const { signals, realtime } = runtime()
    const controllers = Array.from({ length: 20 }, () => new AbortController())
    let stopped = 0
    const readers = controllers.map((controller) => {
      const response = realtime.sseResponse(new Request('https://example.com/events', { signal: controller.signal }),
        () => () => { stopped++ }) as Response
      return response.body!.getReader()
    })
    for (const reader of readers) assert.equal((await reader.read()).done, false)
    assert.equal(signals.listenerCount('SIGTERM'), 1)
    assert.equal(signals.listenerCount('SIGINT'), 1)
    signals.emit(signal)
    signals.emit(signal === 'SIGTERM' ? 'SIGINT' : 'SIGTERM')
    for (const reader of readers) assert.equal((await reader.read()).done, true)
    controllers.forEach((controller) => controller.abort())
    assert.equal(stopped, 20)
  }
})

test('cancelled/aborted streams release shutdown subscriptions; late streams close immediately', async () => {
  const { signals, realtime } = runtime()
  let stopped = 0
  const controller = new AbortController()
  const response = () => realtime.sseResponse(new Request('https://example.com/events', { signal: controller.signal }),
    () => () => { stopped++ }) as Response
  const cancelled = response().body!.getReader()
  await cancelled.cancel()
  const aborted = response().body!.getReader()
  controller.abort()
  assert.equal(stopped, 2)
  signals.emit('SIGTERM')
  assert.equal(stopped, 2)
  assert.equal((await aborted.read()).done, false) // already queued connection comment
  assert.equal((await aborted.read()).done, true)
  const late = realtime.sseResponse(new Request('https://example.com/events'), () => () => { stopped++ }) as Response
  const reader = late.body!.getReader()
  await reader.read()
  assert.equal((await reader.read()).done, true)
  assert.equal(stopped, 3)
})

test('route module reloads share shutdown state and signal handlers', () => {
  const { signals, globals, shutdown } = runtime()
  let stopped = 0
  const off = shutdown.onServerShutdown(() => { stopped++ })
  off()
  const reloaded = load(compile('./server-shutdown.ts'), {}, signals, globals)
  reloaded.onServerShutdown(() => { stopped++ })
  assert.equal(signals.listenerCount('SIGTERM'), 1)
  signals.emit('SIGTERM')
  assert.equal(stopped, 1)
})

test('an HTTP server with an open SSE request exits promptly on real SIGTERM', { timeout: 10_000 }, async (t) => {
  const program = `
    const http = require('node:http');
    const globals = {};
    const load = (source, mocks) => {
      const module = { exports: {} };
      new Function('require', 'module', 'exports', 'process', 'globalThis', source)(
        name => name in mocks ? mocks[name] : require(name), module, module.exports, process, globals);
      return module.exports;
    };
    const shutdown = load(${JSON.stringify(compile('./server-shutdown.ts'))}, {});
    const realtime = load(${JSON.stringify(compile('./chat-realtime.ts'))}, {
      'server-only': {}, './server-shutdown': shutdown,
      '../../harness/plugins/webchat/questions': {}, '@/lib/supabase': {}, '@/lib/job-events': {},
    });
    const server = http.createServer(async (_req, res) => {
      const response = realtime.sseResponse(new Request('http://localhost/events'), () => () => {});
      res.writeHead(200, Object.fromEntries(response.headers));
      for await (const chunk of response.body) res.write(chunk);
      res.end();
    });
    process.once('SIGTERM', () => server.close(() => process.exit(0)));
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `
  const child = spawn(process.execPath, ['-e', program], { stdio: ['ignore', 'pipe', 'pipe'] })
  const exited = once(child, 'exit')
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL') })
  let errors = ''
  child.stderr.on('data', (chunk) => { errors += chunk })
  const [ready] = await once(child.stdout, 'data')
  const response = await fetch(`http://127.0.0.1:${Number(String(ready).trim())}/events`)
  const reader = response.body!.getReader()
  t.after(() => reader.cancel())
  assert.equal(new TextDecoder().decode((await reader.read()).value), ': connected\n\n')
  child.kill('SIGTERM')
  const [code, signal] = await exited
  assert.equal(code, 0, errors)
  assert.equal(signal, null)
  assert.equal((await reader.read()).done, true)
})
