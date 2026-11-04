import type { CollectionConfig } from 'payload'

import { adminOnly, adminOnlyField, isAdmin } from '../access'

export const ROLES = ['admin', 'user'] as const

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'labs'],
  },
  // API keys authenticate MCP clients (Authorization: users API-Key <key>)
  auth: {
    useAPIKey: true,
  },
  access: {
    // The admin panel is for the admin; everyone else uses the app
    admin: ({ req }) => isAdmin(req.user),
    read: ({ req }) => isAdmin(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    create: adminOnly,
    update: ({ req }) => isAdmin(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // The very first account runs the place; otherwise nobody could ever open the admin
        if (operation !== 'create') return data
        const { totalDocs } = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
          req,
        })
        return totalDocs === 0 ? { ...data, role: 'admin' } : data
      },
    ],
  },
  fields: [
    // Email added by default; `labs` (the labs this user works in) added by the multi-tenant plugin
    {
      name: 'name',
      type: 'text',
      admin: { description: 'Shown in the app instead of the email' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'Admin — sees and manages every lab in the admin panel', value: 'admin' },
        { label: 'User — their own lab, in the app', value: 'user' },
      ],
      access: { create: adminOnlyField, update: adminOnlyField },
      admin: { position: 'sidebar' },
    },
  ],
  versions: false,
}
