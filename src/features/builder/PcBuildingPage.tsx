import { ArrowRight, FolderOpen, Pencil, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../../components/ui/Dialog'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { RequestQueue } from '../services/RequestQueue'
import { ComponentSelector } from './ComponentSelector'
import { componentOf, components } from './pc'
import { Pc3dBuilder } from './Pc3dBuilder'
import { usePcBuilder } from './usePcBuilder'

export function PcBuildingPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState(user?.role === 'admin' ? 'requests' : 'builder')
  return (
    <>
      {user?.role === 'admin' && (
        <>
          <PageHeader
            eyebrow="PC BUILDS"
            title="PC Builds"
            description="Review customer quotations and use the shared 3D builder."
          />
          <div className="record-tabs">
            <button
              className={tab === 'requests' ? 'primary-button' : 'secondary-button'}
              onClick={() => setTab('requests')}
            >
              Requests & quotes
            </button>
            <button
              className={tab === 'builder' ? 'primary-button' : 'secondary-button'}
              onClick={() => setTab('builder')}
            >
              Builder tool
            </button>
          </div>
        </>
      )}
      {tab === 'requests' ? <RequestQueue scope="builds" /> : <BuilderTool />}
    </>
  )
}
function BuilderTool() {
  const {
    busy,
    directory,
    loadPlan,
    inventoryLoading,
    inventoryError,
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
    message,
    error,
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
  } = usePcBuilder()

  return (
    <>
      {plansError && (
        <p className="form-error" role="alert">
          {plansError}
        </p>
      )}
      {user?.role !== 'admin' ? (
        <PageHeader
          eyebrow="BUILD STUDIO"
          title="PC Builder"
          description="Configure your PC using available JBC components or parts you already own."
        >
          <ExcelButton disabled={!selected.length} onExport={exportBuild} />
        </PageHeader>
      ) : (
        <div className="admin-builder-toolbar">
          <div>
            <span className="eyebrow">BUILD STUDIO</span>
            <h2>Configure a PC</h2>
          </div>
          <ExcelButton disabled={!selected.length} onExport={exportBuild} />
        </div>
      )}
      <div className="builder-workspace" aria-busy={busy}>
        <Pc3dBuilder
          selected={Object.fromEntries(
            Object.entries(selection).map(([key, value]) => [
              key,
              value === '__custom' ? 'custom:' + key : value,
            ]),
          )}
          inventory={[
            ...inventory,
            ...customSelected.map((item) => ({ ...item, kind: 'part' as const, stock: 1 })),
          ]}
          onSelectionChange={(changes) => {
            change()
            setSelection((current) => ({ ...current, ...changes }))
          }}
          onSelect={(part) => {
            setPartEditorOpen(true)
            setEditingPart(part)
          }}
        />
        <section className="pc-build-tools" aria-label="Build settings and actions">
          <div className="pc-build-tools-top">
            <details
              className="pc-parts-editor"
              open={partEditorOpen}
              onToggle={(event) => setPartEditorOpen(event.currentTarget.open)}
            >
              <summary>
                <Pencil size={16} />
                Choose components
              </summary>
              <div className="pc-parts-editor-list">
                {components.map((part) => (
                  <ComponentSelector
                    key={part.name}
                    part={part}
                    openPart={editingPart}
                    onClose={() =>
                      setEditingPart((current) => (current === part.name ? null : current))
                    }
                    selection={selection}
                    custom={custom}
                    inventory={inventory}
                    loading={inventoryLoading}
                    error={inventoryError}
                    memoryTypes={directory.memory}
                    onChange={change}
                    onSelectionChange={(component, value) =>
                      setSelection((current) => ({ ...current, [component]: value }))
                    }
                    onCustomChange={(component, value) =>
                      setCustom((current) => ({ ...current, [component]: value }))
                    }
                  />
                ))}
              </div>
            </details>
            <button
              type="button"
              className="secondary-button pc-build-details-button"
              onClick={() => setPlanOpen(true)}
              title="Build details"
              aria-label="Build details"
            >
              <FolderOpen size={18} />
              <span>{name || 'Build details'}</span>
            </button>
            <div className="pc-build-total">
              <span>JBC parts subtotal</span>
              <strong>{formatPHP(total)}</strong>
              <small>
                {customSelected.length
                  ? 'Customer-owned parts included'
                  : selected.length + ' of 8 components selected'}
              </small>
            </div>
          </div>
          {planOpen && (
            <Dialog
              title="Build details"
              onClose={() => {
                if (!busy) setPlanOpen(false)
              }}
            >
              <div className="portal-form settings-fields">
                <label>
                  Saved builds
                  <select
                    disabled={busy}
                    aria-label="Saved builds"
                    value={id}
                    onChange={(e) => void loadPlan(e.target.value)}
                  >
                    <option value="">New build</option>
                    {plans.map((plan) => (
                      <option value={plan.id} key={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Build name
                  <input
                    value={name}
                    maxLength={100}
                    onChange={(e) => {
                      change()
                      setName(e.target.value)
                    }}
                  />
                </label>
                <label>
                  Target budget (PHP)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(e) => {
                      change()
                      setBudget(e.target.value)
                    }}
                  />
                </label>
                {plans.find((plan) => plan.id === id)?.legacyNotes && (
                  <details>
                    <summary>Previous manual plan</summary>
                    <p className="legacy-plan storage-caption">
                      {plans.find((plan) => plan.id === id)?.legacyNotes}
                    </p>
                    <p className="storage-caption">
                      Matching stock is selected automatically. Choose replacements for unlisted
                      models.
                    </p>
                  </details>
                )}
                <div className="dialog-actions">
                  <button type="button" className="primary-button" disabled={busy} onClick={save}>
                    <Save size={18} />
                    {busy ? 'Saving?' : id ? 'Save changes' : 'Save build'}
                  </button>
                  {id && (
                    <button
                      type="button"
                      className="secondary-button danger-button"
                      disabled={busy}
                      onClick={deletePlan}
                    >
                      <Trash2 size={18} />
                      Delete build
                    </button>
                  )}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </Dialog>
          )}
          <section className="build-intelligence" aria-label="Your build">
            <div>
              <small>YOUR BUILD</small>
              <strong>{selected.length} / 8 components selected</strong>
              <span>
                <CompatibilityIcon size={16} aria-hidden="true" />{' '}
                {intelligence.status === 'Needs attention'
                  ? 'Incomplete information'
                  : intelligence.status === 'Compatible'
                    ? 'No known conflicts'
                    : intelligence.status}
              </span>
            </div>
            <div>
              <small>Estimated power</small>
              <strong>
                {intelligence.powerEstimateReady
                  ? `~${intelligence.wattage} W`
                  : 'Not available yet'}
              </strong>
              <small>
                Approximate, with standard allowances. Confirm manufacturer requirements.
              </small>
            </div>
            <div>
              <small>JBC parts subtotal</small>
              <strong>{formatPHP(total)}</strong>
              <small>Customer-owned components excluded</small>
            </div>
          </section>
          <div className="pc-build-feedback">
            {errors.map((error) => (
              <p className="form-error" key={error}>
                {error}
              </p>
            ))}
            {unavailable && (
              <p className="form-error">
                One or more selected parts are unavailable. Choose replacements.
              </p>
            )}
            {message && (
              <p className="save-message" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {missing.length > 0 && (
              <p className="storage-caption">
                Still needed: {missing.map((part) => part.name).join(', ')}. Check compatibility
                before ordering.
              </p>
            )}
          </div>
          {!selected.length && (
            <p className="storage-caption">
              Select at least one component before requesting a quote. You can save an unfinished
              draft.
            </p>
          )}
          <p className="builder-model-note">Generic model; labels reflect your selected parts.</p>
          <div className="pc-build-actions">
            <button type="button" className="primary-button" onClick={() => setPlanOpen(true)}>
              <Save size={17} />
              Save build
            </button>
            <button type="button" className="secondary-button" onClick={() => setSummaryOpen(true)}>
              View build summary
            </button>
            {user?.role === 'user' && (
              <>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || requested || !selected.length || !!errors.length || unavailable}
                  onClick={() => setRequestOpen(true)}
                >
                  <ArrowRight size={17} />
                  {requested ? 'Request saved' : 'Request a quote'}
                </button>
                {requested && (
                  <Link className="text-button" to="/customer/records?tab=requests">
                    View build requests
                  </Link>
                )}
              </>
            )}
            <button
              type="button"
              className="text-button"
              aria-label="Start a new build"
              disabled={busy}
              onClick={startNew}
            >
              <Trash2 size={17} />
              New build
            </button>
          </div>
        </section>
      </div>
      {summaryOpen && (
        <Dialog title="Build summary" wide onClose={() => setSummaryOpen(false)}>
          <div className="portal-form settings-fields">
            {components.map((part) => {
              const item = selected.find((item) => componentOf(item) === part.name)
              return (
                <div className="directory-row" key={part.name}>
                  <strong>{part.name}</strong>
                  <span>
                    {item?.name || 'Missing component'}
                    <small>
                      {item?.id.startsWith('custom:')
                        ? 'Customer owned'
                        : item
                          ? 'JBC inventory'
                          : 'Not selected'}
                    </small>
                  </span>
                  <b>{item && !item.id.startsWith('custom:') ? formatPHP(item.price) : 'N/A'}</b>
                </div>
              )
            })}
            <h3>{intelligence.status}</h3>
            {errors.map((value) => (
              <p className="form-error" key={value}>
                {value}
              </p>
            ))}
            {intelligence.unknown.map((value) => (
              <p key={value}>{value}: needs JBC review</p>
            ))}
            <p>
              Estimated power:{' '}
              {intelligence.powerEstimateReady ? `${intelligence.wattage} W` : 'Not available yet'}
            </p>
            <strong>JBC parts subtotal: {formatPHP(total)}</strong>
          </div>
        </Dialog>
      )}
      {requestOpen && (
        <Dialog
          title="Request this build"
          onClose={() => {
            if (!busy) setRequestOpen(false)
          }}
        >
          <p className="dialog-description">
            {name || 'Unnamed build'} / {selected.length} selected components. Review your intended
            use before saving the request.
          </p>
          <div className="portal-form settings-fields">
            <dl className="quote-part-summary">
              {selected.map((item) => (
                <div key={item.id}>
                  <dt>
                    {componentOf(item)}
                    <small>{item.name}</small>
                  </dt>
                  <dd>
                    {item.id.startsWith('custom:') ? 'Customer owned' : formatPHP(item.price)}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              <strong>JBC parts subtotal: {formatPHP(total)}</strong>
              <br />A quote request is not an order or a payment.
            </p>
            <label>
              Build name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => {
                  change()
                  setName(e.target.value)
                }}
              />
            </label>
            <label>
              Primary use
              <select
                value={useCase}
                onChange={(e) => {
                  setUseCase(e.target.value)
                  setRequested(false)
                }}
              >
                {directory.uses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Build request notes
              <textarea
                rows={3}
                maxLength={1000}
                value={requestNotes}
                onChange={(e) => {
                  setRequestNotes(e.target.value)
                  setRequested(false)
                }}
              />
            </label>
            <button
              className="primary-button"
              disabled={
                requested || !selected.length || !name.trim() || !!errors.length || unavailable
              }
              onClick={requestBuild}
            >
              <ArrowRight size={18} />
              {busy ? 'Sending?' : requested ? 'Request saved' : 'Send request'}
            </button>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
