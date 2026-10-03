import { Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ConfirmationProvider } from './components/ui/ConfirmationProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { LoadingState } from './components/ui/LoadingState'
import { AuthProvider } from './lib/auth'
import './App.css'
import './styles/workspace.css'
import './styles/commerce.css'
import './styles/workflows.css'
import './styles/directories.css'
import './styles/payments.css'
import './styles/v2.css'
import './styles/customer.css'
import './styles/admin.css'
import './styles/admin-navigation.css'
import './styles/admin-dashboard.css'
import './styles/admin-pos.css'
import './styles/admin-services.css'
import './styles/admin-sales.css'
import './styles/admin-expenses.css'
import './styles/admin-reports.css'
import './styles/admin-settings.css'
import './styles/auth.css'
import './styles/customer-home.css'
import './styles/customer-navigation.css'
import './styles/customer-booking.css'
import './styles/customer-records.css'
import './styles/customer-forms.css'
import './styles/customer-settings.css'
import './styles/customer-invoice.css'
import './styles/loading.css'
import './styles/blue-hero.css'
import './styles/admin-inventory.css'
import './styles/admin-refinements.css'
import './styles/discovery-controls.css'
import './styles/dropdown-controls.css'
import { AppRoutes } from './routes'

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }])

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmationProvider>
          <Suspense fallback={<LoadingState variant="screen" label="Opening JBC RigWorks…" />}>
            <RouterProvider router={router} />
          </Suspense>
        </ConfirmationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
