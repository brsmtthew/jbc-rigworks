// Deterministic transaction simulation. This does not emulate Firestore rules or networking.
import assert from 'node:assert/strict'
let records = new Map()
export const seed = (entries) => {
  records = new Map(Object.entries(structuredClone(entries)))
}
export const read = (path) => structuredClone(records.get(path))
export const list = (collection) =>
  [...records]
    .filter(([path]) => path.startsWith(collection + '/'))
    .map(([, value]) => structuredClone(value))
export const recordRef = (name, id) => ({ id, path: `${name}/${id}` })
export const shopRef = recordRef('settings', 'shop')
export const firestoreData = (value) => JSON.parse(JSON.stringify(value))
export const where = () => ({})
export const collection = (_db, name) => ({ name })
export async function getDocsFromServer(ref) {
  return {
    docs: [...records]
      .filter(([path]) => path.startsWith(ref.name + '/'))
      .map(([path, value]) => ({
        id: path.slice(ref.name.length + 1),
        data: () => structuredClone(value),
      })),
  }
}
export const useLiveCollection = () => {
  throw new Error('Hooks are not supported in transaction tests')
}
export async function runTransaction(_db, callback) {
  const next = new Map(structuredClone([...records]))
  let writing = false
  const transaction = {
    async get(ref) {
      assert.equal(writing, false, 'All transaction reads must precede writes')
      return {
        id: ref.id,
        ref,
        exists: () => next.has(ref.path),
        data: () => structuredClone(next.get(ref.path)),
      }
    },
    set(ref, value) {
      writing = true
      next.set(ref.path, structuredClone(value))
    },
    update(ref, patch) {
      assert.ok(next.has(ref.path), `Cannot update absent ${ref.path}`)
      writing = true
      next.set(ref.path, { ...next.get(ref.path), ...structuredClone(patch) })
    },
    delete(ref) {
      writing = true
      next.delete(ref.path)
    },
  }
  const result = await callback(transaction)
  records = next
  return result
}
export async function setDoc(ref, value) {
  records.set(ref.path, structuredClone(value))
}
export async function deleteDoc(ref) {
  records.delete(ref.path)
}
export async function getDocFromServer(ref) {
  return { id: ref.id, exists: () => records.has(ref.path), data: () => read(ref.path) }
}
