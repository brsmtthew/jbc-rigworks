import { MetricCard } from '../../components/ui/MetricCard'
import { useWorkspace } from '../../lib/workspaceStorage'
import { formatPHP } from '../../data/appData'
import { CalendarPlus, Cpu, ClipboardList, ShoppingCart, Coins } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../../lib/auth-context'
import { getAppointments, getPcRequests } from '../../lib/customerStorage'

export function CustomerHomePage() {
  const { user } = useAuth()
  const { sales } = useWorkspace()
  if (!user) return null
  const appointments = getAppointments(user)
  const requests = getPcRequests(user)
  return <>
    <PageHeader eyebrow="YOUR CUSTOMER PORTAL" title="Dashboard" description="Book care for your device or start planning your next build." />
    <div className="metric-grid"><MetricCard label="Appointments" value={String(appointments.length)} note="All service requests" icon={CalendarPlus} /><MetricCard label="PC requests" value={String(requests.length)} note="Saved build requests" icon={Cpu} /><MetricCard label="Orders" value={String(sales.length)} note="Your purchase history" icon={ShoppingCart} /><MetricCard label="Order total" value={formatPHP(sales.reduce((sum, sale) => sum + sale.total, 0))} note="Across all your orders" icon={Coins} dark /></div>
    <div className="overview-grid customer-overview-grid">
      <Panel title="Your appointments" subtitle="Keep track of requests and confirmed visits">
        {!appointments.length ? <div className="customer-empty"><ClipboardList size={25} /><h3>No appointments yet</h3><p>Your confirmed and requested bookings will appear here.</p></div> : <div className="customer-record-list">{appointments.slice(0, 3).map(item => <div key={item.id}><span><strong>{item.service}</strong><small>{item.preferredDate} · {item.preferredTime}</small></span><em>{item.status}</em></div>)}</div>}
      </Panel>
      <Panel title="Custom PC requests" subtitle="Build ideas under review">
        {!requests.length ? <div className="customer-empty"><Cpu size={25} /><h3>No build requests yet</h3><p>We’ll review your requirements and prepare a quote.</p></div> : <div className="customer-record-list">{requests.slice(0, 3).map(item => <div key={item.id}><span><strong>{item.useCase} PC</strong><small>{item.budget || 'Budget not set'}</small></span><em>{item.status}</em></div>)}</div>}
      </Panel>
    </div>
  </>
}
