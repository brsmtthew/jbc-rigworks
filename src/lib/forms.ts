export function formText(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

export function formAmount(form: FormData, name: string, optional = false) {
  const raw = formText(form, name)
  const value = Number(raw)
  if ((!raw && !optional) || !Number.isFinite(value) || value < 0)
    throw new Error('Enter a valid non-negative amount.')
  return value
}
