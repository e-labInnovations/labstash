import type { Payload, Where } from 'payload'

import type { User } from '@/payload-types'

import { parseQuery } from './searchQuery'

/** Free-text + value + package search over parts, as the given user. */
export const searchParts = async (payload: Payload, user: User, q: string, limit = 50) => {
  const parsed = parseQuery(q)
  const and: Where[] = []

  if (parsed.value) {
    const { value, unit } = parsed.value
    const tolerance = Math.abs(value) * 1e-6
    and.push({ unit: { equals: unit } })
    and.push({ value: { greater_than_equal: value - tolerance } })
    and.push({ value: { less_than_equal: value + tolerance } })
  }
  if (parsed.package) and.push({ package: { like: parsed.package } })
  if (parsed.sku) {
    const { docs } = await payload.find({
      collection: 'supplier-parts',
      where: { sku: { equals: parsed.sku } },
      depth: 0,
      user,
      overrideAccess: false,
    })
    and.push({ id: { in: docs.map((d) => d.part as string) } })
  }
  for (const term of parsed.terms) {
    and.push({
      or: [
        { name: { like: term } },
        { mpn: { like: term } },
        { package: { like: term } },
        { description: { like: term } },
      ],
    })
  }
  if (and.length === 0) return []

  const { docs: parts } = await payload.find({
    collection: 'parts',
    where: { and },
    sort: '-totalQuantity',
    limit,
    depth: 0,
    joins: false,
    user,
    overrideAccess: false,
  })
  return withLocations(payload, user, parts)
}

export type StockChip = { code: string; quantity: number; approximate: boolean }

/** Attaches "where is it" chips (location code + qty) to each part. */
export const withLocations = async <P extends { id: string }>(
  payload: Payload,
  user: User,
  parts: P[],
) => {
  if (parts.length === 0) return []
  const { docs: rows } = await payload.find({
    collection: 'stock',
    where: { part: { in: parts.map((p) => p.id) } },
    pagination: false,
    depth: 1,
    populate: { locations: { code: true } },
    sort: '-quantity',
    user,
    overrideAccess: false,
  })
  const byPart = new Map<string, StockChip[]>()
  for (const row of rows) {
    const partId = typeof row.part === 'object' ? row.part.id : row.part
    const code = typeof row.location === 'object' ? row.location.code : '?'
    const list = byPart.get(partId) ?? []
    list.push({ code, quantity: row.quantity, approximate: Boolean(row.approximate) })
    byPart.set(partId, list)
  }
  return parts.map((part) => ({ part, stock: byPart.get(part.id) ?? [] }))
}
