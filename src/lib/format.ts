const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const compactCurrency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const dateLabel = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const formatPHP = (amount: number, compact = false) =>
  (compact ? compactCurrency : currency).format(amount)
export const formatDate = (date: string) => dateLabel.format(new Date(date + 'T12:00:00'))
