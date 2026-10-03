import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type Column<T> = {
  label: string
  render: (row: T) => ReactNode
  numeric?: boolean
  sortValue?: (row: T) => string | number
}
function recordTime(row: { id: string }) {
  const record = row as {
    createdAt?: string
    confirmedAt?: string
    date?: string
    stockHistory?: { date: string }[]
  }
  return record.createdAt || record.confirmedAt || record.date || record.stockHistory?.[0]?.date || ''
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  label,
  filtered = false,
}: {
  rows: T[]
  columns: Column<T>[]
  label: string
  filtered?: boolean
}) {
  const [sort, setSort] = useState<{ index: number; direction: 1 | -1 } | null>(null)
  const [limit, setLimit] = useState(10)
  const [cursor, setCursor] = useState({ key: '', page: 0 })
  const key =
    rows.map((row) => row.id).join('|') + ':' + sort?.index + ':' + sort?.direction + ':' + limit
  const pages = Math.max(1, Math.ceil(rows.length / limit))
  const page = cursor.key === key ? Math.min(cursor.page, pages - 1) : 0
  const accessor = sort ? columns[sort.index]?.sortValue : undefined
  const ordered =
    accessor && sort
      ? [...rows].sort((a, b) => {
          const av = accessor(a),
            bv = accessor(b)
          return (
            (typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv), undefined, { numeric: true })) * sort.direction
          )
        })
      : [...rows].sort((a, b) => recordTime(b).localeCompare(recordTime(a)))
  if (!rows.length)
    return (
      <div className="empty-state" role="status">
        <SearchX size={28} />
        <h3>{filtered ? 'No matching records' : 'No records yet'}</h3>
        <p>
          {filtered ? 'Try another search or reset the filters.' : 'New records will appear here.'}
        </p>
      </div>
    )
  return (
    <div className="table-shell">
      {columns.some((column) => column.sortValue) && (
        <div className="table-mobile-sort">
          <label>
            Sort by
            <select
              aria-label={'Sort ' + label}
              value={sort?.index ?? ''}
              onChange={(e) =>
                setSort(
                  e.target.value === '' ? null : { index: Number(e.target.value), direction: 1 },
                )
              }
            >
              <option value="">Newest first</option>
              {columns.map(
                (column, index) =>
                  column.sortValue && (
                    <option key={index} value={index}>
                      {column.label}
                    </option>
                  ),
              )}
            </select>
          </label>
          <button
            type="button"
            className="icon-button"
            disabled={!sort}
            aria-label="Reverse sort order"
            onClick={() => {
              if (sort) setSort({ ...sort, direction: sort.direction === 1 ? -1 : 1 })
            }}
          >
            {sort?.direction === -1 ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
          </button>
        </div>
      )}
      <div className="table-container" tabIndex={0} role="region" aria-label={label + ' records'}>
        <table className="data-table" aria-label={label}>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={column.numeric ? 'numeric' : ''}
                  aria-sort={
                    sort?.index === index
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        setSort({
                          index,
                          direction: sort?.index === index && sort.direction === 1 ? -1 : 1,
                        })
                      }
                    >
                      {column.label}
                      {sort?.index === index ? (
                        sort.direction === 1 ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.slice(page * limit, (page + 1) * limit).map((row) => (
              <tr key={row.id}>
                {columns.map((column, index) => (
                  <td
                    key={index}
                    data-label={column.label}
                    className={column.numeric ? 'numeric' : ''}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <div className="table-pagination">
          <span role="status">
            {page * limit + 1}-{Math.min(rows.length, (page + 1) * limit)} of {rows.length}
          </span>
          <label>
            Rows
            <select
              aria-label={label + ' rows per page'}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 25, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div>
            <button
              type="button"
              className="icon-button"
              aria-label={'Previous page of ' + label}
              disabled={page === 0}
              onClick={() => setCursor({ key, page: page - 1 })}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={'Next page of ' + label}
              disabled={page === pages - 1}
              onClick={() => setCursor({ key, page: page + 1 })}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
