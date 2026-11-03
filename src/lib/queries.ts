import type { Payload } from 'payload'

import { INBOX_CODE } from '@/collections/Locations'
import type { Location, Part, Stock, User } from '@/payload-types'

import { photosFor, withLocations } from './search'

// Every read runs as the signed-in user so collection access applies.
const as = (user: User) => ({ user, overrideAccess: false }) as const

const idOf = (v: string | { id: string } | null | undefined) =>
  (v && typeof v === 'object' ? v.id : v) ?? null

export const findInbox = async (payload: Payload, user: User) => {
  const { docs } = await payload.find({
    collection: 'locations',
    where: { code: { equals: INBOX_CODE } },
    limit: 1,
    depth: 0,
    ...as(user),
  })
  return docs[0] ?? null
}

export const inboxSummary = async (payload: Payload, user: User) => {
  const inbox = await findInbox(payload, user)
  if (!inbox) return { inbox: null, parts: 0 }
  const { totalDocs } = await payload.count({
    collection: 'stock',
    where: { location: { equals: inbox.id } },
    ...as(user),
  })
  return { inbox, parts: totalDocs }
}

export const homeStats = async (payload: Payload, user: User) => {
  const [inbox, low, open, parts] = await Promise.all([
    inboxSummary(payload, user),
    payload.count({ collection: 'parts', where: { lowStock: { equals: true } }, ...as(user) }),
    payload.count({
      collection: 'purchases',
      where: { status: { in: ['ordered', 'partial'] } },
      ...as(user),
    }),
    payload.count({ collection: 'parts', ...as(user) }),
  ])
  return {
    inbox: inbox.parts,
    lowStock: low.totalDocs,
    openOrders: open.totalDocs,
    parts: parts.totalDocs,
  }
}

export const recentMovements = async (payload: Payload, user: User, limit = 8) => {
  const { docs } = await payload.find({
    collection: 'stock-movements',
    sort: '-occurredAt',
    limit,
    depth: 1,
    populate: { parts: { name: true }, locations: { code: true } },
    ...as(user),
  })
  return docs
}

export const allLocations = async (payload: Payload, user: User) => {
  const { docs } = await payload.find({
    collection: 'locations',
    pagination: false,
    sort: 'code',
    depth: 0,
    select: { code: true, name: true, kind: true, parent: true },
    ...as(user),
  })
  return docs.map((l) => ({ id: l.id, code: l.code, name: l.name ?? null, kind: l.kind }))
}
export type LocationOption = Awaited<ReturnType<typeof allLocations>>[number]

export const partDetail = async (payload: Payload, user: User, id: string) => {
  const part = await payload
    .findByID({
      collection: 'parts',
      id,
      depth: 2,
      joins: false,
      populate: { categories: { name: true, breadcrumbs: true } },
      ...as(user),
    })
    .catch(() => null)
  if (!part) return null

  const { docs: stock } = await payload.find({
    collection: 'stock',
    where: { part: { equals: id } },
    pagination: false,
    sort: '-quantity',
    depth: 1,
    populate: { locations: { code: true, name: true, breadcrumbs: true } },
    ...as(user),
  })
  const [sources, photos] = await Promise.all([
    sourcesFor(payload, user, [id]).then((m) => m.get(id) ?? []),
    photosFor(payload, user, [id]).then((m) => m.get(id) ?? []),
  ])
  return { part, stock: stock as Array<Stock & { location: Location }>, sources, photos }
}

export type Source = { id: string; sku: string; url: string | null; supplier: string }

/** Where each part can be bought: store name, sku and product link, by part id. */
export const sourcesFor = async (payload: Payload, user: User, partIds: string[]) => {
  const byPart = new Map<string, Source[]>()
  if (partIds.length === 0) return byPart
  const { docs } = await payload.find({
    collection: 'supplier-parts',
    where: { part: { in: partIds } },
    pagination: false,
    depth: 1,
    populate: { suppliers: { name: true } },
    ...as(user),
  })
  for (const sp of docs) {
    const partId = idOf(sp.part as string)!
    const list = byPart.get(partId) ?? []
    const supplier = typeof sp.supplier === 'object' ? sp.supplier.name : 'Store'
    list.push({ id: sp.id, sku: sp.sku, url: sp.url ?? null, supplier })
    byPart.set(partId, list)
  }
  return byPart
}

/** A location with its child locations and what sits directly in each. */
export const locationContents = async (payload: Payload, user: User, code: string) => {
  const { docs } = await payload.find({
    collection: 'locations',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    ...as(user),
  })
  const location = docs[0]
  if (!location) return null

  const { docs: children } = await payload.find({
    collection: 'locations',
    where: { parent: { equals: location.id } },
    pagination: false,
    sort: 'code',
    depth: 0,
    ...as(user),
  })

  const ids = [location.id, ...children.map((c) => c.id)]
  const { docs: rows } = await payload.find({
    collection: 'stock',
    where: { location: { in: ids } },
    pagination: false,
    sort: '-quantity',
    depth: 1,
    populate: { parts: { name: true, package: true, value: true, unit: true } },
    ...as(user),
  })
  const stockAt = (locationId: string) =>
    rows.filter((r) => idOf(r.location as string) === locationId) as Array<Stock & { part: Part }>

  return {
    location,
    here: stockAt(location.id),
    children: children.map((child) => ({ location: child, stock: stockAt(child.id) })),
  }
}

export const topLevelLocations = async (payload: Payload, user: User) => {
  const { docs } = await payload.find({
    collection: 'locations',
    where: { parent: { exists: false } },
    pagination: false,
    sort: 'code',
    depth: 0,
    ...as(user),
  })
  const counts = await Promise.all(
    docs.map(async (l) => {
      const { totalDocs } = await payload.count({
        collection: 'locations',
        where: { parent: { equals: l.id } },
        ...as(user),
      })
      return totalDocs
    }),
  )
  return docs.map((location, i) => ({ location, children: counts[i] }))
}

export const lowStockParts = async (payload: Payload, user: User) => {
  const { docs } = await payload.find({
    collection: 'parts',
    where: { lowStock: { equals: true } },
    sort: 'totalQuantity',
    pagination: false,
    depth: 0,
    joins: false,
    ...as(user),
  })
  const sources = await sourcesFor(
    payload,
    user,
    docs.map((p) => p.id),
  )
  return docs.map((part) => ({ ...part, sources: sources.get(part.id) ?? [] }))
}

export const openPurchases = async (payload: Payload, user: User) => {
  const { docs } = await payload.find({
    collection: 'purchases',
    sort: '-orderedAt',
    limit: 50,
    depth: 1,
    joins: { lines: false },
    populate: { suppliers: { name: true } },
    ...as(user),
  })
  return docs
}

export const purchaseWithLines = async (payload: Payload, user: User, id: string) => {
  const purchase = await payload
    .findByID({
      collection: 'purchases',
      id,
      depth: 1,
      joins: { lines: false },
      populate: { suppliers: { name: true } },
      ...as(user),
    })
    .catch(() => null)
  if (!purchase) return null
  const { docs: lines } = await payload.find({
    collection: 'purchase-lines',
    where: { purchase: { equals: id } },
    pagination: false,
    sort: 'title',
    depth: 1,
    populate: { parts: { name: true } },
    ...as(user),
  })
  return { purchase, lines }
}

export { withLocations }
