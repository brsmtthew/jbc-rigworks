import { Camera, Download, Pencil, Search, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/ui/ActionButton'
import { Dialog } from '../../components/ui/Dialog'
import { useWorkspace } from '../../hooks/useWorkspace'
import { availableStock } from '../../lib/workflow'
import type { InventoryItem } from '../../types'
import { InventoryEditor } from './InventoryEditor'
import { StockMovementHistory } from './StockMovementHistory'

export function InventoryScanner({
  initial,
  onClose,
  onAdjust,
}: {
  initial?: InventoryItem
  onClose: () => void
  onAdjust?: (item: InventoryItem) => void
}) {
  const { inventory } = useWorkspace()
  const [text, setText] = useState(''),
    [itemId, setItemId] = useState(initial?.id || ''),
    [error, setError] = useState(''),
    [running, setRunning] = useState(false),
    [editing, setEditing] = useState(false),
    [qr, setQr] = useState('')
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<{ stop: () => void } | null>(null),
    generation = useRef(0)
  const item = inventory.find((value) => value.id === itemId)
  function stop() {
    generation.current++
    controls.current?.stop()
    controls.current = null
    const stream = video.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    setRunning(false)
  }
  useEffect(
    () => () => {
      generation.current++
      controls.current?.stop()
    },
    [],
  )
  useEffect(() => {
    let current = true
    if (!itemId) return
    import('qrcode')
      .then((module) => module.toDataURL('jbc-stock:' + itemId, { width: 280, margin: 2 }))
      .then((value) => {
        if (current) setQr(value)
      })
      .catch(() => {
        if (current) setError('Unable to generate the QR label.')
      })
    return () => {
      current = false
    }
  }, [itemId])
  function find(value: string) {
    if (/^jbc-order:/i.test(value.trim())) {
      stop()
      setError('This is a customer order QR. Scan it in POS.')
      return
    }
    const code = value.trim().replace(/^jbc-stock:/i, '')
    const found = inventory.find(
      (item) =>
        item.id.toLowerCase() === code.toLowerCase() ||
        item.sku.toLowerCase() === code.toLowerCase(),
    )
    stop()
    setText(value)
    if (!found) {
      setItemId('')
      setError('No item matches this QR code or SKU.')
      return
    }
    setItemId(found.id)
    setError('')
  }
  async function start() {
    stop()
    const token = generation.current
    setError('')
    setRunning(true)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (token !== generation.current) return
      const reader = new BrowserQRCodeReader()
      const scan = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' }, audio: false },
        video.current!,
        (result) => {
          if (result && token === generation.current) find(result.getText())
        },
      )
      if (token !== generation.current) scan.stop()
      else controls.current = scan
    } catch {
      if (token === generation.current) {
        setRunning(false)
        setError(
          'Camera unavailable or permission denied. Upload a QR photo or enter the SKU below.',
        )
      }
    }
  }
  async function upload(file?: File) {
    if (!file) return
    stop()
    if (!file.type.startsWith('image/') || file.size > 5000000) {
      setError('Choose a QR image smaller than 5 MB.')
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url)
      find(result.getText())
    } catch {
      setError('No readable QR code found. Try a clearer image or enter the SKU.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return (
    <Dialog
      title="Inventory QR tracking"
      wide
      onClose={() => {
        stop()
        onClose()
      }}
    >
      <div className="scanner-layout">
        <div className="portal-form settings-fields">
          <video
            ref={video}
            muted
            playsInline
            className={running ? 'scanner-video' : 'scanner-video is-hidden'}
            aria-label="QR camera view"
          />
          <div className="part-actions">
            <ActionButton label="Start QR camera" disabled={running} onClick={start}>
              <Camera size={22} />
            </ActionButton>
            <ActionButton label="Stop QR camera" disabled={!running} onClick={stop}>
              <Square size={20} />
            </ActionButton>
          </div>
          <label>
            Scan QR image
            <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              find(text)
            }}
          >
            <label>
              QR code or SKU
              <input
                autoFocus
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                placeholder="Scan with a USB reader or type SKU"
              />
            </label>
            <ActionButton type="submit" label="Find inventory item">
              <Search size={20} />
            </ActionButton>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="qr-item">
          {item ? (
            <>
              <h3>{item.name}</h3>
              <p>
                {item.sku} / {item.stock} on hand / {item.reserved ?? 0} reserved /{' '}
                {availableStock(item)} available
              </p>
              {qr && <img src={qr} alt={'Inventory QR label for ' + item.name} />}
              <div className="part-actions">
                <a
                  className="icon-button"
                  title="Download QR label"
                  aria-label="Download QR label"
                  href={qr}
                  download={'stock-' + item.id + '.png'}
                >
                  <Download size={20} />
                </a>
                <ActionButton
                  label="Adjust scanned item"
                  onClick={() => (onAdjust ? onAdjust(item) : setEditing(true))}
                >
                  <Pencil size={20} />
                </ActionButton>
              </div>
              <StockMovementHistory key={item.id} item={item} />
            </>
          ) : (
            <p>Scan a label to view an item and its stock movements.</p>
          )}
        </div>
      </div>
      {editing && item && <InventoryEditor item={item} onClose={() => setEditing(false)} />}
    </Dialog>
  )
}
