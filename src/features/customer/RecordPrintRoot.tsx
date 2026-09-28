import { createPortal } from 'react-dom'
import { formatPHP } from '../../lib/format'
import type { CustomerAppointment, CustomPcRequest } from '../../types'

export function RecordPrintRoot({ record }: { record: CustomerAppointment | CustomPcRequest }) {
  const appointment = 'service' in record
  return createPortal(
    <div className="customer-record-print-root">
      <article className="customer-record-print-document">
        <header>
          <small>JBC RIGWORKS · CUSTOMER RECORD</small>
          <h1>{appointment ? record.service : `${record.useCase} PC request`}</h1>
          <p>Reference {record.id}</p>
        </header>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{record.status}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              {new Date(record.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
            </dd>
          </div>
          {appointment ? (
            <>
              <div>
                <dt>Device</dt>
                <dd>{record.device}</dd>
              </div>
              <div>
                <dt>Preferred schedule</dt>
                <dd>
                  {record.preferredDate} · {record.preferredTime}
                </dd>
              </div>
              <div>
                <dt>Visit</dt>
                <dd>{record.visit?.mode || 'Workshop'}</dd>
              </div>
              {record.reviewedEstimate !== undefined && (
                <div>
                  <dt>Reviewed estimate</dt>
                  <dd>{formatPHP(record.reviewedEstimate)}</dd>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <dt>Target budget</dt>
                <dd>{record.budget || 'Not specified'}</dd>
              </div>
              {record.quote && (
                <div>
                  <dt>Workshop quote</dt>
                  <dd>{formatPHP(record.quote.amount)}</dd>
                </div>
              )}
            </>
          )}
          <div>
            <dt>Notes</dt>
            <dd>{record.notes || 'None provided'}</dd>
          </div>
        </dl>
        {!appointment && record.parts?.length ? (
          <section>
            <h2>Selected components</h2>
            <ul>
              {record.parts.map((part) => (
                <li key={part.component}>
                  <strong>{part.component}</strong> —{' '}
                  {[part.brand, part.model].filter(Boolean).join(' / ')} ({part.source})
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <footer>Generated from your JBC RigWorks account.</footer>
      </article>
    </div>,
    document.body,
  )
}
