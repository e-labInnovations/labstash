import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'
import type { User } from '@/payload-types'

export type SessionUser = User & { collection: 'users'; _ownLabOnly: true }

export const getSession = cache(async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  // The app works in the user's own lab only, even for the admin (who sees every lab in the
  // admin panel); see isAdmin in access.ts
  return {
    payload,
    user: user ? ({ ...user, collection: 'users', _ownLabOnly: true } as SessionUser) : null,
  }
})

/** For pages and actions: the signed-in user, or a redirect to /login. */
export const requireSession = async () => {
  const session = await getSession()
  if (!session.user) redirect('/login')
  return { payload: session.payload, user: session.user }
}
