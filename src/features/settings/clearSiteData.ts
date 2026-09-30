import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

// Every top-level collection written by this app, apart from user profiles.
export const resetCollections = [
  'appointmentSlots',
  'appointments',
  'bundles',
  'catalog',
  'expenses',
  'inventory',
  'inventorySkus',
  'jobs',
  'orderSnapshots',
  'orders',
  'paymentAccounts',
  'paymentProofs',
  'pcRequests',
  'receiptEmails',
  'receipts',
  'sales',
  'stockMovements',
] as const

const batchSize = 100

async function clearCollection(db: Firestore, path: string, onBatch: (count: number) => void) {
  let deleted = 0
  while (true) {
    // Read from the server so a stale local cache cannot make the reset appear complete.
    const page = await getDocsFromServer(query(collection(db, path), limit(batchSize)))
    if (page.empty) return deleted
    const batch = writeBatch(db)
    for (const record of page.docs) batch.delete(record.ref)
    await batch.commit()
    deleted += page.size
    onBatch(deleted)
  }
}

export async function clearSiteData(
  db: Firestore,
  onProgress: (description: string, deleted: number) => void,
) {
  let total = 0
  for (const name of resetCollections) {
    onProgress(`Clearing ${name}…`, total)
    total += await clearCollection(db, name, (count) =>
      onProgress(`Clearing ${name}…`, total + count),
    )
  }

  // Saved PC plans are customer data nested under profiles. Keep the profiles and
  // their account settings so all users can still sign in after the reset.
  onProgress('Clearing saved PC plans…', total)
  const users = await getDocsFromServer(collection(db, 'users'))
  for (const user of users.docs) {
    total += await clearCollection(db, `users/${user.id}/plans`, (count) =>
      onProgress('Clearing saved PC plans…', total + count),
    )
  }

  onProgress('Clearing website settings…', total)
  for (const setting of ['shop', 'directories']) {
    const ref = doc(db, 'settings', setting)
    if (!(await getDocFromServer(ref)).exists()) continue
    await deleteDoc(ref)
    total += 1
    onProgress('Clearing website settings…', total)
  }
  return total
}
