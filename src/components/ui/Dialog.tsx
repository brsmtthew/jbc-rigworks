import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Nested dialogs can unmount in either order (for example when a drawer closes).
let openDialogCount = 0
let initialOverflow = ''

export function Dialog({ title, children, onClose, drawer = false, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; drawer?: boolean; wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    if (openDialogCount === 0) initialOverflow = document.body.style.overflow
    openDialogCount += 1
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      openDialogCount -= 1
      if (openDialogCount === 0) document.body.style.overflow = initialOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog ref={ref} className={drawer ? 'drawer-dialog' : 'app-dialog' + (wide ? ' dialog-wide' : '')} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex="0"]'))
          .filter(element => !element.matches(':disabled') && element.getClientRects().length > 0)
        const first = elements[0]
        const last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() }}>
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20} /></button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  )
}
