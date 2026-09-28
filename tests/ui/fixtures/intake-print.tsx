import { createRoot } from 'react-dom/client'
import { ServiceIntakePrintRoot } from '../../../src/features/customer/ServiceIntakeDocument'
import { emptyServiceIntake } from '../../../src/features/customer/serviceIntake'
import '../../../src/styles/customer-booking.css'

const appointment = {
  id: 'APT-layout', service: 'Standard Deep Cleaning', device: 'Lenovo ThinkPad T14',
  customerName: 'Jamie Santos', customerEmail: 'jamie@example.test',
  preferredDate: '2026-10-10', preferredTime: '09:00–11:00', notes: 'Fan noise',
  createdAt: '2026-09-28T00:00:00.000Z', status: 'Requested' as const,
  visit: { mode: 'Workshop' as const, address: '', distanceKm: 0, basePrice: 700,
    surcharge: 0, transport: 0, taxRate: 0, estimate: 700 },
  serviceIntake: { ...emptyServiceIntake, customerName: 'Jamie Santos', contactPhone: '09171234567',
    cpu: 'Core i5', gpu: 'Integrated graphics', ram: '16 GB', storage: '512 GB SSD',
    motherboard: 'Unknown', psuOrCharger: '65 W charger', cooling: 'Stock',
    serialNumber: 'TEST-123', accessories: 'Charger', visibleDamage: ['Scratches'],
    visibleCondition: 'Small scratch on lid', reportedIssues: 'Fan noise and warm chassis',
    issueHistory: 'Started last month after a long period of use', previousRepairs: 'None',
    backupStatus: 'Backed up' as const },
}
createRoot(document.getElementById('root')!).render(<ServiceIntakePrintRoot appointment={appointment} />)
