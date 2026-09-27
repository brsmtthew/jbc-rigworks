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
import { AppRoutes } from './routes'

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }])

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmationProvider>
          <Suspense fallback={<LoadingState />}>
            <RouterProvider router={router} />
          </Suspense>
        </ConfirmationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
