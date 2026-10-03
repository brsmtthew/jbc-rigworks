import { History, Pencil, Plus, Repeat2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { LoadingState } from '../../components/ui/LoadingState'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useListFilters } from '../../hooks/useListFilters'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { prepareExcel } from '../../lib/excel'
import { formatDate, formatPHP } from '../../lib/format'
import { shortReference } from '../../lib/reference'
import { humanError } from '../../lib/workflow'
import type { Expense } from '../../types'
import { ExpenseEditor } from './ExpenseEditor'
import { nextExpenseDate, recordNextExpense } from './expenseOperations'
import { getSummary } from './summary'

export function ExpensesPage({ onCreate }: { onCreate: () => void }) {
  const [editing, setEditing] = useState<Expense | null>(null),
    [audit, setAudit] = useState<Expense | null>(null)
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [method, setMethod] = useState('all'),
    [recurrence, setRecurrence] = useState('all')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const { user } = useAuth(),
    { confirm } = useConfirmation()
  const workspace = useWorkspace(),
    { expenses } = workspace
  const actorProfiles = useLiveCollection<{ id: string; name?: string }>('users', user?.role === 'admin').rows
  const actorNames = Object.fromEntries(actorProfiles.map((profile) => [profile.id, profile.name?.trim() || '']))
  const auditedExpense = expenses.find((expense) => expense.id === audit?.id) ?? audit
  const filters = useListFilters(),
    summary = getSummary('', workspace)
  const categories = [...new Set(expenses.map((expense) => expense.category))]
  const methods = [...new Set(expenses.map((expense) => expense.method))]
  const filtered = expenses.filter(
    (expense) =>
      filters.matches(
        [
          expense.description,
          expense.id,
          expense.method,
          expense.vendor,
          expense.reference,
          expense.notes,
        ].join(' '),
      ) &&
      (filters.filter === 'all' || expense.category === filters.filter) &&
      (!from || expense.date >= from) &&
      (!to || expense.date <= to) &&
      (method === 'all' || expense.method === method) &&
      (recurrence === 'all' || (expense.recurrence ?? 'One-time') === recurrence),
  )
  const activeExpenses = expenses.filter((expense) => !expense.voided)
  const filteredSpending = filtered
    .filter((expense) => !expense.voided)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const metrics = [
    { label: 'Recorded expenses', value: formatPHP(summary.spent, true), note: 'Operating costs excluding voids' },
    { label: 'Active entries', value: activeExpenses.length, note: 'Expenses in the ledger' },
    { label: 'Categories', value: categories.length, note: 'Types of workshop spending' },
    { label: 'Filtered spending', value: formatPHP(filteredSpending), note: 'Total for the current view' },
  ]
  function exportExpenses() {
    return prepareExcel('expenses', [
      [
        'Reference', 'Description', 'Date', 'Category', 'Vendor', 'Method', 'Amount PHP',
        'Receipt reference', 'Frequency', 'Status', 'Notes',
      ],
      ...filtered.map((expense) => [
        expense.id, expense.description, expense.date, expense.category, expense.vendor || '',
        expense.method, expense.amount, expense.reference || '', expense.recurrence || 'One-time',
        expense.voided ? 'Voided' : 'Recorded', expense.notes || '',
      ]),
    ])
  }
  const nextDate = (expense: Expense) => {
    try {
      return nextExpenseDate(expense)
    } catch {
      return ''
    }
  }
  const unrecordedNext = (expense: Expense) => {
    const date = nextDate(expense)
    return !expense.voided &&
      date &&
      !expenses.some((item) => item.id === `${expense.recurringSourceId ?? expense.id}--${date}`)
      ? date
      : ''
  }
  async function recordOccurrence(expense: Expense) {
    if (busy || !user) return
    const date = nextDate(expense)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (
        !(await confirm({
          title: 'Record next expense?',
          message: `Confirm that ${formatPHP(expense.amount)} for ${expense.description} was paid for ${formatDate(date)}. This creates one expense; no future entries are generated.`,
          confirmLabel: 'Record paid expense',
        }))
      )
        return
      await recordNextExpense(user, expense.id, date)
      setMessage('Recurring expense recorded.')
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  const reset = () => {
    filters.reset()
    setFrom('')
    setTo('')
    setMethod('all')
    setRecurrence('all')
  }
  if (workspace.storageError)
    return (
      <p role="alert" className="form-error">
        {workspace.storageError}
      </p>
    )
  if (workspace.loading) return <LoadingState variant="table" label="Loading expenses…" />
  return (
    <div className="admin-expenses-page">
      <section className="admin-expenses-hero jbc-blue-hero" aria-labelledby="admin-expenses-title">
        <div className="admin-expenses-hero-copy">
          <span className="admin-expenses-kicker">WORKSHOP COSTS</span>
          <h1 id="admin-expenses-title">Expenses</h1>
          <p>Track spending, review recurring payments, and keep a clear record of corrections.</p>
        </div>
        <div className="admin-expenses-hero-actions admin-hero-tool-panel" role="group" aria-label="Expense actions">
          <span className="admin-expenses-hero-actions-label">EXPENSE TOOLS</span>
          <strong>{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'} in your ledger</strong>
          <div>
            <button type="button" className="primary-button" onClick={onCreate}>
              <Plus size={16} /> Record expense
            </button>
            <ExcelButton disabled={!filtered.length} onExport={exportExpenses} />
          </div>
        </div>
      </section>
      <dl className="admin-expenses-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.note}</small>
          </div>
        ))}
      </dl>
      <section className="admin-expenses-discovery discovery-card" aria-label="Find an expense">
        <div className="admin-expenses-discovery-heading">
          <div>
            <span className="eyebrow">FIND A RECORD</span>
            <h2>Search your expenses</h2>
          </div>
          <span className="discovery-card-count" role="status">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span>
        </div>
        <ListToolbar
          {...filters}
          label="Search expenses"
          filterLabel="Category"
          onReset={reset}
          options={[
            { value: 'all', label: 'All categories' },
            ...categories.map((value) => ({ value, label: value })),
          ]}
        />
        <details className="admin-expense-more-filters">
          <summary>More filters{from || to || method !== 'all' || recurrence !== 'all' ? ' · Active' : ''}</summary>
        <div className="portal-form portal-form-grid admin-expense-filters">
          <label>
            From date
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label>
            Payment method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="all">All methods</option>
              {methods.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Frequency
            <select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
              <option value="all">All frequencies</option>
              {['One-time', 'Monthly', 'Yearly'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        </details>
        {(from || to || method !== 'all' || recurrence !== 'all') && (
          <button type="button" className="text-button admin-expenses-clear" onClick={reset}>
            Clear expense filters
          </button>
        )}
      </section>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="save-message">
          {message}
        </p>
      )}
      <Panel
        className="admin-expenses-ledger"
        title="Operating expenses"
        subtitle="Recurring entries are recorded only when you confirm payment."
      >
        <DataTable
          filtered={
            !!filters.query ||
            filters.filter !== 'all' ||
            !!from ||
            !!to ||
            method !== 'all' ||
            recurrence !== 'all'
          }
          rows={filtered}
          label="Operating expenses"
          columns={[
            {
              label: 'Date',
              sortValue: (expense) => expense.date,
              render: (expense) => formatDate(expense.date),
            },
            {
              label: 'Description',
              sortValue: (expense) => expense.description,
              render: (expense) => (
                <>
                  <strong>{expense.description}</strong>
                  <small>{expense.recurrence ?? 'One-time'}</small>
                </>
              ),
            },
            {
              label: 'Category',
              sortValue: (expense) => expense.category,
              render: (expense) => <span className="admin-expenses-category">{expense.category}</span>,
            },
            {
              label: 'Vendor / receipt',
              render: (expense) => (
                <>
                  {expense.vendor || 'Not specified'}
                  <small title={expense.reference}>{expense.reference ? shortReference(expense.reference) : 'No receipt reference'}</small>
                </>
              ),
            },
            {
              label: 'Paid through',
              sortValue: (expense) => expense.method,
              render: (expense) => expense.method,
            },
            {
              label: 'Amount',
              sortValue: (expense) => expense.amount,
              numeric: true,
              render: (expense) => <strong>{formatPHP(expense.amount)}</strong>,
            },
            {
              label: 'Status',
              render: (expense) => (
                <StatusBadge tone={expense.voided ? 'gray' : 'green'}>
                  {expense.voided ? 'Voided' : 'Recorded'}
                </StatusBadge>
              ),
            },
            {
              label: 'Actions',
              render: (expense) => (
                <div className="admin-expenses-row-actions">
                  <button type="button" className="secondary-button" onClick={() => setAudit(expense)}>
                    <History size={15} /> Audit
                  </button>
                  <button
                    type="button"
                    disabled={expense.voided}
                    className="secondary-button"
                    onClick={() => setEditing(expense)}
                    title="Edit expense"
                    aria-label={`Edit ${expense.description}`}
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  {unrecordedNext(expense) && (
                    <button
                      type="button"
                      className="secondary-button admin-expenses-repeat"
                      disabled={busy || nextDate(expense) > today()}
                      onClick={() => recordOccurrence(expense)}
                    >
                      <Repeat2 size={15} />
                      Record next occurrence ({formatDate(nextDate(expense))})
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {auditedExpense && (
        <Dialog title="Expense audit history" wide onClose={() => setAudit(null)}>
          <div className="expense-audit">
            <header className="expense-audit-summary">
              <span className="eyebrow">EXPENSE RECORD</span>
              <h3>{auditedExpense.description}</h3>
              <p>{auditedExpense.category} · {formatDate(auditedExpense.date)}</p>
              <strong>{formatPHP(auditedExpense.amount)}</strong>
            </header>
            <h4>Activity timeline</h4>
            {auditedExpense.audit?.length ? (
              <ol className="expense-audit-timeline">
                {[...auditedExpense.audit].reverse().map((entry, i) => {
                  const name = entry.byName || actorNames[entry.by] || (entry.by === user?.id ? user.name : 'Former team member')
                  const previous = entry.previous
                  return (
                    <li key={`${entry.at}-${i}`}>
                      <div className="expense-audit-event">
                        <span className="expense-audit-mark"><History size={15} /></span>
                        <div>
                          <strong>{entry.action}</strong>
                          <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                        </div>
                      </div>
                      <p className="expense-audit-actor"><UserRound size={15} /> {name}</p>
                      {previous && (
                        <details className="expense-audit-changes">
                          <summary>View values before this change</summary>
                          <dl>
                            {([
                              ['Amount', formatPHP(previous.amount)],
                              ['Description', previous.description],
                              ['Date', formatDate(previous.date)],
                              ['Category', previous.category],
                              ['Payment method', previous.method],
                              ['Vendor', previous.vendor],
                              ['Reference', previous.reference],
                              ['Notes', previous.notes],
                            ] as const).filter(([, value]) => value).map(([label, value]) => (
                              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ol>
            ) : <p className="expense-audit-empty">This older expense has no recorded activity.</p>}
          </div>
        </Dialog>
      )}
      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
