import { DirectoriesPage } from './features/directories/DirectoriesPage'
import { useWorkspace } from './lib/workspaceStorage'
import { PcBuildingPage } from './features/builder/PcBuildingPage'
import { PcPartsDirectoryPage } from './features/builder/PcPartsDirectoryPage'
import { PosPage } from './features/pos/PosPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { UsersPage } from './features/users/UsersPage'
import { ServicesPage } from './features/services/ServicesPage'
import { HeaderHost } from './components/ui/header-context'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { RecordsPage } from './features/customer/RecordsPage'
import { accountKey, defaultAccount, useStoredValue } from './lib/preferences'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { navigation } from './lib/navigation'
import { Topbar } from './components/layout/Topbar'
import { Dialog } from './components/ui/Dialog'
import { EntryForm, type EntryType } from './components/ui/EntryForm'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { JobsPage } from './features/jobs/JobsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SalesPage } from './features/sales/SalesPage'
import { AuthPage } from './features/auth/AuthPage'
import { ConfirmationProvider } from './components/ui/ConfirmationProvider'
import { BookServicePage } from './features/customer/BookServicePage'
import { CustomerHomePage } from './features/customer/CustomerHomePage'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import './App.css'
import './styles/workspace.css'
import './styles/commerce.css'
import './styles/workflows.css'
import './styles/directories.css'

function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('jbc-rigworks:sidebar-collapsed') === 'true' } catch { return false } })
  const [entry, setEntry] = useState<EntryType | 'choose' | null>(null)
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null)
  const location = useLocation()
  const { user, accountError, refreshAccount, resendVerificationEmail } = useAuth()
  const { storageError } = useWorkspace()
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [preferences] = useStoredValue(accountKey(user?.id ?? ''), defaultAccount)
  useEffect(() => {
    if (user?.role === 'admin') {
      try { localStorage.setItem('jbc-rigworks:shop-owner:v1', user.id); window.dispatchEvent(new Event('jbc-workspace-change')) } catch { /* The forms report storage failures when saving. */ }
    }
  }, [user?.id, user?.role])
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const customerTitles: Record<string, string> = { '/customer/records': 'My records', '/customer/pc-building': 'PC builder', '/customer/shop': 'Shop & order', '/customer/orders': 'My orders', '/customer/services': 'Services & booking', '/customer/pc-identifier': 'PC identifier', '/customer/settings': 'My settings', '/customer': 'Dashboard', '/customer/book': 'Book a service', '/customer/build': 'Custom PC request', '/customer/appointments': 'My appointments', '/customer/requests': 'My PC requests' }
  const isCustomer = user?.role === 'user'
  const title = isCustomer ? customerTitles[location.pathname] ?? 'User portal' : navigation.find(item => location.pathname === '/' + item.id)?.label ?? (location.pathname === '/settings' ? 'Workspace settings' : 'Dashboard')

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
    const closeDrawer = () => { if (desktop.matches) setSidebarOpen(false) }
    desktop.addEventListener('change', closeDrawer)
    return () => { desktop.removeEventListener('change', closeDrawer) }
  }, [])

  if (!user) return null

  function toggleSidebar() { setSidebarCollapsed(value => { const next = !value; try { localStorage.setItem('jbc-rigworks:sidebar-collapsed', String(next)) } catch { /* Sidebar preference is optional. */ } return next }) }
  return <div className={`app-shell ${preferences.compact ? 'density-compact' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="app-sidebar"><Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} /></aside>
    {sidebarOpen && <Dialog title="Navigation" drawer onClose={() => setSidebarOpen(false)}><Sidebar onNavigate={() => setSidebarOpen(false)} /></Dialog>}
    <div className="app-main">
      <Topbar title={title} onMenu={() => setSidebarOpen(true)} menuOpen={sidebarOpen} />
      <div className="page-header-host" role="region" aria-label="Page heading" ref={setHeaderHost} />
      <HeaderHost.Provider value={headerHost}>
      <main id="main-content" tabIndex={0} aria-label="Page content" ref={main} className="page-content">
        {user && !user.emailVerified && <div className="verification-banner">
          <p role="status">Check {user.email} for a verification link. Your profile appears in the user directory after verification.</p>
          <button type="button" className="secondary-button" onClick={async () => {
            setVerificationMessage(''); setVerificationError('')
            try { await resendVerificationEmail(); setVerificationMessage('Verification email sent.') }
            catch (error) { setVerificationError(error instanceof Error ? error.message : 'Could not send a verification email.') }
          }}>Send verification email</button>
          <button type="button" className="secondary-button" onClick={async () => {
            setVerificationMessage(''); setVerificationError('')
            try { await refreshAccount(); setVerificationMessage('Account refreshed.') }
            catch (error) { setVerificationError(error instanceof Error ? error.message : 'Could not refresh your account.') }
          }}>I verified my email</button>
          {verificationMessage && <span role="status">{verificationMessage}</span>}
          {verificationError && <span role="alert">{verificationError}</span>}
        </div>}
        {accountError && <div className="verification-banner account-error-banner" role="alert"><p>{accountError}</p>{user?.emailVerified && <button type="button" className="secondary-button" onClick={() => { void refreshAccount().catch(() => { /* The banner stays visible until access recovers. */ }) }}>Retry</button>}</div>}
        {storageError && <p role="alert" className="form-error settings-feedback">{storageError}</p>}
        <div className="page-transition" key={location.pathname}>
          <Routes>
            {isCustomer ? <>
              <Route path="/customer" element={<CustomerHomePage />} />
              <Route path="/customer/book" element={<BookServicePage />} />
              <Route path="/customer/directory" element={<Navigate to="/customer/pc-building" replace />} />
              <Route path="/customer/pc-building" element={<PcBuildingPage />} />
              <Route path="/customer/shop" element={<PosPage />} />
              <Route path="/customer/records" element={<RecordsPage />} />
              <Route path="/customer/orders" element={<Navigate to="/customer/records?tab=orders" replace />} />
              <Route path="/customer/services" element={<ServicesPage />} />
              <Route path="/customer/pc-identifier" element={<Navigate to="/customer/pc-building?mode=identify" replace />} />
              <Route path="/customer/settings" element={<SettingsPage />} />
              <Route path="/customer/build" element={<Navigate to="/customer/pc-building" replace />} />
              <Route path="/customer/appointments" element={<Navigate to="/customer/records?tab=appointments" replace />} />
              <Route path="/customer/requests" element={<Navigate to="/customer/records?tab=requests" replace />} />
              <Route path="*" element={<Navigate to="/customer" replace />} />
            </> : <>
              <Route path="/dashboard" element={<DashboardPage />} /><Route path="/overview" element={<Navigate to={"/dashboard" + location.search} replace />} />
              <Route path="/jobs" element={<JobsPage onCreate={() => setEntry('job')} />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/inventory" element={<InventoryPage onCreate={() => setEntry('item')} />} />
              <Route path="/expenses" element={<ExpensesPage onCreate={() => setEntry('expense')} />} />
              <Route path="/pc-directory" element={<PcPartsDirectoryPage />} />
              <Route path="/pc-building" element={<PcBuildingPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/services" element={<Navigate to="/pc-identifier" replace />} /><Route path="/directories" element={<DirectoriesPage />} />
              <Route path="/pc-identifier" element={<Navigate to="/pc-building?mode=identify" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </>}
          </Routes>
        </div>
        <footer className="page-footer"><span>JBC RIGWORKS <i /> {isCustomer ? 'User Portal' : 'Business Hub'}</span><span>PHP / Asia/Manila</span></footer>
      </main>
      </HeaderHost.Provider>
    </div>
    {entry && <EntryForm initialType={entry === 'choose' ? undefined : entry} onClose={() => setEntry(null)} />}
  </div>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <main className="auth-loading" role="status">Loading your workspace…</main>
  if (!user) return <Routes><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
  return <Routes><Route path="*" element={<Workspace />} /></Routes>
}

export default function App() { return <ErrorBoundary><AuthProvider><ConfirmationProvider><BrowserRouter><AppRoutes /></BrowserRouter></ConfirmationProvider></AuthProvider></ErrorBoundary> }

