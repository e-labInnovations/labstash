import type { Plugin } from 'payload'

import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'

import { mcp } from './mcp'

export const plugins: Plugin[] = [
  // Box › compartment and category trees, with breadcrumbs
  nestedDocsPlugin({
    collections: ['locations'],
    generateLabel: (_, doc) => String(doc.code),
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateLabel: (_, doc) => String(doc.name),
  }),
  mcp,
]
