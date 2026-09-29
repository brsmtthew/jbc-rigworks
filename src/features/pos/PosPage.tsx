import { LoadingState } from '../../components/ui/LoadingState'
import {
  ArrowRight,
  Boxes,
  BrushCleaning,
  CircleCheck,
  Eye,
  Package,
  PackageOpen,
  Plus,
  ScanLine,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { SearchField } from '../../components/ui/Filters'
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
  if (collectingSaleMode) return <CollectPayment {...pos} />

  return (
    <>
      {customerMode && (
        <section className="shop-hero jbc-blue-hero" aria-label="Shop introduction">
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
      {!customerMode && (
        <section className="admin-pos-overview jbc-blue-hero" aria-label="Counter overview">
          <div className="admin-pos-overview-copy">
            <div>
              <span className="admin-pos-kicker">READY AT THE COUNTER</span>
              <h1>Point of sale</h1>
              <p>Build the next order, then review payment at checkout.</p>
            </div>
          </div>
          <div className="admin-pos-overview-side" aria-label="Counter tools">
            <span className="admin-pos-overview-side-label">COUNTER TOOLS</span>
            <div className="admin-pos-overview-stats">
              <div>
                <strong>{products.filter((product) => !product.service && product.stock > 0).length}</strong>
                <span>Products in stock</span>
              </div>
              <div>
                <strong>{products.filter((product) => product.service).length}</strong>
                <span>Services</span>
              </div>
              <div>
                <strong>{cartCount}</strong>
                <span>In this order</span>
              </div>
            </div>
            <div className="admin-pos-overview-actions">
              <button type="button" className="primary-button" onClick={() => setScannerOpen(true)}>
                <ScanLine size={17} />
                Scan order QR
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowOrders(true)}>
                Online orders
              </button>
              <button type="button" className="secondary-button" onClick={() => setBundlesOpen(true)}>
                <Boxes size={17} />
                Bundles &amp; PC sets
              </button>
            </div>
          </div>
        </section>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
      <div className={customerMode ? 'shop-discovery' : 'admin-pos-discovery'}>
        {customerMode && <span className="shop-kicker shop-search-kicker">EXPLORE PARTS</span>}
        {!customerMode && (
          <div className="admin-pos-discovery-heading">
            <div>
              <span className="eyebrow">CATALOG</span>
              <h2>Find items and services</h2>
            </div>
            <span>
              <CircleCheck size={15} /> Availability checked against inventory
            </span>
          </div>
        )}
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
            <div className="admin-pos-type-filter" role="group" aria-label="Product type">
              {['All', 'Products', 'Services'].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'All' ? 'All items' : value}
                </button>
              ))}
            </div>
          )}
        </div>
        {!customerMode && (
          <div className="admin-pos-results" aria-live="polite">
            {workspace.loading
              ? 'Loading catalog…'
              : workspace.storageError
                ? 'Catalog unavailable'
                : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
          </div>
        )}
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
      <div className={customerMode ? 'pos-layout shop-layout' : 'pos-layout admin-pos-layout'}>
        <div>
          <div className="pos-products">
            {!workspace.loading &&
              !workspace.storageError &&
              filtered.map((product) => (
                <article
                  className={
                    customerMode ? 'pos-product shop-product-card' : 'pos-product admin-pos-product'
                  }
                  key={product.id}
                >
                  <div className="product-visual">
                    <span className="service-icon">
                      {product.service ? <BrushCleaning size={32} /> : <Package size={32} />}
                      {customerMode && <small>Image not available</small>}
                    </span>
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
                    {!customerMode && (
                      <>
                        <span className="admin-pos-product-category">
                          {product.service ? 'Service' : product.category}
                        </span>
                        <span className={`admin-pos-stock ${product.stock <= 0 ? 'is-empty' : ''}`}>
                          {product.service
                            ? 'Workshop'
                            : product.stock > 0
                              ? `${product.stock} in stock`
                              : 'Out of stock'}
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
                  {!customerMode && (
                    <span className="admin-pos-price-label">
                      {product.service ? 'Service price' : 'Unit price'}
                    </span>
                  )}
                  <strong>
                    {product.price === null ? 'Price not set' : formatPHP(product.price)}
                  </strong>
                  <button
                    className={
                      customerMode
                        ? 'primary-button shop-add-button'
                        : 'primary-button admin-pos-add'
                    }
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
              <h3>{customerMode ? 'No matching products' : 'No matching items'}</h3>
              <p>
                {customerMode
                  ? products.length
                    ? 'Try a different search or clear your filters.'
                    : 'No products are available yet. Please check back.'
                  : products.length
                    ? 'Try another search or choose a different product type.'
                    : 'Add inventory or workshop services to make them available here.'}
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
      {!customerMode && showOrders && (
        <Dialog title="Online orders" wide onClose={() => setShowOrders(false)}>
          <div className="admin-pos-orders-dialog">
            <div className="admin-pos-dialog-intro">
              <span className="admin-pos-dialog-icon" aria-hidden="true"><ShoppingCart size={20} /></span>
              <div>
                <span className="eyebrow">CUSTOMER ORDERS</span>
                <h3>Review and fulfill online purchases</h3>
                <p>Confirm requests, reserve stock, and open orders in POS to collect payment.</p>
              </div>
            </div>
            <RequestQueue scope="orders" />
          </div>
        </Dialog>
      )}
      {bundlesOpen && (
        <Dialog title="Bundles & PC sets" wide onClose={() => setBundlesOpen(false)}>
          {customerMode ? (
            <BundleCatalog onSelect={selectBundle} />
          ) : (
            <div className="admin-pos-bundle-dialog">
              <div className="admin-pos-dialog-intro">
                <span className="admin-pos-dialog-icon" aria-hidden="true"><PackageOpen size={20} /></span>
                <div>
                  <span className="eyebrow">READY-MADE COMBINATIONS</span>
                  <h3>Choose a bundle for this order</h3>
                  <p>Available sets can be added to the cart with their included parts and price.</p>
                </div>
              </div>
              <BundleCatalog onSelect={selectBundle} showHeading={false} />
            </div>
          )}
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
