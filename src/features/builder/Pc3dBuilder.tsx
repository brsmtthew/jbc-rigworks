import { useEffect, useMemo, useRef, useState } from 'react'
import { componentOf, isPcPart } from '../../lib/pc'
import type { ComponentType, InventoryItem } from '../../types/business'
import type { BuilderInstance, BuilderSelection, CatalogItem, PartCategory } from './three/PCBuilder'
import { PcModelPicker } from './PcModelPicker'
import './three/pc-builder.css'
import './three/integration.css'

type Selection = Partial<Record<ComponentType, string>>
const partCategories: Record<ComponentType, PartCategory> = {
  Processor: 'cpu', Motherboard: 'motherboard', Memory: 'ram', Graphics: 'gpu',
  Storage: 'storage', 'Power supply': 'psu', Case: 'case', Cooling: 'cooling',
}
const partEntries = Object.entries(partCategories) as [ComponentType, PartCategory][]

export function Pc3dBuilder({ selected, inventory, onSelect, onSelectionChange }: {
  selected: Selection
  inventory: InventoryItem[]
  onSelect: (part: ComponentType) => void
  onSelectionChange: (changes: Selection) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<BuilderInstance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const catalog = useMemo<CatalogItem[]>(() => inventory.filter(isPcPart).map(item => ({
    id: item.id, category: partCategories[componentOf(item)!],
    name: [item.brand, item.model || item.name].filter(Boolean).join(' / '),
    stock: item.stock, price: item.price,
    specs: [item.specs, item.socket, item.memoryType].filter(Boolean).join(' · '),
  })), [inventory])
  const selection = useMemo<BuilderSelection>(() => Object.fromEntries(partEntries.flatMap(([part, category]) =>
    selected[part] && selected[part] !== '__custom' ? [[category, selected[part]]] : [],
  )), [selected])
  const latest = useRef({ catalog, selection, onSelectionChange })

  useEffect(() => { latest.current = { catalog, selection, onSelectionChange } }, [catalog, selection, onSelectionChange])
  useEffect(() => {
    let cancelled = false
    const container = host.current!
    // Keep Three.js out of the initial website bundle and handle unsupported GPUs.
    void import('./three/PCBuilder.js').then(({ createPCBuilder }) => {
      if (cancelled) return
      let previous: BuilderSelection = {}
      const viewer = createPCBuilder(container, {
        catalog: latest.current.catalog, selection: latest.current.selection,
        reducedMotion: !!container.closest('.reduce-motion'),
        onChange(build, { reason }) {
          const changes: Selection = {}
          if (reason === 'selection') {
            for (const [part, category] of partEntries) {
              if (previous[category] !== build.selection[category]) changes[part] = build.selection[category]
            }
          }
          previous = build.selection
          // Catalog reconciliation must not erase saved, owned, or unavailable parts.
          if (Object.keys(changes).length) latest.current.onSelectionChange(changes)
        },
      })
      previous = viewer.getBuild().selection
      instance.current = viewer
      setStatus('ready')
    }).catch(() => {
      if (cancelled) return
      container.replaceChildren()
      setStatus('unavailable')
    })
    return () => {
      cancelled = true
      instance.current?.dispose()
      instance.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = instance.current
    if (!viewer) return
    viewer.setCatalog(catalog)
    viewer.setSelection(selection)
  }, [catalog, selection])

  return <div className="pc-3d-builder">
    {status === 'loading' && <p className="pc-3d-feedback" role="status">Loading interactive 3D PC…</p>}
    <div ref={host} aria-label="Interactive 3D PC builder" />
    {status === 'ready' && Object.values(selected).some(id => id === '__custom') && <p className="storage-caption">Owned parts are included in your build below. The 3D catalog shows stock selections.</p>}
    {status === 'unavailable' && <>
      <p className="pc-3d-feedback" role="status">3D preview unavailable in this browser. You can still choose parts and save your build below.</p>
      <PcModelPicker selected={selected} inventory={inventory} onSelect={onSelect} />
    </>}
  </div>
}
