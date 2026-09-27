import { runTransaction, type Transaction } from 'firebase/firestore'
import { money } from '../../lib/commerce'
import { firestoreData, recordRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import { customerSale } from '../../lib/saleSnapshots'
import type {
  AppUser,
  PaymentAccount,
  PaymentProof,
  Sale,
  SalePayment,
  TransactionReceipt,
} from '../../types'

export const validEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export const orderQrValue = (id: string) => `jbc-order:${id}`
export function parseOrderQr(value: string) {
  const id = value.trim().replace(/^jbc-order:/i, '')
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
    throw new Error('Scan an order QR or enter its order reference.')
  return id
}
export const blankPaymentAccounts: PaymentAccount[] = [
  {
    id: 'bank',
    kind: 'Bank transfer',
    name: '',
    accountName: '',
    accountNumber: '',
    qrImage: '',
    enabled: false,
  },
  {
    id: 'ewallet',
    kind: 'E-wallet',
    name: '',
    accountName: '',
    accountNumber: '',
    qrImage: '',
    enabled: false,
  },
]
export const accountAvailable = (account: PaymentAccount) =>
  account.enabled && !!account.qrImage && !!account.name.trim() && !!account.accountName.trim()
export function readPaymentImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 500000)
    return Promise.reject(new Error('Choose a JPG, PNG, or WebP image up to 500 KB.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the image. Please try again.'))
    reader.readAsDataURL(file)
  })
}
export async function submitPaymentProof(
  user: AppUser,
  orderId: string,
  accountId: string,
  reference: string,
  image: string,
) {
  if (
    !reference.trim() ||
    reference.length > 100 ||
    !/^data:image\/(png|jpeg|webp);base64,/.test(image) ||
    image.length > 700000
  )
    throw new Error('Enter a transfer reference and a JPG, PNG, or WebP proof image up to 500 KB.')
  return runTransaction(firebaseFirestore, async (transaction) => {
    const proofRef = recordRef('paymentProofs', orderId)
    const [orderDoc, accountDoc, existing] = await Promise.all([
      transaction.get(recordRef('orders', orderId)),
      transaction.get(recordRef('paymentAccounts', accountId)),
      transaction.get(proofRef),
    ])
    const order = orderDoc.data() as Sale | undefined
    const account = accountDoc.data() as PaymentAccount | undefined
    if (
      !order ||
      order.customerId !== user.id ||
      ['Declined', 'Cancelled'].includes(order.orderStatus ?? '') ||
      order.paid >= order.total
    )
      throw new Error('This order is not available for a payment submission.')
    if (!account || !accountAvailable(account) || account.customers === false)
      throw new Error('This payment account is not available. Pay cash at the store instead.')
    if (existing.exists() && existing.data().status !== 'Rejected')
      throw new Error('A payment proof has already been submitted for this order.')
    const proof: PaymentProof = {
      id: orderId,
      orderId,
      customerId: user.id,
      accountId,
      method: account.kind,
      amount: money(order.total - order.paid),
      reference: reference.trim(),
      image,
      submittedAt: new Date().toISOString(),
      status: 'Pending',
    }
    transaction.set(proofRef, firestoreData(proof))
    transaction.update(orderDoc.ref, { paymentStatus: 'Pending verification' })
  })
}

export async function rejectPaymentProof(user: AppUser, orderId: string, note: string) {
  if (user.role !== 'admin' || !note.trim())
    throw new Error('Enter a reason for rejecting this proof.')
  await runTransaction(firebaseFirestore, async (transaction) => {
    const ref = recordRef('paymentProofs', orderId)
    const [snapshot, order, sale] = await Promise.all([
      transaction.get(ref),
      transaction.get(recordRef('orders', orderId)),
      transaction.get(recordRef('sales', orderId)),
    ])
    if (!snapshot.exists() || snapshot.data().status !== 'Pending')
      throw new Error('This proof has already been reviewed.')
    transaction.update(ref, {
      status: 'Rejected',
      reviewNote: note.trim().slice(0, 500),
      reviewedAt: new Date().toISOString(),
      reviewedBy: user.id,
    })
    if (order.exists() && order.data().paid < order.data().total)
      transaction.update(order.ref, { paymentStatus: 'Rejected' })
    if (sale.exists() && sale.data().paid < sale.data().total)
      transaction.update(sale.ref, { paymentStatus: 'Rejected' })
  })
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
const php = (value: number) => `PHP ${value.toFixed(2)}`

// Called within the same admin transaction as the payment, so a receipt cannot
// exist without the corresponding payment. The outbox awaits email setup.
export function recordReceipt(
  transaction: Transaction,
  sale: Sale,
  payment: SalePayment,
  cashierId: string,
): string {
  const id = `RCT-${payment.id}`
  const publicSale = customerSale({ ...sale, lastReceiptId: id })
  const receipt: TransactionReceipt = {
    id,
    orderId: sale.id,
    customerId: sale.customerId || '',
    recipientEmail: sale.receiptEmail || '',
    issuedAt: payment.date,
    cashierId,
    payment,
    sale: publicSale,
  }
  transaction.set(recordRef('receipts', id), firestoreData(receipt))
  if (receipt.recipientEmail) {
    const rows = [
      sale.seller?.name || 'JBC RigWorks',
      `Transaction receipt: ${id}`,
      `Order: ${sale.id}`,
      `Customer: ${sale.customer}`,
      `Recorded: ${payment.date}`,
      ...(sale.lines ?? []).map(
        (line) => `${line.quantity} x ${line.description}: ${php(line.quantity * line.unitPrice)}`,
      ),
      `Order total: ${php(sale.total)}`,
      `This payment: ${php(payment.amount)} (${payment.method})`,
      ...(payment.reference ? [`Transfer reference: ${payment.reference}`] : []),
      `Total paid: ${php(sale.paid)}`,
      `Balance due: ${php(Math.max(0, sale.total - sale.paid))}`,
      `Payment status: ${sale.status}`,
      'Keep this receipt for transaction and warranty reference.',
    ]
    transaction.set(recordRef('receiptEmails', id), {
      receiptId: id,
      orderId: sale.id,
      customerId: receipt.customerId,
      to: receipt.recipientEmail,
      status: 'Queued',
      createdAt: payment.date,
      message: {
        subject: `JBC RigWorks receipt ${id}`,
        text: rows.join('\n'),
        html: `<h1>Transaction receipt</h1>${rows.map((row) => `<p>${escapeHtml(row)}</p>`).join('')}`,
      },
    })
  }
  return id
}
