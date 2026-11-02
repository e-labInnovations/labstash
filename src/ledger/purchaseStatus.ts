import type { PayloadRequest } from 'payload'

import { asLedger } from './asLedger'
import { derivePurchaseStatus, idOf } from './rules'

export const refreshPurchaseStatus = async (purchase: unknown, req: PayloadRequest) => {
  const purchaseId = idOf(purchase)
  if (!purchaseId) return

  const { docs: lines } = await req.payload.find({
    collection: 'purchase-lines',
    overrideAccess: true,
    where: { purchase: { equals: purchaseId } },
    pagination: false,
    depth: 0,
    req,
  })
  const status = derivePurchaseStatus(lines)

  const current = await req.payload.findByID({
    collection: 'purchases',
    overrideAccess: true,
    id: purchaseId,
    depth: 0,
    req,
  })
  if (current.status === status) return

  await asLedger(req, () =>
    req.payload.update({
      collection: 'purchases',
      overrideAccess: true,
      id: purchaseId,
      data: { status },
      req,
    }),
  )
}
