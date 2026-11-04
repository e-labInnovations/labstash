import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const INBOX_CODE = 'INBOX'

// parent + breadcrumbs fields are added by plugin-nested-docs
export const Locations: CollectionConfig = {
  slug: 'locations',
  versions: false,
  // Each lab has its own B01 and its own INBOX
  indexes: [{ fields: ['lab', 'code'], unique: true }],
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'name', 'kind', 'parent'],
  },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Printed on the label, e.g. B03 or B03-17. Unique within a lab.',
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'box',
      options: [
        { label: 'Box', value: 'box' },
        { label: 'Compartment', value: 'compartment' },
        { label: 'Inbox', value: 'inbox' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'columns',
      type: 'number',
      min: 1,
      max: 24,
      admin: {
        description: 'Compartments per row, for the box grid in the app',
        condition: (_, s) => s.kind === 'box',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
}
