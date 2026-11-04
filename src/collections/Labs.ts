import type { Access, CollectionConfig } from 'payload'

import { adminOnly, authenticated, managedLabs } from '../access'
import { ensureInbox } from '../importers/receiveOrder'
import { THEMES } from '../lib/themes'

/** Lab admins change their own lab's name, logo and theme; the admin, any lab's. */
const manageable: Access = ({ req }) => {
  const labs = managedLabs(req.user)
  if (labs === 'all') return true
  return labs.length > 0 ? { id: { in: labs } } : false
}

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
    update: manageable,
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
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'green',
      options: Object.entries(THEMES).map(([value, t]) => ({ label: t.name, value })),
    },
    {
      // Shown under LabStash in the app
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
