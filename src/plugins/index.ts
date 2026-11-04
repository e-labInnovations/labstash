import type { Plugin } from 'payload'

import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'

import { labs } from './labs'
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
  // After nested-docs, so a compartment's `parent` is also kept to its own lab
  labs,
  mcp,
]
