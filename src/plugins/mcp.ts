import { mcpPlugin } from '@payloadcms/plugin-mcp'

import { Users, collections } from '../collections'

// The MCP plugin exposes every collection with every built-in tool unless told
// otherwise, so each collection opts out explicitly.

// Nothing an MCP client does can change or remove existing records
const appendOnlyTools = {
  update: false,
  delete: false,
  duplicate: false,
  restoreVersion: false,
  getUploadInstructions: false,
} as const

const readOnlyTools = { ...appendOnlyTools, create: false } as const

// An assistant may add parts, boxes and categories, and record stock as ledger
// movements (validated and transactional, like the app). Everything else is read-only.
const CAN_CREATE = new Set(['parts', 'categories', 'locations', 'stock-movements'])

// Users are not exposed at all. (Login and password tools are opt-in, so they stay off.)
const hiddenTools = {
  ...readOnlyTools,
  count: false,
  countVersions: false,
  find: false,
  findDistinct: false,
  findVersionByID: false,
  findVersions: false,
  getCollectionSchema: false,
} as const

// TEMPORARY: lets an assistant restructure box B01. Revert right after.
const fullLocationTools = { duplicate: false, restoreVersion: false, getUploadInstructions: false } as const

const toolsFor = (slug: string) => {
  if (slug === Users.slug) return hiddenTools
  if (slug === 'locations') return fullLocationTools
  return CAN_CREATE.has(slug) ? appendOnlyTools : readOnlyTools
}

export const mcp = mcpPlugin({
  collections: Object.fromEntries(collections.map((c) => [c.slug, { tools: toolsFor(c.slug) }])),
})
