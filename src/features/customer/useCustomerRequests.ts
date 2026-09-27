import { where } from 'firebase/firestore'
import { useLiveCollection } from '../../hooks/useLiveData'
import type { AppUser, CustomerAppointment, CustomPcRequest } from '../../types'

export function useCustomerRequests(user: AppUser | null) {
  const appointments = useLiveCollection<CustomerAppointment>(
    'appointments',
    !!user,
    [where('customerId', '==', user?.id ?? '')],
    user?.id,
  )
  const requests = useLiveCollection<CustomPcRequest>(
    'pcRequests',
    !!user,
    [where('customerId', '==', user?.id ?? '')],
    user?.id,
  )
  return {
    appointments: appointments.rows,
    requests: requests.rows,
    error: appointments.error || requests.error,
    loading: appointments.loading || requests.loading,
  }
}

export function useAllRequests(enabled: boolean) {
  const appointments = useLiveCollection<CustomerAppointment>('appointments', enabled)
  const requests = useLiveCollection<CustomPcRequest>('pcRequests', enabled)
  return {
    appointments: appointments.rows,
    requests: requests.rows,
    error: appointments.error || requests.error,
    loading: appointments.loading || requests.loading,
  }
}
