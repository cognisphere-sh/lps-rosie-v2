import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import proxy from '../proxy'

test('only the exact build-health API bypasses auth', async () => {
  const health = await proxy(new NextRequest('http://localhost/api/health/build'))
  assert.equal(health.status, 200)
  assert.equal(health.headers.get('x-middleware-next'), '1')

  const child = await proxy(new NextRequest('http://localhost/api/health/build/extra'))
  assert.equal(child.status, 401)
  assert.deepEqual(await child.json(), { error: 'unauthorized' })

  const other = await proxy(new NextRequest('http://localhost/api/health'))
  assert.equal(other.status, 401)
})
