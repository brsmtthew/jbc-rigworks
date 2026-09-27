import { Search, X } from 'lucide-react'

export function SearchField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <label className="search-field">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        name="search"
        aria-label={label}
        autoComplete="off"
        placeholder={`${label}…`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button aria-label="Clear search" type="button" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </label>
  )
}

export function PeriodSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      className="period-select"
      type="month"
      aria-label="Report period"
      value={value}
      onChange={(event) => {
        if (event.target.value) onChange(event.target.value)
      }}
    />
  )
}
