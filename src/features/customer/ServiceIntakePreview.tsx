import { Printer } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import type { CustomerAppointment } from '../../types'
import { ServiceIntakeDocument } from './ServiceIntakeDocument'

export function ServiceIntakePreview({
  appointment,
  onClose,
  onPrint,
}: {
  appointment: CustomerAppointment
  onClose: () => void
  onPrint: () => void
}) {
  return (
    <Dialog title="Intake & service authorization" wide onClose={onClose}>
      <div className="home-intake-review-dialog">
        <div className="home-intake-review-actions">
          <p>
            Review your submitted intake. JBC will confirm the condition and collect signatures
            before service.
          </p>
          <button type="button" className="primary-button" onClick={onPrint}>
            <Printer size={17} /> Print form
          </button>
        </div>
        <ServiceIntakeDocument appointment={appointment} />
      </div>
    </Dialog>
  )
}
