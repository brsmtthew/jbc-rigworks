import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
  variant?: 'icon' | 'labeled'
}

export function ActionButton({
  label,
  children,
  variant = 'icon',
  className = '',
  ...props
}: ActionButtonProps) {
  const classes = [
    variant === 'labeled' ? 'secondary-button action-button' : 'icon-button',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={classes} title={label} aria-label={label} {...props}>
      {children}
      {variant === 'labeled' && <span>{label}</span>}
    </button>
  )
}
