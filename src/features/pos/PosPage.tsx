import { LoadingState } from '../../components/ui/LoadingState'
import {
  ArrowRight,
  Boxes,
  BrushCleaning,
  Eye,
  Package,
  Plus,
  ScanLine,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react'
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
import './customer-shop.css'

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
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const categories = ['All', ...new Set(products.map((item) => item.category))]
  const hasBundles = workspace.bundles.some(
    (bundle) => bundle.active !== false && bundle.published !== false,
  )
  const hasActiveFilters =
    !!query ||
    category !== 'All' ||
    brand !== 'All' ||
    availability !== 'All' ||
    !!maxPrice ||
    sort !== 'name'
  const clearShopFilters = () => {
    setQuery('')
    setCategory('All')
    setBrand('All')
    setAvailability('All')
    setMaxPrice('')
    setSort('name')
  }
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
      {!customerMode && (
        <PageHeader
          eyebrow="WORKSHOP CHECKOUT"
          title="Point of sale"
          description="Scan customer orders and record payments at the counter."
        >
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
        </PageHeader>
      )}
      {customerMode && (
        <section className="shop-hero" aria-label="Shop introduction">
          <div className="shop-hero-copy">
            <span className="shop-kicker">EXPLORE THE SHOP</span>
            <h1>Find your next upgrade.</h1>
            <p>
              Explore PC components from JBC inventory, add your picks to cart, and choose pickup or
              delivery at checkout.
            </p>
          </div>
          <div className="shop-hero-cart">
            <span className="shop-hero-cart-icon">
              <ShoppingCart size={21} />
            </span>
            <span className="shop-hero-cart-label">YOUR CART</span>
            <strong>
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </strong>
            <small>{formatPHP(pos.totals.subtotal)} subtotal</small>
            <button type="button" onClick={() => setCartOpen(true)}>
              View cart <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
      <div className={customerMode ? 'shop-discovery' : undefined}>
        {customerMode && <span className="shop-kicker shop-search-kicker">EXPLORE PARTS</span>}
        <div className="list-toolbar pos-toolbar">
          <SearchField
            label={customerMode ? 'Search PC parts' : 'Search products and services'}
            value={query}
            onChange={setQuery}
          />
          {customerMode && (
            <button type="button" className="shop-toolbar-cart" onClick={() => setCartOpen(true)}>
              <ShoppingCart size={16} /> Cart ({cartCount})
            </button>
          )}
          {customerMode && hasBundles && (
            <button type="button" className="shop-bundle-link" onClick={() => setBundlesOpen(true)}>
              <Boxes size={16} /> Bundles & PC sets <ArrowRight size={14} />
            </button>
          )}
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
          <div className="shop-category-tabs" role="group" aria-label="Product category">
            {categories.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {value === 'All' ? 'All parts' : value}
              </button>
            ))}
          </div>
        )}
        {customerMode && (
          <>
            <details className="shop-filter-details">
              <summary>
                <SlidersHorizontal size={16} /> More filters
                {hasActiveFilters && <span>Filters active</span>}
              </summary>
              <div className="shop-filters">
                <label>
                  Brand
                  <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="All">All brands</option>
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
            </details>
            <div className="shop-results">
              <p aria-live="polite">
                {workspace.loading
                  ? 'Loading products…'
                  : workspace.storageError
                    ? 'Products unavailable'
                    : `${filtered.length} of ${products.length} ${products.length === 1 ? 'part' : 'parts'}`}
              </p>
              {hasActiveFilters && (
                <button type="button" className="text-button" onClick={clearShopFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <div className={customerMode ? 'pos-layout shop-layout' : 'pos-layout'}>
        <div>
          <div className="pos-products">
            {!workspace.loading &&
              !workspace.storageError &&
              filtered.map((product) => (
                <article
                  className={customerMode ? 'pos-product shop-product-card' : 'pos-product'}
                  key={product.id}
                >
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
                    {customerMode && (
                      <>
                        <span className="shop-card-category">{product.category}</span>
                        <span
                          className={
                            product.stock > 0 ? 'shop-card-stock' : 'shop-card-stock is-empty'
                          }
                        >
                          {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                        </span>
                      </>
                    )}
                  </div>
                  <h2>{product.name}</h2>
                  {!customerMode && (
                    <p>
                      {product.service
                        ? 'Workshop service'
                        : `${product.item?.brand ? product.item.brand + (product.item.model ? ` / ${product.item.model}` : '') + ' · ' : ''}${product.stock} in stock`}
                    </p>
                  )}
                  {product.item?.specs && <p className="shop-card-specs">{product.item.specs}</p>}
                  <strong>
                    {product.price === null ? 'Price not set' : formatPHP(product.price)}
                  </strong>
                  <button
                    className={customerMode ? 'primary-button shop-add-button' : 'secondary-button'}
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
                    {customerMode
                      ? cart.some((line) => line.id === product.id)
                        ? 'Add another'
                        : 'Add to cart'
                      : 'Add to order'}
                  </button>
                  {!product.service && (
                    <button
                      className={
                        customerMode
                          ? 'secondary-button product-inspect shop-details-button'
                          : 'icon-button product-inspect'
                      }
                      title={'View specs for ' + product.name}
                      aria-label={'View specs for ' + product.name}
                      onClick={() => setProductDetail(product.item!)}
                    >
                      <Eye size={18} />
                      <span>{customerMode ? 'Details & specs' : 'View details'}</span>
                      {customerMode && <ArrowRight className="shop-detail-arrow" size={15} />}
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
