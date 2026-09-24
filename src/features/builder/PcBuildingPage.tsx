import { useDirectories } from '../../lib/directories'
import { Pencil, FolderOpen, Check, X, Info } from 'lucide-react'
import { ProductDialog } from '../inventory/ProductDialog'
import { Dialog } from '../../components/ui/Dialog'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { savePcRequest } from '../../lib/customerStorage'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Cpu, Monitor, Save, ShoppingCart, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../../lib/auth-context'
import { useWorkspace } from '../../lib/workspaceStorage'
import { buildTier, compatibility, componentOf, componentTier, components, isPcPart } from '../../lib/pc'
import { prepareExcel } from '../../lib/business'
import { formatPHP } from '../../data/appData'
import type { ComponentType, InventoryItem, Tier } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { PcModelPicker } from './PcModelPicker'

type Selection = Partial<Record<ComponentType, string>>
type CustomPart = { model: string; capacity: string; socket: string; memoryType: string }
type CustomParts = Partial<Record<ComponentType, CustomPart>>
type Plan = { id: string; name: string; budget: string; selection: Selection; custom?: CustomParts; legacyNotes?: string }
function readPlans(key: string, legacyKey: string, inventory: InventoryItem[]): Plan[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    const current: Plan[] = Array.isArray(value) ? value.filter(plan => plan && typeof plan.id === 'string' && typeof plan.name === 'string' && typeof plan.budget === 'string' && plan.selection && typeof plan.selection === 'object') : []
    const legacy = JSON.parse(localStorage.getItem(legacyKey) ?? '[]')
    if (!Array.isArray(legacy)) return current
    for (const old of legacy) {
      if (!old || typeof old.id !== 'string' || current.some(plan => plan.id === old.id) || !old.parts) continue
      const selection: Selection = {}
      const notes: string[] = []
      for (const [index, code] of ['cpu', 'board', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'].entries()) {
        const part = old.parts[code]
        if (typeof part?.model !== 'string' || !part.model.trim()) continue
        notes.push(`${components[index].name}: ${part.model} (previous estimate: ${part.price || '0'} PHP)`)
        const match = inventory.find(item => item.name.toLowerCase() === part.model.toLowerCase() && componentOf(item) === components[index].name)
        if (match) selection[components[index].name] = match.id
      }
      current.push({ id: old.id, name: old.name || 'Previous build', budget: String(old.budget || ''), selection, legacyNotes: notes.join('\n') })
    }
    return current
  } catch { return [] }
}
export function PcBuildingPage({ identify = false }: { identify?: boolean }) {
  const [directory] = useDirectories()
  const [partOpen, setPartOpen] = useState<ComponentType | null>(null), [partTier, setPartTier] = useState('All'), [partQuery, setPartQuery] = useState(''), [planOpen, setPlanOpen] = useState(false), [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const { inventory } = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [requestOpen, setRequestOpen] = useState(false), [tierHelp, setTierHelp] = useState(false), [modelAngle, setModelAngle] = useState(0)
  const [mode, setMode] = useState(identify || params.get('mode') === 'identify' ? 'identify' : 'build')
  const [custom, setCustom] = useState<CustomParts>({})
  const [useCase, setUseCase] = useState('Gaming'), [requestNotes, setRequestNotes] = useState(''), [requested, setRequested] = useState(false)
  const key = `jbc-rigworks:stock-builds:v1:${user!.id}`
  const [plans, setPlans] = useState(() => readPlans(key, `jbc-rigworks:builds:v1:${user!.id}`, inventory))
  const [selection, setSelection] = useState<Selection>({}), [name, setName] = useState(''), [budget, setBudget] = useState(''), [id, setId] = useState('')
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [dirty, setDirty] = useState(false)
  const selectedIds = Object.values(selection).filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== '__custom')
  const stockSelected = selectedIds.map(id => inventory.find(item => item.id === id)).filter((item): item is InventoryItem => !!item && isPcPart(item))
  const customSelected: InventoryItem[] = components.flatMap(part => {
    const value = custom[part.name]
    if (selection[part.name] !== '__custom' || !value?.model.trim()) return []
    const capacity = Number(value.capacity)
    const tier: Tier | '' = value.capacity === '' || !Number.isSafeInteger(capacity) || capacity < (part.name === 'Graphics' ? 0 : 1) || capacity > 4096 ? '' : part.name === 'Processor' ? capacity >= 8 ? 'High' : capacity >= 4 ? 'Mid' : 'Low' : part.name === 'Graphics' ? capacity >= 12 ? 'High' : capacity >= 4 ? 'Mid' : 'Low' : part.name === 'Memory' ? capacity >= 32 ? 'High' : capacity >= 16 ? 'Mid' : 'Low' : ''
    return [{ id: 'custom:' + part.name, name: value.model, sku: '', category: part.name, component: part.name, stock: 0, minimum: 0, price: 0, cost: 0, tier, socket: value.socket, memoryType: value.memoryType }]
  })
  const selected = [...stockSelected, ...customSelected]
  const incompleteCustom = components.some(part => selection[part.name] === '__custom' && !custom[part.name]?.model.trim())
  const invalidCustom = components.some(part => { const value = custom[part.name]?.capacity; return selection[part.name] === '__custom' && ['Processor', 'Memory', 'Graphics'].includes(part.name) && value !== undefined && value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < (part.name === 'Graphics' ? 0 : 1) || Number(value) > 4096) })
  const total = selected.reduce((sum, item) => sum + item.price, 0)
  const tier = buildTier(selected)
  const errors = compatibility(selected)
  const missing = components.filter(part => !selection[part.name] || !inventory.some(item => item.id === selection[part.name] && isPcPart(item) && item.stock > 0))
  const unavailable = selectedIds.some(id => !inventory.some(item => item.id === id && isPcPart(item) && item.stock > 0))
  const change = () => { setRequested(false); setDirty(true); setMessage(''); setError('') }
  async function save() {
    if (invalidCustom) { setError('Enter valid whole-number hardware specifications.'); return }
    if (!name.trim()) { setError('Enter a build name.'); return }
    if (Number(budget) < 0 || !Number.isFinite(Number(budget))) { setError('Enter a valid budget.'); return }
    const nextId = id || crypto.randomUUID()
    const record = { id: nextId, name: name.trim(), budget, selection, custom, legacyNotes: plans.find(plan => plan.id === nextId)?.legacyNotes }
    const next = plans.some(plan => plan.id === nextId) ? plans.map(plan => plan.id === nextId ? record : plan) : [record, ...plans]
    if (!await confirm({ title: id ? 'Save build changes?' : 'Save this build?', message: `${id ? 'Update' : 'Save'} “${record.name}” to your saved builds?`, confirmLabel: id ? 'Save changes' : 'Save build' })) return
    try { localStorage.setItem(key, JSON.stringify(next)); setPlans(next); setId(nextId); setDirty(false); setError(''); setMessage('Build saved. Stock and prices are rechecked whenever you open it.'); setPlanOpen(false) }
    catch { setError('Unable to save this build. Check browser storage.') }
  }
  async function startNew() {
    if (dirty && !await confirm({ title: 'Start a new build?', message: 'Discard the unsaved changes in this build?', confirmLabel: 'Discard changes', tone: 'danger' })) return
    setSelection({}); setCustom({}); setRequested(false); setName(''); setBudget(''); setId(''); setDirty(false); setMessage(''); setError('')
  }
  function exportBuild() { return prepareExcel(name || 'pc-build', [['Component', 'Model', 'SKU', 'Price PHP'], ...components.map(part => { const item = selected.find(item => componentOf(item) === part.name); return [part.name, item?.name ?? 'Not selected', item?.sku ?? '', item?.id.startsWith('custom:') ? 'Quote required' : item?.price ?? ''] }), ['Stock subtotal', '', '', total], ['Budget', '', '', Number(budget) || 0]]) }
  async function requestBuild() {
    setError(''); setMessage('')
    if (invalidCustom) { setError('Enter valid whole-number hardware specifications.'); return }
    if (!selected.length || incompleteCustom || !name.trim()) { setError('Name your build and select at least one complete part.'); return }
    if (!Number.isFinite(Number(budget)) || Number(budget) < 0) { setError('Enter a valid budget.'); return }
    if (errors.length) { setError('Resolve the listed compatibility conflicts first.'); return }
    try {
      if (!await confirm({ title: 'Send build request?', message: `Save your ${name.trim()} request for workshop review?`, confirmLabel: 'Send request' })) return
      const model = (component: ComponentType) => { const item = selected.find(value => componentOf(value) === component); return item ? [item.brand, item.model || item.name].filter(Boolean).join(' / ') : 'Needs guidance' }
      savePcRequest(user!, { useCase, budget, processor: model('Processor'), graphics: model('Graphics'), memory: model('Memory'), storage: model('Storage'), tier, parts: selected.map(item => ({ component: componentOf(item)!, model: item.model || item.name, brand: item.brand, specs: item.specs, price: item.price, inventoryId: item.id.startsWith('custom:') ? undefined : item.id, source: item.id.startsWith('custom:') ? 'Custom' : 'Stock' })), notes: name + '\n' + requestNotes })
      setRequested(true); setRequestOpen(false); setMessage('Build request saved on this device. The workshop can review it in Service jobs in this browser.')
    } catch { setError('Could not save this request. Your selected parts are still here; check browser storage and try again.') }
  }
  return <>
    <PageHeader eyebrow="BUILD STUDIO" title={mode === 'identify' ? "PC identifier" : "PC builder"} description="Select from the shared component catalog, identify the resulting tier, and request or order the same build."><ExcelButton disabled={!selected.length} onExport={exportBuild} /></PageHeader>
    <div className="record-tabs" role="group" aria-label="PC workspace mode"><button className={mode === 'build' ? 'primary-button' : 'secondary-button'} aria-pressed={mode === 'build'} onClick={() => setMode('build')}><Cpu size={17} />Build & request</button><button className={mode === 'identify' ? 'primary-button' : 'secondary-button'} aria-pressed={mode === 'identify'} onClick={() => setMode('identify')}><Monitor size={17} />Identify my PC</button></div>
    {mode === 'build' && <PcModelPicker selected={selection} onSelect={part => { setPartOpen(part); setPartTier('All'); setPartQuery('') }} angle={modelAngle} onRotate={() => setModelAngle(angle => angle === 0 ? 12 : angle === 12 ? -12 : 0)} />}
    <div className="builder-layout"><div className="directory-grid">{components.map(part => {
      const options = inventory.filter(item => isPcPart(item) && componentOf(item) === part.name && item.stock > 0 && (partTier === 'All' || componentTier(item) === partTier) && (item.name + ' ' + item.brand + ' ' + item.model + ' ' + item.sku + ' ' + item.specs).toLowerCase().includes(partQuery.toLowerCase()))
      const chosen = selected.find(item => item.id === selection[part.name] || (selection[part.name] === '__custom' && item.id === 'custom:' + part.name))
      const details = custom[part.name] ?? { model: '', capacity: '', socket: '', memoryType: '' }
      const updateCustom = (field: keyof CustomPart, value: string) => { change(); setCustom({ ...custom, [part.name]: { ...details, [field]: value } }) }
      return <article className="part-card" key={part.name}><div className="part-heading"><span className="service-icon"><part.icon size={25} /></span>{chosen && <CheckCircle2 size={18} />}</div><h2>{part.name}</h2><p>{part.hint}</p><p className="selected-part-name">{chosen ? [chosen.brand, chosen.model || chosen.name].filter(Boolean).join(' / ') : 'No component selected'}</p><div className="part-actions"><button className="icon-button" aria-label={'Select ' + part.name} title={'Select ' + part.name} onClick={() => { setPartOpen(part.name); setPartTier('All'); setPartQuery('') }}><Pencil size={19}/></button>{chosen && !chosen.id.startsWith('custom:') && <button className="icon-button" aria-label={'Details ' + chosen.name} title="Part details" onClick={() => setDetailItem(chosen)}><Info size={19}/></button>}</div>{partOpen === part.name && <Dialog title={'Select ' + part.name} onClose={() => setPartOpen(null)}><div className="portal-form part-form"><div className="portal-form-grid"><label>Spec tier filter<select value={partTier} onChange={e => setPartTier(e.target.value)}><option>All</option><option>Low</option><option>Mid</option><option>High</option></select></label><label>Find part<input value={partQuery} onChange={e => setPartQuery(e.target.value)} placeholder="Brand, model or SKU"/></label></div><p className="storage-caption">Source: shared parts directory / {part.name}. {options.length} matching parts.</p><label>{part.name} from stock<select aria-label={`${part.name} from stock`} value={selection[part.name] ?? ''} onChange={e => { change(); setSelection({ ...selection, [part.name]: e.target.value || undefined }) }}><option value="">Choose a component</option><option value="__custom">Unlisted / owned component</option>{options.map(item => <option key={item.id} value={item.id} disabled={mode === 'build' && item.stock < 1}>{[item.brand, item.model || item.name].filter(Boolean).join(' / ')} — {formatPHP(item.price)} · {item.stock > 0 ? `${item.stock} available` : 'Out of stock'}</option>)}</select></label>{selection[part.name] === '__custom' && <div className="custom-part-fields"><label>{part.name} model<input maxLength={160} value={details.model} onChange={e => updateCustom('model', e.target.value)} placeholder="Enter any model" /></label>{['Processor', 'Memory', 'Graphics'].includes(part.name) && <label>{{ Processor: 'Physical CPU cores', Memory: 'RAM capacity (GB)', Graphics: 'Dedicated graphics memory (GB)' }[part.name as 'Processor' | 'Memory' | 'Graphics']}<input aria-label={{ Processor: 'Physical CPU cores', Memory: 'RAM capacity (GB)', Graphics: 'Dedicated graphics memory (GB)' }[part.name as 'Processor' | 'Memory' | 'Graphics']} type="number" min={part.name === 'Graphics' ? 0 : 1} max="4096" step="1" value={details.capacity} onChange={e => updateCustom('capacity', e.target.value)} /><small className="storage-caption">{part.name === 'Graphics' ? 'Use 0 for integrated graphics.' : 'Use the manufacturer specifications or system information.'}</small></label>}{['Processor', 'Motherboard'].includes(part.name) && <label>{part.name} socket<input value={details.socket} maxLength={40} onChange={e => updateCustom('socket', e.target.value)} placeholder="Optional, e.g. AM5" /></label>}{['Memory', 'Motherboard'].includes(part.name) && <label>{part.name} memory generation<select value={details.memoryType} onChange={e => updateCustom('memoryType', e.target.value)}><option value="">Unknown</option>{directory.memory.map(value => <option key={value}>{value}</option>)}</select></label>}</div>}</div><div className="dialog-actions"><button className="icon-button" title="Clear selection" aria-label="Clear selection" onClick={() => { change(); setSelection({ ...selection, [part.name]: undefined }); setPartOpen(null) }}><X size={19}/></button><button className="primary-button" title="Use component" aria-label="Use component" onClick={() => setPartOpen(null)}><Check size={19}/></button></div></Dialog>}{chosen && <div className="part-selection"><strong>{chosen.id.startsWith('custom:') ? 'Owned / quote required' : formatPHP(chosen.price)}</strong><span>{componentTier(chosen) ? `${componentTier(chosen)} component rating` : 'Rating not assigned'}{chosen.socket ? ` · ${chosen.socket}` : ''}{chosen.memoryType ? ` · ${chosen.memoryType}` : ''}</span></div>}{!options.length && <p className="storage-caption">No stock listed for this component.</p>}</article>
    })}</div><aside className="build-summary"><Panel title="Your PC set" action={<Cpu size={22} />}><div className="portal-form settings-fields">
      <button className="secondary-button" onClick={() => setPlanOpen(true)} title="Build details" aria-label="Build details"><FolderOpen size={19}/><span>{name || "Build details"}</span></button>{planOpen && <Dialog title="Build details" onClose={() => setPlanOpen(false)}><div className="portal-form settings-fields"><label>Saved builds<select aria-label="Saved builds" disabled={dirty} value={id} onChange={e => { const plan = plans.find(plan => plan.id === e.target.value); setId(plan?.id ?? ''); setName(plan?.name ?? ''); setBudget(plan?.budget ?? ''); setSelection(plan?.selection ?? {}); setCustom(plan?.custom ?? {}); setRequested(false); setError(''); setMessage('') }}><option value="">New build</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label>
      <label>Build name<input value={name} maxLength={100} onChange={e => { change(); setName(e.target.value) }} /></label><label>Target budget (PHP)<input type="number" min="0" step="0.01" value={budget} onChange={e => { change(); setBudget(e.target.value) }} /></label>
      {plans.find(plan => plan.id === id)?.legacyNotes && <details><summary>Previous manual plan</summary><p className="legacy-plan storage-caption">{plans.find(plan => plan.id === id)?.legacyNotes}</p><p className="storage-caption">Matching stock is selected automatically. Choose replacements for unlisted models.</p></details>}
      <div className="dialog-actions"><button className="primary-button" onClick={save}><Save size={18}/>{id ? 'Save changes' : 'Save build'}</button>{id && <button className="secondary-button danger-button" onClick={async () => { if (!await confirm({ title: 'Delete saved build?', message: `Permanently delete “${name}”?`, confirmLabel: 'Delete build', tone: 'danger' })) return; try { const next = plans.filter(plan => plan.id !== id); localStorage.setItem(key, JSON.stringify(next)); setPlans(next); setId(''); setDirty(true); setPlanOpen(false) } catch { setError('Unable to delete the build.') } }}><Trash2 size={18}/>Delete build</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}</div></Dialog>}
      <div className="budget-total"><span>{tier === 'Unclassified' ? 'Choose a rated CPU and GPU to identify the set' : `${tier}-spec PC set`}</span><strong>{formatPHP(total)}</strong>{customSelected.length > 0 && <small>Stock subtotal only. Unlisted parts require a quote.</small>}<small>{Number(budget) > 0 ? `${formatPHP(Math.abs(Number(budget) - total))} ${total > Number(budget) ? 'over budget' : 'remaining'}` : `${selected.length} of 8 components selected`}</small></div>
      <button className="icon-button" onClick={() => setTierHelp(true)} aria-label="How is the tier estimated?" title="How is the tier estimated?"><Info size={20}/></button>
      {errors.map(error => <p className="form-error" key={error}>{error}</p>)}{unavailable && <p className="form-error">One or more selected parts are unavailable. Choose replacements.</p>}
      <p className="storage-caption">{missing.length ? `Still needed: ${missing.map(part => part.name).join(', ')}.` : 'All component slots selected.'} Verify BIOS, power requirements, interfaces, and physical clearances before assembly.</p>
      {message && <p className="save-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" onClick={() => setPlanOpen(true)}><Save size={18} />Save build</button>
      <button className="secondary-button" disabled={!stockSelected.length || customSelected.length > 0 || incompleteCustom || unavailable || !!errors.length} onClick={() => navigate(user?.role === 'customer' ? '/customer/shop' : '/pos', { state: { parts: stockSelected.map(item => item.id), pcSet: missing.length === 0 } })}><ShoppingCart size={18} />{missing.length ? 'Order selected parts' : 'Order PC set'}</button>
      {user?.role === 'customer' && <><button className="primary-button" disabled={requested || !selected.length} onClick={() => setRequestOpen(true)}><ArrowRight size={18} />{requested ? 'Request saved' : 'Request a quote'}</button>{requested && <Link className="text-button" to="/customer/records?tab=requests">View build requests</Link>}</>}
      <button className="text-button" onClick={startNew}><Trash2 size={18} />Start new build</button>
      <p className="storage-caption">Saving a plan does not reserve stock. Checkout checks current availability.</p>
    </div></Panel></aside></div>
    {requestOpen && <Dialog title="Request this build" onClose={() => setRequestOpen(false)}><p className="dialog-description">{name || 'Unnamed build'} / {selected.length} selected components. Review your intended use before saving the request.</p><div className="portal-form settings-fields"><label>Primary use<select value={useCase} onChange={e => { setUseCase(e.target.value); setRequested(false) }}>{directory.uses.map(value => <option key={value}>{value}</option>)}</select></label><label>Build request notes<textarea rows={3} maxLength={1000} value={requestNotes} onChange={e => { setRequestNotes(e.target.value); setRequested(false) }} /></label><button className="primary-button" disabled={requested || !selected.length} onClick={requestBuild}><ArrowRight size={18} />{requested ? 'Request saved' : 'Send request'}</button>{error && <p role="alert" className="form-error">{error}</p>}</div></Dialog>}
    {detailItem && <ProductDialog item={detailItem} onClose={() => setDetailItem(null)}/> }
    {tierHelp && <Dialog title="How the PC tier is estimated" onClose={() => setTierHelp(false)}><div className="help-copy"><p>The tier is calculated from the selected CPU, graphics card, and RAM. The weakest rated component sets the PC tier. The directory uses the part specifications below when present; otherwise it uses the fallback component rating entered by the workshop.</p><dl className="detail-list"><div><dt>Mid</dt><dd>4 CPU cores, 4 GB graphics memory, or 16 GB RAM</dd></div><div><dt>High</dt><dd>8 CPU cores, 12 GB graphics memory, or 32 GB RAM</dd></div></dl><p>This is a planning estimate, not a benchmark. Hardware generation and exact models can change performance. The workshop confirms compatibility before assembly.</p></div></Dialog>}
  </>
}
