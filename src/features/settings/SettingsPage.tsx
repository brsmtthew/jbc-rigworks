import { Dialog } from '../../components/ui/Dialog'
import { useState, type FormEvent } from 'react'
import { Pencil, ArrowRight, BrushCleaning, Building2, Save, Settings2, ShieldCheck, Truck, UserRound } from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { PageHeader } from '../../components/ui/PageHeader'
import { tiers } from '../../lib/pc'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { PaymentAccountsEditor } from './PaymentAccountsEditor'

export function SettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { user, updateProfile } = useAuth()
  const { confirm } = useConfirmation()
  const [shop, saveShop, shopStatus] = useShopSettings()
  const [account, saveAccount, accountStatus] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [business, setBusiness] = useState(shop)
  const [profile, setProfile] = useState({ ...account, name: account.name || user!.name, contactEmail: account.contactEmail || user!.email })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<number | null>(null)
  const admin = user?.role === 'admin'
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!profile.name.trim()) { setError('Enter your display name.'); return }
    const confirmed = await confirm({ title: 'Save changes?', message: `Save your changes to ${areas[section ?? 0].title.toLowerCase()}?`, confirmLabel: 'Save changes' })
    if (!confirmed) return
    try {
      if (admin && section !== 0 && section !== 1) {
        if (!business.name.trim() || !/^[A-Za-z0-9-]{1,12}$/.test(business.prefix)) throw new Error('Enter a business name and an invoice prefix of up to 12 letters, numbers, or hyphens.')
        const prices = Object.values(business.cleaning).flatMap(value => Object.values(value)).filter(value => value !== '')
        if ([business.taxRate, business.labor, business.delivery, ...prices.map(Number), ...[business.homeSurcharge, business.transportBase, business.transportPerKm, business.warrantyMonths].filter(value => value !== '').map(Number)].some(value => !Number.isFinite(value) || value < 0) || business.taxRate > 100) throw new Error('Enter valid prices, charges, and a tax rate between 0 and 100.')
        if (business.warrantyMonths !== '' && (!Number.isSafeInteger(Number(business.warrantyMonths)) || Number(business.warrantyMonths) > 120)) throw new Error('Warranty must be a whole number from 0 to 120 months.')
        await saveShop(business)
      }
      if (section === 0 || section === 1) {
        await updateProfile(profile.name.trim())
        await saveAccount({ ...profile, name: profile.name.trim() })
      }
      setSection(null)
      setMessage('Settings saved.')
    } catch (err) { setError((err as Error).message || 'Unable to save settings. Check your connection.') }
  }
  const areas = [
    { title: 'Profile & contact', description: 'Photo, name, email, phone, and address', icon: UserRound },
    { title: 'Display & account access', description: 'Comfortable density and motion preferences', icon: Settings2 },
    { title: 'Business & invoices', description: 'Business details, billing, and tax defaults', icon: Building2 },
    { title: 'Home service, delivery & warranty', description: 'Distance fees and purchase coverage', icon: Truck },
    { title: 'Deep-clean price catalog', description: 'Desktop and laptop service prices', icon: BrushCleaning },
    { title: 'Company payment QRs', description: 'Bank and e-wallet accounts for verified manual payments', icon: Building2 },
  ]
  function open(index: number) { setBusiness(shop); setProfile({ ...account, name: account.name || user!.name, contactEmail: account.contactEmail || user!.email }); setError(''); setMessage(''); setSection(index) }
  function choosePhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 500000) { setError('Profile images must be 500 KB or smaller.'); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setProfile(current => ({ ...current, photo: reader.result as string })) }
    reader.onerror = () => setError('Unable to read this image. Choose another file.')
    reader.readAsDataURL(file)
  }
  const loadError = shopStatus.error || accountStatus.error
  if (loadError || shopStatus.loading || accountStatus.loading) return <p className={loadError ? 'form-error' : 'storage-caption'} role={loadError ? 'alert' : 'status'}>{loadError || 'Loading settings…'}</p>
  return <>
    {!embedded && <PageHeader eyebrow={admin ? 'WORKSPACE' : 'MY ACCOUNT'} title={admin ? 'Workspace settings' : 'My settings'} description="Your profile and preferences, with controls grouped by purpose." />}
    <section className="profile-card"><div className="profile-symbol">{account.photo ? <img src={account.photo} alt="" /> : <UserRound size={34} />}</div><div><span className="eyebrow">{admin ? 'ADMINISTRATOR' : 'USER'}</span><h2>{account.name || user?.name}</h2><p>{account.contactEmail || user?.email}</p><p>{account.phone || 'Add a contact number'}{account.address ? ' / ' + account.address : ''}</p></div><button type="button" className="secondary-button" onClick={() => open(0)} title="Edit profile" aria-label="Edit profile"><Pencil size={20}/><span>Edit profile</span></button></section>
    {message && <p role="status" className="save-message settings-feedback">{message}</p>}
    <div className="settings-menu">{areas.slice(0, admin ? areas.length : 2).map((area, index) => <button type="button" className="settings-tile" key={area.title} onClick={() => open(index)}><span className="service-icon"><area.icon size={24} /></span><span><strong>{area.title}</strong><small>{area.description}</small></span><ArrowRight size={20} /></button>)}</div>
    {section === 5 && <Dialog title="Company payment QRs" wide onClose={() => setSection(null)}><PaymentAccountsEditor /></Dialog>}
    {section !== null && section !== 5 && <Dialog title={areas[section].title} wide={section === 2 || section === 4} onClose={() => setSection(null)}><form id="workspace-settings" onSubmit={save}>
      {section === 0 && <div className="portal-form settings-fields">
        <div className="profile-photo-field"><span>Profile photo</span><div className="profile-photo-actions">{profile.photo ? <img className="profile-photo-preview" src={profile.photo} alt="Profile preview" /> : <span className="profile-photo-preview profile-photo-placeholder"><UserRound size={27}/></span>}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload a JPG, PNG, or WebP profile photo" onChange={e => choosePhoto(e.target.files?.[0])} />{profile.photo && <button type="button" className="secondary-button" onClick={() => setProfile({ ...profile, photo: '' })}>Remove photo</button>}</div><small className="storage-caption">JPG, PNG, or WebP, up to 500 KB.</small></div>
        <label>Display name<input required maxLength={80} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
        <label>Sign-in email<input value={user?.email} readOnly /><small className="storage-caption">Account identifier. Contact email below can be changed.</small></label>
        <label>Contact email<input type="email" value={profile.contactEmail} onChange={e => setProfile({ ...profile, contactEmail: e.target.value })} /></label>
        <label>Phone number<input type="tel" maxLength={30} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label>
        <label>Address<textarea rows={3} maxLength={400} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
      </div>}
      {section === 1 && <div className="portal-form settings-fields">
        <label className="check-row"><input type="checkbox" checked={profile.compact} onChange={e => setProfile({ ...profile, compact: e.target.checked })} /><span>Compact tables and cards</span></label>
        <label className="check-row"><input type="checkbox" checked={profile.reduceMotion} onChange={e => setProfile({ ...profile, reduceMotion: e.target.checked })} /><span>Reduce animations</span></label>
        <dl className="detail-list"><div><dt>Account role</dt><dd>{admin ? 'Administrator' : 'User'}</dd></div><div><dt>Currency</dt><dd>PHP</dd></div><div><dt>Timezone</dt><dd>Asia/Manila</dd></div><div><dt>Storage</dt><dd>Shared database</dd></div></dl>
        <p className="storage-caption"><ShieldCheck size={16} /> Your password and sign-in are managed by Firebase Authentication.</p>
      </div>}
      {section === 2 && <div className="portal-form settings-fields">
          {(['name', 'address', 'phone', 'email', 'prefix', 'footer'] as const).map(field => <label key={field}>{{ name: 'Business name', address: 'Business address', phone: 'Business phone', email: 'Business email', prefix: 'Invoice prefix', footer: 'Invoice footer' }[field]}<input required={field === 'name' || field === 'prefix'} type={field === 'email' ? 'email' : 'text'} maxLength={field === 'prefix' ? 12 : 250} value={business[field]} onChange={e => setBusiness({ ...business, [field]: e.target.value })} /></label>)}
          <div className="portal-form-grid">{(['taxRate', 'labor'] as const).map(field => <label key={field}>{{ taxRate: 'Default tax (%)', labor: 'Default labor (PHP)', delivery: 'Default delivery (PHP)' }[field]}<input type="number" min="0" max={field === 'taxRate' ? 100 : undefined} step="0.01" value={business[field]} onChange={e => setBusiness({ ...business, [field]: Number(e.target.value) })} /></label>)}</div>
          <p className="storage-caption">Tax is added after discounts to items and charges. Defaults apply to new transactions; saved invoices keep their original details.</p>
        </div>}
      {section === 3 && <div className="portal-form settings-fields">
          {(['homeSurcharge', 'transportBase', 'transportPerKm', 'warrantyMonths'] as const).map(field => <label key={field}>{{ homeSurcharge: 'Home-service surcharge (PHP)', transportBase: 'Transport base fee (PHP)', transportPerKm: 'Transport per kilometre (PHP)', warrantyMonths: 'Default item warranty (months)' }[field]}<input type="number" min="0" max={field === 'warrantyMonths' ? 120 : undefined} step={field === 'warrantyMonths' ? 1 : '0.01'} placeholder="Not configured" value={business[field]} onChange={e => setBusiness({ ...business, [field]: e.target.value })} /></label>)}
          <label>Default warranty terms<textarea rows={4} maxLength={2000} value={business.warrantyTerms} onChange={e => setBusiness({ ...business, warrantyTerms: e.target.value })} placeholder="Coverage, exclusions, and claim instructions" /></label>
          <p className="storage-caption">Transportation = base fee + one-way road distance in kilometres times rate. Selected shop bundles and complete PC sets always receive free item delivery. Home visits add the home-service surcharge and transportation. Blank rates require a quote; warranty details are copied to each purchased item.</p>
        </div>}
      {section === 4 && <div className="portal-form settings-fields">
          {(['Desktop', 'Laptop'] as const).map(device => <fieldset className="price-fieldset" key={device}><legend>{device}</legend>{tiers.map(tier => <label key={tier}>{device} {tier.toLowerCase()} specs (PHP)<input type="number" min="0" step="0.01" placeholder="Price not set" value={business.cleaning[device][tier]} onChange={e => setBusiness({ ...business, cleaning: { ...business.cleaning, [device]: { ...business.cleaning[device], [tier]: e.target.value } } })} /></label>)}</fieldset>)}
          <p className="storage-caption">Blank prices are unavailable at checkout. Prices are shared with the customer catalog across devices.</p>
        </div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setSection(null)}>Cancel</button><button className="primary-button" type="submit"><Save size={18} />Save changes</button></div>
    </form></Dialog>}
  </>
}
