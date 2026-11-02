import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Categories } from './collections/Categories'
import { Locations } from './collections/Locations'
import { Parts } from './collections/Parts'
import { Stock } from './collections/Stock'
import { StockMovements } from './collections/StockMovements'
import { Suppliers } from './collections/Suppliers'
import { SupplierParts } from './collections/SupplierParts'
import { Purchases } from './collections/Purchases'
import { PurchaseLines } from './collections/PurchaseLines'
import { devUser, ensureDevUser, isDev } from './dev/devUser'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// v1 MCP is read-only: built-in write tools are switched off per collection
const readOnlyTools = {
  create: false,
  update: false,
  delete: false,
  duplicate: false,
  restoreVersion: false,
} as const

export default buildConfig({
  admin: {
    user: Users.slug,
    autoLogin: isDev ? { email: devUser.email } : false,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Parts,
    Stock,
    StockMovements,
    Locations,
    Categories,
    Purchases,
    PurchaseLines,
    Suppliers,
    SupplierParts,
    Media,
    Folders,
    Tags,
    Users,
  ],
  onInit: ensureDevUser,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    idType: 'uuidv7',
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  storage: [
    vercelBlobStorage({
      // Off locally without a token: uploads fall back to disk
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: {
        media: true,
      },
      clientUploads: true,
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [
    nestedDocsPlugin({
      collections: ['locations'],
      generateLabel: (_, doc) => String(doc.code),
    }),
    nestedDocsPlugin({
      collections: ['categories'],
      generateLabel: (_, doc) => String(doc.name),
    }),
    mcpPlugin({
      collections: {
        parts: { tools: readOnlyTools },
        stock: { tools: readOnlyTools },
        'stock-movements': { tools: readOnlyTools },
        locations: { tools: readOnlyTools },
        categories: { tools: readOnlyTools },
        purchases: { tools: readOnlyTools },
        'purchase-lines': { tools: readOnlyTools },
        suppliers: { tools: readOnlyTools },
        'supplier-parts': { tools: readOnlyTools },
      },
    }),
  ],
  upload: {
    transformers: [sharpTransformer()],
  },
})
