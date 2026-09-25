import { Link } from 'react-router-dom'
import { CalendarPlus, Cpu, Laptop, Monitor, BrushCleaning } from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import { useShopSettings } from '../../lib/preferences'
import { tiers } from '../../lib/pc'
import { formatPHP } from '../../data/appData'
import { PageHeader } from '../../components/ui/PageHeader'

export function ServicesPage() {
  const { user } = useAuth()
  const [shop] = useShopSettings()
  const base = user?.role === 'user' ? '/customer' : ''
  return <>
    <PageHeader eyebrow="SERVICE CATALOG" title={base ? "Services & booking" : "Deep-clean pricing"} description="Choose your device and spec tier to see its service price.">{base && <Link className="primary-button" to="/customer/book"><CalendarPlus size={16} />Book a service</Link>}<Link className="secondary-button" to={`${base}/pc-identifier`}><Cpu size={16} />Identify my PC</Link>{!base && <Link className="primary-button" to="/settings">Edit prices</Link>}</PageHeader>
    {(['Desktop', 'Laptop'] as const).map(device => <section className="service-section" key={device}>
      <h2>{device === 'Desktop' ? <Monitor size={23} /> : <Laptop size={23} />}{device} deep clean</h2>
      <div className="service-grid">{tiers.map(tier => {
        const price = shop.cleaning[device][tier]
        return <article className="service-price-card" key={tier}><span className="service-icon"><BrushCleaning size={24} /></span><h3>{tier}-spec {device.toLowerCase()}</h3><p>{{ Low: 'Basic and general-use setups.', Mid: 'Mainstream and everyday gaming setups.', High: 'Performance and workstation setups.' }[tier]}</p><strong>{price === '' ? 'Price not set' : formatPHP(Number(price))}</strong><Link className="secondary-button" to={base ? '/customer/book?device=' + device + '&tier=' + tier : price === '' ? `${base}/pc-identifier` : `${base}/${base ? 'shop' : 'pos'}?service=${encodeURIComponent(`clean:${device}:${tier}`)}`}>{base ? 'Book ' + tier.toLowerCase() + '-spec cleaning' : price === '' ? 'Check your spec tier' : 'Add to POS'}</Link></article>
      })}</div>
    </section>)}
    <p className="storage-caption">Catalog prices are service base prices. Any labor, delivery, discount, and tax are itemized before checkout.</p>
  </>
}
