import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

// parent + breadcrumbs fields are added by plugin-nested-docs
export const Categories: CollectionConfig = {
  slug: 'categories',
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent'],
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
    },
  ],
}
