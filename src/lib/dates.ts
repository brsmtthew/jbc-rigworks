const manilaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const today = () => manilaDate.format(new Date())
export const currentPeriod = () => today().slice(0, 7)
