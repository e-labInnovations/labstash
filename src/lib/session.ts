import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'
import type { User } from '@/payload-types'

export const getSession = cache(async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return { payload, user: user as (User & { collection: 'users' }) | null }
})

/** For pages and actions: the signed-in user, or a redirect to /login. */
export const requireSession = async () => {
  const session = await getSession()
  if (!session.user) redirect('/login')
  return { payload: session.payload, user: session.user }
}
