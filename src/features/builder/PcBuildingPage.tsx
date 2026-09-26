import { useDirectories } from '../../lib/directories'
import { FolderOpen, Info, Pencil } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { savePcRequest } from '../../lib/customerStorage'
import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Cpu, Monitor, Save, ShoppingCart, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../lib/auth-context'
import { useWorkspace } from '../../lib/workspaceStorage'
import { buildTier, compatibility, componentOf, components, isPcPart } from '../../lib/pc'
import { prepareExcel } from '../../lib/business'
import { formatPHP } from '../../data/appData'
import type { ComponentType, InventoryItem, Tier } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Pc3dBuilder } from './Pc3dBuilder'
import { PcPartEditor } from './PcPartEditor'
import { deleteDoc, setDoc } from 'firebase/firestore'
import { firestoreData, recordRef, useLiveCollection } from '../../lib/database'

type Selection = Partial<Record<ComponentType, string>>
type CustomPart = { model: string; capacity: string; socket: string; memoryType: string }
type CustomParts = Partial<Record<ComponentType, CustomPart>>
type Plan = { id: string; name: string; budget: string; selection: Selection; custom?: CustomParts; legacyNotes?: string }
export function PcBuildingPage({ identify = false }: { identify?: boolean }) {
  const [directory] = useDirectories()
  const [planOpen, setPlanOpen] = useState(false), [editingPart, setEditingPart] = useState<ComponentType | null>(null), [partEditorOpen, setPartEditorOpen] = useState(false)
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const { inventory } = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [requestOpen, setRequestOpen] = useState(false), [tierHelp, setTierHelp] = useState(false)
  const [mode, setMode] = useState(identify || params.get('mode') === 'identify' ? 'identify' : 'build')
  const [custom, setCustom] = useState<CustomParts>({})
  const [useCase, setUseCase] = useState('Gaming'), [requestNotes, setRequestNotes] = useState(''), [requested, setRequested] = useState(false)
  const plansPath = `users/${user!.id}/plans`
  const { rows: plans, error: plansError } = useLiveCollection<Plan>(plansPath, !!user)
  const [selection, setSelection] = useState<Selection>({}), [name, setName] = useState(''), [budget, setBudget] = useState(''), [id, setId] = useState('')
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [dirty, setDirty] = useState(false)
  const saving = useRef(false)
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
    if (saving.current) return
    if (invalidCustom) { setError('Enter valid whole-number hardware specifications.'); return }
    if (!name.trim()) { setError('Enter a build name.'); return }
    if (Number(budget) < 0 || !Number.isFinite(Number(budget))) { setError('Enter a valid budget.'); return }
    const nextId = id || crypto.randomUUID()
    const record = { id: nextId, name: name.trim(), budget, selection, custom, legacyNotes: plans.find(plan => plan.id === nextId)?.legacyNotes }
    saving.current = true
    try {
      if (!await confirm({ title: id ? 'Save build changes?' : 'Save this build?', message: `${id ? 'Update' : 'Save'} “${record.name}” to your saved builds?`, confirmLabel: id ? 'Save changes' : 'Save build' })) return
      await setDoc(recordRef(plansPath, nextId), firestoreData(record)); setId(nextId); setDirty(false); setError(''); setMessage('Build saved. Stock and prices are rechecked whenever you open it.'); setPlanOpen(false)
    }
    catch { setError('Unable to save this build. Check your connection.') }
    finally { saving.current = false }
  }
  async function startNew() {
    if (dirty && !await confirm({ title: 'Start a new build?', message: 'Discard the unsaved changes in this build?', confirmLabel: 'Discard changes', tone: 'danger' })) return
    setSelection({}); setCustom({}); setRequested(false); setName(''); setBudget(''); setId(''); setDirty(false); setMessage(''); setError('')
  }
  function exportBuild() { return prepareExcel(name || 'pc-build', [['Component', 'Model', 'SKU', 'Price PHP'], ...components.map(part => { const item = selected.find(item => componentOf(item) === part.name); return [part.name, item?.name ?? 'Not selected', item?.sku ?? '', item?.id.startsWith('custom:') ? 'Quote required' : item?.price ?? ''] }), ['Stock subtotal', '', '', total], ['Budget', '', '', Number(budget) || 0]]) }
  async function requestBuild() {
    if (saving.current || requested) return
    setError(''); setMessage('')
    if (invalidCustom) { setError('Enter valid whole-number hardware specifications.'); return }
    if (!selected.length || incompleteCustom || !name.trim()) { setError('Name your build and select at least one complete part.'); return }
    if (!Number.isFinite(Number(budget)) || Number(budget) < 0) { setError('Enter a valid budget.'); return }
    if (errors.length) { setError('Resolve the listed compatibility conflicts first.'); return }
    saving.current = true
    try {
      if (!await confirm({ title: 'Send build request?', message: `Save your ${name.trim()} request for workshop review?`, confirmLabel: 'Send request' })) return
      const model = (component: ComponentType) => { const item = selected.find(value => componentOf(value) === component); return item ? [item.brand, item.model || item.name].filter(Boolean).join(' / ') : 'Needs guidance' }
      await savePcRequest(user!, { useCase, budget, processor: model('Processor'), graphics: model('Graphics'), memory: model('Memory'), storage: model('Storage'), tier, parts: selected.map(item => ({ component: componentOf(item)!, model: item.model || item.name, brand: item.brand, specs: item.specs, price: item.price, inventoryId: item.id.startsWith('custom:') ? undefined : item.id, source: item.id.startsWith('custom:') ? 'Custom' : 'Stock' })), notes: name + '\n' + requestNotes })
      setRequested(true); setRequestOpen(false); setMessage('Build request sent. The workshop can review it in Service jobs.')
    } catch { setError('Could not save this request. Your selected parts are still here; check your connection and try again.') }
    finally { saving.current = false }
  }
  return <>
    {plansError && <p className="form-error" role="alert">{plansError}</p>}
    <PageHeader eyebrow="BUILD STUDIO" title={mode === 'identify' ? "PC identifier" : "PC builder"} description="Select from the shared component catalog, identify the resulting tier, and request or order the same build."><ExcelButton disabled={!selected.length} onExport={exportBuild} /></PageHeader>
    <div className="record-tabs" role="group" aria-label="PC workspace mode"><button className={mode === 'build' ? 'primary-button' : 'secondary-button'} aria-pressed={mode === 'build'} onClick={() => setMode('build')}><Cpu size={17} />Build & request</button><button className={mode === 'identify' ? 'primary-button' : 'secondary-button'} aria-pressed={mode === 'identify'} onClick={() => setMode('identify')}><Monitor size={17} />Identify my PC</button></div>
    {mode === 'build' && <Pc3dBuilder selected={selection} inventory={inventory} onSelectionChange={changes => { change(); setSelection(current => ({ ...current, ...changes })) }} onSelect={part => { setPartEditorOpen(true); setEditingPart(part) }} />}
    <section className="pc-build-tools" aria-label="Build settings and actions">
      <div className="pc-build-tools-top">
        <details className="pc-parts-editor" open={partEditorOpen} onToggle={event => setPartEditorOpen(event.currentTarget.open)}>
          <summary><Pencil size={16}/>Add custom or owned parts</summary>
          <div className="pc-parts-editor-list">{components.map(part => <PcPartEditor key={part.name} part={part} openPart={editingPart} onClose={() => setEditingPart(current => current === part.name ? null : current)} selection={selection} custom={custom} inventory={inventory} memoryTypes={directory.memory} onChange={change} onSelectionChange={(component, value) => setSelection(current => ({ ...current, [component]: value }))} onCustomChange={(component, value) => setCustom(current => ({ ...current, [component]: value }))}/>)}</div>
        </details>
        <button type="button" className="secondary-button pc-build-details-button" onClick={() => setPlanOpen(true)} title="Build details" aria-label="Build details"><FolderOpen size={18}/><span>{name || 'Build details'}</span></button>
        <div className="pc-build-total"><span>{tier === 'Unclassified' ? 'Build subtotal' : tier + '-spec subtotal'}</span><strong>{formatPHP(total)}</strong><small>{customSelected.length ? 'Custom parts require a quote' : selected.length + ' of 8 components selected'}</small></div>
      </div>
      {planOpen && <Dialog title="Build details" onClose={() => setPlanOpen(false)}><div className="portal-form settings-fields">
        <label>Saved builds<select aria-label="Saved builds" disabled={dirty} value={id} onChange={e => { const plan = plans.find(plan => plan.id === e.target.value); setId(plan?.id ?? ''); setName(plan?.name ?? ''); setBudget(plan?.budget ?? ''); setSelection(plan?.selection ?? {}); setCustom(plan?.custom ?? {}); setRequested(false); setError(''); setMessage('') }}><option value="">New build</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label>
        <label>Build name<input value={name} maxLength={100} onChange={e => { change(); setName(e.target.value) }}/></label><label>Target budget (PHP)<input type="number" min="0" step="0.01" value={budget} onChange={e => { change(); setBudget(e.target.value) }}/></label>
        {plans.find(plan => plan.id === id)?.legacyNotes && <details><summary>Previous manual plan</summary><p className="legacy-plan storage-caption">{plans.find(plan => plan.id === id)?.legacyNotes}</p><p className="storage-caption">Matching stock is selected automatically. Choose replacements for unlisted models.</p></details>}
        <div className="dialog-actions"><button type="button" className="primary-button" onClick={save}><Save size={18}/>{id ? 'Save changes' : 'Save build'}</button>{id && <button type="button" className="secondary-button danger-button" onClick={async () => { if (!await confirm({ title: 'Delete saved build?', message: 'Permanently delete "' + name + '"?', confirmLabel: 'Delete build', tone: 'danger' })) return; try { await deleteDoc(recordRef(plansPath, id)); setId(''); setDirty(true); setPlanOpen(false) } catch { setError('Unable to delete the build.') } }}><Trash2 size={18}/>Delete build</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}
      </div></Dialog>}
      <div className="pc-build-feedback">{errors.map(error => <p className="form-error" key={error}>{error}</p>)}{unavailable && <p className="form-error">One or more selected parts are unavailable. Choose replacements.</p>}{message && <p className="save-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}{missing.length > 0 && <p className="storage-caption">Still needed: {missing.map(part => part.name).join(', ')}. Check compatibility before ordering.</p>}</div>
      <div className="pc-build-actions">
        <button type="button" className="primary-button" onClick={() => setPlanOpen(true)}><Save size={17}/>Save build</button>
        <button type="button" className="secondary-button" disabled={!stockSelected.length || customSelected.length > 0 || incompleteCustom || unavailable || !!errors.length} onClick={() => navigate(user?.role === 'user' ? '/customer/shop' : '/pos', { state: { parts: stockSelected.map(item => item.id), pcSet: missing.length === 0 } })}><ShoppingCart size={17}/>{missing.length ? 'Order selected parts' : 'Order PC set'}</button>
        {user?.role === 'user' && <><button type="button" className="primary-button" disabled={requested || !selected.length} onClick={() => setRequestOpen(true)}><ArrowRight size={17}/>{requested ? 'Request saved' : 'Request a quote'}</button>{requested && <Link className="text-button" to="/customer/records?tab=requests">View build requests</Link>}</>}
        <button type="button" className="text-button" aria-label="Start a new build" onClick={startNew}><Trash2 size={17}/>New build</button>
        <button type="button" className="icon-button" aria-label="How is the tier estimated?" title="How is the tier estimated?" onClick={() => setTierHelp(true)}><Info size={18}/></button>
      </div>
    </section>
    {requestOpen && <Dialog title="Request this build" onClose={() => setRequestOpen(false)}><p className="dialog-description">{name || 'Unnamed build'} / {selected.length} selected components. Review your intended use before saving the request.</p><div className="portal-form settings-fields"><label>Primary use<select value={useCase} onChange={e => { setUseCase(e.target.value); setRequested(false) }}>{directory.uses.map(value => <option key={value}>{value}</option>)}</select></label><label>Build request notes<textarea rows={3} maxLength={1000} value={requestNotes} onChange={e => { setRequestNotes(e.target.value); setRequested(false) }} /></label><button className="primary-button" disabled={requested || !selected.length} onClick={requestBuild}><ArrowRight size={18} />{requested ? 'Request saved' : 'Send request'}</button>{error && <p role="alert" className="form-error">{error}</p>}</div></Dialog>}
    {tierHelp && <Dialog title="How the PC tier is estimated" onClose={() => setTierHelp(false)}><div className="help-copy"><p>The tier is calculated from the selected CPU, graphics card, and RAM. The weakest rated component sets the PC tier. The directory uses the part specifications below when present; otherwise it uses the fallback component rating entered by the workshop.</p><dl className="detail-list"><div><dt>Mid</dt><dd>4 CPU cores, 4 GB graphics memory, or 16 GB RAM</dd></div><div><dt>High</dt><dd>8 CPU cores, 12 GB graphics memory, or 32 GB RAM</dd></div></dl><p>This is a planning estimate, not a benchmark. Hardware generation and exact models can change performance. The workshop confirms compatibility before assembly.</p></div></Dialog>}
  </>
}
