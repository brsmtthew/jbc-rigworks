import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { DataTable } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { StatStrip } from '../../components/ui/StatStrip'
import { useListFilters } from '../../hooks/useListFilters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { prepareExcel } from '../../lib/excel'
import { formatDate, formatPHP } from '../../lib/format'
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
  if (workspace.loading) return <LoadingState table label="Loading expenses..." />
  return (
    <>
      <PageHeader
        eyebrow="MONEY OUT"
        title="Expenses"
        description="Recorded workshop costs with a retained history of corrections."
      >
        <button className="primary-button" onClick={onCreate}>
          <Plus size={18} />
          Record expense
        </button>
      </PageHeader>
      <StatStrip
        stats={[
          { label: 'Recorded expenses', value: formatPHP(summary.spent, true) },
          { label: 'Entries', value: expenses.length },
          { label: 'Categories', value: categories.length },
          {
            label: 'Filtered spending',
            value: formatPHP(
              filtered.filter((item) => !item.voided).reduce((sum, item) => sum + item.amount, 0),
            ),
          },
        ]}
      />
      <ListToolbar
        {...filters}
        label="Search expenses"
        count={filtered.length}
        onReset={reset}
        options={[
          { value: 'all', label: 'All categories' },
          ...categories.map((value) => ({ value, label: value })),
        ]}
        onExport={() =>
          prepareExcel('expenses', [
            [
              'Reference',
              'Description',
              'Date',
              'Category',
              'Vendor',
              'Method',
              'Amount PHP',
              'Receipt reference',
              'Frequency',
              'Status',
              'Notes',
            ],
            ...filtered.map((expense) => [
              expense.id,
              expense.description,
              expense.date,
              expense.category,
              expense.vendor || '',
              expense.method,
              expense.amount,
              expense.reference || '',
              expense.recurrence || 'One-time',
              expense.voided ? 'Voided' : 'Recorded',
              expense.notes || '',
            ]),
          ])
        }
      />
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
      {(from || to || method !== 'all' || recurrence !== 'all') && (
        <button className="text-button" onClick={reset}>
          Clear expense filters
        </button>
      )}
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
              render: (expense) => expense.category,
            },
            {
              label: 'Vendor / receipt',
              render: (expense) => (
                <>
                  {expense.vendor || 'Not specified'}
                  <small>{expense.reference || 'No receipt reference'}</small>
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
            { label: 'Status', render: (expense) => (expense.voided ? 'Voided' : 'Recorded') },
            {
              label: 'Actions',
              render: (expense) => (
                <>
                  <button className="text-button" onClick={() => setAudit(expense)}>
                    Audit history
                  </button>
                  <button
                    disabled={expense.voided}
                    className="text-button"
                    onClick={() => setEditing(expense)}
                    title="Edit expense"
                    aria-label={`Edit ${expense.description}`}
                  >
                    <Pencil size={18} />
                  </button>
                  {unrecordedNext(expense) && (
                    <button
                      className="text-button"
                      disabled={busy || nextDate(expense) > today()}
                      onClick={() => recordOccurrence(expense)}
                    >
                      Record next occurrence ({formatDate(nextDate(expense))})
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Panel>
      {audit && (
        <Dialog title="Expense audit history" onClose={() => setAudit(null)}>
          <h3>{audit.description}</h3>
          <p>{audit.notes}</p>
          {audit.audit?.length ? (
            audit.audit.map((entry, i) => (
              <div className="form-section" key={i}>
                <strong>
                  {entry.action} / {new Date(entry.at).toLocaleString()}
                </strong>
                <p>By {entry.by}</p>
                {entry.previous && (
                  <dl className="detail-list">
                    {[
                      ['Amount', formatPHP(entry.previous.amount)],
                      ['Description', entry.previous.description],
                      ['Date', entry.previous.date],
                      ['Category', entry.previous.category],
                      ['Payment method', entry.previous.method],
                      ['Vendor', entry.previous.vendor],
                      ['Reference', entry.previous.reference],
                      ['Notes', entry.previous.notes],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt>Previous {String(label).toLowerCase()}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            ))
          ) : (
            <p>This older expense has no recorded edits.</p>
          )}
        </Dialog>
      )}
      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
