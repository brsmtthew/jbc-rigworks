import type { BookingSchedule, ServiceOffering } from '../../types'

export const defaultSchedule: BookingSchedule = {
  days: [1, 2, 3, 4, 5, 6],
  opens: '09:00',
  closes: '18:00',
  windows: [
    { id: 'morning', start: '09:00', end: '11:00', capacity: 1 },
    { id: 'midday', start: '11:00', end: '13:00', capacity: 1 },
    { id: 'afternoon', start: '14:00', end: '16:00', capacity: 1 },
    { id: 'late', start: '16:00', end: '18:00', capacity: 1 },
  ],
  blockedDates: [],
  blockedPeriods: [],
}
export function adaptServices(
  cleaning?: Record<string, Record<string, string>>,
): ServiceOffering[] {
  return (['Desktop', 'Laptop'] as const)
    .flatMap((device) =>
      ['Standard Deep Cleaning', 'Advanced Deep Cleaning', 'Complete Detail'].map((name, i) => ({
        id: `${device.toLowerCase()}-${i}`,
        name,
        deviceType: device,
        description: `${device} cleaning and care. Package inclusions are confirmed by JBC before service.`,
        inclusions: '',
        price: cleaning?.[device]?.[['Low', 'Mid', 'High'][i]] ?? '',
        durationMinutes: 120,
        workshop: true,
        home: true,
        active: true,
      })),
    )
    .concat(
      ['Diagnosis & Repair', 'Hardware Upgrade', 'PC Assembly'].map((name, index) => ({
        id: `service-${index}`,
        name,
        deviceType: 'Desktop' as const,
        description: 'Assessment and a final quote from JBC before work starts.',
        inclusions: '',
        price: '',
        durationMinutes: 120,
        workshop: true,
        home: false,
        active: true,
      })),
    )
}
export const slotLabel = (slot: BookingSchedule['windows'][number]) => `${slot.start}–${slot.end}`
export const slotKey = (date: string, windowId: string) => `${date}_${windowId}`
export function availableWindows(
  date: string,
  schedule: BookingSchedule,
  counts: { id: string; count: number }[],
  duration = 0,
  now = new Date(),
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    schedule.blockedDates.includes(date) ||
    !schedule.days.includes(new Date(`${date}T12:00:00+08:00`).getUTCDay())
  )
    return []
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  return schedule.windows.filter(
    (slot) =>
      slot.capacity > 0 &&
      slot.start >= schedule.opens &&
      slot.end <= schedule.closes &&
      slot.end > slot.start &&
      minutes(slot.end) - minutes(slot.start) >= duration &&
      new Date(`${date}T${slot.start}:00+08:00`).getTime() > now.getTime() &&
      !schedule.blockedPeriods.some(
        (block) => block.date === date && block.start < slot.end && block.end > slot.start,
      ) &&
      (counts.find((count) => count.id === slotKey(date, slot.id))?.count ?? 0) < slot.capacity,
  )
}
