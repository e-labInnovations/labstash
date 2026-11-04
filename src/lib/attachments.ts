import type { Payload } from 'payload'

import { idOf } from '@/ledger/rules'
import type { Media, User } from '@/payload-types'

// A part's files (anything but photos) are media records pointing at it with a kind;
// its links are on the part. Photos have their own gallery.

export const FILE_KINDS = {
  datasheet: { label: 'Datasheet', accept: '.pdf,application/pdf' },
  symbol: { label: 'KiCad symbol', accept: '.kicad_sym,.lib' },
  footprint: { label: 'KiCad footprint', accept: '.kicad_mod,.pretty,.zip' },
  model3d: { label: '3D model', accept: '.step,.stp,.wrl,.zip' },
  other: { label: 'Other file', accept: '' },
} as const
export type FileKind = keyof typeof FILE_KINDS

export const fileKind = (v: unknown): FileKind | null =>
  typeof v === 'string' && v in FILE_KINDS ? (v as FileKind) : null

/** The app uploads through a server action, which caps request bodies (see next.config.ts). */
export const MAX_FILE_BYTES = 3.9 * 1024 * 1024

export type PartFile = {
  id: string
  kind: FileKind
  filename: string
  size: number | null
  url: string
}

export const toPartFile = (m: Media, url = m.url ?? ''): PartFile => ({
  id: m.id,
  kind: fileKind(m.kind) ?? 'other',
  // The name it was uploaded with (kept as alt); the stored filename gets suffixes
  filename: m.alt || m.filename || 'file',
  size: m.filesize ?? null,
  url,
})

const ORDER = Object.keys(FILE_KINDS)
export const byKind = (a: PartFile, b: PartFile) =>
  ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.filename.localeCompare(b.filename)

/** Files attached to a part, datasheet first, as the user (so only their own lab). */
export const partFiles = async (payload: Payload, user: User, partId: string) => {
  const { docs } = await payload.find({
    collection: 'media',
    where: { and: [{ part: { equals: partId } }, { kind: { not_equals: 'image' } }] },
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs.map((m) => toPartFile(m)).sort(byKind)
}

export const addFile = async (
  payload: Payload,
  user: User,
  input: { part: string; kind: FileKind; file: { data: Buffer; mimetype: string; name: string } },
) => {
  if (input.file.data.length === 0) throw new Error('Pick a file first')
  if (input.file.data.length > MAX_FILE_BYTES) {
    throw new Error('That file is over 4 MB, too large to add from the app')
  }
  // Read as the user: a part in another lab is not found
  const part = await payload.findByID({
    collection: 'parts',
    id: input.part,
    depth: 0,
    select: { datasheet: true },
    user,
    overrideAccess: false,
  })
  const media = await payload.create({
    collection: 'media',
    data: { alt: input.file.name, kind: input.kind, part: part.id },
    file: { ...input.file, size: input.file.data.length },
    user,
    overrideAccess: false,
  })
  // The first datasheet becomes the part's datasheet (shown in lists and copied first)
  if (input.kind === 'datasheet' && !part.datasheet) {
    await payload.update({
      collection: 'parts',
      id: part.id,
      data: { datasheet: media.id },
      user,
      overrideAccess: false,
    })
  }
  return media
}

export const removeFile = async (payload: Payload, user: User, mediaId: string) => {
  const media = await payload.findByID({
    collection: 'media',
    id: mediaId,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const partId = idOf(media.part)
  if (partId) {
    const part = await payload.findByID({
      collection: 'parts',
      id: partId,
      depth: 0,
      select: { datasheet: true },
      user,
      overrideAccess: false,
    })
    if (idOf(part.datasheet) === media.id) {
      await payload.update({
        collection: 'parts',
        id: partId,
        data: { datasheet: null },
        user,
        overrideAccess: false,
      })
    }
  }
  await payload.delete({ collection: 'media', id: media.id, user, overrideAccess: false })
}

const cleanUrl = (url: string) => {
  const trimmed = url.trim()
  // "javascript:…", "mailto:…" and the like are refused; a bare "ti.com/…" gets https://
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):(?!\d)/i)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    throw new Error('Links must start with http:// or https://')
  }
  const withScheme = scheme ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error('That doesn’t look like a web address')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Links must start with http:// or https://')
  }
  return parsed.toString()
}

export const addLink = async (
  payload: Payload,
  user: User,
  input: { part: string; label: string; url: string },
) => {
  const label = input.label.trim()
  if (!label) throw new Error('Give the link a name')
  const url = cleanUrl(input.url)
  const part = await payload.findByID({
    collection: 'parts',
    id: input.part,
    depth: 0,
    select: { links: true },
    user,
    overrideAccess: false,
  })
  await payload.update({
    collection: 'parts',
    id: part.id,
    data: { links: [...(part.links ?? []), { label, url }] },
    user,
    overrideAccess: false,
  })
}

export const removeLink = async (payload: Payload, user: User, partId: string, linkId: string) => {
  const part = await payload.findByID({
    collection: 'parts',
    id: partId,
    depth: 0,
    select: { links: true },
    user,
    overrideAccess: false,
  })
  await payload.update({
    collection: 'parts',
    id: part.id,
    data: { links: (part.links ?? []).filter((l) => l.id !== linkId) },
    user,
    overrideAccess: false,
  })
}
