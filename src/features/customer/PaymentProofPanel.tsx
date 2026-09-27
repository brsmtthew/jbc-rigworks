import { useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { humanError } from '../../lib/workflow'
import type { Sale } from '../../types'
import { accountAvailable, readPaymentImage, submitPaymentProof } from '../finance/payments'
import { usePaymentAccounts, usePaymentProofs } from '../finance/usePayments'

export function PaymentProofPanel({ order }: { order: Sale }) {
  const { user } = useAuth()
  const accounts = usePaymentAccounts(),
    proofs = usePaymentProofs(user)
  const [accountId, setAccountId] = useState(''),
    [reference, setReference] = useState(''),
    [image, setImage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (
    !user ||
    user.id !== order.customerId ||
    order.paid >= order.total ||
    ['Declined', 'Cancelled'].includes(order.orderStatus ?? '')
  )
    return null
  const available = accounts.rows.filter(
    (account) => accountAvailable(account) && account.customers !== false,
  )
  const account = available.find((value) => value.id === accountId)
  const proof = proofs.rows.find((value) => value.orderId === order.id)
  if (accounts.error || proofs.error)
    return (
      <p role="alert" className="form-error">
        {accounts.error || proofs.error}
      </p>
    )
  if (accounts.loading || proofs.loading) return <p role="status">Loading payment options…</p>
  if (proof?.status === 'Pending')
    return (
      <section className="payment-proof-panel">
        <h3>Payment pending verification</h3>
        <p>
          {proof.method} / {formatPHP(proof.amount)} / Reference {proof.reference}
        </p>
        <p>
          The workshop will verify the transfer before recording payment and issuing your receipt.
        </p>
      </section>
    )
  if (!available.length)
    return (
      <p className="storage-caption">
        Payment: cash at the store. Bank and e-wallet QR payments are not available yet.
      </p>
    )
  return (
    <section className="payment-proof-panel portal-form">
      <h3>Pay cash at pickup or submit a transfer for verification</h3>
      {proof?.status === 'Rejected' && (
        <p role="status">
          Previous proof rejected: {proof.reviewNote}. You can upload a corrected proof.
        </p>
      )}
      <label>
        Manual payment option
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Cash at the store</option>
          {available.map((value) => (
            <option key={value.id} value={value.id}>
              {value.kind} — {value.name}
            </option>
          ))}
        </select>
      </label>
      {account && (
        <>
          <p>
            <strong>{account.name}</strong>
            <br />
            {account.accountName}
            <br />
            {account.accountNumber}
          </p>
          <img
            className="payment-qr-image"
            src={account.qrImage}
            alt={`${account.name} payment QR`}
          />
          <p>
            Amount due: <strong>{formatPHP(order.total - order.paid)}</strong>. Transfer using your
            banking or e-wallet app, then upload the confirmation here.
          </p>
          <label>
            Transfer reference
            <input
              required
              maxLength={100}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <label>
            Payment proof image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  setImage(await readPaymentImage(file))
                  setError('')
                } catch (err) {
                  setError(humanError(err))
                }
              }}
            />
          </label>
          {image && <img className="payment-proof-image" src={image} alt="Payment proof preview" />}
          <button
            className="primary-button"
            disabled={busy || !image || !reference.trim()}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                await submitPaymentProof(user, order.id, account.id, reference, image)
                setImage('')
                setReference('')
              } catch (err) {
                setError(humanError(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Submitting…' : 'Submit proof for verification'}
          </button>
          <p className="storage-caption">
            An uploaded proof is reviewed by the workshop. A receipt becomes available after staff
            confirms the payment.
          </p>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
