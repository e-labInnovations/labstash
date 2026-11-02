import { describe, expect, it } from 'vitest'

import { derivePurchaseStatus, isLowStock, movementDeltas, validateMovement } from '@/ledger/rules'

describe('validateMovement', () => {
  it.each([
    [{ type: 'receive', quantity: 5, to: 'A' }, null],
    [{ type: 'receive', quantity: 5 }, 'Receive needs a "to" location'],
    [{ type: 'receive', quantity: 5, from: 'A', to: 'B' }, 'Receive cannot have a "from" location'],
    [{ type: 'move', quantity: 1, from: 'A', to: 'B' }, null],
    [{ type: 'move', quantity: 1, from: 'A' }, 'Move needs both "from" and "to" locations'],
    [{ type: 'move', quantity: 1, from: 'A', to: 'A' }, '"from" and "to" must differ'],
    [{ type: 'use', quantity: 2, from: 'A' }, null],
    [{ type: 'use', quantity: 2, from: 'A', to: 'B' }, 'Use cannot have a "to" location'],
    [{ type: 'adjust', quantity: 2, to: 'A', note: 'found more' }, null],
    [{ type: 'adjust', quantity: 2, to: 'A' }, 'Adjust needs a note explaining the correction'],
    [
      { type: 'adjust', quantity: 2, from: 'A', to: 'B', note: 'x' },
      expect.stringContaining('exactly one'),
    ],
    [{ type: 'use', quantity: 0, from: 'A' }, expect.stringContaining('greater than 0')],
    [{ type: 'use', quantity: 1.5, from: 'A' }, expect.stringContaining('whole number')],
    [{ type: 'steal', quantity: 1, from: 'A' }, 'Unknown movement type'],
  ] as const)('%o', (input, expected) => {
    expect(validateMovement(input as never)).toEqual(expected)
  })
})

describe('movementDeltas', () => {
  it('takes from the source and adds to the destination', () => {
    expect(movementDeltas({ type: 'move', quantity: 3, from: 'A', to: 'B' })).toEqual([
      { location: 'A', delta: -3 },
      { location: 'B', delta: 3 },
    ])
  })
})

describe('isLowStock', () => {
  it('is false without a threshold, true at or below it', () => {
    expect(isLowStock(0, null)).toBe(false)
    expect(isLowStock(5, 5)).toBe(true)
    expect(isLowStock(6, 5)).toBe(false)
  })
})

describe('derivePurchaseStatus', () => {
  const line = (qtyOrdered: number, qtyReceived = 0, cancelled = false) => ({
    qtyOrdered,
    qtyReceived,
    cancelled,
  })

  it.each([
    [[line(5), line(2)], 'ordered'],
    [[line(5, 5), line(2)], 'partial'],
    [[line(5, 1)], 'partial'],
    [[line(5, 5), line(2, 0, true)], 'received'],
    [[line(5, 0, true)], 'cancelled'],
  ] as const)('%o → %s', (lines, status) => {
    expect(derivePurchaseStatus([...lines])).toBe(status)
  })
})
