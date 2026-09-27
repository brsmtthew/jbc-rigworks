import { where } from 'firebase/firestore'
import { useLiveCollection } from '../../hooks/useLiveData'
import type { AppUser, PaymentAccount, PaymentProof } from '../../types'

export function usePaymentAccounts() {
  return useLiveCollection<PaymentAccount>('paymentAccounts')
}
export function usePaymentProofs(user: AppUser | null) {
  return useLiveCollection<PaymentProof>(
    'paymentProofs',
    !!user,
    user?.role === 'admin' ? [] : [where('customerId', '==', user?.id ?? '')],
    user?.role === 'admin' ? 'admin' : user?.id,
  )
}
