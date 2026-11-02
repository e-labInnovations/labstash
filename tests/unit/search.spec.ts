import { describe, expect, it } from 'vitest'

import { formatValue } from '@/lib/format'
import { parseQuery, parseValue } from '@/lib/searchQuery'

describe('parseValue', () => {
  it.each([
    ['10k', 10_000, 'Ω'],
    ['10K', 10_000, 'Ω'],
    ['4k7', 4700, 'Ω'],
    ['2R2', 2.2, 'Ω'],
    ['1M', 1e6, 'Ω'],
    ['330R', 330, 'Ω'],
    ['22E', 22, 'Ω'],
    ['100ohm', 100, 'Ω'],
    ['100nF', 1e-7, 'F'],
    ['100nf', 1e-7, 'F'],
    ['4.7uF', 4.7e-6, 'F'],
    ['10µF', 1e-5, 'F'],
    ['1200mAh', 1200, 'mAh'],
    ['3.3V', 3.3, 'V'],
  ])('%s → %d %s', (token, value, unit) => {
    expect(parseValue(token)).toEqual({ value, unit })
  })

  it.each(['10', '2', 'resistor', '0603'])('%s is not a value', (token) => {
    expect(parseValue(token)).toBeNull()
  })
})

describe('parseQuery', () => {
  it('splits value, package and free text', () => {
    expect(parseQuery('10k 0603 resistor')).toEqual({
      value: { value: 10_000, unit: 'Ω' },
      package: '0603',
      terms: ['resistor'],
    })
  })

  it('normalizes packages and recognizes store codes', () => {
    expect(parseQuery('sot23 mosfet')).toEqual({ package: 'SOT-23', terms: ['mosfet'] })
    expect(parseQuery('et9233')).toEqual({ sku: 'ET9233', terms: [] })
  })

  it('keeps part numbers as text', () => {
    expect(parseQuery('CH32V003')).toEqual({ terms: ['CH32V003'] })
  })
})

describe('formatValue', () => {
  it.each([
    [10_000, 'Ω', '10 kΩ'],
    [4700, 'Ω', '4.7 kΩ'],
    [0, 'Ω', '0 Ω'],
    [1e6, 'Ω', '1 MΩ'],
    [1e-7, 'F', '100 nF'],
    [4.7e-6, 'F', '4.7 µF'],
    [4.7e-4, 'F', '470 µF'],
    [1200, 'mAh', '1200 mAh'],
    [330, 'Ω', '330 Ω'],
  ])('%d %s → %s', (value, unit, out) => {
    expect(formatValue(value, unit)).toBe(out)
  })
})
