import type { PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { MovementInput } from './rules'
import { asLedger } from './asLedger'
import { refreshPurchaseStatus } from './purchaseStatus'
import { idOf, isLowStock, movementDeltas } from './rules'

/**
 * Applies a freshly created movement to `stock`, the part's totals and the
 * purchase line. Runs inside the movement's transaction: any throw rolls the
 * whole thing back, movement included.
 */
export const applyMovement = async (
  movement: MovementInput & { part: unknown },
  req: PayloadRequest,
) => {
  const partId = idOf(movement.part)!

  for (const { location, delta } of movementDeltas(movement)) {
    await applyDelta(partId, location, delta, req)
  }
  await refreshPartTotals(partId, req)

  const lineId = idOf(movement.purchaseLine)
  if (movement.type === 'receive' && lineId) {
    const line = await req.payload.findByID({
      collection: 'purchase-lines',
      overrideAccess: true,
      id: lineId,
      depth: 0,
      req,
    })
    if (idOf(line.part) !== partId) {
      throw new APIError('Purchase line is for a different part', 400, undefined, true)
    }
    await asLedger(req, () =>
      req.payload.update({
        collection: 'purchase-lines',
        overrideAccess: true,
        id: lineId,
        data: { qtyReceived: (line.qtyReceived ?? 0) + movement.quantity! },
        req,
      }),
    )
    await refreshPurchaseStatus(line.purchase, req)
  }
}

const applyDelta = async (part: string, location: string, delta: number, req: PayloadRequest) => {
  const { docs } = await req.payload.find({
    collection: 'stock',
    overrideAccess: true,
    where: { and: [{ part: { equals: part } }, { location: { equals: location } }] },
    limit: 1,
    depth: 0,
    req,
  })
  const row = docs[0]
  const next = (row?.quantity ?? 0) + delta

  if (next < 0) {
    const loc = await req.payload.findByID({
      collection: 'locations',
      overrideAccess: true,
      id: location,
      depth: 0,
      req,
    })
    throw new APIError(
      `Not enough stock at ${loc.code}: have ${row?.quantity ?? 0}, need ${-delta}`,
      400,
      undefined,
      true,
    )
  }

  if (!row) {
    await asLedger(req, () =>
      req.payload.create({
        collection: 'stock',
        overrideAccess: true,
        data: { part, location, quantity: next },
        req,
      }),
    )
  } else if (next === 0) {
    await asLedger(req, () =>
      req.payload.delete({
        collection: 'stock',
        overrideAccess: true,
        id: row.id,
        req,
      }),
    )
  } else {
    await asLedger(req, () =>
      req.payload.update({
        collection: 'stock',
        overrideAccess: true,
        id: row.id,
        data: { quantity: next },
        req,
      }),
    )
  }
}

export const refreshPartTotals = async (part: string, req: PayloadRequest) => {
  const { docs } = await req.payload.find({
    collection: 'stock',
    overrideAccess: true,
    where: { part: { equals: part } },
    pagination: false,
    depth: 0,
    select: { quantity: true },
    req,
  })
  const totalQuantity = docs.reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  const doc = await req.payload.findByID({
    collection: 'parts',
    overrideAccess: true,
    id: part,
    depth: 0,
    req,
  })

  await asLedger(req, () =>
    req.payload.update({
      collection: 'parts',
      overrideAccess: true,
      id: part,
      data: { totalQuantity, lowStock: isLowStock(totalQuantity, doc.minStock) },
      req,
    }),
  )
}
