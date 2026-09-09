import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'app/plants/page.tsx'), 'utf8')

test('plant search supplier cards keep the requested compact identity metadata', () => {
  assert.match(page, /const PANEL_FIXED = \[[\s\S]*'state', 'city',[\s\S]*'primary_contact_email', 'primary_contact_phone', 'updated'/)
  assert.match(page, /const companyLocation = \(g: PlantGroup\) =>[\s\S]*\[g\.company\.values\.city, g\.company\.values\.state\][\s\S]*\.join\(', '\)/)
  assert.equal(page.match(/Supplier location: \{companyLocation\(g\)\}/g)?.length, 2)
  assert.equal(page.match(/Updated \{formatDate\(String\(g\.company\.values\.updated\)\)\}/g)?.length, 2)
  assert.doesNotMatch(page, /\{String\(g\.company\.values\.state\)\}/)
})
