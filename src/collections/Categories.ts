import type { CollectionConfig } from 'payload'

import { adminRoleOnly, authenticated } from '../access'

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
    // Shared by every lab: anyone may add one, only the admin renames, moves or deletes
    create: authenticated,
    update: adminRoleOnly,
    delete: adminRoleOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
