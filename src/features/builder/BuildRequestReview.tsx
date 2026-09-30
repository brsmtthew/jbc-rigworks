import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { useWorkspace } from '../../hooks/useWorkspace'
import { formatPHP } from '../../lib/format'
import { shortReference } from '../../lib/reference'
import { availableStock } from '../../lib/workflow'
import type { CustomPcRequest } from '../../types'
import { RecordStatus } from '../customer/RecordStatus'
import { reviewBuild } from './buildReview'

export function BuildRequestReview({
  request,
  onClose,
  onQuote,
}: {
  request: CustomPcRequest
  onClose: () => void
  onQuote: () => void
}) {
  const { inventory } = useWorkspace()
  const review = reviewBuild(request, inventory)
  const Icon =
    review.status === 'Compatible'
      ? CircleCheck
      : review.status === 'Incompatible'
        ? CircleX
        : review.status === 'Not yet checked'
          ? CircleHelp
          : TriangleAlert
  return (
    <Dialog
      title="Review PC build"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
          {['Under review', 'Quoted'].includes(request.status) && (
            <button className="primary-button" disabled={!!review.errors.length || !!review.unavailable.length || !review.rows.length} onClick={onQuote}>
              Prepare final quote
            </button>
          )}
        </>
      }
    >
      <div className="portal-form settings-fields admin-build-review">
        <div className="admin-build-review-heading">
          <div>
            <span className="eyebrow">COMPATIBILITY REVIEW</span>
            <h3>{request.useCase} PC build</h3>
            <p title={request.id}>{request.customerName || 'Customer'} · {shortReference(request.id)}</p>
          </div>
          <RecordStatus status={request.status} />
        </div>
        {request.notes && <p className="admin-build-review-notes">Customer brief: {request.notes}</p>}
        <div className="build-intelligence">
          <div>
            <strong>
              <Icon size={18} aria-hidden="true" /> {review.status}
            </strong>
            <small>Specifications are checked again before reservation.</small>
          </div>
          <div>
            <small>Estimated system power</small>
            <strong>~{review.wattage} W</strong>
          </div>
          <div>
            <small>Current JBC parts subtotal</small>
            <strong>{formatPHP(review.subtotal)}</strong>
          </div>
        </div>
        {!review.rows.length && (
          <p>
            No structured parts were saved with this older request. Review its notes and ask the
            customer to submit component selections before reservation.
          </p>
        )}
        <div className="admin-build-review-parts-heading">
          <h4>Submitted components</h4>
          <span>{review.rows.length} listed</span>
        </div>
        {review.rows.map((row, index) => (
          <section className="form-section admin-build-review-part" key={`${row.part.component}-${index}`}>
            <h3>
              {row.part.component}: {row.item?.name || row.part.model}
            </h3>
            <p>{row.owned ? 'Customer owned' : 'JBC inventory'}</p>
            <p>{row.item?.specs || row.part.specs || 'Specifications need review'}</p>
            {row.item && (
              <p>
                {[
                  row.item.socket,
                  row.item.memoryType,
                  row.item.formFactor,
                  row.item.storageInterface,
                ]
                  .filter(Boolean)
                  .join(' / ')}
              </p>
            )}
            {!row.owned && (
              <p>
                {row.item
                  ? `${formatPHP(row.item.price)} / ${availableStock(row.item)} available${request.reservationState === 'Reserved' ? ' / 1 reserved for this build' : ''}`
                  : 'Product no longer available'}
                {row.part.price !== undefined && row.item?.price !== row.part.price
                  ? ` / Submitted price ${formatPHP(row.part.price)}`
                  : ''}
              </p>
            )}
            {!row.available && (
              <p className="form-error">
                <TriangleAlert size={16} aria-hidden="true" /> Review this component's availability
                or inventory category.
              </p>
            )}
          </section>
        ))}
        {review.missing.length > 0 && (
          <p>
            <strong>Missing components:</strong>{' '}
            {review.missing.map((component) => component.name).join(', ')}
          </p>
        )}
        {review.errors.map((error) => (
          <p className="form-error" key={error}>
            <CircleX size={16} aria-hidden="true" /> {error}
          </p>
        ))}
        {review.unknown.map((check) => (
          <p key={check}>
            <TriangleAlert size={16} aria-hidden="true" /> {check}: specifications need review.
          </p>
        ))}
        <div className="admin-build-review-total">
          <div><span>Customer budget</span><strong>{request.budget || 'Not specified'}</strong></div>
          <div><span>Final quote</span><strong>{request.quote ? formatPHP(request.quote.amount) : 'Pending review'}</strong></div>
          {request.quote?.message && <p>{request.quote.message}</p>}
        </div>
        {request.approvedAt && <p className="admin-build-review-approval">Quote approved by {request.approvedBy === request.customerId ? 'the customer online' : 'the workshop'} on {new Date(request.approvedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}.</p>}
      </div>
    </Dialog>
  )
}
