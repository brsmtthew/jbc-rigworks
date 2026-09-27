import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { useDirectories } from '../../lib/directories'
import { prepareExcel } from '../../lib/excel'
import { availableStock } from '../../lib/workflow'
import type { ComponentType, InventoryItem } from '../../types'
import { savePcRequest } from '../customer/customerOperations'
import {
  saveBuildPlan,
  removeBuildPlan,
  type Plan,
  type Selection,
  type CustomParts,
} from './buildPlans'
import { compatibility, compatibilitySummary, componentOf, components, isPcPart } from './pc'

export function usePcBuilder() {
  const [directory] = useDirectories()
  const [planOpen, setPlanOpen] = useState(false),
    [editingPart, setEditingPart] = useState<ComponentType | null>(null),
    [partEditorOpen, setPartEditorOpen] = useState(true)
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const { inventory, loading: inventoryLoading, storageError: inventoryError } = useWorkspace()
  const [requestOpen, setRequestOpen] = useState(false),
    [summaryOpen, setSummaryOpen] = useState(false)
  const [custom, setCustom] = useState<CustomParts>({})
  const [useCase, setUseCase] = useState('Gaming'),
    [requestNotes, setRequestNotes] = useState(''),
    [requested, setRequested] = useState(false)
  const plansPath = `users/${user!.id}/plans`
  const { rows: plans, error: plansError } = useLiveCollection<Plan>(plansPath, !!user)
  const [selection, setSelection] = useState<Selection>({}),
    [name, setName] = useState(''),
    [budget, setBudget] = useState(''),
    [id, setId] = useState('')
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const selectedIds = Object.values(selection).filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id !== '__custom',
  )
  const stockSelected = selectedIds
    .map((id) => inventory.find((item) => item.id === id))
    .filter((item): item is InventoryItem => !!item && isPcPart(item))
  const customSelected: InventoryItem[] = components.flatMap((part) => {
    const value = custom[part.name]
    if (selection[part.name] !== '__custom' || !value?.model.trim()) return []
    return [
      {
        id: 'custom:' + part.name,
        name: value.model,
        sku: '',
        category: part.name,
        component: part.name,
        stock: 0,
        minimum: 0,
        price: 0,
        cost: 0,
        brand: value.brand,
        specs: value.notes,
        socket: value.socket,
        memoryType: value.memoryType,
        ...value.compatibility,
      },
    ]
  })
  const selected = [...stockSelected, ...customSelected]
  const incompleteCustom = components.some(
    (part) => selection[part.name] === '__custom' && !custom[part.name]?.model.trim(),
  )
  const invalidCustom = components.some((part) => {
    const value = custom[part.name]?.capacity
    return (
      selection[part.name] === '__custom' &&
      ['Processor', 'Memory', 'Graphics'].includes(part.name) &&
      value !== undefined &&
      value !== '' &&
      (!Number.isSafeInteger(Number(value)) ||
        Number(value) < (part.name === 'Graphics' ? 0 : 1) ||
        Number(value) > 4096)
    )
  })
  const total = selected.reduce((sum, item) => sum + item.price, 0)
  const intelligence = compatibilitySummary(selected)
  const CompatibilityIcon =
    intelligence.status === 'Compatible'
      ? CircleCheck
      : intelligence.status === 'Incompatible'
        ? CircleX
        : intelligence.status === 'Not yet checked'
          ? CircleHelp
          : TriangleAlert
  const errors = compatibility(selected)
  const missing = components.filter(
    (part) => !selected.some((item) => componentOf(item) === part.name),
  )
  const unavailable = selectedIds.some(
    (id) => !inventory.some((item) => item.id === id && isPcPart(item) && availableStock(item) > 0),
  )
  const change = () => {
    setRequested(false)
    setDirty(true)
    setMessage('')
    setError('')
  }
  async function save() {
    if (saving.current) return
    if (invalidCustom) {
      setError('Enter valid whole-number hardware specifications.')
      return
    }
    if (!name.trim()) {
      setError('Enter a build name.')
      return
    }
    if (Number(budget) < 0 || !Number.isFinite(Number(budget))) {
      setError('Enter a valid budget.')
      return
    }
    const nextId = id || crypto.randomUUID()
    const record = {
      id: nextId,
      name: name.trim(),
      budget,
      selection,
      custom,
      legacyNotes: plans.find((plan) => plan.id === nextId)?.legacyNotes,
    }
    saving.current = true
    setBusy(true)
    try {
      if (
        !(await confirm({
          title: id ? 'Save build changes?' : 'Save this build?',
          message: `${id ? 'Update' : 'Save'} “${record.name}” to your saved builds?`,
          confirmLabel: id ? 'Save changes' : 'Save build',
        }))
      )
        return
      await saveBuildPlan(user!.id, record)
      setId(nextId)
      setDirty(false)
      setError('')
      setMessage('Build saved. Stock and prices are rechecked whenever you open it.')
      setPlanOpen(false)
    } catch {
      setError('Unable to save this build. Check your connection.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  async function startNew() {
    if (saving.current) return
    if (
      dirty &&
      !(await confirm({
        title: 'Start a new build?',
        message: 'Discard the unsaved changes in this build?',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      }))
    )
      return
    setSelection({})
    setCustom({})
    setRequested(false)
    setName('')
    setBudget('')
    setId('')
    setDirty(false)
    setMessage('')
    setError('')
  }
  function exportBuild() {
    return prepareExcel(name || 'pc-build', [
      ['Component', 'Model', 'SKU', 'Price PHP'],
      ...components.map((part) => {
        const item = selected.find((item) => componentOf(item) === part.name)
        return [
          part.name,
          item?.name ?? 'Not selected',
          item?.sku ?? '',
          item?.id.startsWith('custom:') ? 'Quote required' : (item?.price ?? ''),
        ]
      }),
      ['Stock subtotal', '', '', total],
      ['Budget', '', '', Number(budget) || 0],
    ])
  }
  async function requestBuild() {
    if (saving.current || requested) return
    setError('')
    setMessage('')
    if (invalidCustom) {
      setError('Enter valid whole-number hardware specifications.')
      return
    }
    if (!selected.length || incompleteCustom || !name.trim()) {
      setError('Name your build and select at least one complete part.')
      return
    }
    if (!Number.isFinite(Number(budget)) || Number(budget) < 0) {
      setError('Enter a valid budget.')
      return
    }
    if (errors.length) {
      setError('Resolve the listed compatibility conflicts first.')
      return
    }
    saving.current = true
    setBusy(true)
    try {
      if (
        !(await confirm({
          title: 'Send build request?',
          message: `Save your ${name.trim()} request for workshop review?`,
          confirmLabel: 'Send request',
        }))
      )
        return
      const model = (component: ComponentType) => {
        const item = selected.find((value) => componentOf(value) === component)
        return item
          ? [item.brand, item.model || item.name].filter(Boolean).join(' / ')
          : 'Needs guidance'
      }
      await savePcRequest(user!, {
        useCase,
        budget,
        processor: model('Processor'),
        graphics: model('Graphics'),
        memory: model('Memory'),
        storage: model('Storage'),
        parts: selected.map((item) => ({
          component: componentOf(item)!,
          model: item.model || item.name,
          brand: item.brand,
          specs: item.specs,
          price: item.price,
          inventoryId: item.id.startsWith('custom:') ? undefined : item.id,
          source: item.id.startsWith('custom:') ? 'customer_owned' : 'inventory',
          compatibility: item.id.startsWith('custom:') ? item : undefined,
        })),
        notes: name + '\n' + requestNotes,
      })
      setRequested(true)
      setRequestOpen(false)
      setMessage(
        'Build request sent. JBC will review compatibility, availability, and your final quote.',
      )
    } catch {
      setError(
        'Could not save this request. Your selected parts are still here; check your connection and try again.',
      )
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  async function deletePlan() {
    if (saving.current || !id || !user) return
    saving.current = true
    setBusy(true)
    try {
      if (
        !(await confirm({
          title: 'Delete saved build?',
          message: 'Permanently delete "' + name + '"?',
          confirmLabel: 'Delete build',
          tone: 'danger',
        }))
      )
        return
      await removeBuildPlan(user.id, id)
      setId('')
      setDirty(true)
      setPlanOpen(false)
    } catch {
      setError('Unable to delete the build.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  async function loadPlan(nextId: string) {
    if (saving.current) return
    if (
      dirty &&
      !(await confirm({
        title: 'Load another build?',
        message: 'Discard unsaved changes and open the selected build?',
        confirmLabel: 'Discard and load',
        tone: 'danger',
      }))
    )
      return
    const plan = plans.find((value) => value.id === nextId)
    setId(plan?.id ?? '')
    setName(plan?.name ?? '')
    setBudget(plan?.budget ?? '')
    setSelection(plan?.selection ?? {})
    setCustom(plan?.custom ?? {})
    setRequested(false)
    setDirty(false)
    setError('')
    setMessage('')
  }
  return {
    busy,
    loadPlan,
    inventoryLoading,
    inventoryError,
    directory,
    planOpen,
    setPlanOpen,
    editingPart,
    setEditingPart,
    partEditorOpen,
    setPartEditorOpen,
    user,
    inventory,
    requestOpen,
    setRequestOpen,
    summaryOpen,
    setSummaryOpen,
    custom,
    setCustom,
    useCase,
    setUseCase,
    requestNotes,
    setRequestNotes,
    requested,
    setRequested,
    plans,
    plansError,
    selection,
    setSelection,
    name,
    setName,
    budget,
    setBudget,
    id,
    setId,
    message,
    setMessage,
    error,
    setError,
    dirty,
    customSelected,
    selected,
    total,
    intelligence,
    CompatibilityIcon,
    errors,
    missing,
    unavailable,
    change,
    save,
    startNew,
    exportBuild,
    requestBuild,
    deletePlan,
  }
}
