import type { Payload, PayloadRequest } from 'payload'

import { INBOX_CODE } from '../collections/Locations'
import { idOf } from '../ledger/rules'
import { withTransaction } from './importOrder'

export type ReceiveOptions = {
  /** The lab whose order this is */
  lab: string
  /** Skus that did not arrive: their lines are marked cancelled */
  except?: string[]
  /** Skus that arrived short: sku → quantity actually received */
  short?: Record<string, number>
}

export type ReceiveResult = {
  received: Array<{ sku: string; quantity: number }>
  cancelled: string[]
  skipped: string[]
}

/**
 * Books everything still outstanding on a purchase into INBOX as receive
 * movements, in one transaction.
 */
export const receiveOrder = async (
  payload: Payload,
  orderNumber: string,
  { lab, except = [], short = {} }: ReceiveOptions,
): Promise<ReceiveResult> =>
  withTransaction(payload, async (req) => {
    const { docs: purchases } = await req.payload.find({
      collection: 'purchases',
      overrideAccess: true,
      where: { and: [{ orderNumber: { equals: orderNumber } }, { lab: { equals: lab } }] },
      limit: 2,
      depth: 0,
      req,
    })
    if (purchases.length !== 1) {
      throw new Error(
        `Expected one purchase with order number ${orderNumber}, found ${purchases.length}`,
      )
    }

    const { docs: lines } = await req.payload.find({
      collection: 'purchase-lines',
      overrideAccess: true,
      where: { purchase: { equals: purchases[0].id } },
      pagination: false,
      depth: 1,
      req,
    })
    const skuOf = (line: (typeof lines)[number]) =>
      typeof line.supplierPart === 'object' && line.supplierPart
        ? line.supplierPart.sku
        : line.title

    const known = new Set(lines.map(skuOf))
    const unknown = [...except, ...Object.keys(short)].filter((s) => !known.has(s))
    if (unknown.length) throw new Error(`Not on this order: ${unknown.join(', ')}`)

    const inbox = await ensureInbox(req, lab)
    const result: ReceiveResult = { received: [], cancelled: [], skipped: [] }

    for (const line of lines) {
      const sku = skuOf(line)
      const outstanding = line.qtyOrdered - (line.qtyReceived ?? 0)

      if (line.cancelled || outstanding <= 0) {
        result.skipped.push(sku)
        continue
      }
      if (except.includes(sku)) {
        await req.payload.update({
          collection: 'purchase-lines',
          overrideAccess: true,
          id: line.id,
          data: { cancelled: true },
          req,
        })
        result.cancelled.push(sku)
        continue
      }

      const quantity = short[sku] ?? outstanding
      if (quantity > outstanding)
        throw new Error(`${sku}: ${quantity} is more than the ${outstanding} outstanding`)
      if (quantity <= 0) {
        result.skipped.push(sku)
        continue
      }
      await req.payload.create({
        collection: 'stock-movements',
        overrideAccess: true,
        data: {
          lab,
          type: 'receive',
          quantity,
          part: idOf(line.part)!,
          to: inbox,
          purchaseLine: line.id,
          note: `Order ${orderNumber}`,
          occurredAt: new Date().toISOString(),
        },
        req,
      })
      result.received.push({ sku, quantity })
    }
    return result
  })

/** Per line: quantity that arrived, or 'missing' to cancel the line. Lines not listed are left alone. */
export type LineReceipts = Record<string, number | 'missing'>

/** The app's receive screen: books chosen quantities into INBOX in one transaction. */
export const receiveLines = async (
  payload: Payload,
  purchaseId: string,
  receipts: LineReceipts,
  user?: PayloadRequest['user'],
) =>
  withTransaction(
    payload,
    async (req) => {
      // Read as the user: an order in another lab is simply not found
      const purchase = await req.payload
        .findByID({ collection: 'purchases', id: purchaseId, depth: 0, overrideAccess: false, req })
        .catch(() => null)
      if (!purchase) throw new Error('Order not found')
      const lab = idOf(purchase.lab)!

      const { docs: lines } = await req.payload.find({
        collection: 'purchase-lines',
        overrideAccess: true,
        where: { purchase: { equals: purchaseId } },
        pagination: false,
        depth: 0,
        req,
      })
      const byId = new Map(lines.map((l) => [l.id, l]))
      const unknown = Object.keys(receipts).filter((id) => !byId.has(id))
      if (unknown.length) throw new Error('Some lines are not on this order')

      const inbox = await ensureInbox(req, lab)
      let received = 0
      let cancelled = 0

      for (const [lineId, receipt] of Object.entries(receipts)) {
        const line = byId.get(lineId)!
        const outstanding = line.qtyOrdered - (line.qtyReceived ?? 0)
        if (line.cancelled || outstanding <= 0) continue

        if (receipt === 'missing') {
          await req.payload.update({
            collection: 'purchase-lines',
            overrideAccess: true,
            id: lineId,
            data: { cancelled: true },
            req,
          })
          cancelled++
          continue
        }
        if (!Number.isInteger(receipt) || receipt < 0 || receipt > outstanding) {
          throw new Error(`"${line.title}": enter 0–${outstanding}`)
        }
        if (receipt === 0) continue
        await req.payload.create({
          collection: 'stock-movements',
          overrideAccess: true,
          data: {
            lab,
            type: 'receive',
            quantity: receipt,
            part: idOf(line.part)!,
            to: inbox,
            purchaseLine: lineId,
            occurredAt: new Date().toISOString(),
          },
          req,
        })
        received += receipt
      }
      return { received, cancelled }
    },
    user,
  )

/** The lab's INBOX, created on first use. */
export const ensureInbox = async (req: PayloadRequest, lab: string) => {
  const { docs } = await req.payload.find({
    collection: 'locations',
    overrideAccess: true,
    where: { and: [{ code: { equals: INBOX_CODE } }, { lab: { equals: lab } }] },
    limit: 1,
    depth: 0,
    req,
  })
  if (docs[0]) return docs[0].id
  const inbox = await req.payload.create({
    collection: 'locations',
    overrideAccess: true,
    data: { lab, code: INBOX_CODE, name: 'Inbox — received, not yet put away', kind: 'inbox' },
    req,
  })
  return inbox.id
}
