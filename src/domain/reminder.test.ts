import { describe, expect, it } from 'vitest'
import { createReminderMessage, validateReminderSettings } from './reminder'

describe('validateReminderSettings', () => {
	it('accepts intervals from 1 to 60 minutes', () => {
		expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 1, reminderSchedule: 'cada 1min' })).toBeNull()
		expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 1, reminderSchedule: 'cada 60min' })).toBeNull()
  })

  it('requires as many scheduled hours as sends', () => {
    expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 2, reminderSchedule: '09:00, 18:00' })).toBeNull()
    expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 1, reminderSchedule: '09:00, 18:00' })).not.toBeNull()
  })

	it('rejects invalid schedules', () => {
		expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 1, reminderSchedule: 'cada 61min' })).not.toBeNull()
    expect(validateReminderSettings({ reminderMessage: 'Cobro pendiente', reminderTimes: 1, reminderSchedule: '25:00' })).not.toBeNull()
	})

	it('prepends the meter payment summary to the custom message', () => {
		expect(createReminderMessage('12345', 'Julio 2026', [
			{ name: 'Local 1', consumption: 20, share: 0.25, payment: 75 },
		], 'Por favor realizar el pago.')).toBe(
			'Resumen de cobro - Suministro 12345 (Julio 2026)\nLocal 1: 20.00 kWh | Participacion: 25.00% | Debe pagar: S/ 75.00\nTotal medidores: 20.00 kWh | Participacion: 25.00% | Total a cobrar: S/ 75.00\n\nPor favor realizar el pago.'
		)
	})
})
