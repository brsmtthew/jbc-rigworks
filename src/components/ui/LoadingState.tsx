export function LoadingState({
  label = 'Loading records...',
  table = false,
}: {
  label?: string
  table?: boolean
}) {
  return (
    <section className="loading-state" role="status" aria-busy="true" aria-label={label}>
      <p>{label}</p>
      {table ? (
        <div className="skeleton-table" aria-hidden="true">
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row}>
              {Array.from({ length: 4 }, (_, column) => (
                <i key={column} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="skeleton-grid" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </section>
  )
}
