import { ArrowRight, Building2, CalendarDays, ClipboardList, CreditCard, Save, Settings2, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import { PaymentAccountsEditor } from './PaymentAccountsEditor'
import { ReferenceDataSettings } from './ReferenceDataSettings'
import { ServiceSettings } from './ServiceSettings'

type WebsiteSection = 'business' | 'delivery' | 'catalog' | 'payments' | 'booking' | 'reference'

const areas = [
  {
    id: 'business',
    title: 'Business & invoices',
    description: 'Shop identity, contact details, and the information shown on invoices.',
    icon: Building2,
  },
  {
    id: 'payments',
    title: 'Company payment QRs',
    description: 'Bank and e-wallet accounts used for verified manual payments.',
    icon: CreditCard,
  },
  {
    id: 'delivery',
    title: 'Home service, delivery & warranty',
    description: 'Visit charges, delivery fees, and default coverage terms.',
    icon: Truck,
  },
  {
    id: 'reference',
    title: 'Reference data & taxes',
    description: 'Product, finance, compatibility, and tax defaults.',
    icon: Settings2,
  },
] as const

export function SettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { confirm } = useConfirmation()
  const [shop, saveShop, shopStatus] = useShopSettings()
  const [business, setBusiness] = useState(shop)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const [section, setSection] = useState<WebsiteSection | null>(
    params.get('section') === 'reference' ? 'reference' : null,
  )

  function open(next: WebsiteSection) {
    setBusiness(shop)
    setError('')
    setMessage('')
    setSection(next)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (section !== 'business' && section !== 'delivery') return
    setError('')
    setMessage('')
    const title = areas.find((area) => area.id === section)?.title ?? 'website settings'
    if (
      !(await confirm({
        title: 'Save changes?',
        message: `Save your changes to ${title.toLowerCase()}?`,
        confirmLabel: 'Save changes',
      }))
    )
      return
    try {
      if (!business.name.trim() || !/^[A-Za-z0-9-]{1,12}$/.test(business.prefix))
        throw new Error(
          'Enter a business name and an invoice prefix of up to 12 letters, numbers, or hyphens.',
        )
      const prices = Object.values(business.cleaning)
        .flatMap((value) => Object.values(value))
        .filter((value) => value !== '')
      if (
        [
          business.taxRate,
          business.labor,
          business.delivery,
          ...prices.map(Number),
          ...[
            business.homeSurcharge,
            business.transportBase,
            business.transportPerKm,
            business.warrantyMonths,
          ]
            .filter((value) => value !== '')
            .map(Number),
        ].some((value) => !Number.isFinite(value) || value < 0) ||
        business.taxRate > 100
      )
        throw new Error('Enter valid prices, charges, and a tax rate between 0 and 100.')
      if (
        business.warrantyMonths !== '' &&
        (!Number.isSafeInteger(Number(business.warrantyMonths)) ||
          Number(business.warrantyMonths) > 120)
      )
        throw new Error('Warranty must be a whole number from 0 to 120 months.')
      await saveShop(business)
      setSection(null)
      setMessage('Website settings saved.')
    } catch (err) {
      setError(humanError(err))
    }
  }

  if (shopStatus.error) return <p className="form-error" role="alert">{shopStatus.error}</p>
  if (shopStatus.loading) return <LoadingState label="Loading website settings…" />

  return (
    <div className="admin-site-settings">
      {!embedded && (
        <section className="admin-settings-hero jbc-blue-hero" aria-labelledby="admin-settings-title">
          <div className="admin-settings-hero-copy">
            <span className="admin-settings-kicker">WEBSITE CONFIGURATION</span>
            <h1 id="admin-settings-title">Settings</h1>
            <p>Set up the services, bookings, payments, and business details used across your website.</p>
          </div>
          <div className="admin-settings-hero-actions admin-hero-tool-panel" role="group" aria-label="Website settings actions">
            <span className="admin-settings-hero-actions-label">CUSTOMER EXPERIENCE</span>
            <strong>Manage the services customers can book</strong>
            <div>
              <button type="button" className="primary-button" onClick={() => open('catalog')}>
                <ClipboardList size={16} /> Service catalog
              </button>
              <button type="button" className="secondary-button" onClick={() => open('booking')}>
                <CalendarDays size={16} /> Booking & scheduling
              </button>
            </div>
          </div>
        </section>
      )}
      {message && (
        <p role="status" className="save-message settings-feedback">
          {message}
        </p>
      )}
      <section className="admin-site-settings-section" aria-labelledby="admin-site-settings-section-title">
        <div className="admin-site-settings-intro">
          <span className="eyebrow">BUSINESS &amp; SYSTEM</span>
          <h2 id="admin-site-settings-section-title">Website configuration</h2>
          <p>Manage the details that appear in checkout, service requests, and business records.</p>
        </div>
        <div className="admin-site-settings-grid">
          {areas.map((area, index) => (
            <button
              type="button"
              className="admin-site-settings-tile"
              key={area.id}
              onClick={() => open(area.id)}
            >
              <span className="admin-site-settings-tile-number" aria-hidden="true">0{index + 1}</span>
              <span className="admin-site-settings-tile-icon"><area.icon size={21} /></span>
              <span className="admin-site-settings-tile-copy">
                <strong>{area.title}</strong>
                <small>{area.description}</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {section === 'catalog' && (
        <Dialog title="Service catalog" wide onClose={() => setSection(null)}>
          <ServiceSettings />
        </Dialog>
      )}
      {section === 'booking' && (
        <Dialog title="Booking & scheduling" wide onClose={() => setSection(null)}>
          <ServiceSettings scheduling />
        </Dialog>
      )}
      {section === 'reference' && (
        <Dialog title="Reference data & taxes" wide onClose={() => setSection(null)}>
          <div className="admin-settings-modal-content"><ReferenceDataSettings embedded /></div>
        </Dialog>
      )}
      {section === 'payments' && (
        <Dialog title="Company payment QRs" wide onClose={() => setSection(null)}>
          <div className="admin-settings-modal-content"><PaymentAccountsEditor /></div>
        </Dialog>
      )}
      {(section === 'business' || section === 'delivery') && (
        <Dialog
          title={areas.find((area) => area.id === section)?.title ?? 'Website settings'}
          wide={section === 'business'}
          onClose={() => setSection(null)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setSection(null)}>
                Cancel
              </button>
              <button className="primary-button" type="submit" form="website-settings-form">
                <Save size={18} /> Save changes
              </button>
            </>
          }
        >
          <form id="website-settings-form" className="admin-site-settings-form" onSubmit={save}>
            <div className="admin-settings-modal-intro">
              <span className="admin-settings-modal-icon" aria-hidden="true">{section === 'business' ? <Building2 size={22} /> : <Truck size={22} />}</span>
              <div>
                <span className="eyebrow">WEBSITE DETAILS</span>
                <h3>{section === 'business' ? 'Business identity & invoice details' : 'Service charges & coverage'}</h3>
                <p>{section === 'business' ? 'These details appear on business records and customer invoices.' : 'Set the charges used for visits and delivery, then define default warranty terms.'}</p>
              </div>
            </div>
            {section === 'business' && (
              <div className="portal-form settings-fields business-settings-fields admin-settings-form-panel">
                {(['name', 'address', 'phone', 'email', 'prefix', 'footer'] as const).map((field) => (
                  <label key={field}>
                    {{
                      name: 'Business name',
                      address: 'Business address',
                      phone: 'Business phone',
                      email: 'Business email',
                      prefix: 'Invoice prefix',
                      footer: 'Invoice footer',
                    }[field]}
                    <input
                      required={field === 'name' || field === 'prefix'}
                      type={field === 'email' ? 'email' : 'text'}
                      maxLength={field === 'prefix' ? 12 : 250}
                      value={business[field]}
                      onChange={(e) => setBusiness({ ...business, [field]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
            {section === 'delivery' && (
              <div className="portal-form settings-fields admin-settings-form-panel">
                <div className="admin-settings-panel-heading"><strong>Visit & delivery charges</strong><small>Blank home service rates require a quote.</small></div>
                <label>
                  Standard product delivery fee (PHP)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={business.delivery}
                    onChange={(e) => setBusiness({ ...business, delivery: Number(e.target.value) })}
                  />
                </label>
                {(['homeSurcharge', 'transportBase', 'transportPerKm'] as const).map((field) => (
                  <label key={field}>
                    {{
                      homeSurcharge: 'Home-service surcharge (PHP)',
                      transportBase: 'Transport base fee (PHP)',
                      transportPerKm: 'Transport per kilometre (PHP)',
                    }[field]}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Not configured"
                      value={business[field]}
                      onChange={(e) => setBusiness({ ...business, [field]: e.target.value })}
                    />
                  </label>
                ))}
                <div className="admin-settings-panel-heading"><strong>Warranty coverage</strong><small>Applied to new purchased items.</small></div>
                <label>
                  Default item warranty (months)
                  <input type="number" min="0" max="120" step="1" placeholder="Not configured" value={business.warrantyMonths} onChange={(event) => setBusiness({ ...business, warrantyMonths: event.target.value })} />
                </label>
                <label>
                  Default warranty terms
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={business.warrantyTerms}
                    onChange={(e) => setBusiness({ ...business, warrantyTerms: e.target.value })}
                    placeholder="Coverage, exclusions, and claim instructions"
                  />
                </label>
                <p className="admin-settings-help">
                  Product orders use the standard delivery fee; bundles receive free delivery only
                  when enabled in Inventory. Home visits add the home-service surcharge and
                  transportation (base fee plus distance times rate). Blank home-service rates
                  require a quote. Warranty details are copied to each purchased item.
                </p>
              </div>
            )}
            {error && <p role="alert" className="form-error">{error}</p>}
          </form>
        </Dialog>
      )}
    </div>
  )
}
