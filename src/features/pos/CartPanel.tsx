import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { formatPHP } from '../../lib/format'
import type { PosController } from './usePos'

export function CartPanel({
  customerMode,
  setCartOpen,
  products,
  cart,
  bundleName,
  selectedBundle,
  setError,
  setCheckoutOpen,
  totals,
  quantity,
}: Pick<
  PosController,
  | 'customerMode'
  | 'setCartOpen'
  | 'products'
  | 'cart'
  | 'bundleName'
  | 'selectedBundle'
  | 'setError'
  | 'setCheckoutOpen'
  | 'totals'
  | 'quantity'
>) {
  return (
    <Panel
      title={customerMode ? 'Your items' : 'Current order'}
      action={<ShoppingCart size={22} />}
    >
      <div className="order-body">
        {' '}
        <div className="cart-lines">
          {cart.length ? (
            cart.map((line) => {
              const item = products.find((item) => item.id === line.id)
              return (
                <div className="cart-line" key={line.id}>
                  <div>
                    <strong>{item?.name ?? 'Unavailable item'}</strong>
                    <small>{formatPHP(item?.price ?? 0)} each</small>
                  </div>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Decrease ${item?.name}`}
                      onClick={() => quantity(line.id, line.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Increase ${item?.name}`}
                      disabled={!item || line.quantity >= item.stock}
                      onClick={() => quantity(line.id, line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${item?.name}`}
                      onClick={() => quantity(line.id, 0)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="customer-empty">
              <ShoppingCart size={28} />
              <h3>Your cart is empty</h3>
              <p>
                {customerMode
                  ? 'Find the right parts for your next upgrade.'
                  : 'Add products or workshop services to start an order.'}
              </p>
              {customerMode && (
                <button className="primary-button" onClick={() => setCartOpen(false)}>
                  Browse parts
                </button>
              )}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <>
            <div className="order-summary">
              <span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span>
              <strong>{formatPHP(totals.total)}</strong>
            </div>
            {bundleName && (
              <p className="storage-caption">
                {bundleName}
                {selectedBundle?.freeDelivery ? ' / Free delivery' : ''}
              </p>
            )}
            <button
              className="primary-button"
              onClick={() => {
                setError('')
                setCartOpen(false)
                setCheckoutOpen(true)
              }}
            >
              <ArrowRight size={18} />
              Review checkout
            </button>
          </>
        )}
      </div>
    </Panel>
  )
}
