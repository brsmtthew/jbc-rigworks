import type { ExcelData } from '../../lib/business'
import { ExcelButton } from './ExcelButton'
import { RotateCcw } from 'lucide-react'
import { SearchField } from './Filters'

export function ListToolbar({ query, setQuery, filter, setFilter, options, label, count, onReset, onExport }: {
  query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void;
  options: { value: string; label: string }[]; label: string; count: number; onReset: () => void; onExport?: () => ExcelData
}) {
  return <div className="list-toolbar"><SearchField label={label} value={query} onChange={setQuery} />
    <select aria-label="Filter records" value={filter} onChange={event => setFilter(event.target.value)}>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
    {(query || filter !== 'all') && <button className="text-button" onClick={onReset} title="Reset" aria-label="Reset"><RotateCcw size={19} /></button>}
    <span className="result-count" role="status" aria-label="Result count">{count} results</span>
    {onExport && <ExcelButton disabled={!count} onExport={onExport} />}
  </div>
}
