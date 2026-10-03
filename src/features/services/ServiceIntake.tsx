import { Save } from 'lucide-react'
import type { FormEvent } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { RecordFields, type RecordField } from '../../components/ui/RecordFields'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { formAmount, formText } from '../../lib/forms'
import { useShopSettings } from '../../lib/preferences'
import type { Job } from '../../types'
import { saveServiceJob } from './serviceOperations'
import { WalkInServiceIntake } from './WalkInServiceIntake'

const fields: RecordField[] = [
  { name: 'customer', label: 'Customer name' },
  { name: 'device', label: 'Device / model' },
  { name: 'service', label: 'Service requested', list: 'intake-services' },
  { name: 'due', label: 'Target date', type: 'date' },
  { name: 'quote', label: 'Service estimate before tax (PHP)', type: 'number', optional: true },
  { name: 'contact', label: 'Phone / contact', optional: true },
  { name: 'concern', label: 'Reported concern', optional: true },
  { name: 'intakeNotes', label: 'Device condition / intake notes', optional: true },
  { name: 'accessories', label: 'Accessories received', optional: true },
]

export function ServiceIntake({ job, onClose }: { job?: Job; onClose: () => void }) {
  return job ? <EditServiceJob job={job} onClose={onClose} /> : <WalkInServiceIntake onClose={onClose} />
}

function EditServiceJob({ job, onClose }: { job: Job; onClose: () => void }) {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [shop] = useShopSettings()
  const { busy, error, run } = useAsyncAction()
  const walkIn = job.channel === 'Walk-in'
  const editableFields = walkIn
    ? fields.filter((field) => ['due', 'quote'].includes(field.name)).map((field) =>
        field.name === 'quote'
          ? { ...field, label: 'Approved service total before tax (PHP)' }
          : field,
      )
    : fields
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      if (!user) throw new Error('Sign in to save this service.')
      const record: Job = walkIn
        ? {
            ...job,
            due: formText(form, 'due'),
            quote: formAmount(form, 'quote', true),
          }
        : {
            ...job,
            customer: formText(form, 'customer'),
            device: formText(form, 'device'),
            service: formText(form, 'service'),
            due: formText(form, 'due'),
            quote: formAmount(form, 'quote', true),
            contact: formText(form, 'contact'),
            concern: formText(form, 'concern'),
            intakeNotes: formText(form, 'intakeNotes'),
            accessories: formText(form, 'accessories'),
            schemaVersion: 2,
          }
      if (
        !(await confirm({
          title: job ? 'Save changes?' : 'Save record?',
          message: 'Save this service intake?',
          confirmLabel: job ? 'Save changes' : 'Save record',
        }))
      )
        return
      await saveServiceJob(user, record)
      onClose()
    })
  }
  return (
    <Dialog
      title={walkIn ? 'Edit walk-in estimate' : 'Edit service job'}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" form="service-intake" disabled={busy}>
            <Save size={18} />
            {job ? 'Save changes' : 'Save record'}
          </button>
        </>
      }
    >
      <form id="service-intake" className="portal-form entry-form" onSubmit={submit}>
        {walkIn && <p className="storage-caption">The customer and device details are stored in the printable intake. The approved total below includes all selected additional work.</p>}
        {walkIn && !!job.selectedCharges?.length && (
          <p className="storage-caption">
            Selected additional work: {job.selectedCharges.map((charge) => `${charge.name} (${formatPHP(charge.price)})`).join(', ')}.
          </p>
        )}
        <fieldset disabled={busy} className="record-fields">
          <RecordFields
            fields={editableFields}
            values={
              job
                ? Object.fromEntries(
                    editableFields.map((field) => [field.name, String(job[field.name as keyof Job] ?? '')]),
                  )
                : { due: today() }
            }
          />
          <datalist id="intake-services">
            {shop.services
              .filter((service) => service.active)
              .map((service) => (
                <option key={service.id} value={service.name} />
              ))}
          </datalist>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="storage-caption">Changes are saved to your business records.</p>
      </form>
    </Dialog>
  )
}
