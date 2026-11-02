// Pure ledger rules — no Payload, unit-testable.

export const MOVEMENT_TYPES = ['receive', 'move', 'use', 'adjust'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export type MovementInput = {
  type?: MovementType | null
  quantity?: number | null
  from?: string | null
  to?: string | null
  note?: string | null
  purchaseLine?: string | null
}

export type StockDelta = { location: string; delta: number }

/** Returns an error message, or null when the movement is well-formed. */
export const validateMovement = (m: MovementInput): string | null => {
  const { type, quantity, from, to } = m
  if (!type || !MOVEMENT_TYPES.includes(type)) return 'Unknown movement type'
  if (quantity == null || !Number.isInteger(quantity) || quantity <= 0) {
    return 'Quantity must be a whole number greater than 0'
  }
  switch (type) {
    case 'receive':
      if (!to) return 'Receive needs a "to" location'
      if (from) return 'Receive cannot have a "from" location'
      return null
    case 'move':
      if (!from || !to) return 'Move needs both "from" and "to" locations'
      if (from === to) return '"from" and "to" must differ'
      return null
    case 'use':
      if (!from) return 'Use needs a "from" location'
      if (to) return 'Use cannot have a "to" location'
      return null
    case 'adjust':
      if (Boolean(from) === Boolean(to)) {
        return 'Adjust needs exactly one location: "to" adds stock, "from" removes it'
      }
      if (!m.note?.trim()) return 'Adjust needs a note explaining the correction'
      return null
  }
}

/** Stock changes per location for a movement that passed validateMovement. */
export const movementDeltas = (m: MovementInput) => {
  const qty = m.quantity ?? 0
  const deltas: StockDelta[] = []
  if (m.from) deltas.push({ location: m.from, delta: -qty })
  if (m.to) deltas.push({ location: m.to, delta: qty })
  return deltas
}

export const isLowStock = (total: number, minStock?: number | null) =>
  minStock != null && total <= minStock

type LineState = { qtyOrdered: number; qtyReceived?: number | null; cancelled?: boolean | null }

export const derivePurchaseStatus = (lines: LineState[]) => {
  const live = lines.filter((l) => !l.cancelled)
  if (lines.length > 0 && live.length === 0) return 'cancelled' as const
  const received = live.filter((l) => (l.qtyReceived ?? 0) >= l.qtyOrdered).length
  if (live.length > 0 && received === live.length) return 'received' as const
  if (live.some((l) => (l.qtyReceived ?? 0) > 0)) return 'partial' as const
  return 'ordered' as const
}

/** Relationship values arrive as ids or populated docs depending on depth. */
export const idOf = (v: unknown): string | null => {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}
