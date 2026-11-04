import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated } from '../access'
import { ensureInbox } from '../importers/receiveOrder'

// One person's (or a group's) workshop. Every part, box, order and photo belongs to a lab;
// the multi-tenant plugin keeps each user to their own. Only the admin creates labs.
export const Labs: CollectionConfig = {
  slug: 'labs',
  versions: false,
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: authenticated, // the plugin narrows this to the user's own labs
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        // Deliveries need somewhere to land before anything else exists
        if (operation === 'create') await ensureInbox(req, doc.id)
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
