import type { Payload } from 'payload'

// Local `next dev` only: a ready-made admin user plus auto-login. Never in production or tests.
export const isDev = process.env.NODE_ENV === 'development'

export const devUser = {
  email: process.env.DEV_USER_EMAIL || 'dev@labstash.local',
  password: process.env.DEV_USER_PASSWORD || 'dev',
}

/** `force` lets the local seed script create the user outside `next dev`. */
export const ensureDevUser = async (payload: Payload, { force = false } = {}) => {
  if (!isDev && !force) return
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs > 0) return
  await payload.create({ collection: 'users', overrideAccess: true, data: devUser })
  payload.logger.info(`Created dev user ${devUser.email}`)
}
