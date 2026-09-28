import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferBuildTier, recommendPreset } from '../../src/features/builder/recommendations.ts'
import { compatibility } from '../../src/features/builder/pc.ts'
import { reconcileSelection } from '../../src/features/builder/three/catalog.js'

const item = (component, id, tier, extra = {}) => ({
  id,
  name: id,
  sku: id,
  component,
  category: component,
  kind: 'part',
  stock: 2,
  reserved: 0,
  minimum: 0,
  price: 1000,
  cost: 500,
  tier,
  ...extra,
})

test('build tier uses actual component specifications when catalog tier is absent', () => {
  assert.equal(inferBuildTier([]), 'Unclassified')
  assert.equal(
    inferBuildTier([
      item('Processor', 'cpu', '', { cores: 12 }),
      item('Graphics', 'gpu', '', { vramGb: 16 }),
      item('Memory', 'ram', '', { memoryGb: 32 }),
    ]),
    'High',
  )
  assert.equal(
    inferBuildTier([
      item('Processor', 'cpu', '', { cores: 6 }),
      item('Memory', 'ram', '', { memoryGb: 16 }),
    ]),
    'Mid',
  )
})

test('preset favors compatible parts at the selected tier and skips unavailable stock', () => {
  const parts = [
    item('Processor', 'cpu-mid', 'Mid', { socket: 'AM5' }),
    item('Motherboard', 'board-wrong', 'Mid', { socket: 'LGA1700', price: 500 }),
    item('Motherboard', 'board-fit', 'Mid', { socket: 'AM5', price: 2000 }),
    item('Memory', 'ram-mid', 'Mid', { memoryType: 'DDR5' }),
    item('Graphics', 'gpu-sold-out', 'Mid', { stock: 0 }),
  ]
  const selection = recommendPreset(parts, 'Mid')
  assert.equal(selection.Motherboard, 'board-fit')
  assert.equal(selection.Graphics, undefined)
  assert.equal(
    compatibility(parts.filter((part) => Object.values(selection).includes(part.id))).length,
    0,
  )
})

test('3D model retains a selected pre-order part when its stock reaches zero', () => {
  const catalog = [{ id: 'cpu', category: 'cpu', name: 'CPU', stock: 0, price: 2000 }]
  assert.deepEqual(reconcileSelection(catalog, { cpu: 'cpu' }), { cpu: 'cpu' })
})
