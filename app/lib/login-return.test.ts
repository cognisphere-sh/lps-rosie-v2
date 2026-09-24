import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import proxy from '../proxy.ts'
import { jobLoginReturn, loginDestination } from './login-return.ts'
import { createSession, SESSION_COOKIE } from './session.ts'

test('signed-out job deep link returns through login without carrying unrelated query data', async () => {
  const result = await proxy(new NextRequest('https://lps.example/jobs?jr=71&token=do-not-copy'))
  assert.equal(result.status, 307)
  const location = new URL(result.headers.get('location')!)
  assert.equal(location.pathname, '/login')
  assert.equal(location.searchParams.get('next'), '/jobs?jr=71')
  assert.equal(location.searchParams.size, 1)
  assert.equal(loginDestination(location.searchParams.get('next'), '/suppliers'), '/jobs?jr=71')
})

test('signed-in navigation keeps the full original job request URL', async () => {
  const previous = process.env.APP_SESSION_SECRET
  process.env.APP_SESSION_SECRET = 'test-login-return-session-secret'
  try {
    const token = await createSession({ id: 'admin', username: 'admin', role: 'admin', supplierId: null, mustChangePassword: false })
    const original = 'https://lps.example/jobs?jr=71&view=compact'
    const request = new NextRequest(original, { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
    const result = await proxy(request)
    assert.equal(result.status, 200)
    assert.equal(result.headers.get('x-middleware-next'), '1')
    assert.equal(result.headers.get('location'), null)
    assert.equal(result.headers.get('x-middleware-rewrite'), null)
    assert.equal(request.nextUrl.href, original, 'the original signed-in URL retains its query')
  } finally {
    if (previous === undefined) delete process.env.APP_SESSION_SECRET
    else process.env.APP_SESSION_SECRET = previous
  }
})

test('forced password change and partner gate still take precedence over job links', async () => {
  const previous = process.env.APP_SESSION_SECRET
  process.env.APP_SESSION_SECRET = 'test-login-return-session-secret'
  try {
    const changing = await createSession({ id: 'partner', username: 'partner', role: 'partner', supplierId: 7, mustChangePassword: true })
    const changeResult = await proxy(new NextRequest('https://lps.example/jobs?jr=71', { headers: { cookie: `${SESSION_COOKIE}=${changing}` } }))
    assert.equal(changeResult.status, 307)
    assert.equal(changeResult.headers.get('location'), 'https://lps.example/change-password')
    assert.equal(loginDestination('/jobs?jr=71', '/change-password'), '/change-password')

    const partner = await createSession({ id: 'partner', username: 'partner', role: 'partner', supplierId: 7, mustChangePassword: false })
    const partnerResult = await proxy(new NextRequest('https://lps.example/jobs?jr=71', { headers: { cookie: `${SESSION_COOKIE}=${partner}` } }))
    assert.equal(partnerResult.status, 307)
    assert.equal(partnerResult.headers.get('location'), 'https://lps.example/partner/7')
  } finally {
    if (previous === undefined) delete process.env.APP_SESSION_SECRET
    else process.env.APP_SESSION_SECRET = previous
  }
})

test('only a valid job id crosses the signed-out login redirect', () => {
  const path = '/jobs'
  for (const search of ['jr=71', 'jr=%37%31', 'jr=71&token=secret']) {
    assert.equal(jobLoginReturn(path, new URLSearchParams(search)), '/jobs?jr=71')
  }
  for (const search of ['', 'jr=0', 'jr=-1', 'jr=071', 'jr=1.2', 'jr=9007199254740992', 'jr=71&jr=72', 'jr=71%26token%3Dsecret', 'jr=71%0A', 'jr=%2F%2Fevil']) {
    assert.equal(jobLoginReturn(path, new URLSearchParams(search)), '/jobs')
  }
  assert.equal(jobLoginReturn('/requests', new URLSearchParams('jr=71&code=secret')), '/requests')
})

test('login next rejects foreign/ambiguous destinations and strips untrusted queries', () => {
  for (const next of [null, '//evil.example/jobs', '/\\evil.example/jobs', 'https://evil.example/jobs',
    '/%2Fevil.example/jobs', '/%5cevil.example/jobs', '/login?next=/jobs', '/api/auth/logout',
    '/jobs?jr=71#secret', '/jobs?jr=71\n']) {
    assert.equal(loginDestination(next, '/suppliers'), '/suppliers', String(next))
  }
  assert.equal(loginDestination('/jobs?jr=%37%31', '/suppliers'), '/jobs?jr=71')
  assert.equal(loginDestination('/jobs?jr=71%26token%3Dsecret', '/suppliers'), '/jobs')
  // Manually entered `next` with extra parameters drops its query; the proxy
  // supplies an encoded next containing only jr, which survives instead.
  assert.equal(loginDestination('/jobs?jr=71&code=secret', '/suppliers'), '/jobs')
  assert.equal(loginDestination('/requests?code=secret', '/suppliers'), '/requests')
  assert.equal(loginDestination('/jobs?jr=71', '/change-password'), '/change-password')
})
