import { useEffect, useRef, useState } from 'react'
import { Camera, Search, Square } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { parseOrderQr } from '../../lib/payments'

export function OrderScanner({ onSelect, onClose }: { onSelect: (id: string) => Promise<void>; onClose: () => void }) {
  const [code, setCode] = useState(''), [error, setError] = useState(''), [running, setRunning] = useState(false), [busy, setBusy] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const generation = useRef(0), resolving = useRef(false)
  function stop() {
    generation.current++
    controls.current?.stop(); controls.current = null
    const stream = video.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach(track => track.stop())
    setRunning(false)
  }
  useEffect(() => () => { generation.current++; controls.current?.stop() }, [])
  async function find(value: string) {
    if (resolving.current) return
    resolving.current = true; stop(); setBusy(true); setError('')
    try { await onSelect(parseOrderQr(value)) }
    catch (err) { setError((err as Error).message) }
    finally { resolving.current = false; setBusy(false) }
  }
  async function start() {
    stop(); setError(''); setRunning(true)
    const token = generation.current
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (token !== generation.current) return
      const scan = await new BrowserQRCodeReader().decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video.current!, result => { if (result && token === generation.current) void find(result.getText()) })
      if (token !== generation.current) scan.stop(); else controls.current = scan
    } catch { if (token === generation.current) { stop(); setError('Camera unavailable. Upload the QR image or enter the order reference.') } }
  }
  async function upload(file?: File) {
    if (!file) return
    stop()
    if (!file.type.startsWith('image/') || file.size > 5000000) { setError('Choose a QR image smaller than 5 MB.'); return }
    const url = URL.createObjectURL(file)
    try { const { BrowserQRCodeReader } = await import('@zxing/browser'); await find((await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText()) }
    catch { setError('No order QR could be read. Enter its reference instead.') }
    finally { URL.revokeObjectURL(url) }
  }
  return <Dialog title="Scan customer order" onClose={() => { stop(); onClose() }}>
    <div className="portal-form settings-fields">
      <video ref={video} muted playsInline className={running ? 'scanner-video' : 'scanner-video is-hidden'} aria-label="Order QR camera" />
      <div className="dialog-actions"><button className="secondary-button" disabled={running || busy} onClick={start}><Camera size={18} />Start camera</button>{running && <button className="secondary-button" onClick={stop}><Square size={18} />Stop camera</button>}</div>
      <label>Upload order QR<input type="file" accept="image/*" disabled={busy} onChange={event => void upload(event.target.files?.[0])} /></label>
      <form className="portal-form" onSubmit={event => { event.preventDefault(); void find(code) }}>
        <label>Order QR or reference<input autoFocus required maxLength={120} value={code} onChange={event => setCode(event.target.value)} placeholder="Scan with a USB reader or enter the reference" /></label>
        <button className="primary-button" disabled={busy}><Search size={18} />{busy ? 'Opening…' : 'Open order in POS'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="storage-caption">Scanning opens the saved order. Confirm the customer and payment before handing over the items.</p>
    </div>
  </Dialog>
}
