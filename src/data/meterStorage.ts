import type { BillingRecord, Meter } from '../domain/meter'
import { defaultReminderSettings } from '../domain/reminder'

const storageKey = 'electricity-payment-records-v1'

export function createDefaultMeters(): Meter[] {
  return [
    { id: crypto.randomUUID(), name: 'Casa', previousReading: 0, currentReading: 0 },
    { id: crypto.randomUUID(), name: 'Local 1', previousReading: 0, currentReading: 0 },
    { id: crypto.randomUUID(), name: 'Local 2', previousReading: 0, currentReading: 0 },
  ]
}

export function createEmptyRecord(): BillingRecord {
	return { createdAt: '', supplyNumber: '', billedMonth: new Date().getMonth() + 1, billedYear: new Date().getFullYear(), totalBill: 0, billedConsumption: 0, meters: createDefaultMeters(), ...defaultReminderSettings }
}

export function recordKey(record: Pick<BillingRecord, 'supplyNumber' | 'billedMonth' | 'billedYear'>) {
  return `${record.supplyNumber.trim()}-${record.billedYear}-${record.billedMonth}`
}

export function loadRecords(): BillingRecord[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return []
    const records = JSON.parse(saved) as BillingRecord[]
    return Array.isArray(records) ? records.filter((record) => Array.isArray(record.meters) && typeof record.supplyNumber === 'string') : []
  } catch {
    return []
  }
}

function persist(records: BillingRecord[]) {
  localStorage.setItem(storageKey, JSON.stringify(records))
}

export function upsertRecord(records: BillingRecord[], record: BillingRecord) {
  const key = recordKey(record)
  const next = [...records.filter((item) => recordKey(item) !== key), record]
  persist(next)
  return next
}

export function removeRecord(records: BillingRecord[], key: string) {
  const next = records.filter((record) => recordKey(record) !== key)
  persist(next)
  return next
}
