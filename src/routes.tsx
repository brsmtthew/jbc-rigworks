import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { WorkspaceShell } from './components/layout/WorkspaceShell'
import { useAuth } from './lib/auth-context'

type EntryType = 'job' | 'item' | 'expense'
const ServiceIntake = lazy(() =>
  import('./features/services/ServiceIntake').then((module) => ({ default: module.ServiceIntake })),
)
const ExpenseEditor = lazy(() =>
  import('./features/finance/ExpenseEditor').then((module) => ({ default: module.ExpenseEditor })),
)
const InventoryEditor = lazy(() =>
  import('./features/inventory/InventoryEditor').then((module) => ({
    default: module.InventoryEditor,
  })),
)

const PcBuildingPage = lazy(() =>
  import('./features/builder/PcBuildingPage').then((module) => ({
    default: module.PcBuildingPage,
  })),
)
const PosPage = lazy(() =>
  import('./features/pos/PosPage').then((module) => ({ default: module.PosPage })),
)
const CustomerSettings = lazy(() =>
  import('./features/settings/CustomerSettings').then((module) => ({
    default: module.CustomerSettings,
  })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const UsersPage = lazy(() =>
  import('./features/settings/UsersPage').then((module) => ({ default: module.UsersPage })),
)
const RecordsPage = lazy(() =>
  import('./features/customer/RecordsPage').then((module) => ({ default: module.RecordsPage })),
)
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ExpensesPage = lazy(() =>
  import('./features/finance/ExpensesPage').then((module) => ({ default: module.ExpensesPage })),
)
const InventoryPage = lazy(() =>
  import('./features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
)
const ServiceWorkspace = lazy(() =>
  import('./features/services/ServiceWorkspace').then((module) => ({
    default: module.ServiceWorkspace,
  })),
)
const ReportsPage = lazy(() =>
  import('./features/finance/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const SalesPage = lazy(() =>
  import('./features/finance/SalesPage').then((module) => ({ default: module.SalesPage })),
)
const AuthPage = lazy(() =>
  import('./features/auth/AuthPage').then((module) => ({ default: module.AuthPage })),
)
const BookingPage = lazy(() =>
  import('./features/customer/BookingPage').then((module) => ({ default: module.BookingPage })),
)
const CustomerHomePage = lazy(() =>
  import('./features/customer/CustomerHomePage').then((module) => ({
    default: module.CustomerHomePage,
  })),
)

function WorkspaceRoutes() {
  const { user } = useAuth()
  const isCustomer = user?.role === 'user'
  const location = useLocation()
  const [entry, setEntry] = useState<EntryType | null>(null)
  return (
    <>
      <Routes>
        {isCustomer ? (
          <>
            <Route path="/customer" element={<CustomerHomePage />} />
            <Route path="/customer/book" element={<BookingPage />} />
            <Route
              path="/customer/directory"
              element={<Navigate to="/customer/pc-building" replace />}
            />
            <Route path="/customer/pc-building" element={<PcBuildingPage />} />
            <Route path="/customer/shop" element={<PosPage />} />
            <Route path="/customer/records" element={<RecordsPage />} />
            <Route
              path="/customer/orders"
              element={<Navigate to="/customer/records?tab=orders" replace />}
            />
            <Route path="/customer/services" element={<BookingPage />} />
            <Route
              path="/customer/pc-identifier"
              element={<Navigate to="/customer/pc-building" replace />}
            />
            <Route path="/customer/settings" element={<CustomerSettings />} />
            <Route
              path="/customer/build"
              element={<Navigate to="/customer/pc-building" replace />}
            />
            <Route
              path="/customer/appointments"
              element={<Navigate to="/customer/records?tab=appointments" replace />}
            />
            <Route
              path="/customer/requests"
              element={<Navigate to="/customer/records?tab=requests" replace />}
            />
            <Route path="*" element={<Navigate to="/customer" replace />} />
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/overview"
              element={<Navigate to={'/dashboard' + location.search} replace />}
            />
            <Route path="/jobs" element={<ServiceWorkspace onCreate={() => setEntry('job')} />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route
              path="/inventory"
              element={<InventoryPage onCreate={() => setEntry('item')} />}
            />
            <Route
              path="/expenses"
              element={<ExpensesPage onCreate={() => setEntry('expense')} />}
            />
            <Route path="/pc-directory" element={<Navigate to="/inventory" replace />} />
            <Route path="/pc-building" element={<PcBuildingPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/services" element={<Navigate to="/jobs" replace />} />
            <Route
              path="/directories"
              element={<Navigate to="/settings?section=reference" replace />}
            />
            <Route path="/pc-identifier" element={<Navigate to="/pc-building" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </>
        )}
      </Routes>
      <Suspense fallback={<p role="status">Opening form…</p>}>
        {entry === 'job' && <ServiceIntake onClose={() => setEntry(null)} />}
        {entry === 'item' && <InventoryEditor onClose={() => setEntry(null)} />}
        {entry === 'expense' && <ExpenseEditor onClose={() => setEntry(null)} />}
      </Suspense>
    </>
  )
}

export function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading)
    return (
      <main className="auth-loading" role="status">
        Loading your workspace…
      </main>
    )
  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  return (
    <Routes>
      <Route
        path="*"
        element={
          <WorkspaceShell key={user.id + ':' + user.role}>
            <WorkspaceRoutes />
          </WorkspaceShell>
        }
      />
    </Routes>
  )
}
