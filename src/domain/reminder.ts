export interface ReminderSettings {
  reminderMessage: string
  reminderTimes: number
  reminderSchedule: string
}

export interface ReminderMeterSummary {
  name: string
  consumption: number
  share: number
  payment: number
}

export const defaultReminderSettings: ReminderSettings = {
  reminderMessage: 'Recordatorio',
  reminderTimes: 1,
  reminderSchedule: 'cada 5min',
}

const intervalPattern = /^cada\s+([1-9]|[1-5]\d|60)min$/i
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export function validateReminderSettings({ reminderMessage, reminderTimes, reminderSchedule }: ReminderSettings) {
  if (!reminderMessage.trim()) return 'El mensaje del recordatorio es obligatorio.'
  if (!Number.isInteger(reminderTimes) || reminderTimes < 1) {
    return 'La cantidad de envios debe ser un numero entero mayor que cero.'
  }

  const schedule = reminderSchedule.trim()
  if (intervalPattern.test(schedule)) return null

  const times = schedule.split(',').map((time) => time.trim())
  if (times.every((time) => timePattern.test(time)) && times.length === reminderTimes) return null

  return 'Usa "cada 1min" a "cada 60min", o horas HH:mm separadas por comas que coincidan con la cantidad de envios.'
}

export function reminderSettingsOf(record: Partial<ReminderSettings>): ReminderSettings {
  return {
    reminderMessage: record.reminderMessage ?? defaultReminderSettings.reminderMessage,
    reminderTimes: record.reminderTimes ?? defaultReminderSettings.reminderTimes,
    reminderSchedule: record.reminderSchedule ?? defaultReminderSettings.reminderSchedule,
  }
}

export function createReminderMessage(
  supplyNumber: string,
  period: string,
  meters: ReminderMeterSummary[],
  message: string
) {
  // const meterSummary = meters.map((meter, index) =>
  //   `${meter.name.trim() || `Medidor ${index + 1}`}: ${meter.consumption.toFixed(2)} kWh | Participacion: ${(meter.share * 100).toFixed(2)}% | Debe pagar: S/ ${meter.payment.toFixed(2)}`
  // )

  const meterSummary = meters.map((meter, index) =>
    `${meter.name.trim() || `Medidor ${index + 1}`}: *S/ ${meter.payment.toFixed(2)}* (${(meter.share * 100).toFixed(2)}%)`
  )

  const totals = meters.reduce(
    (summary, meter) => ({
      consumption: summary.consumption + meter.consumption,
      share: summary.share + meter.share,
      payment: summary.payment + meter.payment,
    }),
    { consumption: 0, share: 0, payment: 0 }
  )
  //const totalSummary = `Total medidores: ${totals.consumption.toFixed(2)} kWh | Participacion: ${(totals.share * 100).toFixed(2)}% | Total a cobrar: S/ ${totals.payment.toFixed(2)}`
  const totalSummary = `Total del recibo: *S/ ${totals.payment.toFixed(2)}* (${(totals.share * 100).toFixed(2)}%)`

  return [
    `\nResumen de cobro - Suministro ${supplyNumber} (${period})`,
    ...meterSummary,
    totalSummary,
    '',
    message.trim(),
  ].join('\n')
}
