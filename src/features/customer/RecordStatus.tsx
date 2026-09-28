import { StatusBadge } from '../../components/ui/StatusBadge'

export function RecordStatus({ status, label }: { status: string; label?: string }) {
  const tone = ['Paid', 'Completed', 'Approved'].includes(status)
    ? 'green'
    : ['Cancelled', 'Declined', 'Rejected', 'No show'].includes(status)
      ? 'red'
      : ['Confirmed', 'Ready', 'In service', 'Assembly', 'Out for delivery'].includes(status)
        ? 'blue'
        : [
              'Requested',
              'Quote requested',
              'Under review',
              'Pending',
              'Quoted',
              'Unpaid',
              'Partially paid',
            ].includes(status)
          ? 'amber'
          : 'gray'
  return <StatusBadge tone={tone}>{label ?? status}</StatusBadge>
}
