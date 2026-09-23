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

export function InventoryPage({ onCreate }: { onCreate: () => void }) {
  const [scanner, setScanner] = useState<InventoryItem | true | null>(null), [detail, setDetail] = useState<InventoryItem | null>(null)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const workspace = useWorkspace()
  const { inventory } = workspace
  const lowStock = inventory.filter(item => item.stock <= item.minimum)
  const stockValue = inventory.reduce((sum, item) => sum + item.stock * item.cost, 0)
  const filters = useListFilters()
  const categories = [...new Set(inventory.map(item => item.category))]
  const filtered = inventory.filter(item => filters.matches([item.name, item.sku, item.category].join(' ')) && (filters.filter === 'all' || (filters.filter === 'low' ? item.stock <= item.minimum : item.category === filters.filter)))
  return <>
    <PageHeader eyebrow="STOCK CONTROL" title="Inventory" description="The right parts, ready for the next job."><button className="primary-button" onClick={onCreate} title="Add item" aria-label="Add item"><Plus size={20} /></button><ActionButton label="Scan inventory QR" onClick={() => setScanner(true)}><ScanLine size={21}/></ActionButton></PageHeader>
    <StatStrip stats={[{ label: 'Stock value at cost', value: formatPHP(stockValue, true) }, { label: 'Unique items', value: inventory.length }, { label: 'Low-stock items', value: lowStock.length }, { label: 'Categories', value: categories.length }]} />
    <ListToolbar {...filters} label="Search inventory" count={filtered.length} onReset={filters.reset}
      options={[{ value: 'all', label: 'All inventory' }, { value: 'low', label: 'Low stock' }, ...categories.map(value => ({ value, label: value }))]}
      onExport={() => prepareExcel('inventory', [['SKU', 'Item', 'Category', 'Stock', 'Minimum', 'Price PHP'], ...filtered.map(item => [item.sku, item.name, item.category, item.stock, item.minimum, item.price])])} />
    <Panel title="Parts & supplies" subtitle="Your workshop inventory at a glance">
      <DataTable filtered={!!filters.query || filters.filter !== 'all'} rows={filtered} label="Inventory" columns={[
        { label: 'Item / SKU', sortValue: item => item.name, render: item => <div className="item-cell"><span className="stock-icon"><Package size={20} /></span><span><strong>{item.name}</strong><small>{item.sku}</small></span></div> },
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
