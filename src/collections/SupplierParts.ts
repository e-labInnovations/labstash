import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

// A part as sold by one store. Importers match re-imports on (supplier, sku).
export const SupplierParts: CollectionConfig = {
  slug: 'supplier-parts',
  versions: false,
  admin: {
    useAsTitle: 'sku',
    defaultColumns: ['sku', 'supplier', 'part', 'url'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  indexes: [{ fields: ['supplier', 'sku'], unique: true }],
  fields: [
    {
      name: 'supplier',
      type: 'relationship',
      relationTo: 'suppliers',
      required: true,
    },
    {
      name: 'part',
      type: 'relationship',
      relationTo: 'parts',
      required: true,
      index: true,
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      admin: { description: 'Store product code, e.g. ET9233' },
    },
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Title as listed by the store' },
    },
    {
      name: 'handle',
      type: 'text',
    },
    {
      name: 'variantId',
      type: 'text',
    },
    {
      name: 'url',
      type: 'text',
    },
  ],
}
