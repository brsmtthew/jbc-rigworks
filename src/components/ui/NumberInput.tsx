import { useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
}

export function NumberInput({ value, onValueChange, ...props }: Props) {
  const [state, setState] = useState({ value, draft: value === 0 ? '' : String(value) })
  const draft = state.value === value ? state.draft : value === 0 ? '' : String(value)
  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        const numeric = next === '' ? 0 : Number(next)
        setState({ value: numeric, draft: next })
        onValueChange(numeric)
      }}
    />
  )
}
