import { describe, expect, it } from 'vitest'
import { isRecordEditable } from './recordEditability'

describe('isRecordEditable', () => {
  const now = new Date('2026-07-29T12:00:00.000Z')

  it('allows editing through the configured time window', () => {
    expect(isRecordEditable('2026-07-15T12:00:00.000Z', 14, now)).toBe(true)
  })

  it('locks a record after the configured time window', () => {
    expect(isRecordEditable('2026-07-15T11:59:59.000Z', 14, now)).toBe(false)
  })
})
