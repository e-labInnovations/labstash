import { mcpPlugin } from '@payloadcms/plugin-mcp'

import { Users, collections } from '../collections'

// The MCP plugin exposes every collection with every built-in tool unless told
// otherwise, so v1 opts each one out of anything that writes.
const readOnlyTools = {
  create: false,
  update: false,
  delete: false,
  duplicate: false,
  restoreVersion: false,
  getUploadInstructions: false,
} as const

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

export const mcp = mcpPlugin({
  collections: Object.fromEntries(
    collections.map((c) => [
      c.slug,
      { tools: c.slug === Users.slug ? hiddenTools : readOnlyTools },
    ]),
  ),
})
