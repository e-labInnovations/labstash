import type { Payload } from 'payload'

import { managedLabs } from '@/access'
import { idOf } from '@/ledger/rules'
import type { User } from '@/payload-types'

import { THEMES, type ThemeKey } from './themes'

export type LabChanges = {
  name: string
  theme: string
  /** A new logo (already shrunk by the browser) */
  logo?: { data: Buffer; mimetype: string; name: string }
  removeLogo?: boolean
}

/** Renames the lab, sets its theme and logo. Lab admins only (and the admin). */
export const updateLab = async (
  payload: Payload,
  user: User,
  labId: string,
  changes: LabChanges,
) => {
  const managed = managedLabs(user)
  if (managed !== 'all' && !managed.includes(labId)) {
    throw new Error('Only a lab admin can change the lab')
  }
  const name = changes.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Give the lab a name')
  if (!(changes.theme in THEMES)) throw new Error('Pick one of the themes')
  if (changes.logo && !changes.logo.mimetype.startsWith('image/')) {
    throw new Error('The logo must be an image')
  }

  const current = await payload.findByID({
    collection: 'labs',
    id: labId,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const oldLogo = idOf(current.logo)
  let logo: string | null | undefined
  if (changes.logo) {
    logo = (
      await payload.create({
        collection: 'media',
        data: { alt: `${name} logo`, kind: 'image' },
        file: { ...changes.logo, size: changes.logo.data.length },
        user,
        overrideAccess: false,
      })
    ).id
  } else if (changes.removeLogo) logo = null

  await payload.update({
    collection: 'labs',
    id: labId,
    data: { name, theme: changes.theme as ThemeKey, ...(logo !== undefined && { logo }) },
    user,
    overrideAccess: false,
  })
  // A replaced or removed logo is not used anywhere else
  if (logo !== undefined && oldLogo) {
    await payload
      .delete({ collection: 'media', id: oldLogo, user, overrideAccess: false })
      .catch(() => undefined)
  }
}
