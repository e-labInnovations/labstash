import type { CollectionConfig } from 'payload'

import { createFolderField, createTagField } from 'payload'

import { authenticated } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  versions: false,
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'image',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Datasheet', value: 'datasheet' },
        { label: '3D model', value: 'model3d' },
        { label: 'KiCad', value: 'kicad' },
        { label: 'Other', value: 'other' },
      ],
    },
    createFolderField({ relationTo: 'folders' }),
    createTagField({ relationTo: 'tags' }),
  ],
  upload: true,
}
