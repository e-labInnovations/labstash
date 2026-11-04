import type { Payload } from 'payload'

import type { User } from '@/payload-types'

/** Display name; blank clears it. Users may only change their own (collection access). */
export const updateProfile = async (payload: Payload, user: User, input: { name: string }) => {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length > 60) throw new Error('Keep the name under 60 characters')
  return payload.update({
    collection: 'users',
    id: user.id,
    data: { name: name || null },
    user,
    overrideAccess: false,
  })
}

export const MIN_PASSWORD = 8

/** Checks the current password before setting a new one. */
export const changePassword = async (
  payload: Payload,
  user: User,
  input: { current: string; next: string; confirm: string },
) => {
  if (input.next.length < MIN_PASSWORD) {
    throw new Error(`Use at least ${MIN_PASSWORD} characters`)
  }
  if (input.next !== input.confirm) throw new Error('The new passwords don’t match')
  if (input.next === input.current) throw new Error('That is the password you have now')
  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email, password: input.current },
    })
  } catch {
    throw new Error('The current password is wrong')
  }
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password: input.next },
    user,
    overrideAccess: false,
  })
}
