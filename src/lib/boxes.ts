import type { Payload } from 'payload'

import { withTransaction } from '@/importers/importOrder'
import type { User } from '@/payload-types'

export type NewBox = { code: string; name?: string; columns: number; compartments: number }

const CODE = /^[A-Z0-9][A-Z0-9_-]{0,23}$/

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '-')

/** "B01", "B07" → "B08"; anything else is ignored. */
export const nextBoxCode = (codes: string[]) => {
  const numbers = codes
    .map((c) => c.match(/^B(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
  return `B${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(2, '0')}`
}

/** B03 with 24 compartments → B03-01 … B03-24 */
export const compartmentCodes = (box: string, count: number) => {
  const width = Math.max(2, String(count).length)
  return Array.from({ length: count }, (_, i) => `${box}-${String(i + 1).padStart(width, '0')}`)
}

/** Creates a box and its numbered compartments in one transaction, as the given user. */
export const createBox = async (payload: Payload, user: User, input: NewBox) => {
  const code = normalizeCode(input.code)
  if (!CODE.test(code)) throw new Error('Use letters, digits and dashes for the code, e.g. B02')
  if (!Number.isInteger(input.columns) || input.columns < 1 || input.columns > 24) {
    throw new Error('Columns must be 1–24')
  }
  if (!Number.isInteger(input.compartments) || input.compartments < 0 || input.compartments > 120) {
    throw new Error('Compartments must be 0–120')
  }

  const taken = await payload.count({
    collection: 'locations',
    where: { code: { in: [code, ...compartmentCodes(code, input.compartments)] } },
    overrideAccess: true,
  })
  if (taken.totalDocs > 0)
    throw new Error(`${code} or one of its compartment codes is already used`)

  return withTransaction(
    payload,
    async (req) => {
      const box = await payload.create({
        collection: 'locations',
        data: { code, name: input.name?.trim() || undefined, kind: 'box', columns: input.columns },
        overrideAccess: false,
        req,
      })
      for (const c of compartmentCodes(code, input.compartments)) {
        await payload.create({
          collection: 'locations',
          data: { code: c, kind: 'compartment', parent: box.id },
          overrideAccess: false,
          req,
        })
      }
      return { id: box.id, code }
    },
    { ...user, collection: 'users' },
  )
}
