import { useSearchParams } from 'react-router-dom'

export function useListFilters() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const filter = params.get('filter') ?? 'all'
  const update = (key: string, value: string) => {
    // The current URL includes the last navigation even when React has not rendered it yet.
    const next = new URLSearchParams(window.location.search)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  return {
    query,
    filter,
    setQuery: (value: string) => update('q', value),
    setFilter: (value: string) => update('filter', value),
    reset: () => setParams({}, { replace: true }),
    matches: (text: string) => text.toLowerCase().includes(query.trim().toLowerCase()),
  }
}
