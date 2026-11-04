import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated } from '../access'

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
    },
  ],
}
