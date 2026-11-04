import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'
import { ledgerOwned } from '../ledger/fields'

export const PURCHASE_STATUSES = ['ordered', 'partial', 'received', 'cancelled'] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

export const Purchases: CollectionConfig = {
  slug: 'purchases',
  versions: false,
  // Two labs can import the same store order (a shared purchase); each once
  indexes: [{ fields: ['lab', 'externalId'], unique: true }],
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'supplier', 'orderedAt', 'total', 'status'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'supplier', type: 'relationship', relationTo: 'suppliers', required: true },
        { name: 'orderNumber', type: 'text', required: true, index: true },
        { name: 'orderedAt', type: 'date' },
      ],
    },
    {
      name: 'externalId',
      type: 'text',
      admin: { description: 'Store order id (e.g. Shopify order GID). Makes imports idempotent.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'ordered',
      options: PURCHASE_STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s })),
      hooks: { beforeChange: [ledgerOwned] },
      admin: { readOnly: true, description: 'Derived from line receipts' },
    },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', type: 'number', admin: { description: 'INR' } },
        { name: 'tax', type: 'number' },
        { name: 'shipping', type: 'number' },
        { name: 'total', type: 'number' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'lines',
      type: 'join',
      collection: 'purchase-lines',
      on: 'purchase',
    },
  ],
}
