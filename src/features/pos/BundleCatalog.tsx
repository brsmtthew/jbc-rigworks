import { Boxes, Pencil, Plus, Save, ShoppingCart, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ActionButton } from '../../components/ui/ActionButton'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { NumberInput } from '../../components/ui/NumberInput'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { availableStock, humanError } from '../../lib/workflow'
import type { ProductBundle } from '../../types'
import { compatibility, componentOf, components, isPcPart, isSellable } from '../builder/pc'
import { readPaymentImage } from '../finance/payments'

export function BundleCatalog({
  onSelect,
  manage = false,
  showHeading = true,
  query = '',
}: {
  onSelect: (bundle: ProductBundle) => void
  manage?: boolean
  showHeading?: boolean
  query?: string
}) {
  const workspace = useWorkspace(),
    { user } = useAuth()
  const { confirm } = useConfirmation()
  const [draft, setDraft] = useState<ProductBundle | null>(null),
    [error, setError] = useState('')
  const [kind, setKind] = useState('PC set'),
    [busy, setBusy] = useState(false)
  const visibleBundles = workspace.bundles.filter(
    (bundle) =>
      (manage || (bundle.active !== false && bundle.published !== false)) &&
      `${bundle.name} ${bundle.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy) return
    setError('')
    setBusy(true)
    try {
      if (
        !draft.name.trim() ||
        draft.items.length < 2 ||
        draft.items.some(
          (part) =>
            !Number.isSafeInteger(part.quantity) ||
            part.quantity < 1 ||
            !workspace.inventory.some(
              (item) =>
                item.id === part.inventoryId &&
                isSellable(item) &&
                (kind !== 'PC set' || isPcPart(item)) &&
                availableStock(item) >= part.quantity,
            ),
        )
      )
        throw new Error(
          'Name the bundle and select at least two different available items with valid quantities.',
        )
      if (draft.price !== undefined && (!Number.isFinite(draft.price) || draft.price < 0))
        throw new Error('Enter a valid bundle price.')
      const conflicts = compatibility(
        workspace.inventory.filter((item) =>
          draft.items.some((part) => part.inventoryId === item.id),
        ),
      )
      if (conflicts.length) throw new Error(conflicts.join(' '))
      if (
        !(await confirm({
          title: 'Save bundle?',
          message: `Save ${draft.name.trim()} with its selected inventory items?`,
          confirmLabel: 'Save bundle',
        }))
      )
        return
      await workspace.save('bundles', { ...draft, name: draft.name.trim() })
      setDraft(null)
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  function choose(component: string, id: string) {
    if (!draft) return
    setDraft({
      ...draft,
      items: [
        ...draft.items.filter(
          (part) =>
            componentOf(workspace.inventory.find((item) => item.id === part.inventoryId)!) !==
            component,
        ),
        ...(id ? [{ inventoryId: id, quantity: 1 }] : []),
      ],
    })
  }
  return (
    <section className="bundle-catalog" aria-label="Item bundles">
      {showHeading && <div className="section-toolbar">
        <h2>
          <Boxes size={22} /> Bundles & PC sets
        </h2>
        {user?.role === 'admin' && manage && (
          <ActionButton
            variant="labeled"
            label="Create bundle"
            onClick={() => {
              setDraft({
                id: crypto.randomUUID(),
                name: '',
                items: [],
                published: false,
                active: true,
              })
              setKind('PC set')
              setError('')
            }}
          >
            <Plus size={18} />
          </ActionButton>
        )}
      </div>}
      {!showHeading && (
        <p className="bundle-catalog-count" role="status">
          {visibleBundles.length} {visibleBundles.length === 1 ? 'bundle' : 'bundles'} listed
        </p>
      )}
      <div className="pos-products">
        {visibleBundles.map((bundle) => {
            const available =
              bundle.items.length >= 2 &&
              bundle.items.every((part) =>
                workspace.inventory.some(
                  (item) =>
                    item.id === part.inventoryId &&
                    isSellable(item) &&
                    availableStock(item) >= part.quantity,
                ),
              )
            const units = bundle.items.length
              ? Math.min(
                  ...bundle.items.map((part) => {
                    const item = workspace.inventory.find((value) => value.id === part.inventoryId)
                    return item && isSellable(item) && part.quantity > 0
                      ? Math.floor(availableStock(item) / part.quantity)
                      : 0
                  }),
                )
              : 0
            const total = bundle.items.reduce(
              (sum, part) =>
                sum +
                (workspace.inventory.find((item) => item.id === part.inventoryId)?.price || 0) *
                  part.quantity,
              0,
            )
            return (
              <article className="pos-product" key={bundle.id}>
                <div className="product-photo">
                  {bundle.image ? (
                    <img src={bundle.image} alt={bundle.name} loading="lazy" />
                  ) : (
                    <Boxes size={30} />
                  )}
                </div>
                <h3>{bundle.name}</h3>
                <small>{units} bundles available</small>
                {bundle.description && <p>{bundle.description}</p>}
                <ul className="bundle-part-list">
                  {bundle.items.map((part) => (
                    <li key={part.inventoryId}>
                      {part.quantity} x{' '}
                      {workspace.inventory.find((item) => item.id === part.inventoryId)?.name ||
                        'Unavailable item'}
                    </li>
                  ))}
                </ul>
                <strong>{formatPHP(bundle.price ?? total)}</strong>
                <span className="save-message">
                  {bundle.freeDelivery ? 'Free delivery included' : 'Delivery charged at checkout'}
                </span>
                <div className="part-actions">
                  {!manage && (
                    <ActionButton
                      variant="labeled"
                      label="Choose bundle"
                      disabled={!available}
                      onClick={() => onSelect(bundle)}
                    >
                      <ShoppingCart size={18} />
                    </ActionButton>
                  )}
                  {user?.role === 'admin' && manage && (
                    <>
                      <ActionButton
                        label={'Edit bundle ' + bundle.name}
                        onClick={() => {
                          setDraft(structuredClone(bundle))
                          setKind('Item bundle')
                          setError('')
                        }}
                      >
                        <Pencil size={18} />
                      </ActionButton>
                      <ActionButton
                        label={'Delete bundle ' + bundle.name}
                        onClick={async () => {
                          if (
                            !(await confirm({
                              title: 'Delete bundle?',
                              message: `Delete ${bundle.name}? Existing orders will keep their saved details.`,
                              confirmLabel: 'Delete bundle',
                              tone: 'danger',
                            }))
                          )
                            return
                          try {
                            await workspace.remove('bundles', bundle.id)
                          } catch (err) {
                            setError(humanError(err))
                          }
                        }}
                      >
                        <Trash2 size={18} />
                      </ActionButton>
                    </>
                  )}
                  {!available && <small>Out of stock</small>}
                </div>
              </article>
            )
          })}
      </div>
      {!visibleBundles.length && (
        <div className="bundle-catalog-empty">
          <Boxes size={25} aria-hidden="true" />
          <h3>No bundles available yet</h3>
          <p>Published bundles and PC sets will appear here when their parts are available.</p>
        </div>
      )}
      {error && !draft && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {draft && (
        <Dialog title="Bundle editor" wide onClose={() => setDraft(null)}>
          <form className="portal-form settings-fields" onSubmit={save}>
            <div className="portal-form-grid">
              <label>
                Bundle name
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Selection mode
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option>PC set</option>
                  <option>Item bundle</option>
                </select>
              </label>
            </div>
            <label>
              Bundle photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  try {
                    const image = await readPaymentImage(file)
                    setDraft((current) => (current ? { ...current, image } : current))
                  } catch (err) {
                    setError(humanError(err))
                  }
                }}
              />
            </label>
            {draft.image && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDraft({ ...draft, image: undefined })}
              >
                Remove bundle photo
              </button>
            )}
            <label>
              Description
              <textarea
                maxLength={1000}
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label>
              Bundle price (blank sums component prices)
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.price ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    price: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
            {(['published', 'active', 'freeDelivery'] as const).map((field) => (
              <label className="check-row" key={field}>
                <input
                  type="checkbox"
                  checked={draft[field] ?? field === 'active'}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.checked })}
                />
                {
                  {
                    published: 'Published in Shop and POS',
                    active: 'Active',
                    freeDelivery: 'Eligible for free delivery',
                  }[field]
                }
              </label>
            ))}
            {kind === 'PC set' ? (
              <div className="portal-form-grid">
                {components.map((component) => (
                  <label key={component.name}>
                    {component.name}
                    <select
                      aria-label={component.name}
                      value={
                        draft.items.find(
                          (part) =>
                            componentOf(
                              workspace.inventory.find((item) => item.id === part.inventoryId)!,
                            ) === component.name,
                        )?.inventoryId || ''
                      }
                      onChange={(e) => choose(component.name, e.target.value)}
                    >
                      <option value="">Select available stock</option>
                      {workspace.inventory
                        .filter(
                          (item) =>
                            isPcPart(item) &&
                            availableStock(item) > 0 &&
                            componentOf(item) === component.name,
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} / {availableStock(item)} available
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <label>
                  Add stock item
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        setDraft({
                          ...draft,
                          items: [...draft.items, { inventoryId: e.target.value, quantity: 1 }],
                        })
                    }}
                  >
                    <option value="">Choose available inventory</option>
                    {workspace.inventory
                      .filter(
                        (item) =>
                          isSellable(item) &&
                          availableStock(item) > 0 &&
                          !draft.items.some((part) => part.inventoryId === item.id),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} / {item.stock} in stock
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <div className="bundle-items">
              {draft.items.map((part) => {
                const item = workspace.inventory.find((item) => item.id === part.inventoryId)
                return (
                  <div className="directory-row" key={part.inventoryId}>
                    <label>
                      {item?.name || 'Unavailable item'}
                      <NumberInput
                        aria-label={'Bundle quantity: ' + item?.name}
                        min="1"
                        max={item ? availableStock(item) : 0}
                        step="1"
                        value={part.quantity}
                        onValueChange={(quantity) =>
                          setDraft({
                            ...draft,
                            items: draft.items.map((value) =>
                              value.inventoryId === part.inventoryId
                                ? { ...value, quantity }
                                : value,
                            ),
                          })
                        }
                      />
                    </label>
                    <ActionButton
                      label={'Remove bundle item ' + item?.name}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter(
                            (value) => value.inventoryId !== part.inventoryId,
                          ),
                        })
                      }
                    >
                      <Trash2 size={18} />
                    </ActionButton>
                  </div>
                )
              })}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <ActionButton
                type="submit"
                disabled={busy}
                variant="labeled"
                label={busy ? 'Saving bundle...' : 'Save bundle'}
              >
                <Save size={18} />
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  )
}
