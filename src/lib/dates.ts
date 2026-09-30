const manilaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function manilaDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(
    manilaDate.formatToParts(date).map(({ type, value: part }) => [type, part]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const today = () => manilaDay(new Date())
export const currentPeriod = () => today().slice(0, 7)
