import { describe, expect, it } from 'vitest'

import { compartmentCodes, nextBoxCode, normalizeCode } from '@/lib/boxes'

describe('box codes', () => {
  it('suggests the next B-number', () => {
    expect(nextBoxCode([])).toBe('B01')
    expect(nextBoxCode(['B01', 'INBOX', 'B07', 'DRAWER-1'])).toBe('B08')
    expect(nextBoxCode(['B99'])).toBe('B100')
  })

  it('numbers compartments with at least two digits', () => {
    expect(compartmentCodes('B03', 3)).toEqual(['B03-01', 'B03-02', 'B03-03'])
    expect(compartmentCodes('B03', 120).at(-1)).toBe('B03-120')
    expect(compartmentCodes('B03', 0)).toEqual([])
  })

  it('normalizes typed codes', () => {
    expect(normalizeCode(' b02 ')).toBe('B02')
    expect(normalizeCode('shelf 2')).toBe('SHELF-2')
  })
})
