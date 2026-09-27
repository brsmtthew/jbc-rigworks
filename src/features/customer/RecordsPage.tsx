import { CalendarDays, Cpu, ReceiptText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { CustomerOrdersPage } from './CustomerOrdersPage'
import { CustomerRecordsPage } from './CustomerRecordsPage'

export function RecordsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'orders'
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT"
        title="My records"
        description="Purchases, warranties, appointments, and build requests in one place."
      />
      <div className="record-tabs" role="group" aria-label="Record type">
        {[
          { id: 'orders', label: 'Purchases & warranties', icon: ReceiptText },
          { id: 'appointments', label: 'Appointments', icon: CalendarDays },
          { id: 'requests', label: 'PC requests', icon: Cpu },
        ].map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'primary-button' : 'secondary-button'}
            aria-pressed={tab === item.id}
            onClick={() => setParams({ tab: item.id })}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'appointments' || tab === 'requests' ? (
        <CustomerRecordsPage key={tab} kind={tab} embedded />
      ) : (
        <CustomerOrdersPage embedded />
      )}
    </>
  )
}
