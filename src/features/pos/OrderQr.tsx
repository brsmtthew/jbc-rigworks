import { useEffect, useState } from 'react'
import { orderQrValue } from '../finance/payments'

export function OrderQr({ orderId }: { orderId: string }) {
  const [result, setResult] = useState({ id: '', url: '', error: '' })
  useEffect(() => {
    let active = true
    import('qrcode')
      .then((module) =>
        module.toDataURL(orderQrValue(orderId), {
          width: 220,
          margin: 2,
          errorCorrectionLevel: 'M',
        }),
      )
      .then((url) => {
        if (active) setResult({ id: orderId, url, error: '' })
      })
      .catch(() => {
        if (active)
          setResult({
            id: orderId,
            url: '',
            error: 'QR unavailable. Show the order reference at the counter.',
          })
      })
    return () => {
      active = false
    }
  }, [orderId])
  return (
    <div className="order-qr">
      {result.id === orderId && result.url ? (
        <img src={result.url} width={180} height={180} alt={`Order QR ${orderId}`} />
      ) : (
        <p role="status">{(result.id === orderId && result.error) || 'Preparing order QR…'}</p>
      )}
      <div>
        <strong>{orderId}</strong>
        <p>
          Show this QR at the store. Staff will open your order in the POS and check its payment and
          pickup status.
        </p>
        {result.id === orderId && result.url && (
          <a className="text-button" href={result.url} download={`${orderId}-QR.png`}>
            Download order QR
          </a>
        )}
      </div>
    </div>
  )
}
