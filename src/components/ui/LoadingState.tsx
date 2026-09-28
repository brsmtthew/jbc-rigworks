import { Cpu } from 'lucide-react'

type LoadingVariant = 'cards' | 'table' | 'compact' | 'screen'

export function LoadingState({
  label = 'Preparing your workspace…',
  variant = 'cards',
}: {
  label?: string
  variant?: LoadingVariant
}) {
  const screen = variant === 'screen'
  return (
    <section
      className={`loading-state loading-state--${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {screen ? (
        <div className="loading-state__screen-card">
          <div className="loading-state__logo" aria-hidden="true">
            <img src="/branding/jbc-primary-logo.png" alt="" />
          </div>
          <span className="loading-state__eyebrow">JBC RIGWORKS PORTAL</span>
          <h1>{label}</h1>
          <p>PC &amp; Laptop Care Done Right.</p>
          <div className="loading-state__track" aria-hidden="true"><span /></div>
        </div>
      ) : (
        <>
          <header className="loading-state__heading">
            <span className="loading-state__emblem" aria-hidden="true"><Cpu size={22} /></span>
            <span className="loading-state__heading-copy">
              <span className="loading-state__eyebrow">JBC RIGWORKS</span>
              <strong>{label}</strong>
            </span>
            <span className="loading-state__activity" aria-hidden="true"><i /><i /><i /></span>
          </header>
          {variant === 'cards' && (
            <div className="loading-state__cards" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="loading-state__card" key={index}>
                  <span className="loading-state__card-icon" />
                  <span className="loading-state__line loading-state__line--short" />
                  <span className="loading-state__line loading-state__line--wide" />
                  <span className="loading-state__line loading-state__line--medium" />
                </div>
              ))}
            </div>
          )}
          {variant === 'table' && (
            <div className="loading-state__table" aria-hidden="true">
              <div className="loading-state__table-heading"><span /><span /><span /></div>
              {Array.from({ length: 5 }, (_, row) => (
                <div className="loading-state__table-row" key={row}><span /><span /><span /></div>
              ))}
            </div>
          )}
          <div className="loading-state__track" aria-hidden="true"><span /></div>
        </>
      )}
    </section>
  )
}
