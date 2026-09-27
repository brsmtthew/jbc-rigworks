import { collection, doc } from 'firebase/firestore'
import { firebaseFirestore } from './firebase'

export const shopRef = doc(firebaseFirestore, 'settings', 'shop')
export const directoriesRef = doc(firebaseFirestore, 'settings', 'directories')
export const accountSettingsRef = (uid: string) =>
  doc(firebaseFirestore, 'users', uid, 'settings', 'account')
export const collectionRef = (name: string) => collection(firebaseFirestore, name)
export const recordRef = (name: string, id: string) => doc(firebaseFirestore, name, id)

// Form records contain optional fields that Firestore cannot store as undefined.
export function firestoreData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
