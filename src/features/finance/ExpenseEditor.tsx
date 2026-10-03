import { Save, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { RecordFields, type RecordField } from '../../components/ui/RecordFields'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { useDirectories } from '../../lib/directories'
import { formAmount, formText } from '../../lib/forms'
import type { Expense } from '../../types'
import { saveExpense } from './expenseOperations'

export function ExpenseEditor({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [directory] = useDirectories()
  const { busy, error, run } = useAsyncAction()
  const fields: RecordField[] = [
    { name: 'description', label: 'Description' },
    {
      name: 'category',
      label: 'Category',
      options: [...new Set([...directory.expenseCategories, expense?.category ?? ''])].filter(Boolean),
      placeholder: 'Select category',
    },
    { name: 'date', label: 'Expense date', type: 'date' },
    { name: 'amount', label: 'Amount (PHP)', type: 'number' },
    {
      name: 'method',
      label: 'Payment method',
      options: [...new Set([...(expense ? [expense.method] : []), ...directory.payments])],
    },
    { name: 'reference', label: 'Receipt / reference number', optional: true },
  ]
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      if (!user) throw new Error('Sign in to save this expense.')
      const record: Expense = {
        ...expense,
        id: expense?.id ?? `EXP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        description: formText(form, 'description'),
        category: formText(form, 'category'),
        date: formText(form, 'date'),
        amount: formAmount(form, 'amount'),
        method: formText(form, 'method'),
        reference: formText(form, 'reference'),
        ...(expense ? {} : { recurrence: 'One-time' as const }),
      }
      if (
        !(await confirm({
          title: expense ? 'Save changes?' : 'Save record?',
          message: 'Save this expense?',
          confirmLabel: expense ? 'Save changes' : 'Save record',
        }))
      )
        return
      await saveExpense(user, record)
      onClose()
    })
  }
  function voidExpense() {
    void run(async () => {
      if (!expense || !user) return
      if (
        !(await confirm({
          title: 'Void expense?',
          message: 'Keep this expense in the audit history and exclude it from operating totals?',
          confirmLabel: 'Void expense',
          tone: 'danger',
        }))
      )
        return
      await saveExpense(user, { ...expense, voided: true })
      onClose()
    })
  }
  return (
    <Dialog
      title={expense ? 'Edit expense' : 'New expense'}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          {expense && (
            <button
              type="button"
              className="secondary-button danger-button"
              disabled={busy}
              onClick={voidExpense}
            >
              <Trash2 size={18} />
              Void expense
            </button>
          )}
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" form="expense-editor" disabled={busy}>
            <Save size={18} />
            {expense ? 'Save changes' : 'Save record'}
          </button>
        </>
      }
    >
      <form id="expense-editor" className="portal-form entry-form" onSubmit={submit}>
        <fieldset disabled={busy} className="record-fields">
          <RecordFields
            fields={fields}
            values={
              expense
                ? Object.fromEntries(
                    fields.map((field) => [
                      field.name,
                      String(expense[field.name as keyof Expense] ?? ''),
                    ]),
                  )
                : { date: today() }
            }
          />
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="storage-caption">Changes are saved to your business records.</p>
      </form>
    </Dialog>
  )
}
