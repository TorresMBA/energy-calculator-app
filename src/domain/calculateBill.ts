import type { BillResult, Meter, MeterResult } from './meter'

const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0)
export const reconciliationTolerance = 5

const round = (value: number) => Math.round(value * 100) / 100

export function calculateBill(meters: Meter[], totalBill: number, billedConsumption: number): BillResult {
  const normalizedBill = Math.max(0, safeNumber(totalBill))
  const normalizedBilledConsumption = Math.max(0, safeNumber(billedConsumption))
  const consumptions = meters.map((meter) =>
    Math.max(0, safeNumber(meter.currentReading) - safeNumber(meter.previousReading)),
  )
  const totalConsumption = consumptions.reduce((total, consumption) => total + consumption, 0)
  const consumptionDifference = round(totalConsumption - normalizedBilledConsumption)
  const isReconciled = normalizedBilledConsumption > 0 && Math.abs(consumptionDifference) <= reconciliationTolerance
  const calculatedMeters: MeterResult[] = meters.map((meter, index) => {
    const consumption = consumptions[index]
    const share = totalConsumption > 0 ? consumption / totalConsumption : 0
    return { ...meter, consumption, share, payment: isReconciled ? share * normalizedBill : 0 }
  })

  return {
    meters: calculatedMeters,
    totalConsumption,
    billedConsumption: normalizedBilledConsumption,
    consumptionDifference,
    isReconciled,
    totalBill: normalizedBill,
    assignedAmount: calculatedMeters.reduce((total, meter) => total + meter.payment, 0),
  }
}
