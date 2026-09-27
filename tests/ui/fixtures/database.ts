import { collections } from './data'
export const recordRef = (name: string, id: string) => ({ id, path: `${name}/${id}` })
export const shopRef = recordRef('settings', 'shop')
export const directoriesRef = recordRef('settings', 'directories')
export const accountSettingsRef = (id: string) => recordRef(`users/${id}/settings`, 'account')
export const collectionRef = (name: string) => ({ path: name })
export const firestoreData = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export function useLiveCollection(name: string, enabled = true) {
  return { rows: enabled ? (collections[name] ?? []) : [], loading: false, error: '' }
}
export function useLiveDocument() {
  return { value: undefined, loading: false, error: '' }
}
