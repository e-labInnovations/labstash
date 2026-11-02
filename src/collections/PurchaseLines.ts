import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'
import { ledgerOwned } from '../ledger/fields'
import { refreshPurchaseStatus } from '../ledger/purchaseStatus'

export const PurchaseLines: CollectionConfig = {
  slug: 'purchase-lines',
  versions: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'purchase', 'qtyOrdered', 'qtyReceived', 'lineTotal', 'cancelled'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [
      async ({ doc, req, context }) => {
        if (context.skipLedger) return doc
        await refreshPurchaseStatus(doc.purchase, req)
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'purchase',
      type: 'relationship',
      relationTo: 'purchases',
      required: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Line title as on the order' },
    },
    {
      type: 'row',
      fields: [
        { name: 'part', type: 'relationship', relationTo: 'parts', required: true, index: true },
        { name: 'supplierPart', type: 'relationship', relationTo: 'supplier-parts' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'qtyOrdered', type: 'number', required: true, min: 0 },
        {
          name: 'qtyReceived',
          type: 'number',
          defaultValue: 0,
          hooks: { beforeChange: [ledgerOwned] },
          admin: { readOnly: true, description: 'Sum of receive movements' },
        },
        { name: 'lineTotal', type: 'number', admin: { description: 'INR' } },
      ],
    },
    {
      name: 'cancelled',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Will not arrive (out of stock, oversold, refunded)' },
    },
  ],
}
