import type { Payload } from 'payload'

import { guessPackage, guessValue } from '@/importers/etstore'
import { withTransaction } from '@/importers/importOrder'
import { ensureInbox } from '@/importers/receiveOrder'
import type { Part, User } from '@/payload-types'

export type NewPart = {
  name: string
  package?: string
  mpn?: string
  category?: string
  minStock?: number
  quantity: number
  /** Where the starting stock goes; INBOX when left out */
  location?: string
  note?: string
}

/**
 * Creates a part that didn't come from an order (a gift, salvage, an old drawer),
 * with its starting stock as an adjust movement so the ledger still explains it.
 */
export const createPart = async (payload: Payload, user: User, input: NewPart) => {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Give the part a name')
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new Error('Quantity must be a whole number')
  }
  if (input.minStock != null && (!Number.isInteger(input.minStock) || input.minStock < 0)) {
    throw new Error('Reorder level must be a whole number')
  }

  const same = await payload.find({
    collection: 'parts',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  if (same.docs[0]) throw new Error(`“${name}” already exists — add stock from its page`)

  return withTransaction(
    payload,
    async (req) => {
      const value = guessValue(name)
      const part = await payload.create({
        collection: 'parts',
        data: {
          name,
          package: input.package?.trim() || guessPackage(name) || undefined,
          mpn: input.mpn?.trim() || undefined,
          category: input.category || undefined,
          minStock: input.minStock,
          ...(value && {
            value: value.value,
            unit: value.unit as Part['unit'],
          }),
        },
        overrideAccess: false,
        req,
      })

      if (input.quantity > 0) {
        const to = input.location || (await ensureInbox(req))
        await payload.create({
          collection: 'stock-movements',
          data: {
            type: 'adjust',
            part: part.id,
            quantity: input.quantity,
            to,
            note: input.note?.trim() || 'Added without an order',
            occurredAt: new Date().toISOString(),
          },
          overrideAccess: false,
          req,
        })
      }
      return { id: part.id }
    },
    { ...user, collection: 'users' },
  )
}
