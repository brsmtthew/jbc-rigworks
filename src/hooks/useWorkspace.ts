import { deleteDoc, setDoc, where } from 'firebase/firestore'
import { saveExpense } from '../features/finance/expenseOperations'
import { usePaymentProofs } from '../features/finance/usePayments'
import { saveInventoryItem } from '../features/inventory/inventoryOperations'
import { checkout } from '../features/pos/checkoutOperations'
import { collectOrderPayment, transitionOrder } from '../features/pos/orderOperations'
import { saveServiceJob } from '../features/services/serviceOperations'
import { useAuth } from '../lib/auth-context'
import { firestoreData, recordRef } from '../lib/database'
import { paymentState } from '../lib/workflow'
import type {
  CheckoutDraft,
  Expense,
  InventoryItem,
  Job,
  ProductBundle,
  Sale,
  WorkspaceData,
} from '../types'
import { useLiveCollection } from './useLiveData'

export function useWorkspace() {
  const { user } = useAuth()
  const admin = user?.role === 'admin'
  const jobs = useLiveCollection<Job>('jobs', admin)
  const sales = useLiveCollection<Sale>('sales', admin)
  const orders = useLiveCollection<Sale>(
    'orders',
    !!user,
    user && !admin ? [where('customerId', '==', user.id)] : [],
    admin ? 'admin' : user?.id,
  )
  const inventory = useLiveCollection<InventoryItem>(admin ? 'inventory' : 'catalog', !!user)
  const expenses = useLiveCollection<Expense>('expenses', admin)
  const bundles = useLiveCollection<ProductBundle>('bundles', !!user)
  const proofs = usePaymentProofs(user)
  const proofsByOrder = new Map(proofs.rows.map((proof) => [proof.orderId, proof]))
  const withPaymentState = (sale: Sale): Sale => ({
    ...sale,
    paymentStatus: paymentState(sale, proofsByOrder.get(sale.id)),
  })
  const data: WorkspaceData = {
    jobs: jobs.rows,
    sales: (admin ? sales.rows : orders.rows).map(withPaymentState),
    inventory: inventory.rows,
    expenses: expenses.rows,
    bundles: bundles.rows,
  }
  const storageError =
    [jobs, sales, orders, inventory, expenses, bundles, proofs]
      .map((item) => item.error)
      .find(Boolean) || undefined
  const loading = [jobs, sales, orders, inventory, expenses, bundles, proofs].some(
    (item) => item.loading,
  )
  async function save<K extends keyof WorkspaceData>(
    collection: K,
    record: WorkspaceData[K][number],
    expectedStock?: number,
  ) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can update these records.')
    switch (collection) {
      case 'inventory':
        return saveInventoryItem(
          user,
          record as InventoryItem,
          expectedStock,
          inventory.rows.find((item) => item.id === record.id),
        )
      case 'jobs':
        return saveServiceJob(user, record as Job)
      case 'expenses':
        return saveExpense(user, record as Expense)
      case 'sales':
        throw new Error('Transactions are issued through POS and cannot be edited here.')
      case 'bundles':
        return setDoc(recordRef('bundles', record.id), firestoreData(record))
    }
  }
  async function remove(collection: keyof WorkspaceData, id: string) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can delete records.')
    if (
      collection === 'inventory' &&
      data.bundles.some((bundle) => bundle.items.some((item) => item.inventoryId === id))
    )
      throw new Error('Remove this item from its bundles before deleting it.')
    if (collection === 'sales' && data.sales.find((sale) => sale.id === id)?.lines)
      throw new Error(
        'Issued invoices must be retained. Update the payment or order status instead.',
      )
    if (collection === 'inventory') {
      const item = data.inventory.find((item) => item.id === id)
      if (!item || item.reserved)
        throw new Error('Release reservations before deactivating this product.')
      await save('inventory', { ...item, active: false }, item.stock)
    } else if (collection === 'expenses') {
      const expense = data.expenses.find((item) => item.id === id)
      if (expense) await save('expenses', { ...expense, voided: true })
    } else if (collection === 'jobs' || collection === 'sales')
      throw new Error('Operational and financial records must be retained.')
    else await deleteDoc(recordRef(collection, id))
  }
  const collectPayment = (
    id: string,
    amount: number,
    options: { cashTendered?: number; verifyProof?: boolean; receiptEmail?: string } = {},
  ) => collectOrderPayment(user!, id, amount, options)
  const updateOrderStatus = (id: string, status: NonNullable<Sale['orderStatus']>) =>
    transitionOrder(user!, id, status)
  return {
    ...data,
    orders: orders.rows.map(withPaymentState),
    ordersLoading: orders.loading,
    ordersError: orders.error,
    storageError,
    loading,
    save,
    remove,
    checkout: (draft: CheckoutDraft) => checkout(user!, draft),
    collectPayment,
    updateOrderStatus,
  }
}
