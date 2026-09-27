import { deleteDoc, setDoc } from 'firebase/firestore'
import { firestoreData, recordRef } from '../../lib/database'
import type { ComponentType, InventoryItem } from '../../types'

export type Selection = Partial<Record<ComponentType, string>>
export type CustomPart = {
  model: string
  capacity: string
  socket: string
  memoryType: string
  brand?: string
  notes?: string
  compatibility?: Partial<InventoryItem>
}
export type CustomParts = Partial<Record<ComponentType, CustomPart>>
export type Plan = {
  id: string
  name: string
  budget: string
  selection: Selection
  custom?: CustomParts
  legacyNotes?: string
}

export async function saveBuildPlan(userId: string, plan: Plan) {
  if (!userId || !plan.id || !plan.name.trim()) throw new Error('Name your build before saving.')
  if (!Number.isFinite(Number(plan.budget)) || Number(plan.budget) < 0)
    throw new Error('Enter a valid budget.')
  await setDoc(recordRef('users/' + userId + '/plans', plan.id), firestoreData(plan))
}
export async function removeBuildPlan(userId: string, id: string) {
  if (!userId || !id) throw new Error('Select a saved build.')
  await deleteDoc(recordRef('users/' + userId + '/plans', id))
}
