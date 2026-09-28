import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { where } from 'firebase/firestore'
import { useSearchParams } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { useDirectories } from '../../lib/directories'
import { prepareExcel } from '../../lib/excel'
import { availableStock } from '../../lib/workflow'
import type { ComponentType, CustomPcRequest, InventoryItem, Tier } from '../../types'
import { savePcRequest, updatePendingPcRequest } from '../customer/customerOperations'
import {
  saveBuildPlan,
  removeBuildPlan,
  type Plan,
  type Selection,
  type CustomParts,
} from './buildPlans'
import { compatibility, compatibilitySummary, componentOf, components, isPcPart } from './pc'
import { inferBuildTier, recommendPreset } from './recommendations'

export function usePcBuilder() {
  const [directory] = useDirectories()
  const [planOpen, setPlanOpen] = useState(false),
    [editingPart, setEditingPart] = useState<ComponentType | null>(null),
    [partEditorOpen, setPartEditorOpen] = useState(true)
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const editId = params.get('edit')
  const [editingRequestId, setEditingRequestId] = useState('')
  const loadedEdit = useRef('')
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
  const editRequests = useLiveCollection<CustomPcRequest>(
    'pcRequests',
    !!editId && user?.role === 'user',
    [where('customerId', '==', user?.id ?? '')],
    user?.id ?? '',
  )
  const loadingRequest = !!editId && editRequests.loading
  const editLocked =
    !!editingRequestId &&
    editRequests.rows.some(
      (request) => request.id === editingRequestId && request.status !== 'Quote requested',
    )
  const [selection, setSelection] = useState<Selection>({}),
    [name, setName] = useState(''),
    [budget, setBudget] = useState(''),
    [id, setId] = useState('')
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  // Hydrate the editable form once when the live request snapshot arrives.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      !editId ||
      !user ||
      user.role !== 'user' ||
      editRequests.loading ||
      loadedEdit.current === editId
    )
      return
    if (editRequests.error) {
      setError(editRequests.error)
      return
    }
    const request = editRequests.rows.find((item) => item.id === editId) ?? null
    if (!request || request.customerId !== user.id || request.status !== 'Quote requested') {
      setError('This pre-order can no longer be edited. Check its status in My records.')
      return
    }
    loadedEdit.current = editId
    const [buildName, ...rest] = request.notes.split('\n')
    setName(buildName || 'My PC build')
    setRequestNotes(rest.join('\n'))
    setUseCase(request.useCase)
    setBudget(request.budget)
    const nextSelection: Selection = {}
    const nextCustom: CustomParts = {}
    for (const part of request.parts ?? []) {
      if (part.source === 'inventory' || part.source === 'Stock') {
        if (part.inventoryId) nextSelection[part.component] = part.inventoryId
      } else {
        nextSelection[part.component] = '__custom'
        nextCustom[part.component] = {
          brand: part.brand,
          model: part.model,
          notes: part.specs,
          socket: part.compatibility?.socket ?? '',
          memoryType: part.compatibility?.memoryType ?? '',
          capacity: '',
          compatibility: part.compatibility,
        }
      }
    }
    setSelection(nextSelection)
    setCustom(nextCustom)
    setEditingRequestId(request.id)
  }, [editId, editRequests.error, editRequests.loading, editRequests.rows, user])
  /* eslint-enable react-hooks/set-state-in-effect */
  const selectedIds = Object.values(selection).filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id !== '__custom',
  )
  const missingCatalogSelections = selectedIds.some(
    (id) => !inventory.some((item) => item.id === id && isPcPart(item)),
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
  const tier = inferBuildTier(selected)
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
  async function applyPreset(nextTier: Tier) {
    const preset = recommendPreset(inventory, nextTier)
    if (!Object.keys(preset).length) {
      setError('No catalog parts are available for a preset yet.')
      return
    }
    if (
      selected.length &&
      !(await confirm({
        title: `Load ${nextTier.toLowerCase()} tier recommendation?`,
        message:
          'This replaces your current component choices. You can change every part afterward.',
        confirmLabel: 'Load recommendation',
      }))
    )
      return
    change()
    setSelection(preset)
    if (!name.trim()) setName(`${nextTier} ${useCase} build`)
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
      useCase,
      requestNotes,
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
    if (saving.current) return false
    if (
      dirty &&
      !(await confirm({
        title: 'Start a new build?',
        message: 'Discard the unsaved changes in this build?',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      }))
    )
      return false
    setSelection({})
    setCustom({})
    setRequested(false)
    setName('')
    setBudget('')
    setUseCase('Gaming')
    setRequestNotes('')
    setId('')
    setEditingRequestId('')
    loadedEdit.current = ''
    if (editId) setParams({}, { replace: true })
    setDirty(false)
    setMessage('')
    setError('')
    return true
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
    saving.current = true
    setBusy(true)
    try {
      if (
        !(await confirm({
          title: editingRequestId ? 'Save pre-order changes?' : 'Submit PC pre-order?',
          message: errors.length
            ? `This build has ${errors.length} known compatibility ${errors.length === 1 ? 'conflict' : 'conflicts'}. Send it for workshop review anyway?`
            : `Send ${name.trim()} for workshop review? No payment is collected now.`,
          confirmLabel: editingRequestId ? 'Save changes' : 'Submit pre-order',
        }))
      )
        return
      const model = (component: ComponentType) => {
        const item = selected.find((value) => componentOf(value) === component)
        return item
          ? [item.brand, item.model || item.name].filter(Boolean).join(' / ')
          : 'Needs guidance'
      }
      const request = {
        requestType: 'Pre-order' as const,
        tier,
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
          source: item.id.startsWith('custom:')
            ? ('customer_owned' as const)
            : ('inventory' as const),
          compatibility: item.id.startsWith('custom:') ? item : undefined,
        })),
        notes: name + '\n' + requestNotes,
      }
      if (editingRequestId) await updatePendingPcRequest(user!, editingRequestId, request)
      else await savePcRequest(user!, request)
      setRequested(true)
      setRequestOpen(false)
      setMessage(
        editingRequestId
          ? 'Pre-order updated. JBC will review your latest selections.'
          : 'Pre-order submitted. JBC will review compatibility, availability, and the final quote.',
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
    if (saving.current) return false
    if (
      dirty &&
      !(await confirm({
        title: 'Load another build?',
        message: 'Discard unsaved changes and open the selected build?',
        confirmLabel: 'Discard and load',
        tone: 'danger',
      }))
    )
      return false
    const plan = plans.find((value) => value.id === nextId)
    setId(plan?.id ?? '')
    setName(plan?.name ?? '')
    setBudget(plan?.budget ?? '')
    setUseCase(plan?.useCase ?? 'Gaming')
    setRequestNotes(plan?.requestNotes ?? '')
    setSelection(plan?.selection ?? {})
    setCustom(plan?.custom ?? {})
    setRequested(false)
    setDirty(false)
    setError('')
    setMessage('')
    return true
  }
  return {
    busy,
    loadingRequest,
    editLocked,
    editingRequestId,
    applyPreset,
    tier,
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
    missingCatalogSelections,
    incompleteCustom,
    invalidCustom,
    change,
    save,
    startNew,
    exportBuild,
    requestBuild,
    deletePlan,
  }
}
