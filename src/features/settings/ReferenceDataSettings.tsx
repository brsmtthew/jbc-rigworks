import { FolderCog, Pencil, Plus, ReceiptText, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ActionButton } from '../../components/ui/ActionButton'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { NumberInput } from '../../components/ui/NumberInput'
import { useWorkspace } from '../../hooks/useWorkspace'
import {
  directoryLabels,
  useDirectories,
  type DirectoryGroup,
  type FeePreset,
} from '../../lib/directories'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import { useAllRequests } from '../customer/useCustomerRequests'

export function ReferenceDataSettings({ embedded = false }: { embedded?: boolean }) {
  const workspace = useWorkspace()
  const requests = useAllRequests(true)
  const referencesTo = (value: string, group: DirectoryGroup) => {
    const records = [
      ...workspace.inventory,
      ...workspace.expenses,
      ...workspace.jobs,
      ...workspace.sales,
      ...requests.appointments,
      ...requests.requests,
      ...workspace.sales.flatMap((sale) => sale.lines ?? []),
    ]
    const listField =
      group === 'sockets'
        ? 'supportedSockets'
        : group === 'formFactors'
          ? 'supportedFormFactors'
          : group === 'storageInterfaces'
            ? 'storageInterfaces'
            : null
    const exactMatches = records.filter((record) => Object.values(record).includes(value)).length
    if (!listField) return exactMatches
    const listMatches = workspace.inventory.filter((item) => {
      if (Object.values(item).includes(value)) return false
      const list = item[listField]
      return typeof list === 'string' &&
        list.split(/[,;|]/).some((entry) => entry.trim() === value)
    }).length
    return exactMatches + listMatches
  }
  const [data, save, directoryStatus] = useDirectories(true)
  const [shop, saveShop, shopStatus] = useShopSettings()
  const { confirm } = useConfirmation()
  const [group, setGroup] = useState<DirectoryGroup | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [feesOpen, setFeesOpen] = useState(false)
  const [fee, setFee] = useState<FeePreset | null>(null)
  const [defaults, setDefaults] = useState({ taxRate: shop.taxRate, labor: shop.labor })

  async function attempt(action: () => Promise<void>) {
    try {
      await action()
      setError('')
    } catch (err) {
      setError(humanError(err))
    }
  }

  async function storeOption() {
    if (!group || requests.loading || workspace.loading) return
    const next = value.trim()
    if (editing && editing !== next && referencesTo(editing, group) > 0) {
      setError(
        'This value is in use. Deactivate it and add a new value to preserve historical records.',
      )
      return
    }
    if (
      !next ||
      data[group].some((item) => item.toLowerCase() === next.toLowerCase() && item !== editing)
    ) {
      setError('Enter a unique, nonempty value.')
      return
    }
    if (['sockets', 'formFactors', 'storageInterfaces'].includes(group) && /[,;|]/.test(next)) {
      setError('This compatibility value cannot contain commas, semicolons, or vertical bars.')
      return
    }
    if (
      !(await confirm({
        title: editing ? 'Save directory change?' : 'Add directory value?',
        message: editing
          ? `Save the change to “${editing}”?`
          : `Add “${next}” to ${directoryLabels[group]}?`,
        confirmLabel: editing ? 'Save changes' : 'Add value',
      }))
    )
      return
    await attempt(async () => {
      await save({
        ...data,
        [group]: editing
          ? data[group].map((item) => (item === editing ? next : item))
          : [...data[group], next],
      })
      setValue('')
      setEditing(null)
    })
  }

  async function removeOption(item: string) {
    if (!group || requests.loading || workspace.loading) return
    const references = referencesTo(item, group)
    if (references) {
      setError(`${item} is used by ${references} records. Deactivate it instead of deleting it.`)
      return
    }
    if (data[group].length < 2) {
      setError('Keep at least one value in this directory.')
      return
    }
    if (
      !(await confirm({
        title: 'Delete directory value?',
        message: `Remove “${item}” from future forms? Existing records keep their saved values.`,
        confirmLabel: 'Delete value',
        tone: 'danger',
      }))
    )
      return
    await attempt(() => save({ ...data, [group]: data[group].filter((value) => value !== item) }))
  }

  async function saveDefaults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !Number.isFinite(defaults.taxRate) ||
      defaults.taxRate < 0 ||
      defaults.taxRate > 100 ||
      !Number.isFinite(defaults.labor) ||
      defaults.labor < 0
    ) {
      setError('Check the default amounts.')
      return
    }
    if (
      !(await confirm({
        title: 'Save fee defaults?',
        message: 'Apply these tax and labor defaults to new transactions?',
        confirmLabel: 'Save defaults',
      }))
    )
      return
    await attempt(async () => {
      await saveShop({ ...shop, ...defaults })
      setFeesOpen(false)
    })
  }

  async function removeFee(item: FeePreset) {
    if (
      !(await confirm({
        title: 'Delete fee preset?',
        message: `Delete “${item.name}”?`,
        confirmLabel: 'Delete preset',
        tone: 'danger',
      }))
    )
      return
    await attempt(() => save({ ...data, fees: data.fees.filter((value) => value.id !== item.id) }))
  }

  async function saveFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fee) return
    if (
      !fee.name.trim() ||
      !Number.isFinite(fee.value) ||
      fee.value < 0 ||
      (fee.kind === 'taxRate' && fee.value > 100)
    ) {
      setError('Enter a name and valid amount.')
      return
    }
    const existing = data.fees.some((item) => item.id === fee.id)
    if (
      !(await confirm({
        title: existing ? 'Save fee preset changes?' : 'Add fee preset?',
        message: `${existing ? 'Save changes to' : 'Add'} “${fee.name.trim()}”?`,
        confirmLabel: existing ? 'Save preset' : 'Add preset',
      }))
    )
      return
    await attempt(async () => {
      await save({
        ...data,
        fees: [
          ...data.fees.filter((item) => item.id !== fee.id),
          { ...fee, name: fee.name.trim() },
        ],
      })
      setFee(null)
    })
  }

  const loadError =
    directoryStatus.error || shopStatus.error || requests.error || workspace.storageError
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>
  if (directoryStatus.loading || shopStatus.loading || requests.loading || workspace.loading)
    return <LoadingState label="Loading directories…" />
  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="SETTINGS"
          title="Reference data"
          description="Manage product, finance, and compatibility values."
        />
      )}
      {embedded && (
        <div className="admin-settings-modal-intro">
          <span className="admin-settings-modal-icon" aria-hidden="true"><FolderCog size={22} /></span>
          <div><span className="eyebrow">SYSTEM LISTS</span><h3>Reference values & tax defaults</h3><p>Manage the choices used by inventory, finance, and checkout forms.</p></div>
        </div>
      )}
      <div className="settings-menu admin-reference-grid">
        {(Object.keys(directoryLabels) as DirectoryGroup[])
          .filter((key) => !['services', 'times'].includes(key))
          .map((key) => (
            <button
              className="settings-tile"
              key={key}
              onClick={() => {
                setGroup(key)
                setEditing(null)
                setValue('')
                setError('')
              }}
            >
              <FolderCog size={25} />
              <span>
                <strong>{directoryLabels[key]}</strong>
                <small>{data[key].length} values</small>
              </span>
            </button>
          ))}
        <button
          className="settings-tile"
          onClick={() => {
            setFeesOpen(true)
            setDefaults({ taxRate: shop.taxRate, labor: shop.labor })
            setError('')
          }}
        >
          <ReceiptText size={25} />
          <span>
            <strong>VAT, fees & deductions</strong>
            <small>Defaults and reusable checkout presets</small>
          </span>
        </button>
      </div>
      <p className="storage-caption">
        Part models, stock quantities, and specifications are maintained in Inventory. Component
        types and transaction statuses are fixed workflow categories.
      </p>

      {group && (
        <Dialog title={directoryLabels[group]} onClose={() => setGroup(null)}>
          <div className="directory-values">
            {data[group].map((item) => (
              <div className="directory-row" key={item}>
                <span>{item}</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const inactive = data.inactive[group] ?? []
                    void attempt(() =>
                      save({
                        ...data,
                        inactive: {
                          ...data.inactive,
                          [group]: inactive.includes(item)
                            ? inactive.filter((value) => value !== item)
                            : [...inactive, item],
                        },
                      }),
                    )
                  }}
                >
                  {data.inactive[group]?.includes(item) ? 'Activate' : 'Deactivate'}
                </button>
                <ActionButton
                  label={'Edit ' + item}
                  onClick={() => {
                    setEditing(item)
                    setValue(item)
                  }}
                >
                  <Pencil size={17} />
                </ActionButton>
                <ActionButton label={'Delete ' + item} onClick={() => removeOption(item)}>
                  <Trash2 size={17} />
                </ActionButton>
              </div>
            ))}
          </div>
          <form
            className="portal-form settings-fields"
            onSubmit={(event) => {
              event.preventDefault()
              void storeOption()
            }}
          >
            <label>
              {editing ? 'Edit value' : 'New value'}
              <input
                required
                maxLength={100}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <ActionButton
                type="submit"
                variant="labeled"
                label={editing ? 'Save value' : 'Add value'}
              >
                <Save size={18} />
              </ActionButton>
              {editing && (
                <ActionButton
                  label="New value"
                  onClick={() => {
                    setEditing(null)
                    setValue('')
                  }}
                >
                  <Plus size={19} />
                </ActionButton>
              )}
            </div>
          </form>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </Dialog>
      )}

      {feesOpen && (
        <Dialog title="VAT, fees & deductions" onClose={() => setFeesOpen(false)}>
          <form
            className="portal-form settings-fields"
            onSubmit={(event) => void saveDefaults(event)}
          >
            <div className="portal-form-grid">
              <label>
                Default VAT / tax (%)
                <NumberInput
                  min="0"
                  max="100"
                  step="0.01"
                  value={defaults.taxRate}
                  onValueChange={(value) =>
                    setDefaults({ ...defaults, taxRate: value })
                  }
                />
              </label>
              <label>
                Default labor (PHP)
                <NumberInput
                  min="0"
                  step="0.01"
                  value={defaults.labor}
                  onValueChange={(value) =>
                    setDefaults({ ...defaults, labor: value })
                  }
                />
              </label>
            </div>
            <ActionButton type="submit" variant="labeled" label="Save fee defaults">
              <Save size={18} />
            </ActionButton>
          </form>
          <h3>Checkout presets</h3>
          <div className="directory-values">
            {data.fees.map((item) => (
              <div className="directory-row" key={item.id}>
                <span>
                  {item.name}
                  <small>
                    {item.kind} / {item.value}
                    {item.kind === 'taxRate' ? '%' : ' PHP'}
                  </small>
                </span>
                <ActionButton
                  label={'Edit ' + item.name}
                  onClick={() => {
                    setFee(item)
                    setError('')
                  }}
                >
                  <Pencil size={17} />
                </ActionButton>
                <ActionButton label={'Delete ' + item.name} onClick={() => removeFee(item)}>
                  <Trash2 size={17} />
                </ActionButton>
              </div>
            ))}
          </div>
          <ActionButton
            variant="labeled"
            label="Add fee preset"
            onClick={() => {
              setFee({ id: crypto.randomUUID(), name: '', kind: 'other', value: 0 })
              setError('')
            }}
          >
            <Plus size={18} />
          </ActionButton>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </Dialog>
      )}

      {fee && (
        <Dialog title="Fee preset" onClose={() => setFee(null)}>
          <form className="portal-form settings-fields" onSubmit={(event) => void saveFee(event)}>
            <label>
              Preset name
              <input
                required
                maxLength={100}
                value={fee.name}
                onChange={(event) => setFee({ ...fee, name: event.target.value })}
              />
            </label>
            <label>
              Type
              <select
                value={fee.kind}
                onChange={(event) =>
                  setFee({ ...fee, kind: event.target.value as FeePreset['kind'] })
                }
              >
                <option value="taxRate">VAT / tax percentage</option>
                <option value="labor">Labor charge</option>
                <option value="other">Other fee</option>
                <option value="discount">Deduction</option>
              </select>
            </label>
            <label>
              Amount or percentage
              <NumberInput
                required
                min="0"
                step="0.01"
                max={fee.kind === 'taxRate' ? 100 : undefined}
                value={fee.value}
                onValueChange={(value) => setFee({ ...fee, value })}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <ActionButton type="submit" variant="labeled" label="Save fee preset">
              <Save size={18} />
            </ActionButton>
          </form>
        </Dialog>
      )}
    </>
  )
}
