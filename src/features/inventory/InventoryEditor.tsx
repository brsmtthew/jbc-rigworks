import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useDirectories } from '../../lib/directories'
import { humanError } from '../../lib/workflow'
import type { ComponentType, InventoryItem } from '../../types'
import { compatibilityFields } from '../builder/componentFields'
import { components, inventoryKind } from '../builder/pc'
import { readPaymentImage } from '../finance/payments'

export function InventoryEditor({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const workspace = useWorkspace(),
    [directory] = useDirectories()
  const [kind, setKind] = useState<NonNullable<InventoryItem['kind']>>(
    item ? inventoryKind(item) : 'part',
  )
  const [component, setComponent] = useState<ComponentType | ''>(item?.component ?? '')
  const [image, setImage] = useState(item?.image ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget),
      text = (key: string) => String(form.get(key) ?? '').trim()
    setError('')
    setBusy(true)
    try {
      const stock = item?.stock ?? Number(text('stock'))
      const record: InventoryItem = {
        ...item,
        id: item?.id ?? `STK-${crypto.randomUUID()}`,
        name: text('name'),
        sku: text('sku'),
        category: text('category'),
        kind,
        component: kind === 'part' ? component : '',
        brand: text('brand'),
        model: text('model'),
        price: Number(text('price')),
        cost: Number(text('cost')),
        stock,
        minimum: Number(text('minimum')),
        location: text('location'),
        assetTag: text('assetTag'),
        specs: text('specs'),
        image,
        warrantyMonths: text('warrantyMonths'),
        warrantyTerms: text('warrantyTerms'),
        active: item?.active ?? true,
      }
      if (!record.name || !record.sku || !record.category || (kind === 'part' && !component))
        throw new Error('Add a name, SKU, category, and component type for PC parts.')
      if (
        [record.price, record.cost, stock, record.minimum].some(
          (value) => !Number.isFinite(value) || value < 0,
        ) ||
        !Number.isSafeInteger(stock) ||
        !Number.isSafeInteger(record.minimum)
      )
        throw new Error('Enter valid prices and whole stock quantities.')
      if (
        workspace.inventory.some(
          (value) => value.id !== item?.id && value.sku.toLowerCase() === record.sku.toLowerCase(),
        )
      )
        throw new Error('This SKU already exists.')
      if (
        record.warrantyMonths &&
        (!Number.isInteger(Number(record.warrantyMonths)) || Number(record.warrantyMonths) > 120)
      )
        throw new Error('Warranty must be a whole number up to 120 months.')
      for (const field of component && kind === 'part' ? compatibilityFields[component] : []) {
        const value = text(field.key)
        if (field.number && value && (!Number.isFinite(Number(value)) || Number(value) < 0))
          throw new Error(`Check ${field.label}.`)
        Object.assign(record, {
          [field.key]: value === '' ? undefined : field.number ? Number(value) : value,
        })
      }
      await workspace.save('inventory', record, item?.stock)
      onClose()
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  const field = (
    name: keyof InventoryItem,
    label: string,
    options: { number?: boolean; required?: boolean } = {},
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={options.number ? 'number' : 'text'}
        min={options.number ? 0 : undefined}
        step={['stock', 'minimum', 'warrantyMonths'].includes(name) ? '1' : 'any'}
        required={options.required}
        maxLength={500}
        defaultValue={String(item?.[name] ?? '')}
        placeholder={options.number ? 'Not configured' : undefined}
      />
    </label>
  )
  return (
    <Dialog
      title={item ? 'Edit inventory item' : 'New inventory item'}
      wide
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <button className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary-button" form="inventory-editor" disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Save item'}
          </button>
        </>
      }
    >
      <form id="inventory-editor" className="portal-form settings-fields" onSubmit={submit}>
        <h3>Basic information</h3>
        <div className="portal-form-grid">
          {field('name', 'Item name', { required: true })}
          {field('sku', 'SKU', { required: true })}
          {field('brand', 'Brand')}
          {field('model', 'Model')}
          <label>
            Item type
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="part">PC component</option>
              <option value="product">Retail product</option>
              <option value="asset">Tool / equipment</option>
              <option value="consumable">Consumable</option>
            </select>
          </label>
          <label>
            Category
            <input
              name="category"
              required
              list="inventory-categories"
              defaultValue={item?.category ?? ''}
            />
            <datalist id="inventory-categories">
              {directory.categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </datalist>
          </label>
        </div>
        <h3>Pricing & stock</h3>
        <div className="portal-form-grid">
          {field('cost', 'Unit cost (PHP)', { number: true, required: true })}
          {field('price', 'Selling price (PHP)', { number: true, required: true })}
          {!item && field('stock', 'Opening quantity', { number: true, required: true })}
          {field('minimum', 'Minimum stock', { number: true })}
          {field('location', 'Storage location')}
          {kind === 'asset' && field('assetTag', 'Asset tag', { required: true })}
        </div>
        {item && (
          <p className="storage-caption">
            On hand: {item.stock}. Use Adjust stock to receive, correct, or write off units with a
            reason.
          </p>
        )}
        {kind === 'part' && (
          <details open className="form-section">
            <summary>Component compatibility</summary>
            <label>
              PC component
              <select
                name="component"
                required
                value={component}
                onChange={(e) => setComponent(e.target.value as ComponentType)}
              >
                <option value="">Select component</option>
                {components.map((part) => (
                  <option key={part.name}>{part.name}</option>
                ))}
              </select>
            </label>
            <div className="portal-form-grid">
              {component &&
                compatibilityFields[component].map((value) =>
                  field(value.key, value.label, { number: value.number }),
                )}
            </div>
          </details>
        )}
        <details className="form-section">
          <summary>Product presentation</summary>
          <label>
            Description & specifications
            <textarea name="specs" rows={3} maxLength={4000} defaultValue={item?.specs} />
          </label>
          <label>
            Product photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file)
                  try {
                    setImage(await readPaymentImage(file))
                  } catch (err) {
                    setError(humanError(err))
                  }
              }}
            />
          </label>
          {image && (
            <div className="upload-preview">
              <img src={image} alt="Product preview" />
              <button className="secondary-button" type="button" onClick={() => setImage('')}>
                Remove photo
              </button>
            </div>
          )}
        </details>
        <details className="form-section">
          <summary>Warranty overrides</summary>
          {field('warrantyMonths', 'Warranty months (blank uses business default)', {
            number: true,
          })}
          <label>
            Warranty terms
            <textarea name="warrantyTerms" defaultValue={item?.warrantyTerms} maxLength={2000} />
          </label>
        </details>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
