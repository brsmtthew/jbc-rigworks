import { useState } from 'react'
import { setDoc } from 'firebase/firestore'
import { accountAvailable, blankPaymentAccounts, readPaymentImage, usePaymentAccounts } from '../../lib/payments'
import { firestoreData, recordRef } from '../../lib/database'
import type { PaymentAccount } from '../../types/business'

function AccountEditor({ account }: { account: PaymentAccount }) {
  const [draft, setDraft] = useState(account), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  async function save() {
    setError(''); setSaved(false)
    if (draft.enabled && !accountAvailable(draft)) { setError('Add the provider name, account holder, and company QR before enabling this payment option.'); return }
    setBusy(true)
    try { await setDoc(recordRef('paymentAccounts', draft.id), firestoreData({ ...draft, name: draft.name.trim(), accountName: draft.accountName.trim(), accountNumber: draft.accountNumber.trim() })); setSaved(true) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="payment-account-card portal-form">
    <h3>{account.kind === 'Bank transfer' ? 'Company bank QR' : 'Company e-wallet QR'}</h3>
    <label>Provider name<input maxLength={80} value={draft.name} onChange={event => { setSaved(false); setDraft({ ...draft, name: event.target.value }) }} /></label>
    <label>Account holder<input maxLength={100} value={draft.accountName} onChange={event => { setSaved(false); setDraft({ ...draft, accountName: event.target.value }) }} /></label>
    <label>Account number or mobile number<input maxLength={60} value={draft.accountNumber} onChange={event => { setSaved(false); setDraft({ ...draft, accountNumber: event.target.value }) }} /></label>
    <label>Company QR image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const qrImage = await readPaymentImage(file); setDraft(current => ({ ...current, qrImage })); setError(''); setSaved(false) } catch (err) { setError((err as Error).message) } }} /></label>
    {draft.qrImage ? <><img className="payment-qr-image" src={draft.qrImage} alt={`${account.kind} company QR`} /><button className="text-button" onClick={() => { setDraft({ ...draft, qrImage: '', enabled: false }); setSaved(false) }}>Remove QR</button></> : <div className="payment-qr-empty">No QR added</div>}
    <label className="check-row"><input type="checkbox" checked={draft.enabled} onChange={event => { setSaved(false); setDraft({ ...draft, enabled: event.target.checked }) }} /><span>Offer this manual payment option</span></label>
    <button className="primary-button" disabled={busy} onClick={save}>{busy ? 'Saving…' : `Save ${account.kind === 'Bank transfer' ? 'bank' : 'e-wallet'} QR`}</button>
    {error && <p role="alert" className="form-error">{error}</p>}{saved && <p role="status" className="save-message">Payment account saved.</p>}
  </section>
}

export function PaymentAccountsEditor() {
  const { rows, loading, error } = usePaymentAccounts()
  if (error || loading) return <p role={error ? 'alert' : 'status'}>{error || 'Loading payment accounts…'}</p>
  return <div className="settings-fields">
    <p>Cash is accepted at the store. These slots stay empty and unavailable to customers until you add and enable your company QRs. Staff must verify every transfer before recording payment.</p>
    <div className="payment-account-grid">{blankPaymentAccounts.map(blank => <AccountEditor key={blank.id} account={rows.find(account => account.id === blank.id) || blank} />)}</div>
  </div>
}
