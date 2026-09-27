import { Eye, Package, Pencil, Plus, QrCode, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { ActionButton } from '../../components/ui/ActionButton'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { StatStrip } from '../../components/ui/StatStrip'
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
  const lowStock = inventory.filter((item) => availableStock(item) <= item.minimum)
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
  const kindLabel = (kind: string) =>
    ({
      part: 'PC part',
      product: 'Retail product',
      asset: 'Tool / equipment',
      consumable: 'Consumable',
    })[kind] || kind
  if (workspace.storageError)
    return (
      <p role="alert" className="form-error">
        {workspace.storageError}
      </p>
    )
  if (workspace.loading) return <LoadingState table label="Loading inventory..." />
  return (
    <>
      <PageHeader
        eyebrow="STOCK CONTROL"
        title="Inventory"
        description="Master product catalog, stock, reservations, and bundles."
      >
        <button className="primary-button" onClick={onCreate}>
          <Plus size={18} />
          Add item
        </button>
        <button className="secondary-button" onClick={() => setBundlesOpen(true)}>
          Manage bundles
        </button>
        <ActionButton variant="labeled" label="Scan inventory QR" onClick={() => setScanner(true)}>
          <ScanLine size={18} />
        </ActionButton>
      </PageHeader>
      <StatStrip
        stats={[
          { label: 'Stock value at cost', value: formatPHP(stockValue, true) },
          { label: 'Unique items', value: inventory.length },
          { label: 'Low-stock items', value: lowStock.length },
          { label: 'Categories', value: categories.length },
        ]}
      />
      <div className="inventory-filter-toolbar">
        <ListToolbar
          {...filters}
          label="Search inventory"
          count={filtered.length}
          onReset={() => {
            filters.reset()
            setCategoryFilter('all')
            setKindFilter('all')
          }}
          options={[
            { value: 'all', label: 'All stock statuses' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
          onExport={() =>
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
          }
        />
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
          Part category
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
        {(categoryFilter !== 'all' || kindFilter !== 'all') && (
          <button
            className="text-button inventory-filter-reset"
            onClick={() => {
              setCategoryFilter('all')
              setKindFilter('all')
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      <Panel title="Inventory" subtitle="Parts, products, equipment, and consumables">
        <DataTable
          filtered={
            !!filters.query ||
            filters.filter !== 'all' ||
            categoryFilter !== 'all' ||
            kindFilter !== 'all'
          }
          rows={filtered}
          label="Inventory"
          columns={[
            {
              label: 'Item / SKU',
              sortValue: (item) => item.name,
              render: (item) => (
                <div className="item-cell">
                  <span className="stock-icon">
                    <Package size={20} />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.sku}
                      {item.assetTag ? ` · ${item.assetTag}` : ''}
                    </small>
                  </span>
                </div>
              ),
            },
            {
              label: 'Role',
              sortValue: (item) => kindLabel(inventoryKind(item)),
              render: (item) => <span>{kindLabel(inventoryKind(item))}</span>,
            },
            {
              label: 'Category',
              sortValue: (item) => item.category,
              render: (item) => item.category,
            },
            { label: 'On hand', render: (item) => item.stock },
            { label: 'Reserved', render: (item) => item.reserved ?? 0 },
            { label: 'Unit cost', numeric: true, render: (item) => formatPHP(item.cost) },
            {
              label: 'Available',
              sortValue: (item) => availableStock(item),
              render: (item) => (
                <>
                  <strong>{availableStock(item)} units</strong>
                  <small>Minimum {item.minimum}</small>
                </>
              ),
            },
            {
              label: 'Stock status',
              sortValue: (item) => (availableStock(item) <= item.minimum ? 0 : 1),
              render: (item) => (
                <StatusBadge tone={availableStock(item) <= item.minimum ? 'amber' : 'green'}>
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
              label: 'Selling price',
              sortValue: (item) => item.price,
              numeric: true,
              render: (item) => <strong>{formatPHP(item.price)}</strong>,
            },
            {
              label: 'Actions',
              render: (record) => (
                <div className="part-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      setAdjusting(record)
                      setAdjustError('')
                    }}
                  >
                    Adjust stock
                  </button>
                  <button
                    className="text-button"
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
                    {' '}
                    {record.active === false ? 'Activate' : 'Deactivate'}
                  </button>
                  <ActionButton label={'Edit ' + record.id} onClick={() => setEditing(record)}>
                    <Pencil size={18} />
                  </ActionButton>
                  <ActionButton label={'QR ' + record.sku} onClick={() => setScanner(record)}>
                    <QrCode size={18} />
                  </ActionButton>
                  <ActionButton label={'View ' + record.name} onClick={() => setDetail(record)}>
                    <Eye size={18} />
                  </ActionButton>
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
    </>
  )
}
