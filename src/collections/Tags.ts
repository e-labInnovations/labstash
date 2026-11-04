import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated } from '../access'

export const Tags: CollectionConfig = {
  slug: 'tags',
  versions: false,
  // Admin panel organisation, shared by every lab
  access: {
    read: authenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
  },
  tags: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
