import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // API keys authenticate MCP clients (Authorization: users API-Key <key>)
  auth: {
    useAPIKey: true,
  },
  fields: [
    // Email added by default
  ],
  versions: false,
}
