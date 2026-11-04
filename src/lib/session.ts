import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import { labsOf, managedLabs } from '@/access'
import { themeKey } from '@/lib/themes'
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

export type CurrentLab = {
  id: string
  name: string
  theme: ReturnType<typeof themeKey>
  logo: { url: string; thumb: string } | null
  /** Lab admin of this lab (or the admin): may change its name, logo and theme */
  canManage: boolean
}

/** The signed-in user's lab, for its name, logo and theme; null when signed out. */
export const getLab = cache(async (): Promise<CurrentLab | null> => {
  const { payload, user } = await getSession()
  const id = user ? labsOf(user)[0] : undefined
  if (!user || !id) return null
  const lab = await payload
    .findByID({ collection: 'labs', id, depth: 1, user, overrideAccess: false })
    .catch(() => null)
  if (!lab) return null
  const logo = typeof lab.logo === 'object' && lab.logo?.url ? lab.logo : null
  const managed = managedLabs(user)
  return {
    id,
    name: lab.name,
    theme: themeKey(lab.theme),
    logo: logo ? { url: logo.url!, thumb: logo.variants?.thumbnail?.url ?? logo.url! } : null,
    canManage: managed === 'all' || managed.includes(id),
  }
})
