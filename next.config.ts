import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Loaded from node_modules, not bundled: minifying renames VercelPool, and drizzle only gives
  // a transaction its own connection when the client's class name says "Pool". Bundled, every
  // transaction ran across the shared pool and could not see its own uncommitted rows.
  serverExternalPackages: ['@vercel/postgres', '@neondatabase/serverless'],
  experimental: {
    // Photos are shrunk in the browser to well under this; Vercel caps bodies at 4.5 MB
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
