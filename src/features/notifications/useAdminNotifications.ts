import { useEffect, useState } from 'react'
import { usePaymentProofs } from '../finance/usePayments'
import { useAllRequests } from '../customer/useCustomerRequests'
import type { AppUser, Sale } from '../../types'
import { shortReference } from '../../lib/reference'

export type AdminNotification = {
  id: string
  title: string
  detail: string
  date: string
  path: string
  group: 'pos' | 'jobs' | 'pc-building'
  read: boolean
}

type NotificationPreferences = { read: string[]; hidden: string[] }
const emptyPreferences: NotificationPreferences = { read: [], hidden: [] }
const sessionPreferences = new Map<string, NotificationPreferences>()
const storageKey = (uid: string) => `jbc-rigworks:notifications:v1:${uid}`

function readPreferences(key: string): NotificationPreferences {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return sessionPreferences.get(key) ?? emptyPreferences
    const raw = JSON.parse(saved) as Partial<NotificationPreferences>
    return {
      read: Array.isArray(raw.read) ? raw.read.filter((id): id is string => typeof id === 'string') : [],
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return sessionPreferences.get(key) ?? emptyPreferences
  }
}

export function useAdminNotifications(user: AppUser | null, orders: Sale[]) {
  const enabled = user?.role === 'admin'
  const key = storageKey(enabled ? user.id : '')
  const requests = useAllRequests(enabled)
  const proofs = usePaymentProofs(enabled ? user : null)
  const [stored, setStored] = useState(() => ({ key, value: readPreferences(key) }))
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key) {
        sessionPreferences.delete(key)
        setStored({ key, value: readPreferences(key) })
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  const preferences = stored.key === key ? stored.value : readPreferences(key)
  const source = enabled ? [
    ...orders
      .filter((order) => order.channel === 'Online' && !order.buildId && !order.serviceJobId && (order.orderStatus ?? 'Requested') === 'Requested')
      .map((order) => ({
        id: `order:${order.id}`, title: 'New online order',
        detail: `${order.customer} · ${order.detail}`,
        date: order.createdAt ?? `${order.date}T00:00:00`,
        path: `/pos?orders=true&reference=${encodeURIComponent(order.id)}`, group: 'pos' as const,
      })),
    ...proofs.rows.filter((proof) => proof.status === 'Pending').map((proof) => ({
      id: `proof:${proof.id}:${proof.submittedAt}`, title: 'Payment proof to review',
      detail: `Order ${shortReference(proof.orderId)} · ${proof.method}`,
      date: proof.submittedAt,
      path: `/pos?orders=true&reference=${encodeURIComponent(proof.orderId)}`, group: 'pos' as const,
    })),
    ...requests.appointments.filter((item) => item.status === 'Requested').map((item) => ({
      id: `appointment:${item.id}`, title: 'Service booking request',
      detail: `${item.customerName} · ${item.service}`,
      date: item.createdAt,
      path: `/jobs?reference=${encodeURIComponent(item.id)}`, group: 'jobs' as const,
    })),
    ...requests.requests.filter((item) => ['Quote requested', 'Approved'].includes(item.status)).map((item) => ({
      id: `build:${item.id}:${item.status}`, title: item.status === 'Approved' ? 'PC quote approved' : 'PC build request',
      detail: `${item.customerName || 'Customer'} · ${item.useCase}`,
      date: item.status === 'Approved' ? item.approvedAt ?? item.createdAt : item.createdAt,
      path: `/pc-building?reference=${encodeURIComponent(item.id)}`, group: 'pc-building' as const,
    })),
  ] : []
  const notifications: AdminNotification[] = source
    .filter((item) => !preferences.hidden.includes(item.id))
    .map((item) => ({ ...item, read: preferences.read.includes(item.id) }))
    .sort((a, b) => b.date.localeCompare(a.date))

  function updatePreferences(update: (current: NotificationPreferences) => NotificationPreferences) {
    const next = update(readPreferences(key))
    sessionPreferences.set(key, next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* Keep the current session responsive when browser storage is unavailable. */
    }
    setStored({ key, value: next })
  }

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    markRead: (id: string) => updatePreferences((current) => ({
      ...current, read: [...new Set([...current.read, id])],
    })),
    markAllRead: () => updatePreferences((current) => ({
      ...current, read: [...new Set([...current.read, ...notifications.map((item) => item.id)])],
    })),
    dismiss: (id: string) => updatePreferences((current) => ({
      ...current, hidden: [...new Set([...current.hidden, id])],
    })),
    loading: enabled && (requests.loading || proofs.loading),
    error: enabled ? requests.error || proofs.error : '',
  }
}
