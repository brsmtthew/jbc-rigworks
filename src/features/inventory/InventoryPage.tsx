import {
  Boxes,
  Coins,
  Eye,
  Layers3,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  QrCode,
  RotateCcw,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { SearchField } from '../../components/ui/Filters'
import { LoadingState } from '../../components/ui/LoadingState'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useListFilters } from '../../hooks/useListFilters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { prepareExcel } from '../../lib/excel'
import { formatPHP } from '../../lib/format'
import { availableStock, humanError } from '../../lib/workflow'
import type { InventoryItem } from '../../types'
import { inventoryKind } from '../builder/pc'
import { BundleCatalog } from '../pos/BundleCatalog'
import { InventoryEditor } from './InventoryEditor'
import { InventoryScanner } from './InventoryScanner'
import { ProductDialog } from './ProductDialog'

export function InventoryPage({ onCreate }: { onCreate: () => void }) {
  const { confirm } = useConfirmation()
  const [bundlesOpen, setBundlesOpen] = useState(false),
    [adjusting, setAdjusting] = useState<InventoryItem | null>(null),
    [adjustError, setAdjustError] = useState(''),
    [busy, setBusy] = useState(false)
  const [scanner, setScanner] = useState<InventoryItem | true | null>(null),
    [detail, setDetail] = useState<InventoryItem | null>(null)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const workspace = useWorkspace()
  const { inventory } = workspace
  const lowStock = inventory.filter(
    (item) => item.active !== false && availableStock(item) <= item.minimum,
  )
  const stockValue = inventory.reduce((sum, item) => sum + item.stock * item.cost, 0)
  const filters = useListFilters()
  const categories = [...new Set(inventory.map((item) => item.category))]
  const filtered = inventory.filter(
    (item) =>
      filters.matches(
        [
          item.name,
          item.brand,
          item.model,
          item.sku,
          item.category,
          item.assetTag,
          item.location,
        ].join(' '),
      ) &&
      (filters.filter === 'all' ||
        (filters.filter === 'low' &&
          item.active !== false &&
          availableStock(item) <= item.minimum) ||
        (filters.filter === 'out' && item.active !== false && availableStock(item) === 0)) &&
      (categoryFilter === 'all' || item.category === categoryFilter) &&
      (kindFilter === 'all' || inventoryKind(item) === kindFilter),
  )
  const hasFilters =
    !!filters.query || filters.filter !== 'all' || categoryFilter !== 'all' || kindFilter !== 'all'
  const kindLabel = (kind: string) =>
    ({
      part: 'PC part',
      product: 'Retail product',
      asset: 'Tool / equipment',
      consumable: 'Consumable',
    })[kind] || kind
  const exportInventory = () =>
    prepareExcel('inventory', [
      [
        'Role',
        'SKU',
        'Brand',
        'Model',
        'Item',
        'Category',
        'Stock',
        'Minimum',
        'Cost PHP',
        'Price PHP',
        'Asset tag',
        'Location',
      ],
      ...filtered.map((item) => [
        kindLabel(inventoryKind(item)),
        item.sku,
        item.brand || '',
        item.model || '',
        item.name,
        item.category,
        item.stock,
        item.minimum,
        item.cost,
        item.price,
        item.assetTag || '',
        item.location || '',
      ]),
    ])
  const clearFilters = () => {
    filters.reset()
    setCategoryFilter('all')
    setKindFilter('all')
  }
  if (workspace.storageError)
    return (
      <p role="alert" className="form-error">
        {workspace.storageError}
      </p>
    )
  if (workspace.loading) return <LoadingState variant="table" label="Loading inventory…" />
  return (
    <div className="admin-inventory">
      <section className="inventory-hero jbc-blue-hero" aria-labelledby="inventory-title">
        <div className="inventory-hero-copy">
          <span className="eyebrow">STOCK CONTROL</span>
          <h1 id="inventory-title">Inventory</h1>
          <p>Track every part, product, and supply from one organized catalog.</p>
        </div>
        <div className="inventory-hero-actions" aria-label="Inventory actions">
          <span className="inventory-hero-actions-label">QUICK ACTIONS</span>
          <div>
            <button type="button" className="primary-button" onClick={onCreate}>
              <Plus size={17} /> Add item
            </button>
            <ExcelButton disabled={!filtered.length} onExport={exportInventory} />
            <button type="button" className="secondary-button" onClick={() => setBundlesOpen(true)}>
              <Boxes size={16} /> Bundles
            </button>
            <button
              type="button"
              className="secondary-button"
              aria-label="Scan inventory QR"
              onClick={() => setScanner(true)}
            >
              <ScanLine size={16} /> Scan QR
            </button>
          </div>
        </div>
      </section>

      <dl className="inventory-metrics" aria-label="Inventory overview">
        {[
          {
            label: 'Stock value at cost',
            value: formatPHP(stockValue, true),
            detail: 'On-hand inventory',
            icon: Coins,
          },
          {
            label: 'Catalog items',
            value: inventory.length,
            detail: 'Across all roles',
            icon: Package,
          },
          {
            label: 'Needs attention',
            value: lowStock.length,
            detail: 'At or below minimum',
            icon: TriangleAlert,
          },
          {
            label: 'Categories',
            value: categories.length,
            detail: 'In the catalog',
            icon: Layers3,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div
            key={label}
            className={label === 'Needs attention' && lowStock.length ? 'is-attention' : ''}
          >
            <span className="inventory-metric-icon">
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <dt>{label}</dt>
            <dd>{value}</dd>
            <small>{detail}</small>
          </div>
        ))}
      </dl>

      <section className="inventory-discovery discovery-card" aria-labelledby="inventory-discovery-title">
        <div className="inventory-discovery-heading">
          <div>
            <span className="eyebrow">FIND A RECORD</span>
            <h2 id="inventory-discovery-title">Explore the catalog</h2>
          </div>
          <span className="inventory-discovery-count discovery-card-count" role="status">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'} shown
          </span>
        </div>
        <div className="inventory-filter-toolbar">
          <div className="inventory-search-filter toolbar-field">
            <span className="toolbar-field-label">Search</span>
            <SearchField label="Search inventory" value={filters.query} onChange={filters.setQuery} />
          </div>
          <label className="inventory-category-filter">
            <span>Stock status</span>
            <select
              aria-label="Filter by stock status"
              value={filters.filter}
              onChange={(event) => filters.setFilter(event.target.value)}
            >
              <option value="all">All stock statuses</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
          <label className="inventory-category-filter">
            <span>Inventory role</span>
            <select
              aria-label="Filter by inventory role"
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
            >
              <option value="all">All roles</option>
              <option value="part">PC parts</option>
              <option value="product">Retail products</option>
              <option value="asset">Tools & equipment</option>
              <option value="consumable">Consumables</option>
            </select>
          </label>
          <label className="inventory-category-filter">
            <span>Category</span>
            <select
              aria-label="Filter by part category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="inventory-discovery-footer">
          <span>Availability reflects reserved units.</span>
          <div>
            {hasFilters && (
              <button type="button" className="inventory-clear-button" onClick={clearFilters}>
                <RotateCcw size={15} /> Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      <Panel title="Catalog records" subtitle="Parts, products, equipment, and consumables">
        <DataTable
          filtered={hasFilters}
          rows={filtered}
          label="Inventory"
          columns={[
            {
              label: 'Item',
              sortValue: (item) => item.name,
              render: (item) => (
                <div className="item-cell">
                  <span className="inventory-item-icon" aria-hidden="true">
                    <Package size={20} />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.sku}
                      {item.assetTag ? ` · ${item.assetTag}` : ''}
                    </small>
                    {(item.brand || item.model) && (
                      <small>{[item.brand, item.model].filter(Boolean).join(' / ')}</small>
                    )}
                  </span>
                </div>
              ),
            },
            {
              label: 'Type & category',
              sortValue: (item) => kindLabel(inventoryKind(item)),
              render: (item) => (
                <div className="inventory-type-cell">
                  <strong>{kindLabel(inventoryKind(item))}</strong>
                  <small>{item.category}</small>
                </div>
              ),
            },
            {
              label: 'Stock position',
              sortValue: (item) => availableStock(item),
              render: (item) => (
                <div className="inventory-stock-cell">
                  <strong>{availableStock(item)} available</strong>
                  <small>
                    {item.stock} on hand · {item.reserved ?? 0} reserved
                  </small>
                  <small>Minimum {item.minimum}</small>
                </div>
              ),
            },
            {
              label: 'Status',
              sortValue: (item) =>
                item.active === false
                  ? 3
                  : availableStock(item) === 0
                    ? 0
                    : availableStock(item) <= item.minimum
                      ? 1
                      : 2,
              render: (item) => (
                <StatusBadge
                  tone={
                    item.active === false
                      ? 'gray'
                      : availableStock(item) === 0
                        ? 'red'
                        : availableStock(item) <= item.minimum
                          ? 'amber'
                          : 'green'
                  }
                >
                  {item.active === false
                    ? 'Inactive'
                    : availableStock(item) === 0
                      ? 'Out of stock'
                      : availableStock(item) <= item.minimum
                        ? 'Low stock'
                        : 'In stock'}
                </StatusBadge>
              ),
            },
            {
              label: 'Pricing',
              sortValue: (item) => item.price,
              render: (item) => (
                <div className="inventory-price-cell">
                  <strong>{formatPHP(item.price)}</strong>
                  <small>Cost {formatPHP(item.cost)}</small>
                </div>
              ),
            },
            {
              label: 'Actions',
              render: (record) => (
                <div
                  className="inventory-row-actions"
                  role="group"
                  aria-label={`Actions for ${record.name}`}
                >
                  <button
                    type="button"
                    className="inventory-row-action is-primary"
                    aria-label={`View ${record.name}`}
                    onClick={() => setDetail(record)}
                  >
                    <Eye size={15} /> View
                  </button>
                  <button
                    type="button"
                    className="inventory-row-action"
                    aria-label={`Edit ${record.id}`}
                    onClick={() => setEditing(record)}
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    className="inventory-row-action"
                    aria-label={`Adjust stock for ${record.name}`}
                    onClick={() => {
                      setAdjusting(record)
                      setAdjustError('')
                    }}
                  >
                    <PackagePlus size={15} /> Adjust
                  </button>
                  <button
                    type="button"
                    className="inventory-row-action"
                    aria-label={`QR ${record.sku}`}
                    onClick={() => setScanner(record)}
                  >
                    <QrCode size={15} /> QR label
                  </button>
                  <button
                    type="button"
                    className="inventory-row-action is-muted"
                    aria-label={`${record.active === false ? 'Activate' : 'Deactivate'} ${record.name}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title:
                            record.active === false ? 'Activate product?' : 'Deactivate product?',
                          message:
                            'Historical transactions keep their original product information.',
                          confirmLabel: 'Confirm',
                        })
                      )
                        try {
                          await workspace.save(
                            'inventory',
                            { ...record, active: record.active === false },
                            record.stock,
                          )
                        } catch (error) {
                          setAdjustError(humanError(error))
                        }
                    }}
                  >
                    <Power size={15} />
                    {record.active === false ? 'Activate' : 'Deactivate'}
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {adjustError && !adjusting && (
        <p role="alert" className="form-error">
          {adjustError}
        </p>
      )}
      {bundlesOpen && (
        <Dialog title="Manage bundles" wide onClose={() => setBundlesOpen(false)}>
          <BundleCatalog manage onSelect={() => {}} />
        </Dialog>
      )}
      {adjusting && (
        <Dialog
          title="Adjust stock"
          onClose={() => {
            if (!busy) setAdjusting(null)
          }}
          footer={
            <button className="primary-button" type="submit" form="adjust-stock" disabled={busy}>
              Save stock movement
            </button>
          }
        >
          <form
            id="adjust-stock"
            className="portal-form settings-fields"
            onSubmit={async (event) => {
              event.preventDefault()
              if (busy) return
              const form = new FormData(event.currentTarget),
                after = Number(form.get('quantity')),
                reason = String(form.get('reason') ?? '').trim(),
                kind = String(form.get('kind'))
              if (!Number.isSafeInteger(after) || after < (adjusting.reserved ?? 0) || !reason) {
                setAdjustError('Enter a whole quantity covering reservations, and a reason.')
                return
              }
              setBusy(true)
              try {
                await workspace.save(
                  'inventory',
                  {
                    ...adjusting,
                    stock: after,
                    stockHistory: [
                      ...(adjusting.stockHistory ?? []),
                      {
                        date: new Date().toISOString(),
                        before: adjusting.stock,
                        after,
                        reason: kind + ': ' + reason,
                      },
                    ],
                  },
                  adjusting.stock,
                )
                setAdjusting(null)
              } catch (err) {
                setAdjustError(humanError(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            <h3>{adjusting.name}</h3>
            <p>
              On hand: {adjusting.stock} / Reserved: {adjusting.reserved ?? 0} / Available:{' '}
              {availableStock(adjusting)}
            </p>
            <label>
              Movement type
              <select name="kind">
                <option>STOCK_RECEIVED</option>
                <option>CUSTOMER_RETURN</option>
                <option>SUPPLIER_RETURN</option>
                <option>DAMAGED</option>
                <option>LOST</option>
                <option>MANUAL_CORRECTION</option>
              </select>
            </label>
            <label>
              New on-hand quantity
              <input
                required
                name="quantity"
                type="number"
                min={adjusting.reserved ?? 0}
                step="1"
                defaultValue={adjusting.stock}
              />
            </label>
            <label>
              Reason
              <textarea required name="reason" maxLength={300} />
            </label>
            {adjustError && (
              <p role="alert" className="form-error">
                {adjustError}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {scanner && (
        <InventoryScanner
          onAdjust={(item) => {
            setScanner(null)
            setAdjustError('')
            setAdjusting(item)
          }}
          initial={scanner === true ? undefined : scanner}
          onClose={() => setScanner(null)}
        />
      )}
      {detail && <ProductDialog item={detail} onClose={() => setDetail(null)} />}
      {editing && <InventoryEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
