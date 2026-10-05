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
})

describe('createReminderMessage', () => {
  it('prepends the meter payment summary to the custom message', () => {
    expect(createReminderMessage('12345', 'Julio 2026', [
      { name: 'Local 1', consumption: 20, share: 0.25, payment: 75 },
    ], 'Por favor realizar el pago.')).toBe(
      'Resumen de cobro - Suministro 12345 (Julio 2026)\nLocal 1: *S/ 75.00* (25.00%)\nTotal del recibo: *S/ 75.00* (25.00%)\n\nPor favor realizar el pago.'
    )
  })

  it('sums payments and shares across all meters', () => {
    const message = createReminderMessage('12345', 'Julio 2026', [
      { name: 'Casa', consumption: 30, share: 0.6, payment: 90 },
      { name: 'Local', consumption: 20, share: 0.4, payment: 60 },
    ], 'Cobro pendiente')

    expect(message).toContain('Casa: *S/ 90.00* (60.00%)')
    expect(message).toContain('Local: *S/ 60.00* (40.00%)')
    expect(message).toContain('Total del recibo: *S/ 150.00* (100.00%)')
  })

  it('trims names and the custom message and labels unnamed meters', () => {
    const message = createReminderMessage('12345', 'Julio 2026', [
      { name: ' Casa ', consumption: 0, share: 0, payment: 0 },
      { name: '   ', consumption: 1, share: 1, payment: 10 },
    ], '  Cobro pendiente  ')

    expect(message).toContain('Casa: *S/ 0.00* (0.00%)')
    expect(message).toContain('Medidor 2: *S/ 10.00* (100.00%)')
    expect(message).toMatch(/\n\nCobro pendiente$/)
  })

  it('formats rounded amounts and percentages to two decimal places', () => {
    const message = createReminderMessage('12345', 'Julio 2026', [
      { name: 'Casa', consumption: 1, share: 1 / 3, payment: 10 / 3 },
      { name: 'Local', consumption: 2, share: 2 / 3, payment: 20 / 3 },
    ], 'Cobro pendiente')

    expect(message).toContain('Casa: *S/ 3.33* (33.33%)')
    expect(message).toContain('Local: *S/ 6.67* (66.67%)')
    expect(message).toContain('Total del recibo: *S/ 10.00* (100.00%)')
  })
})
