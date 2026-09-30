import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { invoiceTotals, money } from '../../lib/commerce'
import { useDirectories } from '../../lib/directories'
import { formatPHP } from '../../lib/format'
import { bundlePriceAdjustment, qualifyingBundle } from '../../lib/fulfillment'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { availableStock } from '../../lib/workflow'
import type { InventoryItem, Job, ProductBundle, Sale } from '../../types'
import { isSellable } from '../builder/pc'
import { rejectPaymentProof } from '../finance/payments'
import { usePaymentAccounts, usePaymentProofs } from '../finance/usePayments'
import { findPayableOrder } from './orderOperations'

type PosProduct = {
  id: string
  name: string
  category: string
  price: number | null
  stock: number
  service: boolean
  item?: InventoryItem
}

export function usePos() {
  const [directory] = useDirectories()
  const [productDetail, setProductDetail] = useState<InventoryItem | null>(null)
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const location = useLocation()
  const customerMode = user?.role === 'user'
  const [cartOpen, setCartOpen] = useState(false),
    [ordersOverride, setOrdersOverride] = useState<{ key: string; value: boolean } | null>(null)
  const showOrders = ordersOverride?.key === location.key
    ? ordersOverride.value
    : new URLSearchParams(location.search).get('orders') === 'true'
  const setShowOrders = (value: boolean) => setOrdersOverride({ key: location.key, value })
  const [toast, setToast] = useState(''),
    [category, setCategory] = useState('All'),
    [brand, setBrand] = useState('All'),
    [availability, setAvailability] = useState('All'),
    [sort, setSort] = useState('name'),
    [maxPrice, setMaxPrice] = useState('')
  const accounts = usePaymentAccounts()
  const [paymentAccountId, setPaymentAccountId] = useState(''),
    [paymentReference, setPaymentReference] = useState(''),
    [paymentVerified, setPaymentVerified] = useState(false)
  const paymentAccount = accounts.rows.find((account) => account.id === paymentAccountId)
  const checkoutKey = useRef(crypto.randomUUID())
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])
  const workspace = useWorkspace()
  const [shop] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [params] = useSearchParams()
  const jobDraft = location.state?.job as Job | undefined
  const collectSaleId =
    typeof location.state?.collectSaleId === 'string' ? location.state.collectSaleId : null
  const [scannedSaleId, setCollectingSaleMode] = useState<string | null>(null)
  const collectingSaleMode = scannedSaleId || collectSaleId
  const [scannerOpen, setScannerOpen] = useState(false),
    [scannedOrder, setScannedOrder] = useState<Sale | null>(null)
  const collectingSale = collectingSaleMode
    ? workspace.sales.find((item) => item.id === collectingSaleMode) ||
      workspace.orders.find((item) => item.id === collectingSaleMode) ||
      (scannedOrder?.id === collectingSaleMode ? scannedOrder : undefined)
    : undefined
  const needsProcessing =
    !!collectingSale?.customerId &&
    !workspace.sales.some((item) => item.id === collectingSaleMode) &&
    collectingSale.reservationState !== 'Reserved'
  const proofs = usePaymentProofs(user?.role === 'admin' ? user : null)
  const pendingProof = proofs.rows.find(
    (proof) => proof.orderId === collectingSaleMode && proof.status === 'Pending',
  )
  const [reviewNote, setReviewNote] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [jobService] = useState(() =>
    jobDraft
      ? {
          id: `job-service:${jobDraft.id}`,
          description: `${jobDraft.device} / ${jobDraft.service}`,
          unitPrice: jobDraft.quote,
        }
      : undefined,
  )
  const customServices = jobService ? [jobService] : []
  const products: PosProduct[] = [
    ...workspace.inventory
      .filter((item) => isSellable(item))
      .map((item) => ({
        id: item.id,
        name: item.brand ? `${item.brand} ${item.model || item.name}` : item.model || item.name,
        category: item.category,
        price: item.price,
        stock: availableStock(item),
        service: false,
        item,
      })),
    ...(!customerMode
      ? [
          ...shop.services
            .filter((service) => service.active && service.workshop)
            .map((service) => ({
              id: `service:${service.id}`,
              name: `${service.name} / ${service.deviceType}`,
              category: 'Services',
              price: service.price === '' ? null : Number(service.price),
              stock: Infinity,
              service: true,
            })),
          ...(jobService
            ? [
                {
                  ...jobService,
                  name: jobService.description,
                  category: 'Service jobs',
                  price: jobService.unitPrice,
                  stock: 1,
                  service: true,
                },
              ]
            : []),
        ]
      : []),
  ]
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>(() => {
    if (jobService) return [{ id: jobService.id, quantity: 1 }]
    const parts = location.state?.parts as string[] | undefined
    if (Array.isArray(parts)) return [...new Set(parts)].map((id) => ({ id, quantity: 1 }))
    const service = customerMode ? null : params.get('service')
    return service ? [{ id: service, quantity: 1 }] : []
  })
  const [bundleId, setBundleId] = useState<string | undefined>()
  const [pcSet, setPcSet] = useState(Boolean(location.state?.pcSet))
  const [fulfillment, setFulfillment] = useState<'Pickup' | 'Delivery'>('Pickup')
  const [addressChoice, setAddress] = useState<string | null>(null)
  const distance = '0'
  const address = addressChoice ?? profile.address
  const bundleName = qualifyingBundle(cart, workspace.inventory, workspace.bundles, bundleId, pcSet)
  const selectedBundle = bundleName
    ? workspace.bundles.find((bundle) => bundle.id === bundleId)
    : undefined
  const hasProducts = cart.some((line) =>
    products.some((product) => product.id === line.id && !product.service),
  )
  const deliveryFee =
    !hasProducts || fulfillment === 'Pickup' || selectedBundle?.freeDelivery ? 0 : shop.delivery
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All')
  const [customerChoice, setCustomer] = useState<string | null>(null)
  const customer =
    customerChoice ??
    (customerMode ? profile.name || user!.name : (jobDraft?.customer ?? 'Walk-in Customer'))
  const [contactChoice, setContact] = useState<string | null>(null)
  const contact =
    contactChoice ??
    (customerMode
      ? [profile.phone, profile.contactEmail || user!.email].filter(Boolean).join(' / ')
      : (jobDraft?.contact ?? ''))
  const channel = customerMode ? 'Online' : 'Walk-in'
  const [notes, setNotes] = useState('')
  const [receiptEmailChoice, setReceiptEmail] = useState<string | null>(null)
  const receiptEmail =
    receiptEmailChoice ??
    collectingSale?.receiptEmail ??
    (customerMode ? profile.contactEmail || user!.email : '')
  const [chargeChoice, setCharges] = useState<
    Partial<{
      labor: number
      delivery: number
      other: number
      otherLabel: string
      discount: number
      taxRate: number
    }>
  >({})
  const charges = {
    labor: 0,
    delivery: 0,
    other: 0,
    otherLabel: '',
    discount: 0,
    taxRate: shop.taxRate,
    ...chargeChoice,
  }
  const [sale, setSale] = useState<Sale | null>(null)
  const { error, setError, busy, run } = useAsyncAction()
  const [checkoutOpen, setCheckoutOpen] = useState(false),
    [bundlesOpen, setBundlesOpen] = useState(false)
  const scanSequence = useRef(0)
  const baseCharges = customerMode
    ? { labor: 0, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate }
    : jobService
      ? { ...charges, labor: 0 }
      : charges
  const effectiveCharges = {
    ...baseCharges,
    ...(selectedBundle ? bundlePriceAdjustment(selectedBundle, workspace.inventory) : {}),
    delivery: deliveryFee ?? 0,
  }
  const productsById = new Map(products.map((product) => [product.id, product]))
  const lines = cart.map((line) => {
    const product = productsById.get(line.id)
    return {
      ...line,
      description: product?.name ?? 'Unavailable item',
      unitPrice: product?.price ?? 0,
      unitCost: 0,
    }
  })
  const totals = cart.length
    ? invoiceTotals(lines, effectiveCharges)
    : { subtotal: 0, tax: 0, total: 0 }
  const receivedCash = cashReceived.trim() ? Number(cashReceived) : 0
  const cashPaid = Number.isFinite(receivedCash)
    ? Math.min(Math.max(0, receivedCash), totals.total)
    : 0
  const collectBalance = collectingSale
    ? money(Math.max(0, collectingSale.total - collectingSale.paid))
    : 0
  const collectionCashPaid = Number.isFinite(receivedCash)
    ? Math.min(Math.max(0, receivedCash), collectBalance)
    : 0
  const checkoutPaid = customerMode ? 0 : paymentAccount ? totals.total : cashPaid
  const filtered = products
    .filter(
      (product) =>
        (filter === 'All' || (filter === 'Services' ? product.service : !product.service)) &&
        (category === 'All' || product.category === category) &&
        (brand === 'All' || product.item?.brand === brand) &&
        (availability === 'All' || product.stock > 0) &&
        (!maxPrice || (product.price ?? Infinity) <= Number(maxPrice)) &&
        `${product.name} ${product.category} ${product.item?.specs || ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'price-low'
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : sort === 'price-high'
          ? (b.price ?? 0) - (a.price ?? 0)
          : a.name.localeCompare(b.name),
    )
  function quantity(id: string, next: number) {
    setCart((current) =>
      next < 1
        ? current.filter((line) => line.id !== id)
        : current.some((line) => line.id === id)
          ? current.map((line) => (line.id === id ? { ...line, quantity: next } : line))
          : [...current, { id, quantity: next }],
    )
    setError('')
    if (customerMode && next > (cart.find((line) => line.id === id)?.quantity ?? 0))
      setToast('Added to cart')
  }
  async function checkout() {
    return run(async () => {
      if (
        !(await confirm({
          title: customerMode ? 'Place this order?' : 'Complete this sale?',
          message: `${customerMode ? 'Send this order' : 'Complete this sale'} for ${formatPHP(totals.total)}?`,
          confirmLabel: customerMode ? 'Place order' : 'Complete sale',
        }))
      )
        return
      const result = await workspace.checkout({
        idempotencyKey: checkoutKey.current,
        paymentAccountId,
        paymentVerified,
        paymentReference,
        customer,
        contact,
        receiptEmail,
        channel,
        cashTendered:
          !customerMode && !paymentAccount && cashReceived.trim() ? receivedCash : undefined,
        paymentMethod: paymentAccount?.kind ?? 'Cash',
        paid: checkoutPaid,
        lines: cart,
        customServices,
        jobId: jobService ? jobDraft?.id : undefined,
        fulfillment: {
          mode: hasProducts ? fulfillment : 'Pickup',
          address,
          distanceKm: Number(distance),
        },
        bundleId: bundleName ? bundleId : undefined,
        pcSet: !!bundleName && pcSet,
        charges: effectiveCharges,
        notes,
      })
      checkoutKey.current = crypto.randomUUID()
      setCheckoutOpen(false)
      setCartOpen(false)
      setSale(result)
      setCart([])
      setCashReceived('')
      setBundleId(undefined)
      setPcSet(false)
    })
  }
  async function selectBundle(bundle: ProductBundle) {
    if (
      cart.length &&
      !(await confirm({
        title: 'Replace current order?',
        message: 'Choosing this bundle will replace the items in your current order.',
        confirmLabel: 'Replace order',
        tone: 'danger',
      }))
    )
      return
    setCart(bundle.items.map((item) => ({ id: item.inventoryId, quantity: item.quantity })))
    setBundleId(bundle.id)
    setPcSet(false)
    setError('')
    setBundlesOpen(false)
  }
  async function collectOutstanding(verifyProof = false) {
    return run(async () => {
      if (!collectingSale) {
        setError('This invoice is unavailable. Return to Sales and open it again.')
        return
      }
      const amount = verifyProof ? (pendingProof?.amount ?? 0) : collectionCashPaid
      if (!Number.isFinite(amount) || amount <= 0 || amount !== collectBalance) {
        setError('Collect the full remaining balance to complete payment.')
        return
      }

      if (
        !(await confirm({
          title: 'Record payment?',
          message: verifyProof
            ? `Confirm that ${formatPHP(amount)} with reference ${pendingProof?.reference} was received in the company account? This issues the transaction receipt.`
            : `Record ${formatPHP(amount)} cash received at the store against ${collectingSale.id}?`,
          confirmLabel: 'Record payment',
        }))
      )
        return
      const updated = await workspace.collectPayment(collectingSale.id, amount, {
        receiptEmail,
        verifyProof,
        cashTendered: !verifyProof && cashReceived.trim() ? receivedCash : undefined,
      })
      setSale(updated)
      setCashReceived('')
      setError('')
    })
  }
  function setQuickCash(amount: number) {
    setCashReceived(String(Math.round(amount * 100) / 100))
  }
  async function openScannedOrder(id: string) {
    const sequence = ++scanSequence.current
    const found = await findPayableOrder(id)
    if (sequence !== scanSequence.current) return
    setScannedOrder(found)
    setCollectingSaleMode(id)
    setScannerOpen(false)
    setCashReceived('')
    setReceiptEmail(null)
    setReviewNote('')
    setError('')
  }
  async function prepareOrder() {
    return run(async () => {
      if (!collectingSale) return
      if (
        !(await confirm({
          title: 'Prepare order in POS?',
          message: 'Check current prices and reserve the ordered stock before recording payment?',
          confirmLabel: 'Prepare order',
        }))
      )
        return

      await workspace.updateOrderStatus(collectingSale.id, 'Confirmed')
    })
  }
  async function rejectProof() {
    return run(async () => {
      if (!pendingProof || !user) return
      if (!reviewNote.trim()) {
        setError('Enter the reason this proof is being rejected.')
        return
      }
      if (
        !(await confirm({
          title: 'Reject payment proof?',
          message: 'The customer can submit a corrected proof or pay cash at the store.',
          confirmLabel: 'Reject proof',
        }))
      )
        return

      await rejectPaymentProof(user, pendingProof.orderId, reviewNote)
    })
  }
  async function confirmPickup() {
    return run(async () => {
      if (!collectingSale) return
      if (
        !(await confirm({
          title: 'Confirm pickup?',
          message: 'Confirm that the customer has received all items in this paid order?',
          confirmLabel: 'Confirm pickup',
        }))
      )
        return

      await workspace.updateOrderStatus(collectingSale.id, 'Completed')
    })
  }
  const cashShortcuts = (amount: number) =>
    [
      ...new Set([
        amount,
        Math.ceil(amount / 20) * 20,
        Math.ceil(amount / 100) * 100,
        Math.ceil(amount / 500) * 500,
      ]),
    ].filter((value) => value > 0 && Number.isFinite(value))

  return {
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
    bundleName,
    selectedBundle,
    setError,
    setCheckoutOpen,
    totals,
    setCollectingSaleMode,
    collectingSale,
    needsProcessing,
    proofs,
    pendingProof,
    reviewNote,
    setReviewNote,
    cashReceived,
    setCashReceived,
    customer,
    setReceiptEmail,
    receiptEmail,
    error,
    busy,
    lines,
    receivedCash,
    collectBalance,
    collectionCashPaid,
    collectOutstanding,
    setQuickCash,
    prepareOrder,
    rejectProof,
    confirmPickup,
    cashShortcuts,
    directory,
    accounts,
    paymentAccountId,
    setPaymentAccountId,
    paymentReference,
    setPaymentReference,
    paymentVerified,
    setPaymentVerified,
    paymentAccount,
    shop,
    jobService,
    bundleId,
    pcSet,
    fulfillment,
    setFulfillment,
    setAddress,
    address,
    hasProducts,
    deliveryFee,
    setCustomer,
    setContact,
    contact,
    notes,
    setNotes,
    setCharges,
    charges,
    effectiveCharges,
    cashPaid,
    checkout,
  }
}
export type PosController = ReturnType<typeof usePos>
