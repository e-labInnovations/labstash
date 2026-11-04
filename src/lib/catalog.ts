import fs from 'node:fs/promises'
import path from 'node:path'
import type { Payload, PayloadRequest, Where } from 'payload'

import { labsOf } from '@/access'
import { idOf } from '@/ledger/rules'
import type { Media, Part, User } from '@/payload-types'

import { byKind, toPartFile } from './attachments'

import { partConditions } from './search'
import { parseQuery } from './searchQuery'

// The shared catalog: parts other labs chose to share, read across labs on the server.
// This is the only way into another lab, so it hands out the fields below and nothing else:
// never stock, boxes, orders, prices, notes, reorder levels, or who or which lab shares it.

const SHARED_FIELDS = {
  name: true,
  value: true,
  unit: true,
  package: true,
  mpn: true,
  manufacturer: true,
  description: true,
  category: true,
  datasheet: true,
  kicadSymbol: true,
  kicadFootprint: true,
  links: true,
} as const

type SharedPart = Pick<Part, 'id' | keyof typeof SHARED_FIELDS>

export type CatalogItem = {
  id: string
  name: string
  value: number | null
  unit: Part['unit'] | null
  package: string | null
  mpn: string | null
  thumb: string | null
}

/** Shared by another lab (your own parts are already in your own search). */
const sharedByOthers = (user: User): Where => ({
  and: [{ shared: { equals: true } }, { lab: { not_in: labsOf(user) } }],
})

/** Files of shared parts are served through the catalog, never the media API. */
export const catalogFileUrl = (mediaId: string, size?: 'thumbnail') =>
  `/catalog/file/${mediaId}${size ? `?size=${size}` : ''}`

const imagesOf = async (payload: Payload, partIds: string[]) => {
  if (partIds.length === 0) return []
  const { docs } = await payload.find({
    collection: 'media',
    where: { and: [{ part: { in: partIds } }, { mimeType: { contains: 'image/' } }] },
    pagination: false,
    sort: 'createdAt',
    depth: 0,
    select: { part: true, alt: true },
    overrideAccess: true,
  })
  return docs.map((m) => ({ id: m.id, part: idOf(m.part)!, alt: m.alt ?? null }))
}

export const searchCatalog = async (payload: Payload, user: User, q: string, limit = 20) => {
  const parsed = parseQuery(q)
  const skuParts = parsed.sku
    ? (
        await payload.find({
          collection: 'supplier-parts',
          where: { sku: { equals: parsed.sku } },
          depth: 0,
          select: { part: true },
          pagination: false,
          overrideAccess: true,
        })
      ).docs.map((d) => idOf(d.part)!)
    : []
  const and = partConditions(parsed, skuParts)
  if (and.length === 0) return []

  const { docs } = await payload.find({
    collection: 'parts',
    where: { and: [sharedByOthers(user), ...and] },
    sort: 'name',
    limit,
    depth: 0,
    joins: false,
    select: SHARED_FIELDS,
    overrideAccess: true,
  })
  const images = await imagesOf(
    payload,
    docs.map((d) => d.id),
  )
  return docs.map((p): CatalogItem => ({
    id: p.id,
    name: p.name,
    value: p.value ?? null,
    unit: p.unit ?? null,
    package: p.package ?? null,
    mpn: p.mpn ?? null,
    thumb: ((m) => (m ? catalogFileUrl(m.id, 'thumbnail') : null))(
      images.find((i) => i.part === p.id),
    ),
  }))
}

/** One shared part with everything a copy takes along, or null if it isn't shared (any more). */
export const catalogPart = async (payload: Payload, user: User, id: string) => {
  const { docs } = await payload.find({
    collection: 'parts',
    where: { and: [{ id: { equals: id } }, sharedByOthers(user)] },
    limit: 1,
    depth: 0,
    joins: false,
    select: SHARED_FIELDS,
    overrideAccess: true,
  })
  const part = docs[0] as SharedPart | undefined
  if (!part) return null

  const categoryId = idOf(part.category)
  const datasheetId = idOf(part.datasheet)
  const [category, images, files, listings] = await Promise.all([
    categoryId
      ? payload
          .findByID({ collection: 'categories', id: categoryId, depth: 0, overrideAccess: true })
          .catch(() => null)
      : null,
    imagesOf(payload, [id]),
    // Datasheets, KiCad files, 3D models…, plus the part's datasheet if it isn't filed under it
    payload.find({
      collection: 'media',
      where: {
        or: [
          { and: [{ part: { equals: id } }, { kind: { not_equals: 'image' } }] },
          ...(datasheetId ? [{ id: { equals: datasheetId } }] : []),
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'supplier-parts',
      where: { part: { equals: id } },
      pagination: false,
      depth: 1,
      populate: { suppliers: { name: true } },
      select: { supplier: true, sku: true, title: true, handle: true, variantId: true, url: true },
      overrideAccess: true,
    }),
  ])

  return {
    part,
    category: category
      ? {
          id: category.id,
          label: category.breadcrumbs?.map((b) => b.label).join(' › ') || category.name,
        }
      : null,
    photos: images.map((m) => ({
      id: m.id,
      alt: m.alt,
      url: catalogFileUrl(m.id),
      thumb: catalogFileUrl(m.id, 'thumbnail'),
    })),
    files: files.docs
      .map((m) =>
        toPartFile(
          { ...m, kind: m.id === datasheetId ? 'datasheet' : m.kind },
          catalogFileUrl(m.id),
        ),
      )
      .sort(byKind),
    datasheetId,
    listings: listings.docs.map((l) => ({
      supplier: typeof l.supplier === 'object' ? l.supplier : null,
      sku: l.sku,
      title: l.title ?? null,
      handle: l.handle ?? null,
      variantId: l.variantId ?? null,
      url: l.url ?? null,
    })),
  }
}

export type CatalogPart = NonNullable<Awaited<ReturnType<typeof catalogPart>>>

/** A media record that belongs to a shared part (a photo of it, or its datasheet), else null. */
export const sharedMedia = async (payload: Payload, mediaId: string) => {
  const media = await payload
    .findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!media) return null
  const { totalDocs } = await payload.count({
    collection: 'parts',
    where: {
      and: [
        { shared: { equals: true } },
        {
          or: [
            ...(media.part ? [{ id: { equals: idOf(media.part) } }] : []),
            { datasheet: { equals: media.id } },
          ],
        },
      ],
    },
    overrideAccess: true,
  })
  return totalDocs > 0 ? media : null
}

/**
 * The bytes of a stored file (or its thumbnail), wherever uploads live: the storage adapter
 * (Vercel Blob in production) answers first, local disk otherwise.
 */
export const readMediaFile = async (
  payload: Payload,
  media: Media,
  variant?: 'thumbnail',
): Promise<{ data: Buffer; mimeType: string; filename: string }> => {
  const v = variant ? media.variants?.[variant] : undefined
  const filename = v?.filename ?? media.filename
  const mimeType = v?.mimeType ?? media.mimeType ?? 'application/octet-stream'
  if (!filename) throw new Error('File not found')

  const config = payload.collections.media.config
  const req = { payload, headers: new Headers() } as unknown as PayloadRequest
  for (const handler of config.upload.handlers ?? []) {
    const res = await handler(req, {
      doc: media as never,
      headers: new Headers(),
      params: { collection: 'media', filename },
    })
    if (res instanceof Response) {
      if (!res.ok) throw new Error('File not found')
      return { data: Buffer.from(await res.arrayBuffer()), mimeType, filename }
    }
  }
  // Local development only (production files come from the storage adapter above); the
  // comments keep the bundler from shipping the whole project to read one folder
  const dir = path.resolve(/* turbopackIgnore: true */ config.upload.staticDir || 'media')
  const file = path.resolve(dir, filename)
  if (!file.startsWith(dir + path.sep)) throw new Error('File not found')
  return { data: await fs.readFile(/* turbopackIgnore: true */ file), mimeType, filename }
}

/** Shares or stops sharing the given parts of the user's own lab; returns how many changed. */
export const setShared = async (payload: Payload, user: User, ids: string[], shared: boolean) => {
  if (ids.length === 0) throw new Error('Pick some parts first')
  const { docs } = await payload.update({
    collection: 'parts',
    where: { id: { in: ids } },
    data: { shared },
    depth: 0,
    select: { shared: true },
    user,
    overrideAccess: false,
  })
  return docs.length
}
