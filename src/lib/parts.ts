import type { Payload, PayloadRequest } from 'payload'

import { guessPackage, guessValue } from '@/importers/etstore'
import { withTransaction } from '@/importers/importOrder'
import { idOf } from '@/ledger/rules'
import { ensureInbox } from '@/importers/receiveOrder'
import { type CatalogPart, catalogPart, readMediaFile } from '@/lib/catalog'
import { formatValue } from '@/lib/format'
import { parseValue } from '@/lib/searchQuery'
import type { Media, Part, User } from '@/payload-types'

export type NewPart = {
  name: string
  package?: string
  mpn?: string
  category?: string
  minStock?: number
  quantity: number
  /** Where the starting stock goes; INBOX when left out */
  location?: string
  note?: string
  /** A shared part from another lab to copy: details, photos, datasheet and store links */
  from?: string
}

/**
 * Creates a part that didn't come from an order (a gift, salvage, an old drawer),
 * with its starting stock as an adjust movement so the ledger still explains it.
 */
const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ')

const checkMinStock = (minStock: number | null | undefined) => {
  if (minStock != null && (!Number.isInteger(minStock) || minStock < 0)) {
    throw new Error('Reorder level must be a whole number')
  }
}

const refuseDuplicate = async (payload: Payload, user: User, name: string, except?: string) => {
  const same = await payload.find({
    collection: 'parts',
    where: {
      and: [{ name: { equals: name } }, ...(except ? [{ id: { not_equals: except } }] : [])],
    },
    limit: 1,
    depth: 0,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  if (same.docs[0]) throw new Error(`“${name}” already exists — add stock from its page`)
}

export const createPart = async (payload: Payload, user: User, input: NewPart) => {
  const name = cleanName(input.name)
  if (!name) throw new Error('Give the part a name')
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new Error('Quantity must be a whole number')
  }
  checkMinStock(input.minStock)
  await refuseDuplicate(payload, user, name)
  // Read on the server: only what the sharing lab exposes is ever copied
  const source = input.from ? await catalogPart(payload, user, input.from) : null
  if (input.from && !source) throw new Error('That part is no longer shared')
  const shared = source?.part

  return withTransaction(
    payload,
    async (req) => {
      const value = shared?.value != null ? shared : guessValue(name)
      const part = await payload.create({
        collection: 'parts',
        data: {
          name,
          package: input.package?.trim() || shared?.package || guessPackage(name) || undefined,
          mpn: input.mpn?.trim() || shared?.mpn || undefined,
          manufacturer: shared?.manufacturer || undefined,
          description: shared?.description || undefined,
          kicadSymbol: shared?.kicadSymbol || undefined,
          kicadFootprint: shared?.kicadFootprint || undefined,
          links: shared?.links?.map(({ label, url }) => ({ label, url })) ?? undefined,
          category: input.category || undefined,
          minStock: input.minStock,
          ...(value && {
            value: value.value,
            unit: value.unit as Part['unit'],
          }),
        },
        overrideAccess: false,
        req,
      })
      if (source) await copyAttachments(payload, req, part.id, source)

      if (input.quantity > 0) {
        const to = input.location || (await ensureInbox(req, idOf(part.lab)!))
        await payload.create({
          collection: 'stock-movements',
          data: {
            type: 'adjust',
            part: part.id,
            quantity: input.quantity,
            to,
            note: input.note?.trim() || 'Added without an order',
            occurredAt: new Date().toISOString(),
          },
          overrideAccess: false,
          req,
        })
      }
      return { id: part.id }
    },
    { ...user, collection: 'users' },
  )
}

/** Copies a shared part's photos, files (datasheet, KiCad, 3D…) and store links into this lab. */
const copyAttachments = async (
  payload: Payload,
  req: PayloadRequest,
  partId: string,
  source: CatalogPart,
) => {
  const copy = async (mediaId: string, kind: Media['kind'], alt: string | null) => {
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const file = await readMediaFile(payload, media)
    return payload.create({
      collection: 'media',
      data: { alt: alt ?? undefined, kind, part: partId },
      file: {
        data: file.data,
        mimetype: file.mimeType,
        name: file.filename,
        size: file.data.length,
      },
      overrideAccess: false,
      req,
    })
  }
  for (const photo of source.photos) await copy(photo.id, 'image', photo.alt)
  for (const file of source.files) {
    const copied = await copy(file.id, file.kind, file.filename)
    if (file.id === source.datasheetId) {
      await payload.update({
        collection: 'parts',
        id: partId,
        data: { datasheet: copied.id },
        overrideAccess: false,
        req,
      })
    }
  }

  for (const listing of source.listings) {
    if (!listing.supplier) continue
    // This lab may already know that store code from its own orders; keep its own link
    const { totalDocs } = await payload.count({
      collection: 'supplier-parts',
      where: {
        and: [{ supplier: { equals: listing.supplier.id } }, { sku: { equals: listing.sku } }],
      },
      overrideAccess: false,
      req,
    })
    if (totalDocs > 0) continue
    await payload.create({
      collection: 'supplier-parts',
      data: {
        supplier: listing.supplier.id,
        part: partId,
        sku: listing.sku,
        title: listing.title ?? undefined,
        handle: listing.handle ?? undefined,
        variantId: listing.variantId ?? undefined,
        url: listing.url ?? undefined,
      },
      overrideAccess: false,
      req,
    })
  }
}

export type PartEdit = {
  name: string
  /** As typed: "10k", "100nF", "3.3V"; empty clears it */
  value?: string
  package?: string
  mpn?: string
  manufacturer?: string
  category?: string
  minStock?: number | null
  notes?: string
  /** KiCad library references, e.g. Device:R and Resistor_SMD:R_0603_1608Metric */
  kicadSymbol?: string
  kicadFootprint?: string
}

/** Updates a part's description. Stock stays with the ledger and is never touched here. */
export const updatePart = async (payload: Payload, user: User, id: string, input: PartEdit) => {
  const current = await payload.findByID({
    collection: 'parts',
    id,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const name = cleanName(input.name)
  if (!name) throw new Error('Give the part a name')
  checkMinStock(input.minStock)
  await refuseDuplicate(payload, user, name, id)

  const typed = input.value?.trim() ?? ''
  let value: Pick<Part, 'value' | 'unit'> = { value: current.value, unit: current.unit }
  // Untouched values stay as they are, even ones the parser can't read back (mAh, pcs)
  if (typed !== (formatValue(current.value, current.unit) ?? '')) {
    if (!typed) value = { value: null, unit: null }
    else {
      const parsed = parseValue(typed.replace(/\s+/g, ''))
      if (!parsed) throw new Error(`Couldn’t read the value “${typed}”. Try 10k, 100nF or 3.3V`)
      value = { value: parsed.value, unit: parsed.unit as Part['unit'] }
    }
  }

  const blank = (v?: string) => v?.trim() || null
  return payload.update({
    collection: 'parts',
    id,
    data: {
      name,
      ...value,
      package: blank(input.package),
      mpn: blank(input.mpn),
      manufacturer: blank(input.manufacturer),
      category: input.category || null,
      minStock: input.minStock ?? null,
      notes: blank(input.notes),
      kicadSymbol: blank(input.kicadSymbol),
      kicadFootprint: blank(input.kicadFootprint),
    },
    user,
    overrideAccess: false,
  })
}
