import type { Payload } from 'payload'

import { labsOf } from '@/access'
import { type ParsedOrder, STORE_URL, parseEtstoreOrder } from '@/importers/etstore'
import { type SupplierSpec, importOrder } from '@/importers/importOrder'
import { idOf } from '@/ledger/rules'
import type { User } from '@/payload-types'

import {
  type StoreOrderSummary,
  etstorePhotos,
  fetchEtstoreOrder,
  listEtstoreOrders,
} from './etstore'
import { ROBU_URL, fetchRobuOrder } from './robu'

// Importing a store's orders into the user's lab. The store key is used for the calls and
// dropped; nothing about the store account is stored.

const STORES: Record<
  'etstore' | 'robu',
  {
    supplier: SupplierSpec
    order: (key: string, id: string) => Promise<ParsedOrder>
    photos?: (key: string, id: string) => Promise<Map<string, string>>
  }
> = {
  etstore: {
    supplier: { name: 'ETstore', website: STORE_URL, importer: 'etstore' },
    order: async (key, id) => parseEtstoreOrder(await fetchEtstoreOrder(key, id)),
    photos: etstorePhotos,
  },
  robu: {
    supplier: { name: 'Robu', website: ROBU_URL, importer: 'robu' },
    order: fetchRobuOrder,
  },
}
export type Store = keyof typeof STORES
export const isStore = (s: unknown): s is Store => typeof s === 'string' && s in STORES

const MAX_PER_IMPORT = 10

const labOf = (user: User) => {
  const lab = labsOf(user)[0]
  if (!lab) throw new Error('You aren’t in a lab yet')
  return lab
}

export type ListedOrder = StoreOrderSummary & { imported: boolean }

/** The store's recent orders, marking those already in this lab. */
export const listOrders = async (payload: Payload, user: User, key: string) => {
  const orders = await listEtstoreOrders(key)
  const { docs } = await payload.find({
    collection: 'purchases',
    where: { externalId: { in: orders.map((o) => o.id) } },
    pagination: false,
    depth: 0,
    select: { externalId: true },
    user,
    overrideAccess: false,
  })
  const have = new Set(docs.map((p) => p.externalId))
  return orders.map((o): ListedOrder => ({ ...o, imported: have.has(o.id) }))
}

export type PreviewLine = {
  sku: string
  name: string
  quantity: number
  lineTotal: number
  /** The part in this lab it will be booked against, or null for a new part */
  match: { id: string; name: string } | null
}

/** What importing these orders would do, line by line, without writing anything. */
export const previewOrders = async (
  payload: Payload,
  user: User,
  store: Store,
  key: string,
  ids: string[],
) => {
  if (ids.length === 0) throw new Error('Pick at least one order')
  if (ids.length > MAX_PER_IMPORT) throw new Error(`Pick up to ${MAX_PER_IMPORT} orders at a time`)
  const parsed = await Promise.all(ids.map((id) => STORES[store].order(key, id)))
  const { docs: existing } = await payload.find({
    collection: 'purchases',
    where: { externalId: { in: parsed.map((p) => p.order.externalId) } },
    pagination: false,
    depth: 0,
    select: { externalId: true },
    user,
    overrideAccess: false,
  })
  const imported = new Set(existing.map((p) => p.externalId))
  const skus = [...new Set(parsed.flatMap((p) => p.lines.map((l) => l.sku)))]
  const { docs } = await payload.find({
    collection: 'supplier-parts',
    where: { sku: { in: skus } },
    pagination: false,
    depth: 1,
    populate: { parts: { name: true } },
    select: { sku: true, part: true },
    user,
    overrideAccess: false,
  })
  const known = new Map(
    docs.map((d) => [
      d.sku,
      typeof d.part === 'object' && d.part ? { id: d.part.id, name: d.part.name } : null,
    ]),
  )
  return parsed.map((p) => ({
    id: p.order.externalId,
    number: p.order.orderNumber,
    total: p.order.total,
    imported: imported.has(p.order.externalId),
    warnings: p.warnings,
    lines: p.lines.map((l): PreviewLine => ({
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      match: known.get(l.sku) ?? null,
    })),
  }))
}

export type ImportedOrder = {
  number: string
  purchaseId: string
  status: 'imported' | 'exists'
  partsCreated: number
  partsMatched: number
  photos: number
}

/** Imports the orders into the user's lab, each in its own transaction, then adds photos. */
export const importOrders = async (
  payload: Payload,
  user: User,
  store: Store,
  key: string,
  ids: string[],
) => {
  if (ids.length === 0) throw new Error('Pick at least one order')
  if (ids.length > MAX_PER_IMPORT) throw new Error(`Pick up to ${MAX_PER_IMPORT} orders at a time`)
  const lab = labOf(user)
  const results: ImportedOrder[] = []
  for (const id of ids) {
    const { supplier, order, photos: photosOf } = STORES[store]
    const parsed = await order(key, id)
    const result = await importOrder(payload, parsed, supplier, lab)
    const photos =
      photosOf && result.status === 'imported' && result.partsCreated > 0
        ? await addPhotos(payload, user, result.purchaseId, await photosOf(key, id))
        : 0
    results.push({
      number: parsed.order.orderNumber,
      purchaseId: result.purchaseId,
      status: result.status,
      partsCreated: result.status === 'imported' ? result.partsCreated : 0,
      partsMatched: result.status === 'imported' ? result.partsMatched : 0,
      photos,
    })
  }
  return results
}

/** Store photos for the order's parts that have none yet; skips any that fail. */
const addPhotos = async (
  payload: Payload,
  user: User,
  purchaseId: string,
  photos: Map<string, string>,
) => {
  if (photos.size === 0) return 0
  const { docs: lines } = await payload.find({
    collection: 'purchase-lines',
    where: { purchase: { equals: purchaseId } },
    pagination: false,
    depth: 1,
    populate: { 'supplier-parts': { sku: true } },
    select: { part: true, supplierPart: true, title: true },
    user,
    overrideAccess: false,
  })
  let added = 0
  for (const line of lines) {
    const part = idOf(line.part)
    const sku = typeof line.supplierPart === 'object' ? line.supplierPart?.sku : undefined
    const url = sku ? photos.get(sku) : undefined
    if (!part || !url) continue
    const { totalDocs } = await payload.count({
      collection: 'media',
      where: { and: [{ part: { equals: part } }, { kind: { equals: 'image' } }] },
      user,
      overrideAccess: false,
    })
    if (totalDocs > 0) continue
    try {
      const src = new URL(url)
      if (!src.hostname.endsWith('cdn.shopify.com')) continue
      src.searchParams.set('width', '1000')
      const res = await fetch(src, { cache: 'no-store' })
      const type = res.headers.get('content-type') ?? ''
      if (!res.ok || !type.startsWith('image/')) continue
      const data = Buffer.from(await res.arrayBuffer())
      const ext = type.split('/')[1]?.split(';')[0] ?? 'jpg'
      await payload.create({
        collection: 'media',
        data: { alt: line.title, kind: 'image', part },
        file: { data, mimetype: type, name: `${sku!.toLowerCase()}.${ext}`, size: data.length },
        user,
        overrideAccess: false,
      })
      added++
    } catch {
      // A missing photo is not worth failing the import over
    }
  }
  return added
}
