import { createPortal } from 'react-dom'
import { HeaderHost } from './header-context'
import { useContext, useEffect, useRef, type ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description: string; children?: ReactNode
}) {
  const host = useContext(HeaderHost)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--page-heading-height', `${ref.current?.offsetHeight ?? 100}px`))
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [host])
  const heading = <div className="page-heading" ref={ref}>
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    {children && <div className="heading-actions">{children}</div>}
  </div>
  return host ? createPortal(heading, host) : heading
}
