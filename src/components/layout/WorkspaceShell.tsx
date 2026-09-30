import { Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Dialog } from '../../components/ui/Dialog'
import { HeaderHost } from '../../components/ui/header-context'
import { LoadingState } from '../../components/ui/LoadingState'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { useDirectories } from '../../lib/directories'
import { navigation } from '../../lib/navigation'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { useAdminNotifications } from '../../features/notifications/useAdminNotifications'

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('jbc-rigworks:sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const location = useLocation()
  const { user, accountError, refreshAccount, resendVerificationEmail } = useAuth()
  const workspace = useWorkspace()
  const { storageError, loading: recordsLoading } = workspace
  const activity = useAdminNotifications(user, workspace.orders)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [preferences, , preferenceStatus] = useStoredValue(
    accountKey(user?.id ?? ''),
    defaultAccount,
  )
  const [, , shopStatus] = useShopSettings()
  const [, , directoryStatus] = useDirectories()
  const databaseError =
    storageError || preferenceStatus.error || shopStatus.error || directoryStatus.error
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const customerTitles: Record<string, string> = {
    '/customer/records': 'My records',
    '/customer/pc-building': 'PC builder',
    '/customer/shop': 'Shop',
    '/customer/orders': 'My orders',
    '/customer/services': 'Services & booking',
    '/customer/pc-identifier': 'PC identifier',
    '/customer/settings': 'My settings',
    '/customer': 'Dashboard',
    '/customer/book': 'Book a service',
    '/customer/build': 'Custom PC request',
    '/customer/appointments': 'My appointments',
    '/customer/requests': 'My PC requests',
  }
  const isCustomer = user?.role === 'user'
  const title = isCustomer
    ? (customerTitles[location.pathname] ?? 'User portal')
    : (navigation.find((item) => location.pathname === '/' + item.id)?.label ??
      (location.pathname === '/settings' ? 'Workspace settings' : 'Dashboard'))

  useEffect(() => {
    document.title = title + ' · JBC RigWorks'
    if (previousPath.current !== location.pathname) {
      main.current?.scrollTo({ top: 0, behavior: 'instant' })
      main.current?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
  }, [location.pathname, title])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1025px)')
    const closeDrawer = () => {
      if (desktop.matches) setSidebarOpen(false)
    }
    desktop.addEventListener('change', closeDrawer)
    return () => {
      desktop.removeEventListener('change', closeDrawer)
    }
  }, [])

  if (!user) return null

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem('jbc-rigworks:sidebar-collapsed', String(next))
      } catch {
        /* Sidebar preference is optional. */
      }
      return next
    })
  }
  return (
    <div
      className={`app-shell ${isCustomer ? 'customer-shell' : 'admin-shell'} ${preferences.compact ? 'density-compact' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      data-page={location.pathname.split('/')[1]}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="app-sidebar">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </aside>
      {sidebarOpen && (
        <Dialog title="Navigation" drawer onClose={() => setSidebarOpen(false)}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </Dialog>
      )}
      <div className="app-main">
        <Topbar
          title={title}
          onMenu={() => setSidebarOpen(true)}
          menuOpen={sidebarOpen}
          notifications={activity.notifications}
          unreadCount={activity.unreadCount}
          onMarkNotificationRead={activity.markRead}
          onMarkAllNotificationsRead={activity.markAllRead}
          onDismissNotification={activity.dismiss}
          notificationsLoading={activity.loading || workspace.ordersLoading}
          notificationsError={activity.error || workspace.ordersError}
        />
        <HeaderHost.Provider value={null}>
          <main
            id="main-content"
            tabIndex={0}
            aria-label="Page content"
            ref={main}
            className="page-content"
          >
            {user.adminVerificationRequired && (
              <div className="verification-banner">
                <p role="status">
                  Your account has been assigned an admin role. Verify {user.email} to open the
                  admin workspace.
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    setVerificationMessage('')
                    setVerificationError('')
                    try {
                      await resendVerificationEmail()
                      setVerificationMessage('Verification email sent.')
                    } catch (error) {
                      setVerificationError(
                        error instanceof Error
                          ? error.message
                          : 'Could not send a verification email.',
                      )
                    }
                  }}
                >
                  Send verification email
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    setVerificationMessage('')
                    setVerificationError('')
                    try {
                      await refreshAccount()
                      setVerificationMessage('Account refreshed.')
                    } catch (error) {
                      setVerificationError(
                        error instanceof Error ? error.message : 'Could not refresh your account.',
                      )
                    }
                  }}
                >
                  I verified my email
                </button>
                {verificationMessage && <span role="status">{verificationMessage}</span>}
                {verificationError && <span role="alert">{verificationError}</span>}
              </div>
            )}
            {accountError && (
              <div className="verification-banner account-error-banner" role="alert">
                <p>{accountError}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    void refreshAccount().catch(() => {
                      /* The banner stays visible until access recovers. */
                    })
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {databaseError && (
              <p role="alert" className="form-error settings-feedback">
                {databaseError}
              </p>
            )}
            {!databaseError && recordsLoading && (
              <LoadingState variant="compact" label="Syncing your records…" />
            )}
            <div className="page-transition" key={location.pathname}>
              <Suspense fallback={<LoadingState label="Loading page…" />}>{children}</Suspense>
            </div>
            <footer className="page-footer">
              <span>
                JBC RIGWORKS <i /> {isCustomer ? 'Customer Portal' : 'Business Hub'}
              </span>
              {!isCustomer && <span>PHP / Asia/Manila</span>}
            </footer>
          </main>
        </HeaderHost.Provider>
      </div>
    </div>
  )
}
