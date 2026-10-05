import { describe, expect, it } from 'vitest'
import { calculateBill } from './calculateBill'

describe('calculateBill', () => {
  it('distributes the bill according to each meter consumption', () => {
    const result = calculateBill([
      { id: '1', name: 'Casa', previousReading: 100, currentReading: 130 },
      { id: '2', name: 'Local', previousReading: 50, currentReading: 70 },
    ], 150, 50)

    expect(result.totalConsumption).toBe(50)
    expect(result.meters[0].share).toBe(0.6)
    expect(result.meters[0].payment).toBe(90)
    expect(result.meters[1].payment).toBe(60)
  })

  it('does not allocate a bill when total consumption is zero', () => {
    const result = calculateBill([{ id: '1', name: 'Casa', previousReading: 10, currentReading: 10 }], 80, 0)
    expect(result.meters[0].payment).toBe(0)
  })

  it('treats readings that go backwards as zero consumption', () => {
    const result = calculateBill([{ id: '1', name: 'Casa', previousReading: 50, currentReading: 45 }], 80, 10)
    expect(result.meters[0].consumption).toBe(0)
  })

  it('blocks payment allocation when meter consumption differs from the bill', () => {
    const result = calculateBill([{ id: '1', name: 'Casa', previousReading: 0, currentReading: 40 }], 100, 50)
    expect(result.isReconciled).toBe(false)
    expect(result.consumptionDifference).toBe(-10)
    expect(result.assignedAmount).toBe(0)
  })

  it('allows a difference within the one kWh reconciliation tolerance', () => {
    const result = calculateBill([{ id: '1', name: 'Casa', previousReading: 0, currentReading: 49.2 }], 100, 50)
    expect(result.isReconciled).toBe(true)
    expect(result.assignedAmount).toBe(100)
  })
})
