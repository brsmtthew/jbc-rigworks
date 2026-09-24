import { InventoryScanner } from './InventoryScanner'
import { ProductDialog } from './ProductDialog'
import { ActionButton } from '../../components/ui/ActionButton'
import { ScanLine, QrCode, Pencil, Eye } from 'lucide-react'
import { useState } from 'react'
import { EntryForm } from '../../components/ui/EntryForm'
import type { InventoryItem } from '../../types/business'
import { useWorkspace } from '../../lib/workspaceStorage'
import { Package, Plus } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { prepareExcel } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'
import { inventoryKind } from '../../lib/pc'

export function InventoryPage({ onCreate }: { onCreate: () => void }) {
  const [scanner, setScanner] = useState<InventoryItem | true | null>(null), [detail, setDetail] = useState<InventoryItem | null>(null)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const workspace = useWorkspace()
  const { inventory } = workspace
  const lowStock = inventory.filter(item => item.stock <= item.minimum)
  const stockValue = inventory.reduce((sum, item) => sum + item.stock * item.cost, 0)
  const filters = useListFilters()
  const categories = [...new Set(inventory.map(item => item.category))]
  const filtered = inventory.filter(item => filters.matches([item.name, item.brand, item.model, item.sku, item.category, item.assetTag, item.location].join(' ')) && (filters.filter === 'all' || (filters.filter === 'low' && item.stock <= item.minimum)) && (categoryFilter === 'all' || item.category === categoryFilter) && (kindFilter === 'all' || inventoryKind(item) === kindFilter))
  const kindLabel = (kind: string) => ({ part: 'PC part', product: 'Retail product', asset: 'Tool / equipment', consumable: 'Consumable' }[kind] || kind)
  return <>
    <PageHeader eyebrow="STOCK CONTROL" title="Inventory" description="The right parts, ready for the next job."><button className="primary-button" onClick={onCreate}><Plus size={18} />Add item</button><ActionButton variant="labeled" label="Scan inventory QR" onClick={() => setScanner(true)}><ScanLine size={18}/></ActionButton></PageHeader>
    <StatStrip stats={[{ label: 'Stock value at cost', value: formatPHP(stockValue, true) }, { label: 'Unique items', value: inventory.length }, { label: 'Low-stock items', value: lowStock.length }, { label: 'Categories', value: categories.length }]} />
    <div className="inventory-filter-toolbar">
      <ListToolbar {...filters} label="Search inventory" count={filtered.length} onReset={() => { filters.reset(); setCategoryFilter('all'); setKindFilter('all') }}
        options={[{ value: 'all', label: 'All stock statuses' }, { value: 'low', label: 'Low stock' }]}
        onExport={() => prepareExcel('inventory', [['Role', 'SKU', 'Brand', 'Model', 'Item', 'Category', 'Stock', 'Minimum', 'Cost PHP', 'Price PHP', 'Asset tag', 'Location'], ...filtered.map(item => [kindLabel(inventoryKind(item)), item.sku, item.brand || '', item.model || '', item.name, item.category, item.stock, item.minimum, item.cost, item.price, item.assetTag || '', item.location || ''])])} />
      <label className="inventory-category-filter"><span>Inventory role</span><select aria-label="Filter by inventory role" value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option value="all">All roles</option><option value="part">PC parts</option><option value="product">Retail products</option><option value="asset">Tools & equipment</option><option value="consumable">Consumables</option></select></label>
      <label className="inventory-category-filter">Part category<select aria-label="Filter by part category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      {(categoryFilter !== 'all' || kindFilter !== 'all') && <button className="text-button inventory-filter-reset" onClick={() => { setCategoryFilter('all'); setKindFilter('all') }}>Clear filters</button>}
    </div>
    <Panel title="Inventory" subtitle="Parts, products, equipment, and consumables">
      <DataTable filtered={!!filters.query || filters.filter !== 'all' || categoryFilter !== 'all' || kindFilter !== 'all'} rows={filtered} label="Inventory" columns={[
        { label: 'Item / SKU', sortValue: item => item.name, render: item => <div className="item-cell"><span className="stock-icon"><Package size={20} /></span><span><strong>{item.brand ? `${item.brand} ${item.model || item.name}` : item.model || item.name}</strong><small>{item.sku}{item.assetTag ? ` · ${item.assetTag}` : ''}</small></span></div> },
        { label: 'Role', sortValue: item => kindLabel(inventoryKind(item)), render: item => <span>{kindLabel(inventoryKind(item))}</span> },
        { label: 'Category', sortValue: item => item.category, render: item => item.category },
        { label: 'Available', sortValue: item => item.stock, render: item => <><strong>{item.stock} units</strong><small>Minimum {item.minimum}</small></> },
        { label: 'Stock status', sortValue: item => item.stock <= item.minimum ? 0 : 1, render: item => <StatusBadge tone={item.stock <= item.minimum ? 'amber' : 'green'}>{item.stock <= item.minimum ? 'Low stock' : 'In stock'}</StatusBadge> },
        { label: 'Selling price', sortValue: item => item.price, numeric: true, render: item => <strong>{formatPHP(item.price)}</strong> },
        { label: 'Actions', render: record => <div className="part-actions"><ActionButton label={"Edit " + record.id} onClick={() => setEditing(record)}><Pencil size={18}/></ActionButton><ActionButton label={"QR " + record.sku} onClick={() => setScanner(record)}><QrCode size={18}/></ActionButton><ActionButton label={"View " + record.name} onClick={() => setDetail(record)}><Eye size={18}/></ActionButton></div> },
      ]} />
    </Panel>
    {scanner && <InventoryScanner initial={scanner === true ? undefined : scanner} onClose={() => setScanner(null)}/>}
    {detail && <ProductDialog item={detail} onClose={() => setDetail(null)}/>}
    {editing && <EntryForm initialType="item" record={editing} onClose={() => setEditing(null)} />}
  </>
}
