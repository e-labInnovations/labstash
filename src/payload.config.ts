import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users, collections } from './collections'
import { devUser, ensureDevUser, isDev } from './dev/devUser'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    autoLogin: isDev ? { email: devUser.email } : false,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections,
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
  plugins,
  upload: {
    transformers: [sharpTransformer()],
  },
})
