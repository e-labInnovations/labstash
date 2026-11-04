import type { Payload, Sort, Where } from 'payload'

import { INBOX_CODE } from '@/collections/Locations'
import { idOf } from '@/ledger/rules'
import type { User } from '@/payload-types'

import { formatValue } from './format'
import { partConditions, withLocations } from './search'
import { parseQuery } from './searchQuery'

// The All parts list: filtering, sorting and paging all happen in the database, so the page
// stays quick however big the lab gets. Every query runs as the user, so only their own lab.

export const SHOW = {
  all: 'All',
  low: 'Running low',
  out: 'Out of stock',
  inbox: 'In Inbox',
  shared: 'Shared',
} as const
export type Show = keyof typeof SHOW

export const SORT = {
  name: 'Name',
  most: 'Most stock',
  least: 'Least stock',
  value: 'Value',
  newest: 'Newest',
} as const
export type SortKey = keyof typeof SORT

const ORDER: Record<SortKey, Sort> = {
  name: 'name',
  most: ['-totalQuantity', 'name'],
  least: ['totalQuantity', 'name'],
  // Grouped by unit (Ω, F, V…), smallest first
  value: ['unit', 'value', 'name'],
  newest: '-createdAt',
}

export const PER_PAGE = [20, 50, 100] as const

export type ListParams = {
  q: string
  category: string
  show: Show
  sort: SortKey
  page: number
  limit: number
}

const oneOf = <T extends string>(options: Record<T, string>, v: unknown, fallback: T) =>
  typeof v === 'string' && v in options ? (v as T) : fallback

/** Reads the list's settings from the address bar, falling back to defaults. */
export const listParams = (raw: Record<string, string | string[] | undefined>): ListParams => {
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : '')
  const limit = Number(str('limit'))
  return {
    q: str('q').trim(),
    category: str('category'),
    show: oneOf(SHOW, raw.show, 'all'),
    sort: oneOf(SORT, raw.sort, 'name'),
    page: Math.max(1, Math.floor(Number(str('page'))) || 1),
    limit: (PER_PAGE as readonly number[]).includes(limit) ? limit : 50,
  }
}

const as = (user: User) => ({ user, overrideAccess: false as const })

/** Ids of parts with stock in locations whose code contains `code`. */
const partsInBoxes = async (payload: Payload, user: User, code: string, exact = false) => {
  const { docs: boxes } = await payload.find({
    collection: 'locations',
    where: { code: exact ? { equals: code } : { like: code } },
    pagination: false,
    depth: 0,
    select: { code: true },
    ...as(user),
  })
  if (boxes.length === 0) return []
  const { docs } = await payload.find({
    collection: 'stock',
    where: { location: { in: boxes.map((b) => b.id) } },
    pagination: false,
    depth: 0,
    select: { part: true },
    ...as(user),
  })
  return [...new Set(docs.map((s) => idOf(s.part)!))]
}

export const listParts = async (payload: Payload, user: User, params: ListParams) => {
  const and: Where[] = []

  if (params.q) {
    const parsed = parseQuery(params.q)
    const skuParts = parsed.sku
      ? (
          await payload.find({
            collection: 'supplier-parts',
            where: { sku: { equals: parsed.sku } },
            pagination: false,
            depth: 0,
            select: { part: true },
            ...as(user),
          })
        ).docs.map((d) => idOf(d.part)!)
      : []
    const boxParts = new Map(
      await Promise.all(
        parsed.terms.map(async (t) => [t, await partsInBoxes(payload, user, t)] as const),
      ),
    )
    and.push(...partConditions(parsed, skuParts, boxParts))
  }
  if (params.category) and.push({ category: { equals: params.category } })
  if (params.show === 'low') and.push({ lowStock: { equals: true } })
  if (params.show === 'out') and.push({ totalQuantity: { equals: 0 } })
  if (params.show === 'shared') and.push({ shared: { equals: true } })
  if (params.show === 'inbox') {
    and.push({ id: { in: await partsInBoxes(payload, user, INBOX_CODE, true) } })
  }
  const where: Where = and.length ? { and } : {}

  const [result, all] = await Promise.all([
    payload.find({
      collection: 'parts',
      where,
      sort: ORDER[params.sort],
      page: params.page,
      limit: params.limit,
      depth: 1,
      joins: false,
      populate: { categories: { name: true, breadcrumbs: true } },
      select: {
        name: true,
        mpn: true,
        value: true,
        unit: true,
        package: true,
        category: true,
        totalQuantity: true,
        lowStock: true,
        shared: true,
      },
      ...as(user),
    }),
    // Pieces across every match, not just this page
    payload.find({
      collection: 'parts',
      where,
      pagination: false,
      depth: 0,
      joins: false,
      select: { totalQuantity: true },
      ...as(user),
    }),
  ])

  const rows = (await withLocations(payload, user, result.docs)).map(({ part, stock, thumb }) => {
    const category = typeof part.category === 'object' ? part.category : null
    return {
      part: {
        id: part.id,
        name: part.name,
        value: part.value ?? null,
        unit: part.unit ?? null,
        package: part.package ?? null,
        totalQuantity: part.totalQuantity ?? 0,
        lowStock: Boolean(part.lowStock),
      },
      mpn: part.mpn ?? null,
      valueText: formatValue(part.value, part.unit) ?? '',
      category: category
        ? category.breadcrumbs?.map((b) => b.label).join(' › ') || category.name
        : null,
      shared: Boolean(part.shared),
      stock,
      thumb,
    }
  })

  return {
    rows,
    total: result.totalDocs,
    pages: result.totalPages,
    page: result.page ?? params.page,
    pcs: all.docs.reduce((sum, p) => sum + (p.totalQuantity ?? 0), 0),
  }
}

export type PartList = Awaited<ReturnType<typeof listParts>>
export type PartListRow = PartList['rows'][number]
