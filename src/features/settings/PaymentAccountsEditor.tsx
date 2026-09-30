import { setDoc } from 'firebase/firestore'
import { CreditCard, Plus, Wallet } from 'lucide-react'
import { useRef, useState } from 'react'
import { LoadingState } from '../../components/ui/LoadingState'
import { firestoreData, recordRef } from '../../lib/database'
import type { PaymentAccount } from '../../types'
import { accountAvailable, blankPaymentAccounts, readPaymentImage } from '../finance/payments'
import { usePaymentAccounts } from '../finance/usePayments'

function AccountEditor({ account }: { account: PaymentAccount }) {
  const revision = useRef(0)
  const saving = useRef(false)
  const [draft, setDraft] = useState(account),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false)
  function updateDraft(patch: Partial<PaymentAccount>) {
    revision.current += 1
    setDraft((current) => ({ ...current, ...patch }))
    setSaved(false)
    setError('')
  }
  async function save() {
    if (saving.current) return
    setError('')
    setSaved(false)
    if (draft.enabled && !accountAvailable(draft)) {
      setError(
        'Add the provider name, account holder, and company QR before enabling this payment option.',
      )
      return
    }
    saving.current = true
    const savedRevision = revision.current
    setBusy(true)
    try {
      await setDoc(
        recordRef('paymentAccounts', draft.id),
        firestoreData({
          ...draft,
          name: draft.name.trim(),
          accountName: draft.accountName.trim(),
          accountNumber: draft.accountNumber.trim(),
        }),
      )
      if (revision.current === savedRevision) setSaved(true)
    } catch (err) {
      if (revision.current === savedRevision) setError((err as Error).message)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <section className="payment-account-card portal-form">
      <div className="payment-account-card-heading">
        <span aria-hidden="true">{draft.kind === 'Bank transfer' ? <CreditCard size={20} /> : <Wallet size={20} />}</span>
        <div><h3>{draft.kind === 'Bank transfer' ? 'Company bank QR' : 'Company e-wallet QR'}</h3><small>{draft.name || 'Add provider details'}</small></div>
        <em className={draft.enabled ? 'is-active' : ''}>{draft.enabled ? 'Enabled' : 'Disabled'}</em>
      </div>
      <div className="payment-account-fields">
      <label>
        Type
        <select
          value={draft.kind}
          onChange={(e) => updateDraft({ kind: e.target.value as PaymentAccount['kind'] })}
        >
          <option>Bank transfer</option>
          <option>E-wallet</option>
        </select>
      </label>
      <label>
        Provider name
        <input
          maxLength={80}
          value={draft.name}
          onChange={(event) => updateDraft({ name: event.target.value })}
        />
      </label>
      <label>
        Account holder
        <input
          maxLength={100}
          value={draft.accountName}
          onChange={(event) => updateDraft({ accountName: event.target.value })}
        />
      </label>
      <label>
        Account number or mobile number
        <input
          maxLength={60}
          value={draft.accountNumber}
          onChange={(event) => updateDraft({ accountNumber: event.target.value })}
        />
      </label>
      </div>
      <div className="payment-account-qr-panel">
      <label>
        Company QR image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              const qrImage = await readPaymentImage(file)
              updateDraft({ qrImage })
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
      </label>
      {draft.qrImage ? (
        <>
          <img
            className="payment-qr-image"
            src={draft.qrImage}
            alt={`${draft.kind} company QR`}
          />
          <button
            className="text-button"
            onClick={() => updateDraft({ qrImage: '', enabled: false })}
          >
            Remove QR
          </button>
        </>
      ) : (
        <div className="payment-qr-empty">No QR added</div>
      )}
      </div>
      <div className="payment-account-options">
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => updateDraft({ enabled: event.target.checked })}
        />
        <span>Offer this manual payment option</span>
      </label>
      <label>
        Payment instructions
        <textarea
          value={draft.instructions ?? ''}
          maxLength={1000}
          onChange={(e) => updateDraft({ instructions: e.target.value })}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.customers !== false}
          onChange={(e) => updateDraft({ customers: e.target.checked })}
        />
        Available to customers
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.pos !== false}
          onChange={(e) => updateDraft({ pos: e.target.checked })}
        />
        Available in POS
      </label>
      </div>
      <button className="primary-button" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : `Save ${draft.kind === 'Bank transfer' ? 'bank' : 'e-wallet'} QR`}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="save-message">
          Payment account saved.
        </p>
      )}
    </section>
  )
}

export function PaymentAccountsEditor() {
  const { rows, loading, error } = usePaymentAccounts()
  const [newAccounts, setNewAccounts] = useState<PaymentAccount[]>([])
  if (error) return <p role="alert" className="form-error">{error}</p>
  if (loading) return <LoadingState variant="compact" label="Loading payment accounts…" />
  return (
    <div className="settings-fields admin-payment-settings">
      <div className="admin-settings-modal-intro">
        <span className="admin-settings-modal-icon" aria-hidden="true"><CreditCard size={22} /></span>
        <div><span className="eyebrow">PAYMENT CHANNELS</span><h3>Company payment accounts</h3><p>Set up verified bank and e-wallet QR payments for customers and POS.</p></div>
      </div>
      <div className="admin-payment-toolbar">
        <p>Cash is accepted at the store. A QR option appears only when its account details and image are complete and enabled.</p>
        <button
        type="button"
        className="secondary-button"
        onClick={() =>
          setNewAccounts([
            ...newAccounts,
            {
              id: crypto.randomUUID(),
              kind: 'E-wallet',
              name: '',
              accountName: '',
              accountNumber: '',
              qrImage: '',
              enabled: false,
            },
          ])
        }
      >
        <Plus size={16} /> Add account
        </button>
      </div>
      <div className="payment-account-grid">
        {[
          ...blankPaymentAccounts,
          ...rows.filter((row) => !blankPaymentAccounts.some((blank) => blank.id === row.id)),
          ...newAccounts.filter((row) => !rows.some((saved) => saved.id === row.id)),
        ].map((blank) => (
          <AccountEditor
            key={blank.id}
            account={rows.find((account) => account.id === blank.id) || blank}
          />
        ))}
      </div>
    </div>
  )
}
