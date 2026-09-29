import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import type { ComponentType } from '../../types'
import { RequestQueue } from '../services/RequestQueue'
import { ComponentSelector } from './ComponentSelector'
import { componentIcons } from './componentIcons'
import { componentOf, components } from './pc'
import { Pc3dBuilder } from './Pc3dBuilder'
import { usePcBuilder } from './usePcBuilder'
import './pc-builder-page.css'
import './admin-builds.css'

const steps = [
  { title: 'Build brief', detail: 'Name and purpose' },
  { title: 'Choose parts', detail: 'Pick freely or start with a preset' },
  { title: 'Review & pre-order', detail: 'Check and submit for review' },
]

function BuilderHero({ admin }: { admin: boolean }) {
  return (
    <header className="pcb-hero jbc-blue-hero">
      <div className="pcb-hero-copy">
        <span className="pcb-eyebrow">PLAN YOUR BUILD</span>
        {admin ? (
          <h2>Build a PC that fits your plans.</h2>
        ) : (
          <h1>Build a PC that fits your plans.</h1>
        )}
        <p>
          Choose any catalog parts or add parts you own. See the build in 3D, check fit, and send
          a pre-order for workshop review.
        </p>
      </div>
      <div className="pcb-hero-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </header>
  )
}

export function PcBuildingPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState(user?.role === 'admin' ? 'requests' : 'builder')
  return (
    <div className={user?.role === 'admin' ? 'admin-builds-page' : undefined}>
      {user?.role === 'admin' && (
        <>
          {tab === 'requests' && (
            <section className="admin-builds-hero jbc-blue-hero" aria-labelledby="admin-builds-title">
              <div className="admin-builds-hero-copy">
                <div>
                  <span className="eyebrow">CUSTOM BUILD WORKSHOP</span>
                  <h1 id="admin-builds-title">PC Builds</h1>
                  <p>Review customer plans, prepare quotes, and follow each build through completion.</p>
                </div>
              </div>
              <div className="admin-builds-hero-note">
                <span>BUILD WORKFLOW</span>
                <strong>Review <ArrowRight size={15} /> Quote <ArrowRight size={15} /> Build</strong>
                <small>Customer approval comes before parts are reserved.</small>
              </div>
            </section>
          )}
          {tab === 'builder' && (
            <>
              <h1 className="sr-only">PC Builds</h1>
              <BuilderHero admin />
            </>
          )}
          <div className="record-tabs admin-builds-tabs" role="group" aria-label="PC builds view">
            <button
              type="button"
              className={tab === 'requests' ? 'primary-button' : 'secondary-button'}
              aria-pressed={tab === 'requests'}
              onClick={() => setTab('requests')}
            >
              Requests & quotes
            </button>
            <button
              type="button"
              className={tab === 'builder' ? 'primary-button' : 'secondary-button'}
              aria-pressed={tab === 'builder'}
              onClick={() => setTab('builder')}
            >
              Builder tool
            </button>
          </div>
        </>
      )}
      {tab === 'requests' ? <RequestQueue scope="builds" /> : <BuilderTool showHero={user?.role !== 'admin'} />}
    </div>
  )
}

function BuilderTool({ showHero }: { showHero: boolean }) {
  const [params] = useSearchParams()
  const [step, setStep] = useState(params.has('edit') ? 1 : 0)
  const stepsRef = useRef<HTMLOListElement>(null)
  const {
    busy,
    loadingRequest,
    editLocked,
    editingRequestId,
    applyPreset,
    tier,
    directory,
    loadPlan,
    inventoryLoading,
    inventoryError,
    editingPart,
    setEditingPart,
    user,
    inventory,
    custom,
    setCustom,
    useCase,
    setUseCase,
    requestNotes,
    setRequestNotes,
    requested,
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
    missingCatalogSelections,
    incompleteCustom,
    invalidCustom,
    change,
    save,
    startNew,
    exportBuild,
    requestBuild,
    deletePlan,
  } = usePcBuilder()
  const selectedCount = selected.length
  const canRequest =
    !busy &&
    !requested &&
    !!name.trim() &&
    selectedCount > 0 &&
    !loadingRequest &&
    !editLocked &&
    (!params.has('edit') || !!editingRequestId) &&
    !missingCatalogSelections &&
    Number.isFinite(Number(budget)) &&
    Number(budget) >= 0 &&
    !incompleteCustom &&
    !invalidCustom

  function goToStep(next: number) {
    setStep(next)
    requestAnimationFrame(() =>
      stepsRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }),
    )
  }

  function openPart(part: ComponentType) {
    goToStep(1)
    setEditingPart(part)
  }

  return (
    <div className="pc-builder-redesign" data-step={step} aria-busy={busy}>
      {showHero && <BuilderHero admin={user?.role === 'admin'} />}

      <div className="pcb-workflow-intro">
        <strong>Three steps to your PC pre-order</strong>
        <span>
          Start from a recommendation or choose freely. Compatibility findings stay visible while
          you build.
        </span>
      </div>
      {loadingRequest && (
        <p className="storage-caption" role="status">
          Loading your pre-order…
        </p>
      )}
      {editingRequestId && (
        <p className="pcb-edit-banner" role="status">
          {editLocked
            ? 'JBC has started reviewing this pre-order. Editing is now closed.'
            : `Editing pre-order ${editingRequestId}. Changes can be saved until JBC begins review.`}
        </p>
      )}
      <ol ref={stepsRef} className="pcb-steps" aria-label="PC builder progress">
        {steps.map((item, index) => (
          <li
            key={item.title}
            className={`pcb-step ${step === index ? 'is-active' : ''} ${step > index ? 'is-complete' : ''}`}
            aria-current={step === index ? 'step' : undefined}
          >
            <span className="pcb-step-number">
              {step > index ? <Check size={15} /> : `0${index + 1}`}
            </span>
            <span className="pcb-step-text">
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
          </li>
        ))}
      </ol>

      <div className="pcb-layout">
        <div className="pcb-main-column">
          {step === 0 && (
            <section className="pcb-panel pcb-brief" aria-labelledby="pcb-brief-title">
              <div className="pcb-panel-heading">
                <span className="pcb-panel-kicker">STEP 01 / THE BRIEF</span>
                <h2 id="pcb-brief-title">Start with the essentials</h2>
                <p>
                  Give your build a name and a target. You can adjust these as you choose parts.
                </p>
              </div>
              <div className="pcb-step-content" tabIndex={0} aria-label="Build brief fields">
                {plans.length > 0 && (
                  <details className="pcb-drafts">
                    <summary>Resume a previous draft</summary>
                    <div>
                      {plans.map((plan) => (
                        <button
                          type="button"
                          key={plan.id}
                          disabled={busy}
                          onClick={async () => {
                            if (await loadPlan(plan.id)) goToStep(1)
                          }}
                        >
                          <span>{plan.name}</span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                {plansError && (
                  <p className="form-error" role="alert">
                    {plansError}
                  </p>
                )}
                <div className="pcb-fields">
                  <label className="pcb-field">
                    <span>
                      Build name <small>Required to save or request</small>
                    </span>
                    <input
                      value={name}
                      maxLength={100}
                      placeholder="e.g. My gaming setup"
                      onChange={(event) => {
                        change()
                        setName(event.target.value)
                      }}
                    />
                  </label>
                  <label className="pcb-field">
                    <span>Primary use</span>
                    <select
                      value={useCase}
                      onChange={(event) => {
                        change()
                        setUseCase(event.target.value)
                      }}
                    >
                      {directory.uses.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="pcb-field">
                    <span>
                      Target budget <small>PHP / optional</small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={budget}
                      placeholder="Enter an amount"
                      onChange={(event) => {
                        change()
                        setBudget(event.target.value)
                      }}
                    />
                  </label>
                </div>
                <div className="pcb-note">
                  <Sparkles size={18} />
                  <p>
                    Not sure about every component? Add what you know. JBC can help with the rest
                    when reviewing your request.
                  </p>
                </div>
                {plans.find((plan) => plan.id === id)?.legacyNotes && (
                  <details className="pcb-legacy">
                    <summary>Previous manual plan</summary>
                    <p>{plans.find((plan) => plan.id === id)?.legacyNotes}</p>
                    <p>Choose replacements for any models that are no longer listed.</p>
                  </details>
                )}
              </div>
              <div className="pcb-panel-footer">
                <span>Next: choose components</span>
                <button type="button" className="primary-button" onClick={() => goToStep(1)}>
                  Choose components <ArrowRight size={17} />
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="pcb-panel pcb-parts" aria-labelledby="pcb-parts-title">
              <div className="pcb-panel-heading">
                <span className="pcb-panel-kicker">STEP 02 / COMPONENTS</span>
                <h2 id="pcb-parts-title">Choose your components</h2>
                <p>
                  Pick any catalog part, even if fit or stock needs review. You can also enter a
                  component you own. Tap a part on the 3D model to change it.
                </p>
              </div>
              <div className="pcb-step-content" tabIndex={0} aria-label="Component choices">
                <section className="pcb-presets" aria-label="Preset recommendations">
                  <div>
                    <span className="pcb-panel-kicker">STARTING POINTS</span>
                    <strong>Recommended builds</strong>
                    <p>These use current catalog parts. Every selection remains editable.</p>
                  </div>
                  <div className="pcb-preset-actions">
                    {(['Low', 'Mid', 'High'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        disabled={inventoryLoading || !!inventoryError || loadingRequest}
                        onClick={() => void applyPreset(level)}
                      >
                        <Sparkles size={15} /> {level} tier
                      </button>
                    ))}
                  </div>
                </section>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div
                  className="pcb-progress"
                  aria-label={`${selectedCount} of 8 components selected`}
                >
                  <div>
                    <strong>{selectedCount} of 8 selected</strong>
                    <span>{Math.round((selectedCount / 8) * 100)}% complete</span>
                  </div>
                  <div className="pcb-progress-track">
                    <span style={{ width: `${(selectedCount / 8) * 100}%` }} />
                  </div>
                </div>
                <div className="pcb-part-list">
                  {components.map((part, index) => {
                    const Icon = componentIcons[part.name]
                    return (
                      <div className="pcb-part-item" key={part.name}>
                        <span className="pcb-part-icon">
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <span className="pcb-part-index">{String(index + 1).padStart(2, '0')}</span>
                        <div className="pcb-part-body">
                          <ComponentSelector
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
                          <small className="pcb-part-hint">{part.hint}</small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="pcb-panel-footer">
                <button type="button" className="pcb-quiet-button" onClick={() => goToStep(0)}>
                  <ArrowLeft size={16} /> Build brief
                </button>
                <button type="button" className="primary-button" onClick={() => goToStep(2)}>
                  Review build <ArrowRight size={17} />
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="pcb-panel pcb-review" aria-labelledby="pcb-review-title">
              <div className="pcb-panel-heading">
                <span className="pcb-panel-kicker">STEP 03 / FINAL CHECK</span>
                <h2 id="pcb-review-title">Review your build</h2>
                <p>
                  Review your parts, estimated cost, tier, and any compatibility conflicts before
                  placing a pre-order request.
                </p>
              </div>
              <div className="pcb-step-content" tabIndex={0} aria-label="Build review">
                <div className="pcb-review-title-row">
                  <div>
                    <small>BUILD NAME</small>
                    <strong>{name.trim() || 'Unnamed build'}</strong>
                    <span>
                      {useCase}
                      {Number(budget) > 0 ? ` / ${formatPHP(Number(budget))} target` : ''}
                    </span>
                    <span className="pcb-tier-label">
                      {tier === 'Unclassified'
                        ? 'Tier pending more specifications'
                        : `${tier} tier · based on CPU, graphics, and memory specifications`}
                    </span>
                  </div>
                  <button type="button" className="pcb-quiet-button" onClick={() => goToStep(0)}>
                    Edit brief
                  </button>
                </div>
                <div className="pcb-review-list">
                  {components.map((part) => {
                    const item = selected.find((value) => componentOf(value) === part.name)
                    const Icon = componentIcons[part.name]
                    return (
                      <div className="pcb-review-item" key={part.name}>
                        <span className="pcb-part-icon">
                          <Icon size={18} strokeWidth={1.8} />
                        </span>
                        <div>
                          <strong>{part.name === 'Graphics' ? 'Graphics card' : part.name}</strong>
                          <span>{item?.name || 'Needs guidance'}</span>
                        </div>
                        <span className="pcb-review-price">
                          {item
                            ? item.id.startsWith('custom:')
                              ? 'Owned'
                              : formatPHP(item.price)
                            : '—'}
                        </span>
                        <button
                          type="button"
                          className="pcb-edit-part"
                          onClick={() => openPart(part.name)}
                          aria-label={`Edit ${part.name}`}
                        >
                          Edit
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="pcb-review-total">
                  <span>
                    JBC parts subtotal<small>Owned parts and final service quote excluded</small>
                  </span>
                  <strong>{formatPHP(total)}</strong>
                </div>
                <div
                  className={`pcb-compatibility ${errors.length ? 'has-errors' : intelligence.status === 'Compatible' ? 'is-good' : ''}`}
                >
                  <CompatibilityIcon size={20} aria-hidden="true" />
                  <div>
                    <strong>
                      {intelligence.status === 'Compatible'
                        ? 'No known conflicts'
                        : intelligence.status}
                    </strong>
                    <p>
                      {errors.length
                        ? errors.join(' ')
                        : 'JBC will confirm fit, availability, and the final price.'}
                    </p>
                  </div>
                </div>
                {unavailable && (
                  <p className="form-error">
                    <CircleAlert size={16} /> Some selected parts are out of stock. JBC will check
                    availability during pre-order review.
                  </p>
                )}
                {missingCatalogSelections && (
                  <p className="form-error" role="alert">
                    One or more catalog parts are no longer listed. Choose replacements before
                    saving this pre-order.
                  </p>
                )}
                {missing.length > 0 && (
                  <p className="pcb-missing">
                    Still open: {missing.map((part) => part.name).join(', ')}. JBC can advise on
                    these parts.
                  </p>
                )}
                {user?.role === 'user' && (
                  <div className="pcb-request-form">
                    <h3>Submit a PC pre-order</h3>
                    <p>
                      JBC will confirm part fit, availability, and the final quote. You can edit or
                      cancel this request until review begins. No payment is collected now.
                    </p>
                    <label className="pcb-field">
                      <span>
                        Anything JBC should know? <small>Optional</small>
                      </span>
                      <textarea
                        rows={3}
                        maxLength={1000}
                        placeholder="Preferences, existing parts, or questions"
                        value={requestNotes}
                        onChange={(event) => {
                          change()
                          setRequestNotes(event.target.value)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="primary-button pcb-send-button"
                      disabled={!canRequest}
                      onClick={() => void requestBuild()}
                    >
                      <Send size={17} />
                      {busy
                        ? 'Saving…'
                        : requested
                          ? 'Pre-order sent'
                          : editingRequestId
                            ? 'Save pre-order changes'
                            : 'Submit pre-order'}
                    </button>
                    {!name.trim() && (
                      <small className="pcb-form-help">
                        Add a build name in the brief to request a quote.
                      </small>
                    )}
                    {requested && (
                      <Link className="text-button" to="/customer/records?tab=requests">
                        View pre-orders <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                )}
                <div className="pcb-review-actions" aria-label="Build draft actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    <Save size={16} /> {id ? 'Save changes' : 'Save draft'}
                  </button>
                  <ExcelButton disabled={!selectedCount} onExport={exportBuild} />
                  {id && (
                    <button
                      type="button"
                      className="pcb-quiet-button pcb-delete"
                      disabled={busy}
                      onClick={() => void deletePlan()}
                    >
                      <Trash2 size={16} /> Delete draft
                    </button>
                  )}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="save-message" role="status">
                    {message}
                  </p>
                )}
              </div>
              <div className="pcb-panel-footer">
                <button type="button" className="pcb-quiet-button" onClick={() => goToStep(1)}>
                  <ArrowLeft size={16} /> Components
                </button>
                <button
                  type="button"
                  className="pcb-quiet-button"
                  disabled={busy}
                  onClick={async () => {
                    if (await startNew()) goToStep(0)
                  }}
                >
                  <Plus size={16} /> Start a new build
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="pcb-preview" aria-label="Live build preview">
          <div className="pcb-preview-heading">
            <div>
              <span className="pcb-panel-kicker">LIVE PREVIEW</span>
              <h2>Your PC in 3D</h2>
            </div>
            <span className="pcb-live-dot">INTERACTIVE</span>
          </div>
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
            onSelect={openPart}
          />
          <p className="pcb-model-note">
            Generic component shapes. Selected product names appear on the model.
          </p>
          <div className="pcb-preview-stats">
            <div>
              <span>COMPONENTS</span>
              <strong>
                {selectedCount}
                <small> / 8</small>
              </strong>
            </div>
            <div>
              <span>JBC SUBTOTAL</span>
              <strong>{formatPHP(total)}</strong>
            </div>
            <div>
              <span>ESTIMATED TIER</span>
              <strong>{tier}</strong>
            </div>
          </div>
          <div
            className={`pcb-preview-status ${intelligence.status === 'Compatible' ? 'is-good' : ''}`}
          >
            <CompatibilityIcon size={18} aria-hidden="true" />
            <span>
              {intelligence.status === 'Compatible' ? 'No known conflicts' : intelligence.status}
            </span>
            <small>
              {intelligence.powerEstimateReady
                ? `~${intelligence.wattage} W estimated power`
                : 'Power estimate pending'}
            </small>
          </div>
        </aside>
      </div>
    </div>
  )
}
