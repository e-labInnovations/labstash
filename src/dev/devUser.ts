import type { Payload } from 'payload'

// Local `next dev` only: a ready-made admin user plus auto-login. Never in production or tests.
export const isDev = process.env.NODE_ENV === 'development'

export const devUser = {
  email: process.env.DEV_USER_EMAIL || 'dev@labstash.local',
  password: process.env.DEV_USER_PASSWORD || 'dev',
}

/**
 * Creates the dev admin and their lab on an empty database, and returns that lab.
 * `force` lets the local seed script use it outside `next dev`.
 */
export const ensureDevUser = async (payload: Payload, { force = false } = {}) => {
  if (!isDev && !force) return ''
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: devUser.email } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  })
  const existing = docs[0]?.labs?.[0]?.lab
  if (existing) return typeof existing === 'object' ? existing.id : existing

  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  if (totalDocs > 0 && !force) return ''
  const lab = await payload.create({
    collection: 'labs',
    overrideAccess: true,
    data: { name: 'Dev lab' },
  })
  await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { ...devUser, role: 'admin', labs: [{ lab: lab.id }] },
  })
  payload.logger.info(`Created dev user ${devUser.email} in ${lab.name}`)
  return lab.id
}
