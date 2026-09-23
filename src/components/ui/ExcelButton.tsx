import { useState } from 'react'
import { X, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { Dialog } from './Dialog'
import { DataTable } from './DataTable'
import { downloadExcel, type ExcelData } from '../../lib/business'
export function ExcelButton({ onExport, disabled = false }: { onExport: () => ExcelData; disabled?: boolean }) {
  const [preview, setPreview] = useState<ExcelData | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save() {
    if (!preview || busy) return
    setBusy(true); setError('')
    try { await downloadExcel(preview.name, preview.rows); setPreview(null) } catch { setError('The Excel file could not be created. Your preview is still available; try again.') } finally { setBusy(false) }
  }
  return <><button type="button" className="secondary-button" title="Export Excel" aria-label="Export Excel" disabled={disabled} onClick={() => { setError(''); try { const data = onExport(); setPreview({ name: data.name, rows: data.rows.map(row => [...row]) }) } catch { setError('Could not prepare the preview. Try again.') } }}><FileSpreadsheet size={20} /></button>
    {error && !preview && <span role="alert" className="form-error">{error}</span>}
    {preview && <Dialog title="Excel preview" wide onClose={() => { if (!busy) setPreview(null) }}><div className="export-preview-summary"><FileSpreadsheet size={28} /><div><strong>{preview.name}.xlsx</strong><p>{Math.max(0, preview.rows.length - 1)} rows / {preview.rows[0]?.length ?? 0} columns. Review the data before downloading.</p></div></div>
      <DataTable<{ id: string; cells: (string | number)[] }> label="Excel preview data" rows={preview.rows.slice(1).map((cells, index) => ({ id: String(index), cells }))} columns={(preview.rows[0] ?? []).map((heading, index) => ({ label: String(heading), render: row => row.cells[index] ?? '', sortValue: row => row.cells[index] ?? '' }))} />
      {error && <p role="alert" className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setPreview(null)} title="Cancel" aria-label="Cancel"><X size={19}/></button><button type="button" className="primary-button" disabled={busy} onClick={save} title="Download Excel" aria-label={busy ? "Preparing file..." : "Download Excel"}>{busy ? <LoaderCircle size={18} className="loading-icon" /> : <Download size={18} />}</button></div>
    </Dialog>}
  </>
}
