import { runTransaction } from 'firebase/firestore'
import { firestoreData, recordRef } from '../../lib/database'
import { today } from '../../lib/dates'
import { firebaseFirestore } from '../../lib/firebase'
import type { AppUser, Expense } from '../../types'

export function nextExpenseDate(expense: Pick<Expense, 'date' | 'recurrence'>) {
  if (
    !['Monthly', 'Yearly'].includes(expense.recurrence ?? '') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expense.date)
  )
    throw new Error('Select a monthly or yearly expense with a valid date.')
  const [year, month, day] = expense.date.split('-').map(Number)
  const original = new Date(Date.UTC(year, month - 1, day))
  if (original.toISOString().slice(0, 10) !== expense.date)
    throw new Error('Enter a valid expense date.')
  const next = new Date(
    Date.UTC(
      year + (expense.recurrence === 'Yearly' ? 1 : 0),
      month - 1 + (expense.recurrence === 'Monthly' ? 1 : 0),
      1,
    ),
  )
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(day, last))
  return next.toISOString().slice(0, 10)
}

export async function recordNextExpense(user: AppUser, sourceId: string, expectedDate: string) {
  if (user.role !== 'admin') throw new Error('Only the workshop can record expenses.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const source = await tx.get(recordRef('expenses', sourceId)),
      expense = source.data() as Expense | undefined
    if (!expense || expense.voided) throw new Error('This expense is no longer available.')
    const date = nextExpenseDate(expense)
    if (date !== expectedDate)
      throw new Error('The recurring expense changed. Review its next date again.')
    const root = expense.recurringSourceId ?? expense.id,
      id = `${root}--${date}`
    const ref = recordRef('expenses', id),
      existing = await tx.get(ref)
    if (existing.exists())
      throw new Error('This occurrence is already recorded. Open that expense to make corrections.')
    if (date > today())
      throw new Error('Record this expense on or after its next date, once payment has occurred.')
    const at = new Date().toISOString()
    const next: Expense = {
      id,
      date,
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      method: expense.method,
      vendor: expense.vendor,
      notes: expense.notes,
      reference: '',
      recurrence: expense.recurrence,
      recurringSourceId: root,
      createdAt: at,
      createdBy: user.id,
      updatedAt: at,
      updatedBy: user.id,
      audit: [{ at, by: user.id, action: 'Recurring occurrence recorded' }],
    }
    tx.set(ref, firestoreData(next))
    return next
  })
}

export async function saveExpense(user: AppUser, record: Expense) {
  if (user.role !== 'admin') throw new Error('Only the workshop can update expenses.')
  await runTransaction(firebaseFirestore, async (transaction) => {
    const ref = recordRef('expenses', record.id),
      previous = await transaction.get(ref)
    const expense = record,
      at = new Date().toISOString()
    if (!Number.isFinite(expense.amount) || expense.amount < 0)
      throw new Error('Enter a valid expense amount.')
    const old = previous.data() as Expense | undefined
    if (old?.voided) throw new Error('A voided expense cannot be edited.')
    const { audit: _audit, ...snapshot } = old ?? expense
    void _audit
    transaction.set(
      ref,
      firestoreData({
        ...expense,
        createdAt: old?.createdAt ?? at,
        createdBy: old?.createdBy ?? user.id,
        updatedAt: at,
        updatedBy: user.id,
        audit: [
          ...(old?.audit ?? []),
          {
            at,
            by: user.id,
            action: expense.voided ? 'Voided' : old ? 'Edited' : 'Created',
            ...(old ? { previous: snapshot } : {}),
          },
        ],
      }),
    )
  })
}
