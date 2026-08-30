#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const [appDir, runtimeDir] = process.argv.slice(2)
if (!appDir || !runtimeDir) throw new Error('usage: verify-runtime-env <snapshot-app> <runtime>')
const requireFromApp = createRequire(path.join(appDir, 'package.json'))
const { loadEnvConfig } = requireFromApp('@next/env')
const logger = { info() {}, error() {} }
const { combinedEnv } = loadEnvConfig(appDir, false, logger, true)
const sensitiveName = /(?:^|_)(?:PASS(?:WORD)?|SECRET(?:_KEY)?|TOKEN|PRIVATE_KEY)$/i
const values = []
for (const [key, value] of Object.entries(combinedEnv)) {
  if (key.startsWith('NEXT_PUBLIC_') || !sensitiveName.test(key) || !value) continue
  if (Buffer.byteLength(value) < 4) throw new Error(`sensitive build value ${key} must be at least 4 bytes`)
  values.push([key, Buffer.from(value)])
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) walk(file)
    else if (entry.isFile()) {
      const data = fs.readFileSync(file)
      for (const [key, value] of values) {
        if (data.includes(value)) throw new Error(`resolved nonpublic build value ${key} persisted in runtime`)
      }
    }
  }
}
walk(runtimeDir)
