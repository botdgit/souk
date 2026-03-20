import { describe, it, expect } from 'vitest'
import { computeFees } from './stripe'

describe('computeFees', () => {
  it('calculates 5% service fee correctly', () => {
    const result = computeFees(32000) // AED 320.00 in fils
    expect(result.priceAed).toBe(32000)
    expect(result.serviceFee).toBe(1600) // 5% = AED 16.00
    expect(result.deliveryFeeAed).toBe(0)
    expect(result.total).toBe(33600) // AED 336.00
  })

  it('includes delivery fee in total', () => {
    const result = computeFees(32000, 1500) // AED 15.00 delivery
    expect(result.total).toBe(35100) // 32000 + 1600 + 1500
  })

  it('rounds service fee to nearest fil', () => {
    const result = computeFees(1000) // AED 10.00
    expect(result.serviceFee).toBe(50) // AED 0.50
    expect(result.total).toBe(1050)
  })

  it('handles zero delivery fee', () => {
    const result = computeFees(5000, 0)
    expect(result.deliveryFeeAed).toBe(0)
  })
})
