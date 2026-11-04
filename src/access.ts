import type { Access, FieldAccess } from 'payload'

import { getUserTenantIDs } from '@payloadcms/plugin-multi-tenant/utilities'

/** Signed-in user, plus the markers Payload and the app put on it at runtime. */
type SessionUser = {
  collection?: string
  role?: string | null
  /** Set by Payload for requests authenticated with an API key (MCP clients) */
  _strategy?: string
  /** Set by the app's session: the PWA only ever works in the user's own lab */
  _ownLabOnly?: boolean
}

// The multi-tenant plugin scopes a request to the user's labs only when the user is marked
// as coming from `users`. Payload's Local API adds the marker when it is missing; anything
// that still arrives without it gets nothing rather than every lab.
export const authenticated: Access = ({ req }) => req.user?.collection === 'users'

export const nobody: Access = () => false

/**
 * Sees and manages every lab. Only through the admin panel's own login: the PWA marks its
 * session own-lab-only, and API keys (MCP) act in the key owner's lab like anyone else.
 */
export const isAdmin = (user: unknown): boolean => {
  const u = user as SessionUser | null | undefined
  return (
    u?.collection === 'users' && u.role === 'admin' && u._strategy !== 'api-key' && !u._ownLabOnly
  )
}

export const adminOnly: Access = ({ req }) => isAdmin(req.user)
export const adminOnlyField: FieldAccess = ({ req }) => isAdmin(req.user)

/** Labs whose settings the user may change: all for the admin, else where they are lab admin. */
export const managedLabs = (user: unknown): string[] | 'all' => {
  const u = user as
    (SessionUser & { labs?: Array<{ lab: unknown; labRole?: string | null }> }) | null
  if (u?.collection === 'users' && u.role === 'admin') return 'all'
  return (u?.labs ?? [])
    .filter((row) => row.labRole === 'admin')
    .map((row) =>
      String(typeof row.lab === 'object' && row.lab ? (row.lab as { id: string }).id : row.lab),
    )
}

/** The labs the user belongs to (one today; the field allows sharing a lab later). */
export const labsOf = (user: unknown): string[] =>
  getUserTenantIDs(user as never, {
    tenantsArrayFieldName: 'labs',
    tenantsArrayTenantFieldName: 'lab',
  }).map(String)
