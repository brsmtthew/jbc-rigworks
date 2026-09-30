import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manilaDay } from '../../src/lib/dates.ts'

test('reports and sales use the Manila calendar day across UTC midnight', () => {
  assert.equal(manilaDay('2026-09-30T15:59:59Z'), '2026-09-30')
  assert.equal(manilaDay('2026-09-30T16:00:00Z'), '2026-10-01')
  assert.equal(manilaDay('invalid timestamp'), '')
})
