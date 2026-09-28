import { LoadingState } from '../../components/ui/LoadingState'
import { Boxes, BrushCleaning, Eye, Package, Plus, ScanLine, ShoppingCart } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { SearchField } from '../../components/ui/Filters'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatPHP } from '../../lib/format'
import { availableStock } from '../../lib/workflow'
import { InvoiceDialog } from '../finance/InvoiceDialog'
import { ProductDialog } from '../inventory/ProductDialog'
import { RequestQueue } from '../services/RequestQueue'
import { BundleCatalog } from './BundleCatalog'
import { CartPanel } from './CartPanel'
import { CheckoutDialog } from './CheckoutDialog'
import { CollectPayment } from './CollectPayment'
import { OrderScanner } from './OrderScanner'
import { usePos } from './usePos'

export function PosPage() {
  const pos = usePos()
  const {
    productDetail,
    setProductDetail,
    customerMode,
    cartOpen,
    setCartOpen,
    showOrders,
    setShowOrders,
    toast,
    category,
    setCategory,
    brand,
    setBrand,
    availability,
    setAvailability,
    sort,
    setSort,
    maxPrice,
    setMaxPrice,
    workspace,
    collectingSaleMode,
    scannerOpen,
    setScannerOpen,
    products,
    cart,
    query,
    setQuery,
    filter,
    setFilter,
    sale,
    setSale,
    checkoutOpen,
    bundlesOpen,
    setBundlesOpen,
    filtered,
    quantity,
    selectBundle,
    openScannedOrder,
  } = pos
  const cartPanel = <CartPanel {...pos} />
  if (showOrders && !collectingSaleMode)
    return (
      <>
        <PageHeader
          eyebrow="POINT OF SALE"
          title="Online orders"
          description="Confirm requests, reserve stock, and collect payments."
        >
          <button className="secondary-button" onClick={() => setShowOrders(false)}>
            Back to POS
          </button>
        </PageHeader>
        <RequestQueue scope="orders" />
      </>
    )
  if (collectingSaleMode) return <CollectPayment {...pos} />

  return (
    <>
      <PageHeader
        eyebrow={customerMode ? 'PC PARTS SHOP' : 'WORKSHOP CHECKOUT'}
        title={customerMode ? 'Shop PC parts' : 'Point of sale'}
        description={
          customerMode
            ? 'Browse parts, choose pickup or delivery, and track your order.'
            : 'Scan customer orders and record payments at the counter.'
        }
      >
        {customerMode ? (
          <button className="primary-button" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={18} />
            Cart ({cart.reduce((sum, line) => sum + line.quantity, 0)})
          </button>
        ) : (
          <>
            <button className="secondary-button" onClick={() => setShowOrders(true)}>
              Online orders
            </button>
            <button className="secondary-button" onClick={() => setScannerOpen(true)}>
              <ScanLine size={18} />
              Scan order QR
            </button>
            <button className="secondary-button" onClick={() => setBundlesOpen(true)}>
              <Boxes size={18} />
              Bundles & PC sets
            </button>
          </>
        )}
      </PageHeader>
      {customerMode &&
        workspace.bundles.some(
          (bundle) => bundle.active !== false && bundle.published !== false,
        ) && (
          <button className="secondary-button" onClick={() => setBundlesOpen(true)}>
            Browse bundles & PC sets
          </button>
        )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
      <div className="list-toolbar pos-toolbar">
        <SearchField
          label={customerMode ? 'Search PC parts' : 'Search products and services'}
          value={query}
          onChange={setQuery}
        />
        {!customerMode && (
          <select
            aria-label="Product type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All</option>
            <option>Products</option>
            <option>Services</option>
          </select>
        )}
      </div>
      {customerMode && (
        <>
          <div className="shop-filters">
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>All</option>
                {[...new Set(products.map((item) => item.category))].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Brand
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option>All</option>
                {[...new Set(products.map((item) => item.item?.brand).filter(Boolean))].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Availability
              <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option>All</option>
                <option>In stock</option>
              </select>
            </label>
            <label>
              Maximum price (PHP)
              <input
                type="number"
                min="0"
                placeholder="No limit"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </label>
            <label>
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">Name</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>
          <div className="shop-results">
            <p>
              {workspace.loading
                ? 'Loading products…'
                : workspace.storageError
                  ? 'Products unavailable'
                  : filtered.length + (filtered.length === 1 ? ' product' : ' products')}
            </p>
            <button
              className="text-button"
              onClick={() => {
                setQuery('')
                setCategory('All')
                setBrand('All')
                setAvailability('All')
                setMaxPrice('')
                setSort('name')
              }}
            >
              Clear filters
            </button>
          </div>
        </>
      )}
      <div className={customerMode ? 'pos-layout shop-layout' : 'pos-layout'}>
        <div>
          <div className="pos-products">
            {!workspace.loading &&
              !workspace.storageError &&
              filtered.map((product) => (
                <article className="pos-product" key={product.id}>
                  <div className="product-visual">
                    {(customerMode || !product.item?.image) && (
                      <span className="service-icon">
                        {product.service ? <BrushCleaning size={32} /> : <Package size={32} />}
                        {customerMode && <small>Image not available</small>}
                      </span>
                    )}
                    {product.item?.image && (
                      <img
                        className="product-image"
                        loading="lazy"
                        src={product.item.image}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.hidden = true
                        }}
                      />
                    )}
                  </div>
                  <h2>{product.name}</h2>
                  <p>
                    {product.service
                      ? 'Workshop service'
                      : `${product.item?.brand ? product.item.brand + (product.item.model ? ` / ${product.item.model}` : '') + ' · ' : ''}${product.stock} in stock`}
                  </p>
                  {product.item?.specs && <p className="shop-card-specs">{product.item.specs}</p>}
                  <strong>
                    {product.price === null ? 'Price not set' : formatPHP(product.price)}
                  </strong>
                  <button
                    className="secondary-button"
                    disabled={
                      product.price === null ||
                      product.stock <= (cart.find((line) => line.id === product.id)?.quantity ?? 0)
                    }
                    onClick={() =>
                      quantity(
                        product.id,
                        (cart.find((line) => line.id === product.id)?.quantity ?? 0) + 1,
                      )
                    }
                    aria-label={`${customerMode ? 'Add to cart' : 'Add to order'}: ${product.name}`}
                  >
                    <Plus size={18} />
                    {customerMode ? 'Add to cart' : 'Add to order'}
                  </button>
                  {!product.service && (
                    <button
                      className="icon-button product-inspect"
                      title={'View specs for ' + product.name}
                      aria-label={'View specs for ' + product.name}
                      onClick={() => setProductDetail(product.item!)}
                    >
                      <Eye size={19} />
                      <span>View details</span>
                    </button>
                  )}
                </article>
              ))}
          </div>
          {workspace.loading && <LoadingState label="Loading products…" />}
          {workspace.storageError && (
            <p className="form-error" role="alert">
              {workspace.storageError}
            </p>
          )}
          {!workspace.loading && !workspace.storageError && !filtered.length && (
            <div className="empty-state">
              <Package size={26} />
              <h3>No matching products</h3>
              <p>
                {customerMode
                  ? products.length
                    ? 'Try a different search or clear your filters.'
                    : 'No products are available yet. Please check back.'
                  : 'Add inventory to make products available here.'}
              </p>
            </div>
          )}
        </div>
        {!customerMode && cartPanel}
      </div>
      {customerMode && cartOpen && (
        <Dialog title="Your cart" wide onClose={() => setCartOpen(false)}>
          {cartPanel}
        </Dialog>
      )}
      {checkoutOpen && <CheckoutDialog {...pos} />}
      {bundlesOpen && (
        <Dialog title="Bundles & PC sets" wide onClose={() => setBundlesOpen(false)}>
          <BundleCatalog onSelect={selectBundle} />
        </Dialog>
      )}
      {productDetail && (
        <ProductDialog
          item={productDetail}
          addLabel={customerMode ? 'Add to cart' : 'Add to order'}
          addDisabled={
            (cart.find((line) => line.id === productDetail.id)?.quantity ?? 0) >=
            availableStock(productDetail)
          }
          onAdd={() => {
            quantity(
              productDetail.id,
              (cart.find((line) => line.id === productDetail.id)?.quantity ?? 0) + 1,
            )
            setProductDetail(null)
          }}
          onClose={() => setProductDetail(null)}
        />
      )}
      {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
      {scannerOpen && (
        <OrderScanner onSelect={openScannedOrder} onClose={() => setScannerOpen(false)} />
      )}
    </>
  )
}
