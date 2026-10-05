export interface Meter {
  id: string
  name: string
  previousReading: number
  currentReading: number
}

export interface MeterResult extends Meter {
  consumption: number
  share: number
  payment: number
}

export interface BillResult {
  meters: MeterResult[]
  totalConsumption: number
  billedConsumption: number
  consumptionDifference: number
  isReconciled: boolean
  totalBill: number
  assignedAmount: number
}

export interface BillingRecord {
  createdAt: string
  supplyNumber: string
  billedMonth: number
  billedYear: number
  totalBill: number
  billedConsumption: number
  meters: Meter[]
  reminderMessage?: string
  reminderTimes?: number
  reminderSchedule?: string
}
