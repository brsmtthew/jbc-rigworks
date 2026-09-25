import { useState } from 'react'
import { Check, Info, Pencil, X } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { ProductDialog } from '../inventory/ProductDialog'
import { componentOf, componentTier, isPcPart } from '../../lib/pc'
import { formatPHP } from '../../data/appData'
import type { ComponentType, InventoryItem, Tier } from '../../types/business'

type Selection = Partial<Record<ComponentType, string>>
type CustomPart = { model: string; capacity: string; socket: string; memoryType: string }

export function PcPartEditor({ part, openPart, onClose, selection, custom, inventory, memoryTypes, onChange, onSelectionChange, onCustomChange }: {
  part: { name: ComponentType; hint: string }
  openPart: ComponentType | null
  onClose: () => void
  selection: Selection
  custom: Partial<Record<ComponentType, CustomPart>>
  inventory: InventoryItem[]
  memoryTypes: string[]
  onChange: () => void
  onSelectionChange: (component: ComponentType, id: string | undefined) => void
  onCustomChange: (component: ComponentType, value: CustomPart) => void
}) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<Tier | 'All'>('All')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const details = custom[part.name] ?? { model: '', capacity: '', socket: '', memoryType: '' }
  const selectedId = selection[part.name]
  const chosen = selectedId && selectedId !== '__custom' ? inventory.find(item => item.id === selectedId) : undefined
  const label = selectedId === '__custom' ? details.model || 'Owned / custom part' : chosen ? [chosen.brand, chosen.model || chosen.name].filter(Boolean).join(' / ') : 'Not selected'
  const options = inventory.filter(item => isPcPart(item) && componentOf(item) === part.name && item.stock > 0 && (tier === 'All' || componentTier(item) === tier) && (item.name + ' ' + item.brand + ' ' + item.model + ' ' + item.sku + ' ' + item.specs).toLowerCase().includes(query.toLowerCase()))

  function update(field: keyof CustomPart, value: string) {
    onChange()
    onCustomChange(part.name, { ...details, [field]: value })
  }

  return <div className="pc-part-editor-row">
    <span><strong>{part.name}</strong><small title={label}>{label}</small></span>
    {chosen && <button type="button" className="icon-button" aria-label={'Details ' + chosen.name} title="Part details" onClick={() => setDetail(chosen)}><Info size={17}/></button>}
    <button type="button" className="secondary-button" aria-label={'Edit ' + part.name} onClick={() => setOpen(true)}><Pencil size={16}/>Edit</button>
    {(open || openPart === part.name) && <Dialog title={'Select ' + part.name} onClose={() => { setOpen(false); onClose() }}>
      <div className="portal-form part-form">
        <div className="portal-form-grid">
          <label>Spec tier filter<select value={tier} onChange={event => setTier(event.target.value as Tier | 'All')}><option>All</option><option>Low</option><option>Mid</option><option>High</option></select></label>
          <label>Find part<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Brand, model or SKU"/></label>
        </div>
        <p className="storage-caption">Source: shared parts directory / {part.name}. {options.length} matching parts.</p>
        <label>{part.name} from stock<select aria-label={`${part.name} from stock`} value={selectedId ?? ''} onChange={event => { onChange(); onSelectionChange(part.name, event.target.value || undefined) }}>
          <option value="">Choose a component</option><option value="__custom">Unlisted / owned component</option>
          {options.map(item => <option key={item.id} value={item.id}>{[item.brand, item.model || item.name].filter(Boolean).join(' / ')} — {formatPHP(item.price)} · {item.stock} available</option>)}
        </select></label>
        {selectedId === '__custom' && <div className="custom-part-fields">
          <label>{part.name} model<input maxLength={160} value={details.model} onChange={event => update('model', event.target.value)} placeholder="Enter any model"/></label>
          {['Processor', 'Memory', 'Graphics'].includes(part.name) && <label>{{ Processor: 'Physical CPU cores', Memory: 'RAM capacity (GB)', Graphics: 'Dedicated graphics memory (GB)' }[part.name as 'Processor' | 'Memory' | 'Graphics']}<input aria-label={{ Processor: 'Physical CPU cores', Memory: 'RAM capacity (GB)', Graphics: 'Dedicated graphics memory (GB)' }[part.name as 'Processor' | 'Memory' | 'Graphics']} type="number" min={part.name === 'Graphics' ? 0 : 1} max="4096" step="1" value={details.capacity} onChange={event => update('capacity', event.target.value)}/><small className="storage-caption">{part.name === 'Graphics' ? 'Use 0 for integrated graphics.' : 'Use the manufacturer specifications or system information.'}</small></label>}
          {['Processor', 'Motherboard'].includes(part.name) && <label>{part.name} socket<input maxLength={40} value={details.socket} onChange={event => update('socket', event.target.value)} placeholder="Optional, e.g. AM5"/></label>}
          {['Memory', 'Motherboard'].includes(part.name) && <label>{part.name} memory generation<select value={details.memoryType} onChange={event => update('memoryType', event.target.value)}><option value="">Unknown</option>{memoryTypes.map(value => <option key={value}>{value}</option>)}</select></label>}
        </div>}
      </div>
      <div className="dialog-actions"><button type="button" className="icon-button" title="Clear selection" aria-label="Clear selection" onClick={() => { onChange(); onSelectionChange(part.name, undefined); setOpen(false); onClose() }}><X size={19}/></button><button type="button" className="primary-button" title="Use component" aria-label="Use component" onClick={() => { setOpen(false); onClose() }}><Check size={19}/></button></div>
    </Dialog>}
    {detail && <ProductDialog item={detail} onClose={() => setDetail(null)}/>}
  </div>
}
