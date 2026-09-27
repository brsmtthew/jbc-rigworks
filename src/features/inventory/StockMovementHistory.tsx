import { where } from 'firebase/firestore'
import { useState } from 'react'
import { useLiveCollection } from '../../hooks/useLiveData'
import type { InventoryItem, StockMovement } from '../../types'

export function StockMovementHistory({ item }: { item: InventoryItem }) {
  const movements = useLiveCollection<StockMovement>(
    'stockMovements',
    true,
    [where('itemId', '==', item.id)],
    item.id,
  )
  const [shown, setShown] = useState(30)
  const rows = [...movements.rows].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const legacy = (item.stockHistory ?? []).filter(
    (entry) =>
      !rows.some(
        (row) =>
          row.timestamp === entry.date &&
          row.quantityBefore === entry.before &&
          row.quantityAfter === entry.after &&
          row.reason === entry.reason,
      ),
  )
  if (movements.error)
    return (
      <p className="form-error" role="alert">
        {movements.error}
      </p>
    )
  if (movements.loading) return <p role="status">Loading stock movements...</p>
  return (
    <section className="stock-history" aria-label="Stock movement ledger">
      <h3>Stock movements</h3>
      {rows.slice(0, shown).map((row) => (
        <article className="form-section" key={row.id}>
          <strong>{row.type.replaceAll('_', ' ')}</strong>
          <p>{row.reason}</p>
          <dl className="detail-list">
            <div>
              <dt>On hand</dt>
              <dd>
                {row.quantityBefore} to {row.quantityAfter} ({row.quantityChange > 0 ? '+' : ''}
                {row.quantityChange})
              </dd>
            </div>
            <div>
              <dt>Reserved</dt>
              <dd>
                {row.reservedBefore} to {row.reservedAfter}
              </dd>
            </div>
          </dl>
          <small>
            {new Date(row.timestamp).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
            <br />
            {row.referenceType}: {row.referenceId}
            <br />
            Recorded by: {row.performedBy}
          </small>
        </article>
      ))}
      {rows.length > shown && (
        <button className="secondary-button" onClick={() => setShown((value) => value + 30)}>
          Show more movements ({rows.length - shown})
        </button>
      )}
      {legacy.length > 0 && (
        <details>
          <summary>Earlier item history ({legacy.length})</summary>
          {[...legacy].reverse().map((entry, index) => (
            <div className="directory-row" key={index}>
              <span>
                {entry.reason}
                <small>{new Date(entry.date).toLocaleString('en-PH')}</small>
              </span>
              <strong>
                {entry.before} to {entry.after}
              </strong>
            </div>
          ))}
        </details>
      )}
      {!rows.length && !legacy.length && <p>No movements recorded yet.</p>}
    </section>
  )
}
