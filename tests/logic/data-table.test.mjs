import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DataTable } from '../../src/components/ui/DataTable.tsx'

test('record tables show the latest created record first by default', () => {
  const rows = [
    { id: 'older', date: '2026-10-01', createdAt: '2026-10-01T12:00:00.000Z' },
    { id: 'latest', date: '2026-09-29', createdAt: '2026-10-03T12:00:00.000Z' },
    { id: 'middle', date: '2026-10-02' },
  ]
  const markup = renderToStaticMarkup(createElement(DataTable, {
    rows,
    columns: [{ label: 'Reference', render: (row) => row.id }],
    label: 'Sales',
  }))
  assert.ok(markup.indexOf('latest') < markup.indexOf('middle'))
  assert.ok(markup.indexOf('middle') < markup.indexOf('older'))
})
