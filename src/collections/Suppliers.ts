import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated } from '../access'

export const Suppliers: CollectionConfig = {
  slug: 'suppliers',
  versions: false,
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: authenticated,
    // Shared by every lab, so only the admin edits (importers add new ones as a system job)
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
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
