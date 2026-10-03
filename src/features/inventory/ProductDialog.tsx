import { Package, ShieldCheck, ShoppingCart } from 'lucide-react'
import { createElement, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { availableStock } from '../../lib/workflow'
import type { InventoryItem } from '../../types'
import { compatibilityFields } from '../builder/componentFields'
import { componentIcons } from '../builder/componentIcons'
import { componentOf } from '../builder/pc'

export function ProductDialog({
  item,
  onClose,
  onAdd,
  addLabel = 'Add to cart',
  addDisabled = false,
}: {
  item: InventoryItem
  onClose: () => void
  onAdd?: () => void
  addLabel?: string
  addDisabled?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [shop] = useShopSettings()
  const component = componentOf(item)
  const specs = component
    ? compatibilityFields[component].filter(
        (field) => item[field.key] !== undefined && item[field.key] !== '',
      )
    : []
  const months = item.warrantyMonths || shop.warrantyMonths
  return (
    <Dialog
      title={item.name}
      wide
      onClose={onClose}
      footer={
        onAdd ? (
          <>
            <span>{formatPHP(item.price)}</span>
            <button
              className="primary-button"
              disabled={addDisabled || availableStock(item) <= 0 || item.active === false}
              onClick={onAdd}
            >
              <ShoppingCart size={18} />
              {addLabel}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="product-detail-layout">
        <div className="product-photo">
          {item.image && !imageFailed ? (
            <img src={item.image} alt={item.name} onError={() => setImageFailed(true)} />
          ) : (
            <>
              {createElement(component ? componentIcons[component] : Package, { size: 90 })}
              <span>Photo not provided</span>
            </>
          )}
        </div>
        <div>
          <span className="eyebrow">{item.category}</span>
          <h3>{formatPHP(item.price)}</h3>
          <p>{availableStock(item) > 0 ? `${availableStock(item)} available` : 'Out of stock'}</p>
          {specs.length > 0 && (
            <>
              <h3>Key specifications</h3>
              <dl className="detail-list">
                {specs.map((field) => (
                  <div key={field.key}>
                    <dt>{field.label.replace(' (comma separated)', '')}</dt>
                    <dd>{String(item[field.key])}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <h3>Full specifications</h3>
          {item.description && <p className="product-description">{item.description}</p>}
          <p className="product-specs">
            {item.specs || 'Ask JBC for additional product specifications.'}
          </p>
          <h3>
            <ShieldCheck size={18} /> Warranty
          </h3>
          <p>
            {months === ''
              ? 'Duration to be confirmed'
              : Number(months) === 0
                ? 'No warranty coverage'
                : `${months} ${Number(months) === 1 ? 'month' : 'months'}`}
            . {item.warrantyTerms || shop.warrantyTerms || 'Terms to be confirmed by the workshop.'}
          </p>
          <h3>Product information</h3>
          <dl className="detail-list">
            {[
              ['Brand', item.brand || 'Not specified'],
              ['Model', item.model || item.name],
              ['SKU', item.sku],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Dialog>
  )
}
