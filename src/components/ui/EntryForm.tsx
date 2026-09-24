import { useDirectories } from '../../lib/directories'
import { Save, Trash2, ImagePlus, ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Package, ReceiptText, ShoppingBag, Wrench } from 'lucide-react'
import { components, inventoryKind, tiers } from '../../lib/pc'
import { Dialog } from './Dialog'
import { today, useWorkspace } from '../../lib/workspaceStorage'
import type { Expense, InventoryItem, Job, Sale } from '../../types/business'
import { useConfirmation } from './confirmation-context'

export type EntryType = 'job' | 'sale' | 'item' | 'expense'
type RecordType = Job | Sale | InventoryItem | Expense
type Field = { name: string; label: string; type?: string; options?: string[]; optional?: boolean }
const entries = {
  job: { label: 'Service job', description: 'Receive a device and plan the work.', icon: Wrench, fields: [
    { name: 'customer', label: 'Customer name' }, { name: 'device', label: 'Device / model' }, { name: 'service', label: 'Service requested' }, { name: 'due', label: 'Target date', type: 'date' }, { name: 'quote', label: 'Quoted price (PHP)', type: 'number' }, { name: 'status', label: 'Status', options: ['Queued', 'In progress', 'Ready'] },
  ] },
  sale: { label: 'Sale', description: 'Record a sale or update its payment.', icon: ShoppingBag, fields: [
    { name: 'customer', label: 'Customer name' }, { name: 'detail', label: 'Service or product' }, { name: 'date', label: 'Sale date', type: 'date' }, { name: 'total', label: 'Total amount (PHP)', type: 'number' }, { name: 'paid', label: 'Amount received (PHP)', type: 'number' }, { name: 'cost', label: 'Cost of sale (PHP)', type: 'number' },
  ] },
  item: { label: 'Inventory item', description: 'Manage a part, price, and stock level.', icon: Package, fields: [
    { name: 'name', label: 'Item name' }, { name: 'kind', label: 'Inventory role', options: ['part', 'product', 'asset', 'consumable'] }, { name: 'brand', label: 'Brand', optional: true }, { name: 'model', label: 'Model', optional: true }, { name: 'sku', label: 'SKU' }, { name: 'category', label: 'Category' }, { name: 'stock', label: 'Quantity on hand', type: 'number' }, { name: 'minimum', label: 'Minimum stock', type: 'number' }, { name: 'cost', label: 'Unit cost (PHP)', type: 'number' }, { name: 'price', label: 'Selling price (PHP)', type: 'number' },
    { name: 'assetTag', label: 'Asset tag', optional: true }, { name: 'location', label: 'Storage location', optional: true },
    { name: 'warrantyMonths', label: 'Item warranty months (blank uses default)', type: 'number', optional: true }, { name: 'warrantyTerms', label: 'Item warranty terms (blank uses default)', optional: true },
    { name: 'component', label: 'PC component', options: ['', ...components.map(part => part.name)], optional: true }, { name: 'tier', label: 'Fallback component rating', options: ['', ...tiers], optional: true }, { name: 'cores', label: 'Processor cores (tier input)', type: 'number', optional: true }, { name: 'memoryGb', label: 'RAM capacity GB (tier input)', type: 'number', optional: true }, { name: 'vramGb', label: 'Graphics memory GB (tier input)', type: 'number', optional: true }, { name: 'socket', label: 'CPU / board socket', options: ['', 'AM4', 'AM5', 'LGA1700', 'LGA1851'], optional: true }, { name: 'memoryType', label: 'Memory generation', options: ['', 'DDR3', 'DDR4', 'DDR5'], optional: true },
  ] },
  expense: { label: 'Expense', description: 'Record a workshop operating cost.', icon: ReceiptText, fields: [
    { name: 'description', label: 'Description' }, { name: 'category', label: 'Category' }, { name: 'date', label: 'Expense date', type: 'date' }, { name: 'amount', label: 'Amount (PHP)', type: 'number' }, { name: 'method', label: 'Payment method', options: ['Cash', 'GCash', 'Bank transfer', 'Card', 'Other'] },
  ] },
} satisfies Record<EntryType, { label: string; description: string; icon: typeof Wrench; fields: Field[] }>

export function EntryForm({ initialType, record, onClose }: { initialType?: EntryType; record?: RecordType; onClose: () => void }) {
  const [type, setType] = useState(initialType)
  const [error, setError] = useState('')
  const workspace = useWorkspace()
  const { confirm } = useConfirmation()
  const [directory] = useDirectories()
  const [image, setImage] = useState(type === 'item' && record && 'image' in record ? record.image || '' : '')
  const fields = type ? (entries[type].fields as Field[]).map(field => ({ ...field, options: field.name === 'socket' ? ['', ...directory.sockets] : field.name === 'memoryType' ? ['', ...directory.memory] : field.name === 'method' ? directory.payments : field.options })).filter(field => (!(type === 'sale' && record && 'lines' in record && record.lines) || field.name === 'paid') && !(type === 'job' && record && 'status' in record && record.status === 'Completed' && field.name === 'status')) : []
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!type) return
    const form = new FormData(event.currentTarget)
    const parsed = Object.fromEntries(fields.map(field => { const raw = String(form.get(field.name) ?? '').trim(); return [field.name, field.type === 'number' && field.name !== 'warrantyMonths' ? (raw === '' && field.optional ? '' : Number(raw)) : raw] }))
    const values = { ...(record as unknown as Record<string, unknown>), ...parsed }
    if (fields.some(field => (!field.optional && parsed[field.name] === '') || (typeof parsed[field.name] === 'number' && (!Number.isFinite(parsed[field.name]) || Number(parsed[field.name]) < 0)))) { setError('Complete every field with a valid value.'); return }
    if (type === 'sale' && Number(values.paid) > Number(values.total)) { setError('Amount received cannot exceed the sale total.'); return }
    if (type === 'item' && workspace.inventory.some(item => item.sku.toLowerCase() === String(values.sku).toLowerCase() && item.id !== record?.id)) { setError('This SKU already exists. Edit that inventory item instead.'); return }
    if (type === 'item' && values.kind === 'part' && (!String(values.brand || '').trim() || !String(values.model || '').trim() || !String(values.component || '').trim() || !String(form.get('specs') || '').trim())) { setError('PC parts need a brand, model, component type, and specifications before they can be listed in the shared catalog.'); return }
    if (type === 'item' && values.kind === 'asset' && (!String(values.assetTag || '').trim() || !String(values.location || '').trim())) { setError('Tools and equipment need an asset tag and storage location.'); return }
    if (type === 'item' && values.kind === 'asset' && workspace.inventory.some(item => item.assetTag?.trim().toLowerCase() === String(values.assetTag).trim().toLowerCase() && item.id !== record?.id)) { setError('This asset tag already exists.'); return }
    if (type === 'item' && (['stock', 'minimum'].some(field => !Number.isSafeInteger(Number(values[field]))) || (values.warrantyMonths !== '' && (!Number.isSafeInteger(Number(values.warrantyMonths)) || Number(values.warrantyMonths) < 0 || Number(values.warrantyMonths) > 120)))) { setError('Stock and warranty must be valid whole numbers; warranty can be 0 to 120 months.'); return }
    if (type === 'item' && ([['cores', 1, 256], ['memoryGb', 1, 4096], ['vramGb', 0, 256]] as const).some(([field, minimum, maximum]) => values[field] !== '' && (!Number.isSafeInteger(Number(values[field])) || Number(values[field]) < minimum || Number(values[field]) > maximum))) { setError('Enter whole-number CPU core, RAM, and graphics-memory specifications within the listed ranges.'); return }
    if (type === 'item' && record && JSON.stringify(workspace.inventory.find(item => item.id === record.id)) !== JSON.stringify(record)) { setError('This item changed while you were editing. Close and reopen it to use current stock and details.'); return }
    const confirmed = await confirm({ title: record ? 'Save changes?' : 'Save record?', message: `${record ? 'Save your changes to this' : 'Create this'} ${entries[type].label.toLowerCase()}?`, confirmLabel: record ? 'Save changes' : 'Save record' })
    if (!confirmed) return
    const id = record?.id ?? `${{ job: 'JOB', sale: 'INV', item: 'STK', expense: 'EXP' }[type]}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    try {
      if (type === 'job') workspace.save('jobs', { ...values, id } as Job)
      if (type === 'sale') workspace.save('sales', { ...values, id, status: values.paid === values.total ? 'Paid' : Number(values.paid) > 0 ? 'Partial' : 'Unpaid' } as Sale)
      if (type === 'item') { const old = record as InventoryItem | undefined; workspace.save('inventory', { ...values, kind: String(values.kind) as InventoryItem['kind'], cores: values.cores === '' ? undefined : Number(values.cores), memoryGb: values.memoryGb === '' ? undefined : Number(values.memoryGb), vramGb: values.vramGb === '' ? undefined : Number(values.vramGb), brand: String(values.brand || '').trim(), model: String(values.model || '').trim(), assetTag: String(values.assetTag || '').trim(), location: String(values.location || '').trim(), image, specs: String(form.get('specs') || ''), stockHistory: [...(old?.stockHistory || []), ...(old?.stock !== Number(values.stock) ? [{ date: new Date().toISOString(), before: old?.stock || 0, after: Number(values.stock), reason: String(form.get('stockReason') || (old ? 'Inventory adjustment' : 'Opening stock')) }] : [])], warrantyMonths: values.warrantyMonths || undefined, id } as InventoryItem) }
      if (type === 'expense') workspace.save('expenses', { ...values, id } as Expense)
      onClose()
    } catch (err) { setError((err as Error).message) }
  }
  return <Dialog wide={type === 'item'} title={type ? `${record ? 'Edit ' : 'New '}${entries[type].label.toLowerCase()}` : 'New entry'} onClose={onClose}>
    {!type ? <div className="entry-options">{(Object.keys(entries) as EntryType[]).map(key => {
      const item = entries[key]
      return <button key={key} onClick={() => setType(key)}><item.icon size={22} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={18} aria-hidden="true" /></button>
    })}</div> : <form className="portal-form entry-form" onSubmit={submit}>
      <div className="portal-form-grid">{fields.map(field => <label key={field.name}>{field.label}
        {field.options ? <select name={field.name} defaultValue={field.name === 'kind' ? record && 'kind' in record ? inventoryKind(record as InventoryItem) : 'part' : record ? String(record[field.name as keyof RecordType] ?? '') : field.options[0]}>{field.options.map(value => <option key={value} value={value}>{field.name === 'kind' ? ({ part: 'PC part', product: 'Retail product', asset: 'Tool / equipment', consumable: 'Consumable' } as Record<string, string>)[value] : value || "Not specified"}</option>)}</select> : <input list={field.name === 'category' ? 'entry-categories' : field.name === 'service' ? 'entry-services' : undefined} name={field.name} type={field.type ?? 'text'} required={!field.optional} maxLength={2000} min={field.type === 'number' ? 0 : undefined} step={['stock', 'minimum', 'warrantyMonths', 'cores', 'memoryGb', 'vramGb'].includes(field.name) ? 1 : '0.01'} defaultValue={record ? String((record as unknown as Record<string, unknown>)[field.name] ?? '') : field.name === 'kind' ? 'part' : field.type === 'date' ? today() : field.type === 'number' && !field.optional ? 0 : ''} />}
      </label>)}</div>
      <datalist id="entry-categories">{(type === 'expense' ? directory.expenseCategories : directory.categories).map(value => <option key={value} value={value}/>)}</datalist><datalist id="entry-services">{directory.services.map(value => <option key={value} value={value}/>)}</datalist>
      {type === 'item' && <fieldset className="inventory-media"><legend><ImagePlus size={18}/> Product presentation</legend><label>Specifications<textarea name="specs" maxLength={4000} rows={4} defaultValue={(record as InventoryItem)?.specs || ''} placeholder="Model, dimensions, interfaces, power requirements, and included accessories"/></label><label>Product photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 500000) { setError('Use a JPEG, PNG, or WebP photo smaller than 500 KB.'); return } const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setError('') }; reader.onerror = () => setError('The photo could not be read.'); reader.readAsDataURL(file) }}/></label>{image && <div className="upload-preview"><img src={image} alt="Product photo"/><button type="button" className="icon-button" aria-label="Remove photo" title="Remove photo" onClick={() => setImage('')}><Trash2 size={18}/></button></div>}<label>Stock adjustment reason<input name="stockReason" maxLength={200} placeholder="Delivery, count correction, damaged stock..."/></label></fieldset>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="storage-caption">Saved on this device.</p>
      <div className="dialog-actions">{!initialType && <button className="secondary-button" type="button" onClick={() => { setType(undefined); setError('') }}><ArrowLeft size={18}/>Back</button>}<button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Save size={18}/>{record ? 'Save changes' : 'Save record'}</button>{record && !(type === 'sale' && 'lines' in record && record.lines) && <button type="button" className="secondary-button danger-button" onClick={async () => { if (!await confirm({ title: 'Delete record?', message: 'Permanently delete this record? This cannot be undone.', confirmLabel: 'Delete record', tone: 'danger' })) return; try { workspace.remove(({ job: 'jobs', sale: 'sales', item: 'inventory', expense: 'expenses' } as const)[type], record.id); onClose() } catch (err) { setError((err as Error).message) } }}><Trash2 size={18}/>Delete record</button>}</div>
    </form>}
  </Dialog>
}
