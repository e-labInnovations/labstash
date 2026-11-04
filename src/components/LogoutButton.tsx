'use client'

import React, { useState } from 'react'

import { Icon } from './Icon'

/** Ends the session, then reloads into the sign-in page so nothing of it stays on screen. */
export function LogoutButton() {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(
          () => undefined,
        )
        // A full load, not a client navigation: nothing of the signed-out session stays in memory
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login')
      }}
      className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-line font-semibold text-danger disabled:opacity-60"
    >
      <Icon name="logout" className="size-5" />
      {pending ? 'Logging out…' : 'Log out'}
    </button>
  )
}
