import assert from 'node:assert/strict'
import test from 'node:test'

import { partnerLoginContext, partnerPortalName } from './portal-branding'
import { partnerManifest, partnerMetadata } from './portal-pwa'

test('supplier PWA identity, launch destination and all app names stay aligned', () => {
  for (const [id, name] of [[7, 'Oak Hill Nursery'], [12, 'Hill Country Growers']] as const) {
    const manifest = partnerManifest(name, id)
    const metadata = partnerMetadata(name, id)
    assert.equal(manifest.name, name)
    assert.equal(manifest.short_name, name)
    assert.equal(manifest.id, '/requests', 'preserve the original installed app identity')
    assert.equal(manifest.start_url, `/partner/${id}`)
    assert.equal(manifest.scope, '/')
    assert.equal(manifest.display, 'standalone')
    assert.ok(manifest.icons?.some(icon => icon.purpose === 'maskable'))
    assert.deepEqual(metadata.title, { absolute: name })
    assert.equal(metadata.applicationName, name)
    assert.equal(metadata.manifest, `/partner/${id}/manifest.webmanifest`)
    assert.equal((metadata.appleWebApp as { title: string }).title, name)
    assert.doesNotMatch(JSON.stringify({ metadata, manifest }), /Local Plant Supply|LPS:/)
    assert.match(manifest.description!, /message Chris/)
  }
})

test('unidentified partner links stay generic and untrusted next paths cannot supply a supplier id', () => {
  assert.equal(partnerPortalName('  Oak Hill Nursery  '), 'Oak Hill Nursery')
  assert.equal(partnerPortalName(), 'Partner Portal')
  assert.equal(partnerManifest(partnerPortalName()).start_url, '/partner')
  assert.deepEqual(partnerLoginContext('/partner/7/orders/42'), { supplierId: 7 })
  assert.deepEqual(partnerLoginContext('/partner'), { supplierId: null })
  for (const path of ['//evil/partner/7', '/partner/9007199254740992', '/partner/7?name=spoof', '/jobs']) {
    assert.equal(partnerLoginContext(path), null)
  }
})
