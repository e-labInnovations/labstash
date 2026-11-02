import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const Suppliers: CollectionConfig = {
  slug: 'suppliers',
  versions: false,
  admin: {
    useAsTitle: 'name',
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
      unique: true,
    },
    {
      name: 'website',
      type: 'text',
    },
    {
      name: 'importer',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'ETstore', value: 'etstore' },
        { label: 'Robu', value: 'robu' },
        { label: 'Abest', value: 'abest' },
        { label: 'Manual', value: 'manual' },
      ],
    },
  ],
}
