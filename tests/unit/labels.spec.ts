import { describe, expect, it } from 'vitest'

import { labelFor, labelSize, toPages } from '@/lib/labels'

describe('label sheet', () => {
  it('falls back to medium for unknown sizes', () => {
    expect(labelSize('s')).toBe('s')
    expect(labelSize('xl')).toBe('m')
    expect(labelSize(undefined)).toBe('m')
  })

  it('fills A4 pages and skips used cells on the first one', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    expect(toPages(items, 'm').map((p) => p.length)).toEqual([24, 6])
    const skipped = toPages(items, 'm', 3)
    expect(skipped[0].slice(0, 4)).toEqual([null, null, null, 0])
    expect(skipped.map((p) => p.length)).toEqual([24, 9])
    // never skips a whole page
    expect(toPages([1], 's', 999)[0]).toHaveLength(40)
  })

  it('says what the part is and where it lives, leaving out INBOX', () => {
    const label = labelFor(
      { id: 'p1', name: '10K OHM 0603', value: 10000, unit: 'Ω', package: '0603' },
      [
        { code: 'B01-06', quantity: 20, approximate: false },
        { code: 'INBOX', quantity: 5, approximate: false },
        { code: 'B02', quantity: 1, approximate: true },
      ],
    )
    expect(label).toEqual({
      id: 'p1',
      name: '10K OHM 0603',
      detail: '10 kΩ · 0603',
      where: 'B01-06, B02',
    })
    expect(labelFor({ id: 'p2', name: 'Kapton tape' }, []).detail).toBe('')
  })
})
