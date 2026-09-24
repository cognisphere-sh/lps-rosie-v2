import assert from 'node:assert/strict'
import test from 'node:test'

import { formatMonthDay, formatWeekdayMonthDay } from './format.ts'

test('MM-DD keeps valid install calendar dates on the saved day', () => {
  assert.equal(formatMonthDay('2026-01-01'), '01-01')
  assert.equal(formatMonthDay('2024-02-29'), '02-29')
  assert.equal(formatMonthDay('2000-02-29'), '02-29')
  for (const invalid of [null, undefined, '', 'not a date', '2026-02-29', '1900-02-29', '2026-13-01']) {
    assert.equal(formatMonthDay(invalid), '', String(invalid))
  }
})

test('created/submitted timestamps use Chicago business dates across midnight and daylight saving', () => {
  assert.equal(formatMonthDay('2026-09-15T01:00:00Z'), '09-14')
  assert.equal(formatMonthDay('2026-01-01T05:59:59Z'), '12-31')
  assert.equal(formatMonthDay('2026-01-01T06:00:00Z'), '01-01')
  assert.equal(formatMonthDay('2026-07-01T05:00:00Z'), '07-01')
})

test('weekday dates use Day, MM/DD and preserve calendar/business dates', () => {
  assert.equal(formatWeekdayMonthDay('2026-09-20'), 'Sun, 09/20')
  assert.equal(formatWeekdayMonthDay('2026-09-15T01:00:00Z'), 'Mon, 09/14')
  assert.equal(formatWeekdayMonthDay('2024-02-29'), 'Thu, 02/29')
  for (const invalid of [null, undefined, '', 'not a date', '2026-02-29']) {
    assert.equal(formatWeekdayMonthDay(invalid), '')
  }
})
