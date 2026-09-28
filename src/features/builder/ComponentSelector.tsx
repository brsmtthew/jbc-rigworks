import { Check, Package, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatPHP } from '../../lib/format'
import { availableStock } from '../../lib/workflow'
import type { ComponentType, InventoryItem } from '../../types'
import type { CustomPart, CustomParts, Selection } from './buildPlans'
import { compatibilityFields } from './componentFields'
import { compatibility, componentOf, isPcPart } from './pc'

type Props = {
  part: { name: ComponentType; hint: string }
  openPart: ComponentType | null
  onClose: () => void
  selection: Selection
  custom: CustomParts
  inventory: InventoryItem[]
  loading?: boolean
  error?: string
  memoryTypes: string[]
  onChange: () => void
  onSelectionChange: (component: ComponentType, id: string | undefined) => void
  onCustomChange: (component: ComponentType, value: CustomPart) => void
}
export function ComponentSelector(props: Props) {
  const { part, selection, custom, inventory, onSelectionChange, onChange } = props
  const [open, setOpen] = useState(false)
  const owned = selection[part.name] === '__custom'
  const chosen = inventory.find((item) => item.id === selection[part.name])
  const selected = !!selection[part.name]
  const close = () => {
    setOpen(false)
    props.onClose()
  }
  return (
    <div className="pc-part-editor-row">
      <span>
        <strong>{part.name === 'Graphics' ? 'Graphics card' : part.name}</strong>
        <small>
          {owned
            ? custom[part.name]?.model || 'Customer owned'
            : chosen?.name || (selected ? 'Unavailable selection' : 'Not selected')}
        </small>
        {selected && (
          <small>
            {owned
              ? 'Customer owned · excluded from subtotal'
              : chosen
                ? `JBC inventory · ${formatPHP(chosen.price)}`
                : 'Choose a replacement'}
          </small>
        )}
      </span>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setOpen(true)}
        aria-label={`${selected ? 'Change' : 'Add'} ${part.name}`}
      >
        {selected ? (
          'Change'
        ) : (
          <>
            <Plus size={15} />
            Add
          </>
        )}
      </button>
      {selected && (
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove ${part.name}`}
          onClick={() => {
            onChange()
            onSelectionChange(part.name, undefined)
          }}
        >
          <X size={16} />
        </button>
      )}
      {(open || props.openPart === part.name) && <ComponentPicker {...props} onClose={close} />}
    </div>
  )
}

function ComponentPicker({
  part,
  selection,
  custom,
  inventory,
  onClose,
  onChange,
  onSelectionChange,
  onCustomChange,
  loading,
  error,
}: Props) {
  const [source, setSource] = useState<'inventory' | 'owned'>(
    selection[part.name] === '__custom' ? 'owned' : 'inventory',
  )
  const [selectedId, setSelectedId] = useState(selection[part.name] ?? '')
  const [details, setDetails] = useState<CustomPart>(
    custom[part.name] ?? { model: '', capacity: '', socket: '', memoryType: '' },
  )
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('All')
  const available = inventory.filter(
    (item) =>
      isPcPart(item) &&
      item.active !== false &&
      componentOf(item) === part.name &&
      availableStock(item) > 0,
  )
  const options = available.filter(
    (item) =>
      (brand === 'All' || item.brand === brand) &&
      `${item.name} ${item.brand} ${item.model} ${item.specs}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const others: InventoryItem[] = Object.entries(selection)
    .filter(([component]) => component !== part.name)
    .flatMap(([component, id]) => {
      if (id === '__custom') {
        const value = custom[component as ComponentType]
        return value
          ? [
              {
                id: 'owned:' + component,
                name: value.model,
                category: component,
                component: component as ComponentType,
                sku: '',
                cost: 0,
                price: 0,
                stock: 0,
                minimum: 0,
                socket: value.socket,
                memoryType: value.memoryType,
                ...value.compatibility,
              },
            ]
          : []
      }
      const item = inventory.find((item) => item.id === id)
      return item ? [item] : []
    })
  const chosen = available.find((item) => item.id === selectedId)
  const numericValid = compatibilityFields[part.name].every(
    (field) =>
      !field.number ||
      details.compatibility?.[field.key] === undefined ||
      (Number.isFinite(Number(details.compatibility[field.key])) &&
        Number(details.compatibility[field.key]) >= 0),
  )
  const valid =
    source === 'owned'
      ? !!details.model.trim() && numericValid
      : !!chosen && !compatibility([...others, chosen]).length && !loading && !error
  function apply() {
    if (!valid) return
    onChange()
    if (source === 'owned') onCustomChange(part.name, { ...details, model: details.model.trim() })
    onSelectionChange(part.name, source === 'owned' ? '__custom' : selectedId)
    onClose()
  }
  return (
    <Dialog
      title={`Choose ${part.name === 'Graphics' ? 'graphics card' : part.name.toLowerCase()}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button
            className="text-button"
            onClick={() => {
              onChange()
              onSelectionChange(part.name, undefined)
              onClose()
            }}
          >
            Clear selection
          </button>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={!valid} onClick={apply}>
            <Check size={17} />
            Use component
          </button>
        </>
      }
    >
      <div className="portal-form settings-fields">
        <div className="record-tabs" role="group" aria-label="Component source">
          <button
            aria-pressed={source === 'inventory'}
            className={source === 'inventory' ? 'primary-button' : 'secondary-button'}
            onClick={() => setSource('inventory')}
          >
            JBC inventory
          </button>
          <button
            aria-pressed={source === 'owned'}
            className={source === 'owned' ? 'primary-button' : 'secondary-button'}
            onClick={() => setSource('owned')}
          >
            I already own this component
          </button>
        </div>
        {source === 'inventory' ? (
          <>
            <div className="portal-form-grid">
              <label>
                Search components
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Brand, model, specifications"
                />
              </label>
              <label>
                Brand
                <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                  <option>All</option>
                  {[...new Set(available.map((item) => item.brand).filter(Boolean))].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : loading ? (
              <LoadingState variant="compact" label="Loading inventory…" />
            ) : (
              <>
                <p className="storage-caption">
                  {options.length} available {options.length === 1 ? 'option' : 'options'}
                </p>
                <div className="component-options">
                  {options.map((item) => {
                    const issues = compatibility([...others, item])
                    return (
                      <button
                        type="button"
                        className="component-option"
                        key={item.id}
                        aria-pressed={selectedId === item.id}
                        disabled={!!issues.length}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="component-option-image">
                          {item.image ? (
                            <img loading="lazy" src={item.image} alt="" />
                          ) : (
                            <Package size={28} />
                          )}
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.specs || item.model || item.brand}</small>
                          <small>{availableStock(item)} available</small>
                          {issues.map((issue) => (
                            <small className="form-error" key={issue}>
                              {issue}
                            </small>
                          ))}
                        </span>
                        <strong>{formatPHP(item.price)}</strong>
                        {selectedId === item.id && <Check size={18} />}
                      </button>
                    )
                  })}
                </div>
                {!options.length && (
                  <div className="customer-empty">
                    <Package />
                    <p>
                      {available.length
                        ? 'No components match your filters.'
                        : 'No in-stock components in this category yet.'}
                    </p>
                    <button
                      className="text-button"
                      onClick={() =>
                        available.length ? (setQuery(''), setBrand('All')) : setSource('owned')
                      }
                    >
                      {available.length ? 'Clear filters' : 'Use a component I own'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p>
              Identify your component. Leave unknown specifications blank; JBC will review
              incomplete compatibility information.
            </p>
            <div className="portal-form-grid">
              <label>
                Brand
                <input
                  value={details.brand ?? ''}
                  maxLength={100}
                  onChange={(e) => setDetails({ ...details, brand: e.target.value })}
                />
              </label>
              <label>
                Model (required)
                <input
                  required
                  maxLength={160}
                  value={details.model}
                  onChange={(e) => setDetails({ ...details, model: e.target.value })}
                />
              </label>
              {compatibilityFields[part.name].map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    type={field.number ? 'number' : 'text'}
                    min={0}
                    value={String(
                      details.compatibility?.[field.key] ??
                        (field.key === 'socket'
                          ? details.socket
                          : field.key === 'memoryType'
                            ? details.memoryType
                            : ''),
                    )}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        ...(field.key === 'socket'
                          ? { socket: e.target.value }
                          : field.key === 'memoryType'
                            ? { memoryType: e.target.value }
                            : {}),
                        compatibility: {
                          ...details.compatibility,
                          [field.key]:
                            e.target.value === ''
                              ? undefined
                              : field.number
                                ? Number(e.target.value)
                                : e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Notes / specifications
              <textarea
                maxLength={2000}
                value={details.notes ?? ''}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              />
            </label>
            {!numericValid && (
              <p className="form-error">Enter valid non-negative specifications.</p>
            )}
            <p className="fulfillment-note">
              Owned components update your build and model labels. They are excluded from JBC’s
              purchase subtotal and inventory.
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}
