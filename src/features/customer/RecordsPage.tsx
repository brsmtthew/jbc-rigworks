import { CalendarDays, Cpu, ReceiptText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { CustomerOrdersPage } from './CustomerOrdersPage'
import { CustomerRecordsPage } from './CustomerRecordsPage'

export function RecordsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'orders'
  return (
    <div className="customer-records">
      <header className="customer-records-hero">
        <span className="customer-records-kicker">TRACK YOUR ACTIVITY</span>
        <h1>Your records, all in one place.</h1>
        <p>Orders, receipts, service appointments, and custom PC requests in one place.</p>
      </header>
      <nav className="customer-records-tabs" aria-label="Record type">
        {[
          {
            id: 'orders',
            label: 'Purchases & warranties',
            detail: 'Orders and receipts',
            icon: ReceiptText,
          },
          {
            id: 'appointments',
            label: 'Appointments',
            detail: 'Service visits',
            icon: CalendarDays,
          },
          { id: 'requests', label: 'PC requests', detail: 'Builds and quotes', icon: Cpu },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setParams({ tab: item.id })}
          >
            <span className="customer-records-tab-icon">
              <item.icon size={19} />
            </span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </button>
        ))}
      </nav>
      <section className="customer-records-content" aria-live="polite">
        {tab === 'appointments' || tab === 'requests' ? (
          <CustomerRecordsPage key={tab} kind={tab} embedded />
        ) : (
          <CustomerOrdersPage embedded />
        )}
      </section>
    </div>
  )
}
