import { Printer } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import type { Job } from '../../types'
import { ServiceIntakeDocument, ServiceIntakePrintRoot } from '../customer/ServiceIntakeDocument'
import { recordSignedWalkInIntake } from './serviceOperations'
import { walkInDocumentAppointment } from './walkInDocument'

export function WalkInIntakeReview({ job, onClose }: { job: Job; onClose: () => void }) {
  const { user } = useAuth()
  const [reviewed, setReviewed] = useState(false)
  const { busy, error, run } = useAsyncAction()
  const appointment = walkInDocumentAppointment(job)
  return (
    <>
      <Dialog
        title="Walk-in intake & service authorization"
        wide
        onClose={() => {
          if (!busy) onClose()
        }}
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => window.print()}>
              <Printer size={16} /> Print form
            </button>
            {!job.intakeSignedAt && (
              <button
                type="button"
                className="primary-button"
                disabled={busy || !reviewed}
                onClick={() => void run(async () => {
                  if (!user) throw new Error('Sign in to record the signed intake.')
                  await recordSignedWalkInIntake(user, job.id)
                  onClose()
                })}
              >
                Record signed form collected
              </button>
            )}
          </>
        }
      >
        <div className="walkin-review-dialog">
          <p className="walkin-signature-guidance">
            Review the device condition with the customer and collect both paper signatures before starting service.
          </p>
          <ServiceIntakeDocument appointment={appointment} walkIn />
          {job.intakeSignedAt ? (
            <p className="save-message">Signed paper intake recorded.</p>
          ) : (
            <label className="check-row walkin-signature-check">
              <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
              I reviewed the completed paper form and collected the customer and JBC signatures.
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </Dialog>
      <ServiceIntakePrintRoot appointment={appointment} walkIn />
    </>
  )
}
