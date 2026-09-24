import { Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatPHP } from '../../data/appData'
import { componentOf, componentTier, isPcPart } from '../../lib/pc'
import { useWorkspace } from '../../lib/workspaceStorage'
import type { ComponentType, InventoryItem } from '../../types/business'
import { ActionButton } from '../../components/ui/ActionButton'
import { DataTable } from '../../components/ui/DataTable'
import { EntryForm } from '../../components/ui/EntryForm'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProductDialog } from '../inventory/ProductDialog'
import { StatusBadge } from '../../components/ui/StatusBadge'

export function PcPartsDirectoryPage() {
  const { inventory } = useWorkspace()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All parts')
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const parts = useMemo(() => inventory.filter(isPcPart), [inventory])
  const categories = [...new Set(parts.map(item => componentOf(item)).filter((value): value is ComponentType => !!value))]
  const filtered = parts.filter(item => `${item.name} ${item.brand || ''} ${item.model || ''} ${item.sku} ${item.category} ${item.specs || ''}`.toLowerCase().includes(query.trim().toLowerCase()) && (category === 'All parts' || componentOf(item) === category))
  return <>
    <PageHeader eyebrow="SHARED COMPONENT CATALOG" title="PC parts directory" description="Maintain one catalog for the shop, PC identifier, and PC request builder."><button className="primary-button" onClick={() => setEditing('new')}><Plus size={18}/>Add PC part</button></PageHeader>
    <div className="list-toolbar directory-toolbar"><label className="search-field"><Search size={17}/><input aria-label="Search PC parts" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search brand, model, SKU, specs"/></label><label className="inventory-category-filter">Component<select aria-label="Filter by component" value={category} onChange={event => setCategory(event.target.value)}><option>All parts</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><span className="result-count">{filtered.length} of {parts.length} catalog parts</span></div>
    <DataTable rows={filtered} label="PC parts directory" columns={[
      { label: 'Part / SKU', sortValue: item => item.name, render: item => <div className="item-cell"><span className="stock-icon">{(item.brand || item.name).slice(0, 1).toUpperCase()}</span><span><strong>{item.brand ? `${item.brand} ${item.model || item.name}` : item.model || item.name}</strong><small>{item.sku}</small></span></div> },
      { label: 'Component', sortValue: item => componentOf(item) || '', render: item => componentOf(item) || item.category },
      { label: 'Specifications', render: item => <span className="directory-specs">{[componentTier(item) && `${componentTier(item)} component rating`, item.socket, item.memoryType, item.specs].filter(Boolean).join(' · ') || 'Specifications not added'}</span> },
      { label: 'Price', sortValue: item => item.price, numeric: true, render: item => <strong>{formatPHP(item.price)}</strong> },
      { label: 'Availability', sortValue: item => String(item.stock), render: item => <>{item.stock > 0 ? <StatusBadge tone="green">{`${item.stock} available`}</StatusBadge> : <StatusBadge tone="amber">Out of stock</StatusBadge>}</> },
      { label: 'Actions', render: item => <div className="part-actions"><ActionButton label={`View specs for ${item.name}`} onClick={() => setDetail(item)}><Search size={18}/></ActionButton><ActionButton label={`Edit ${item.name}`} onClick={() => setEditing(item)}><Pencil size={18}/></ActionButton></div> },
    ]}/>
    {editing && <EntryForm initialType="item" record={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}/>}
    {detail && <ProductDialog item={detail} onClose={() => setDetail(null)}/>}
  </>
}
