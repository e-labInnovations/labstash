import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'

/** Boots Payload on the test database and resets it. Refuses anything not named *_test. */
export const freshPayload = async (): Promise<Payload> => {
  const dbName = new URL(process.env.DATABASE_URL ?? 'postgres://x/none').pathname.slice(1)
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Integration tests wipe the database; DATABASE_URL points at "${dbName}", not *_test`,
    )
  }
  const payload = await getPayload({ config: await config })
  await payload.db.migrateFresh({ forceAcceptWarning: true })
  return payload
}

export const newLab = async (payload: Payload, name: string) =>
  (await payload.create({ collection: 'labs', overrideAccess: true, data: { name } })).id

/** A user in `lab`, shaped like the app's session user (own lab only, even for an admin). */
export const newUser = async (
  payload: Payload,
  email: string,
  lab: string,
  role: 'admin' | 'user' = 'user',
) => {
  const user = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email, password: 'secret', role, labs: [{ lab }] },
  })
  return { ...user, collection: 'users' as const, _ownLabOnly: true as const }
}
