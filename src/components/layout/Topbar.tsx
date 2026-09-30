import { Bell, Check, Clock3, Eye, LogOut, Menu, Trash2, UserRound } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useConfirmation } from '../ui/confirmation-context'
import { LoadingState } from '../ui/LoadingState'
import { Dialog } from '../ui/Dialog'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useStoredValue } from '../../lib/preferences'
import type { AdminNotification } from '../../features/notifications/useAdminNotifications'
const AccountSettingsModal = lazy(() =>
  import('../../features/settings/CustomerSettings').then((module) => ({
    default: module.AccountSettingsModal,
  })),
)
export function Topbar({
  title,
  onMenu,
  menuOpen,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead = () => {},
  onMarkAllNotificationsRead = () => {},
  onDismissNotification = () => {},
  notificationsLoading = false,
  notificationsError = '',
}: {
  title: string
  onMenu: () => void
  menuOpen: boolean
  notifications?: AdminNotification[]
  unreadCount?: number
  onMarkNotificationRead?: (id: string) => void
  onMarkAllNotificationsRead?: () => void
  onDismissNotification?: (id: string) => void
  notificationsLoading?: boolean
  notificationsError?: string
}) {
  const { user, signOut } = useAuth()
  const { confirm } = useConfirmation()
  const location = useLocation()
  const customer = user?.role === 'user'
  const { busy, error, run } = useAsyncAction()
  const [account] = useStoredValue(accountKey(user?.id ?? ''), defaultAccount)
  const [now, setNow] = useState(() => new Date())
  const [profileOpenAt, setProfileOpenAt] = useState<string | null>(null)
  const profileOpen = profileOpenAt === location.pathname
  const [notificationsOpenAt, setNotificationsOpenAt] = useState<string | null>(null)
  const notificationsOpen = notificationsOpenAt === location.pathname
  useEffect(() => {
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date())
        schedule()
      }, 60_000 - (Date.now() % 60_000) + 50)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])
  const date = now.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <>
      <header className="topbar">
        <div className="topbar-context">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={onMenu}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title-block">
            <span>{customer ? 'JBC RIGWORKS · CUSTOMER PORTAL' : 'JBC RIGWORKS · ADMIN WORKSPACE'}</span>
            <strong>{title}</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <time
            className={`workspace-clock ${customer ? 'customer-clock' : ''}`}
            dateTime={now.toISOString()}
            aria-label={date + ', ' + time + ', Philippine time'}
          >
            <Clock3 size={17} aria-hidden="true" />
            <span>
              <small>PHILIPPINE TIME</small>
              <strong>{time}</strong>
              <em>{date}</em>
            </span>
          </time>
          {customer ? (
            <nav className="customer-topbar-links" aria-label="Account actions">
              <Link
                to="/customer/settings"
                className="customer-account-link"
                aria-label="Profile and settings"
                title="Profile and settings"
              >
                <span className="topbar-avatar">
                  {account.photo ? <img src={account.photo} alt="" /> : <UserRound size={17} />}
                </span>
                <span>Profile &amp; settings</span>
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (
                      await confirm({
                        title: 'Sign out?',
                        message: 'End your customer session on this device?',
                        confirmLabel: 'Sign out',
                      })
                    )
                      await signOut()
                  })
                }
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
                <span>{busy ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </nav>
          ) : (
            <nav className="admin-topbar-links" aria-label="Account actions">
              <button
                type="button"
                className="admin-notification-button"
                aria-label={notificationsLoading ? 'Notifications loading' : `Notifications, ${unreadCount} unread`}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpenAt(location.pathname)}
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && <span className="admin-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              <button
                type="button"
                className="admin-account-link"
                title="Profile settings"
                aria-label="Profile settings"
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpenAt(location.pathname)}
              >
                <span className="topbar-avatar">
                  {account.photo ? <img src={account.photo} alt="" /> : <UserRound size={18} />}
                </span>
                <span>{account.name || user?.name || 'Profile settings'}</span>
              </button>
              <button
                type="button"
                className="admin-signout-button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (
                      await confirm({
                        title: 'Sign out?',
                        message: 'End your admin session on this device?',
                        confirmLabel: 'Sign out',
                      })
                    )
                      await signOut()
                  })
                }
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
                <span>{busy ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </nav>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!customer && profileOpen && (
        <Suspense fallback={<LoadingState variant="compact" label="Opening profile settings…" />}>
          <AccountSettingsModal accountType="admin" onClose={() => setProfileOpenAt(null)} />
        </Suspense>
      )}
      {!customer && notificationsOpen && (
        <Dialog title="Notification center" onClose={() => setNotificationsOpenAt(null)}>
          <div className="admin-notification-center">
            <div className="admin-notification-summary">
              <p>{unreadCount} unread · Customer activity that needs workshop attention.</p>
              {unreadCount > 0 && (
                <button type="button" className="secondary-button" onClick={onMarkAllNotificationsRead}>
                  <Check size={15} aria-hidden="true" /> Mark all as read
                </button>
              )}
            </div>
            {notificationsError ? (
              <p role="alert" className="form-error">Customer activity could not load: {notificationsError}</p>
            ) : notificationsLoading ? (
              <LoadingState variant="compact" label="Loading customer activity…" />
            ) : notifications.length ? (
              <div className="admin-notification-list">
                {notifications.map((item) => (
                  <div key={item.id} className={`admin-notification-item ${item.read ? 'is-read' : 'is-unread'}`}>
                    <Link to={item.path} className="admin-notification-content" onClick={() => {
                      onMarkNotificationRead(item.id)
                      setNotificationsOpenAt(null)
                    }}>
                      <span className="admin-notification-dot" aria-hidden="true" />
                      <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                    </Link>
                    <div className="admin-notification-actions">
                      {!item.read && <button type="button" onClick={() => onMarkNotificationRead(item.id)} aria-label={`Mark ${item.title} as read`} title="Mark as read"><Check size={15} aria-hidden="true" /><span>Mark read</span></button>}
                      <Link to={item.path} onClick={() => {
                        onMarkNotificationRead(item.id)
                        setNotificationsOpenAt(null)
                      }} aria-label={`View ${item.title}`}><Eye size={15} aria-hidden="true" /><span>View</span></Link>
                      <button type="button" className="is-danger" onClick={() => onDismissNotification(item.id)} aria-label={`Delete ${item.title} notification`} title="Delete notification"><Trash2 size={15} aria-hidden="true" /><span>Delete</span></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="admin-notification-empty">All caught up. New customer orders and requests will appear here.</div>}
          </div>
        </Dialog>
      )}
    </>
  )
}
