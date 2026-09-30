/** Keep the record type and both ends of a long ID visible in compact lists. */
export function shortReference(reference: string, maxLength = 22) {
  if (reference.length <= maxLength) return reference
  const start = Math.max(8, maxLength - 8)
  return `${reference.slice(0, start)}…${reference.slice(-6)}`
}
