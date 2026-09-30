import { RotateCcw } from 'lucide-react'
import { SearchField } from './Filters'

export function ListToolbar({
  query,
  setQuery,
  filter,
  setFilter,
  options,
  label,
  filterLabel,
  onReset,
}: {
  query: string
  setQuery: (value: string) => void
  filter: string
  setFilter: (value: string) => void
  options: { value: string; label: string }[]
  label: string
  filterLabel: string
  onReset: () => void
}) {
  return (
    <div className="list-toolbar">
      <div className="toolbar-field">
        <span className="toolbar-field-label">Search</span>
        <SearchField label={label} value={query} onChange={setQuery} />
      </div>
      <label className="toolbar-field">
        <span className="toolbar-field-label">{filterLabel}</span>
        <select
          aria-label="Filter records"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {(query || filter !== 'all') && (
        <button className="text-button toolbar-reset" type="button" onClick={onReset} title="Reset filters" aria-label="Reset filters">
          <RotateCcw size={19} />
        </button>
      )}
    </div>
  )
}
