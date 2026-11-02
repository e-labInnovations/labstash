import type { CollectionConfig } from 'payload'

import { createTagField } from 'payload'

import { authenticated } from '../access'
import { deriveLowStock, ledgerOwned } from '../ledger/fields'

export const UNITS = ['Ω', 'F', 'H', 'V', 'A', 'W', 'Hz', 'mAh', 'm', 'g', 'pcs'] as const

export const Parts: CollectionConfig = {
  slug: 'parts',
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'package', 'totalQuantity', 'lowStock'],
    listSearchableFields: ['name', 'mpn', 'description'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'mpn', type: 'text', label: 'MPN', index: true },
        { name: 'manufacturer', type: 'text' },
        { name: 'package', type: 'text', admin: { description: 'e.g. 0603, SOP-8, TO-220' } },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
    },
    createTagField({ relationTo: 'tags' }),
    {
      name: 'description',
      type: 'textarea',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'value',
          type: 'number',
          index: true,
          admin: { description: 'Base units: 10k resistor = 10000' },
        },
        {
          name: 'unit',
          type: 'select',
          options: UNITS.map((u) => ({ label: u, value: u })),
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'minStock',
          type: 'number',
          min: 0,
          admin: { description: 'Flag as low stock at or below this' },
        },
        {
          name: 'totalQuantity',
          type: 'number',
          defaultValue: 0,
          index: true,
          hooks: { beforeChange: [ledgerOwned] },
          admin: { readOnly: true },
        },
        {
          name: 'lowStock',
          type: 'checkbox',
          defaultValue: false,
          index: true,
          hooks: { beforeChange: [deriveLowStock] },
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Files & CAD',
      fields: [
        { name: 'datasheet', type: 'upload', relationTo: 'media' },
        { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
        { name: 'model3d', type: 'upload', relationTo: 'media', label: '3D model' },
        { name: 'kicadSymbol', type: 'text', admin: { description: 'Library:Symbol' } },
        { name: 'kicadFootprint', type: 'text', admin: { description: 'Library:Footprint' } },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'stock',
      type: 'join',
      collection: 'stock',
      on: 'part',
    },
    {
      name: 'supplierParts',
      type: 'join',
      collection: 'supplier-parts',
      on: 'part',
    },
  ],
}
