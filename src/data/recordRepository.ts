import type { BillingRecord } from '../domain/meter'
import { recordKey } from './meterStorage'

export interface RecordSettings {
  editWindowDays: number
}

export interface ReminderPayload {
  mensaje: string
  veces: number
  horario: string
}

async function request(url: string, options?: RequestInit): Promise<BillingRecord[]> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(error?.message ?? 'No fue posible guardar los registros.')
  }
  return response.json() as Promise<BillingRecord[]>
}

export function fetchRecords() {
  return request('/api/records')
}

export async function fetchRecordSettings(): Promise<RecordSettings> {
  const response = await fetch('/api/settings')
  if (!response.ok) throw new Error('No fue posible cargar la configuracion.')
  return response.json() as Promise<RecordSettings>
}

export function persistRecord(record: BillingRecord) {
  return request(`/api/records/${encodeURIComponent(recordKey(record))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
}

export function deletePersistedRecord(key: string) {
  return request(`/api/records/${encodeURIComponent(key)}`, { method: 'DELETE' })
}

export async function sendReminder(payload: ReminderPayload) {
  const response = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(error?.message ?? 'No fue posible enviar el recordatorio de WhatsApp.')
  }
}
