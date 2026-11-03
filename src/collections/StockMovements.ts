import type { CollectionConfig } from 'payload'

import { APIError } from 'payload'

import { authenticated, nobody } from '../access'
import { applyMovement } from '../ledger/applyMovement'
import { MOVEMENT_TYPES, idOf, validateMovement } from '../ledger/rules'

// Append-only ledger. Mistakes are fixed with a reverse movement, never an edit.
export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  versions: false,
  admin: {
    defaultColumns: ['occurredAt', 'type', 'part', 'quantity', 'from', 'to'],
    description: 'Every stock change. Receive, move, use or adjust — records cannot be edited.',
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: nobody,
    delete: nobody,
  },
  defaultSort: '-occurredAt',
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        const error = validateMovement({
          ...data,
          from: idOf(data.from),
          to: idOf(data.to),
        })
        if (error) throw new APIError(error, 400, undefined, true)
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        // A caller's `select` also trims `doc` (the MCP plugin asks for the id only),
        // so read the full movement back before applying it
        const movement = await req.payload.findByID({
          collection: 'stock-movements',
          id: doc.id,
          depth: 0,
          overrideAccess: true,
          req,
        })
        await applyMovement(
          {
            type: movement.type,
            quantity: movement.quantity,
            part: movement.part,
            from: idOf(movement.from),
            to: idOf(movement.to),
            purchaseLine: idOf(movement.purchaseLine),
          },
          req,
        )
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: MOVEMENT_TYPES.map((t) => ({
            label: t[0].toUpperCase() + t.slice(1),
            value: t,
          })),
        },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        {
          name: 'occurredAt',
          type: 'date',
          required: true,
          index: true,
          defaultValue: () => new Date().toISOString(),
        },
      ],
    },
    {
      name: 'part',
      type: 'relationship',
      relationTo: 'parts',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'from',
          type: 'relationship',
          relationTo: 'locations',
          admin: { condition: (_, s) => s.type !== 'receive' },
        },
        {
          name: 'to',
          type: 'relationship',
          relationTo: 'locations',
          admin: { condition: (_, s) => s.type !== 'use' },
        },
      ],
    },
    {
      name: 'purchaseLine',
      type: 'relationship',
      relationTo: 'purchase-lines',
      admin: { condition: (_, s) => s.type === 'receive' },
    },
    {
      name: 'note',
      type: 'textarea',
    },
  ],
}
