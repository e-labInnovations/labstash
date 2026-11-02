import type { CollectionConfig } from 'payload'

import { authenticated, nobody } from '../access'
import { ledgerOwned } from '../ledger/fields'

// One row per (part, location). Written only by the stock-movements ledger.
export const Stock: CollectionConfig = {
  slug: 'stock',
  versions: false,
  labels: { singular: 'Stock', plural: 'Stock' },
  admin: {
    defaultColumns: ['part', 'location', 'quantity', 'approximate'],
    description: 'Read-only view of what is where. Change it by recording a stock movement.',
  },
  access: {
    read: authenticated,
    create: nobody,
    update: authenticated, // only `approximate` is writable, see field access
    delete: nobody,
  },
  indexes: [{ fields: ['part', 'location'], unique: true }],
  fields: [
    {
      name: 'part',
      type: 'relationship',
      relationTo: 'parts',
      required: true,
      index: true,
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      required: true,
      index: true,
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'quantity',
      type: 'number',
      required: true,
      min: 0,
      hooks: { beforeChange: [ledgerOwned] },
      admin: { readOnly: true },
    },
    {
      name: 'approximate',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Count is a rough guess (cheap passives)' },
    },
  ],
}
