import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useDirectories } from '../../lib/directories'
import { humanError } from '../../lib/workflow'
import type { ComponentType, InventoryItem } from '../../types'
import { compatibilityFields, type CompatibilityField } from '../builder/componentFields'
import { components, inventoryKind } from '../builder/pc'
import { readPaymentImage } from '../finance/payments'

function CompatibilityMultiSelect({
  name,
  label,
  options,
  initialValue,
}: {
  name: string
  label: string
  options: string[]
  initialValue: string
}) {
  const [selected, setSelected] = useState(() =>
    [...new Set(initialValue.split(/[,;|]/).map((value) => value.trim()).filter(Boolean))],
  )
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && event.target instanceof Node && !menu.current.contains(event.target))
        menu.current.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  const choices = [...new Set([...options, ...selected])]
  return (
    <div className="inventory-directory-multi">
      <span className="inventory-directory-label">{label}</span>
      <details ref={menu}>
        <summary aria-label={`Choose ${label}`}>
          <span>{selected.length ? selected.join(', ') : `Select ${label.toLowerCase()}`}</span>
        </summary>
        <div className="inventory-directory-options" role="group" aria-label={label}>
          {choices.map((option) => (
            <label className="check-row" key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(option)
                      ? current.filter((value) => value !== option)
                      : [...current, option],
                  )
                }
              />
              {option}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
        </div>
      </details>
      <input type="hidden" name={name} value={selected.join(', ')} />
    </div>
  )
}

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
    const warranty = text('warranty')
    const warrantyMatch = warranty.match(/^(\d{1,3})\s*months?\s*(?:[-–—:]\s*)?(.*)$/i)
    if (warranty && /^\d/.test(warranty) && !warrantyMatch) {
      setError('Start the warranty with a whole number of months, then add the terms.')
      return
    }
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
        minimum: item?.minimum ?? 0,
        location: item?.location ?? '',
        assetTag: text('assetTag'),
        description: text('description'),
        specs: text('specs'),
        image,
        warrantyMonths: warrantyMatch?.[1] ?? '',
        warrantyTerms: warrantyMatch?.[2] ?? (warrantyMatch ? '' : warranty),
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
        step={name === 'stock' ? '1' : 'any'}
        required={options.required}
        maxLength={500}
        defaultValue={String(item?.[name] ?? '')}
        placeholder={options.number ? 'Not configured' : undefined}
      />
    </label>
  )
  const compatibilityField = (entry: CompatibilityField) => {
    if (!entry.directory) return field(entry.key, entry.label, { number: entry.number })
    const label = entry.label.replace(' (comma separated)', '')
    const current = String(item?.[entry.key] ?? '').trim()
    const options = directory[entry.directory]
    if (entry.multiple)
      return (
        <CompatibilityMultiSelect
          key={entry.key}
          name={entry.key}
          label={label}
          options={options}
          initialValue={current}
        />
      )
    return (
      <label key={entry.key}>
        {label}
        <select name={entry.key} defaultValue={current}>
          <option value="">Select {label.toLowerCase()}</option>
          {[...new Set([...options, current])].filter(Boolean).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }
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
            <select name="category" required defaultValue={item?.category ?? ''}>
              <option value="">Select category</option>
              {[...new Set([...directory.categories, item?.category ?? ''])]
                .filter(Boolean)
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <h3>Pricing & stock</h3>
        <div className="portal-form-grid">
          {field('cost', 'Unit cost (PHP)', { number: true, required: true })}
          {field('price', 'Selling price (PHP)', { number: true, required: true })}
          {!item && field('stock', 'Stock quantity', { number: true, required: true })}
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
                compatibilityFields[component].map(compatibilityField)}
            </div>
          </details>
        )}
        <details className="form-section">
          <summary>Product presentation</summary>
          <label>
            Description
            <textarea name="description" rows={3} maxLength={2000} defaultValue={item?.description} />
          </label>
          <label>
            Specifications
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
          <label>
            Warranty (months and terms)
            <textarea name="warranty" rows={2} defaultValue={[item?.warrantyMonths ? `${item.warrantyMonths} months` : '', item?.warrantyTerms].filter(Boolean).join(' — ')} maxLength={2000} placeholder="12 months — Parts and labor" />
            <small>Leave blank to use the business default. Start with the number of months when specifying a duration.</small>
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
