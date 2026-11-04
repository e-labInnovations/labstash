import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated } from '../access'

export const Folders: CollectionConfig = {
  slug: 'folders',
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
  folders: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
