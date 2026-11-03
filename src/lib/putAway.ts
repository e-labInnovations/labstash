import type { Payload } from 'payload'

import { INBOX_CODE } from '@/collections/Locations'
import { withTransaction } from '@/importers/importOrder'
import { idOf } from '@/ledger/rules'
import type { User } from '@/payload-types'

/**
 * Moves everything INBOX holds of each given part into one location, in one
 * transaction. Quantities come from the INBOX stock rows, never from the client.
 */
export const putAwayAll = async (payload: Payload, user: User, partIds: string[], to: string) => {
  if (partIds.length === 0) throw new Error('Pick at least one part')
  if (!to) throw new Error('Pick where they go')

  return withTransaction(
    payload,
    async (req) => {
      const { docs: inbox } = await payload.find({
        collection: 'locations',
        where: { code: { equals: INBOX_CODE } },
        limit: 1,
        depth: 0,
        overrideAccess: false,
        req,
      })
      if (!inbox[0]) throw new Error('Inbox is empty')
      if (inbox[0].id === to) throw new Error('Pick a box other than INBOX')

      const { docs: rows } = await payload.find({
        collection: 'stock',
        where: { and: [{ location: { equals: inbox[0].id } }, { part: { in: partIds } }] },
        pagination: false,
        depth: 0,
        overrideAccess: false,
        req,
      })
      let pcs = 0
      for (const row of rows) {
        if (row.quantity <= 0) continue
        await payload.create({
          collection: 'stock-movements',
          data: {
            type: 'move',
            part: idOf(row.part)!,
            quantity: row.quantity,
            from: inbox[0].id,
            to,
            occurredAt: new Date().toISOString(),
          },
          overrideAccess: false,
          req,
        })
        pcs += row.quantity
      }
      if (pcs === 0) throw new Error('Those parts are no longer in the Inbox')
      return { parts: rows.filter((r) => r.quantity > 0).length, pcs }
    },
    { ...user, collection: 'users' },
  )
}
