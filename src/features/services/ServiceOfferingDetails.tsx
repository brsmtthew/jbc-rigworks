import { Clock3, House, MapPin } from 'lucide-react'
import { formatPHP } from '../../lib/format'
import type { ServiceOffering } from '../../types'

export function ServiceOfferingDetails({ service }: { service: ServiceOffering }) {
  return (
    <div className="service-offering-details">
      {service.image && (
        <img className="service-offering-details-image" src={service.image} alt={service.name} />
      )}
      <div className="service-offering-details-meta">
        <span>{service.deviceType}</span>
        <span><Clock3 size={15} /> {service.durationMinutes} min</span>
        {service.workshop && <span><MapPin size={15} /> Workshop</span>}
        {service.home && <span><House size={15} /> Home service</span>}
      </div>
      <p>{service.description || 'No description provided.'}</p>
      <dl>
        <div>
          <dt>Service estimate</dt>
          <dd>{service.price === '' ? 'Quote after review' : formatPHP(Number(service.price))}</dd>
        </div>
        {service.inclusions && (
          <div>
            <dt>Package inclusions</dt>
            <dd>{service.inclusions}</dd>
          </div>
        )}
        {!!service.additionalCharges?.length && (
          <div>
            <dt>Optional additional charges</dt>
            <dd>
              <ul>
                {service.additionalCharges.map((charge) => (
                  <li key={charge.id}>
                    <span>{charge.name}</span>
                    <strong>{formatPHP(Number(charge.price))}</strong>
                  </li>
                ))}
              </ul>
              <small>Additional work and charges require customer approval.</small>
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
