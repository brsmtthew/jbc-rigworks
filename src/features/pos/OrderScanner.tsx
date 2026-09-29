import { Camera, ImageUp, Keyboard, ScanLine, Search, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { parseOrderQr } from '../finance/payments'

export function OrderScanner({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const generation = useRef(0),
    resolving = useRef(false)
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
  async function find(value: string) {
    if (resolving.current) return
    resolving.current = true
    stop()
    setBusy(true)
    setError('')
    try {
      await onSelect(parseOrderQr(value))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      resolving.current = false
      setBusy(false)
    }
  }
  async function start() {
    stop()
    setError('')
    setRunning(true)
    const token = generation.current
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (token !== generation.current) return
      const scan = await new BrowserQRCodeReader().decodeFromConstraints(
        { video: { facingMode: 'environment' }, audio: false },
        video.current!,
        (result) => {
          if (result && token === generation.current) void find(result.getText())
        },
      )
      if (token !== generation.current) scan.stop()
      else controls.current = scan
    } catch {
      if (token === generation.current) {
        stop()
        setError('Camera unavailable. Upload the QR image or enter the order reference.')
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
      await find((await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText())
    } catch {
      setError('No order QR could be read. Enter its reference instead.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  return (
    <Dialog
      title="Scan customer order"
      onClose={() => {
        stop()
        onClose()
      }}
    >
      <div className="pos-order-scanner">
        <div className="admin-pos-dialog-intro">
          <span className="admin-pos-dialog-icon" aria-hidden="true"><ScanLine size={20} /></span>
          <div>
            <span className="eyebrow">ORDER LOOKUP</span>
            <h3>Find a customer order</h3>
            <p>Use the camera, upload a QR image, or enter a reference from a USB scanner.</p>
          </div>
        </div>
        <div className="pos-scanner-methods">
          <section className="pos-scanner-method" aria-label="Scan with camera">
            <span className="pos-scanner-method-icon" aria-hidden="true"><Camera size={20} /></span>
            <strong>Use camera</strong>
            <p>Point your camera at the customer’s order QR.</p>
            <video
              ref={video}
              muted
              playsInline
              className={running ? 'scanner-video' : 'scanner-video is-hidden'}
              aria-label="Order QR camera"
            />
            {running ? (
              <button type="button" className="secondary-button" onClick={stop}>
                <Square size={16} /> Stop camera
              </button>
            ) : (
              <button type="button" className="secondary-button" disabled={busy} onClick={start}>
                <Camera size={16} /> Start camera
              </button>
            )}
          </section>
          <section className="pos-scanner-method" aria-label="Upload order QR">
            <span className="pos-scanner-method-icon" aria-hidden="true"><ImageUp size={20} /></span>
            <strong>Upload QR image</strong>
            <p>Choose a clear image of the QR code from this device.</p>
            <label className="pos-scanner-upload">
              <span className="sr-only">Upload order QR</span>
              <input type="file" accept="image/*" disabled={busy}
                onChange={(event) => void upload(event.target.files?.[0])} />
            </label>
          </section>
        </div>
        <form
          className="pos-scanner-reference"
          onSubmit={(event) => {
            event.preventDefault()
            void find(code)
          }}
        >
          <div className="pos-scanner-reference-heading">
            <Keyboard size={18} aria-hidden="true" />
            <div><strong>Enter a reference</strong><span>USB readers can scan directly into this field.</span></div>
          </div>
          <label>
            Order QR or reference
            <input
              autoFocus
              required
              maxLength={120}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Scan with a USB reader or enter the reference"
            />
          </label>
          <button type="submit" className="primary-button" disabled={busy}>
            <Search size={18} />
            {busy ? 'Opening…' : 'Open order in POS'}
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="pos-scanner-note">
          Scanning opens the saved order. Confirm the customer and payment before handing over the
          items.
        </p>
      </div>
    </Dialog>
  )
}
