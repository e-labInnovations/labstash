import type { Payload } from 'payload'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import { catalogPart, readMediaFile, searchCatalog, setShared, sharedMedia } from '@/lib/catalog'
import { createPart } from '@/lib/parts'
import { findInbox } from '@/lib/queries'

import { freshPayload, newLab, newUser } from './setup'

// Sharing across labs: only parts marked shared, only their descriptive fields, and adding
// one makes an independent copy. Stock, boxes, orders, notes and reorder levels never leave.
let payload: Payload
let alice: Awaited<ReturnType<typeof newUser>>
let bob: Awaited<ReturnType<typeof newUser>>
let part: string
let photo: string
let datasheet: string

const as = (user: object) => ({ user: user as never, overrideAccess: false as const })

describe('shared catalog', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    alice = await newUser(payload, 'alice@example.com', await newLab(payload, 'Alice’s lab'))
    bob = await newUser(payload, 'bob@example.com', await newLab(payload, 'Bob’s lab'))

    part = (
      await createPart(payload, alice, {
        name: 'NE555 timer SOP-8',
        mpn: 'NE555DR',
        quantity: 9,
        minStock: 5,
      })
    ).id
    await payload.update({
      collection: 'parts',
      id: part,
      data: { notes: 'Alice’s secret drawer', manufacturer: 'TI', description: 'Precision timer' },
      ...as(alice),
    })
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#335' },
    })
      .png()
      .toBuffer()
    photo = (
      await payload.create({
        collection: 'media',
        data: { alt: 'NE555', part },
        file: { data: png, mimetype: 'image/png', name: 'ne555.png', size: png.length },
        ...as(alice),
      })
    ).id
    const pdf = Buffer.from('%PDF-1.4\n% datasheet\n')
    datasheet = (
      await payload.create({
        collection: 'media',
        data: { alt: 'NE555 datasheet', kind: 'datasheet' },
        file: { data: pdf, mimetype: 'application/pdf', name: 'ne555.pdf', size: pdf.length },
        ...as(alice),
      })
    ).id
    await payload.update({ collection: 'parts', id: part, data: { datasheet }, ...as(alice) })
    const store = await payload.create({
      collection: 'suppliers',
      data: { name: 'ETstore', importer: 'etstore' },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'supplier-parts',
      data: { supplier: store.id, part, sku: 'ET5555', url: 'https://example.com/ne555' },
      ...as(alice),
    })
  })

  it('shows nothing until the owner shares it', async () => {
    expect(await searchCatalog(payload, bob, 'NE555')).toEqual([])
    expect(await catalogPart(payload, bob, part)).toBeNull()
    expect(await sharedMedia(payload, photo)).toBeNull()
  })

  it('lets only the owner share or stop sharing', async () => {
    expect(await setShared(payload, bob, [part], true)).toBe(0)
    expect(await catalogPart(payload, bob, part)).toBeNull()
    expect(await setShared(payload, alice, [part], true)).toBe(1)
    expect(await setShared(payload, bob, [part], false)).toBe(0)
    expect(await catalogPart(payload, bob, part)).not.toBeNull()
  })

  it('finds shared parts of other labs with their descriptive fields only', async () => {
    const found = await searchCatalog(payload, bob, 'NE555')
    expect(found).toHaveLength(1)
    expect(Object.keys(found[0]).sort()).toEqual([
      'id',
      'mpn',
      'name',
      'package',
      'thumb',
      'unit',
      'value',
    ])
    expect(found[0]).toMatchObject({ name: 'NE555 timer SOP-8', mpn: 'NE555DR', package: 'SOP-8' })
    // by store code too, and never your own lab's parts
    expect(await searchCatalog(payload, bob, 'ET5555')).toHaveLength(1)
    expect(await searchCatalog(payload, alice, 'NE555')).toEqual([])

    const shared = (await catalogPart(payload, bob, part))!
    for (const key of [
      'notes',
      'minStock',
      'totalQuantity',
      'lowStock',
      'lab',
      'stock',
      'shared',
      'createdBy',
    ]) {
      expect(shared.part).not.toHaveProperty(key)
    }
    expect(shared.part).toMatchObject({ manufacturer: 'TI', description: 'Precision timer' })
    expect(shared.listings).toEqual([
      expect.objectContaining({ sku: 'ET5555', url: 'https://example.com/ne555' }),
    ])
    expect(Object.keys(shared.listings[0].supplier!).sort()).toEqual(['id', 'name'])
    expect(shared.photos).toHaveLength(1)
    expect(shared.files.map((f) => f.kind)).toEqual(['datasheet'])
    expect(shared.datasheetId).toBe(datasheet)
    // The files are served only because the part is shared
    const media = (await sharedMedia(payload, photo))!
    expect((await readMediaFile(payload, media, 'thumbnail')).mimeType).toBe('image/png')
    expect(await sharedMedia(payload, datasheet)).not.toBeNull()
  })

  it('copies a shared part into your lab as your own, independent part', async () => {
    const copy = (
      await createPart(payload, bob, { name: 'NE555 timer SOP-8', quantity: 2, from: part })
    ).id
    const mine = await payload.findByID({ collection: 'parts', id: copy, depth: 0, ...as(bob) })
    expect(mine).toMatchObject({
      mpn: 'NE555DR',
      manufacturer: 'TI',
      description: 'Precision timer',
      package: 'SOP-8',
      totalQuantity: 2,
      shared: false,
    })
    expect(mine.notes ?? null).toBeNull()
    expect(mine.minStock ?? null).toBeNull()

    // Photos, datasheet and store link are Bob's own copies, in Bob's lab
    const media = await payload.find({
      collection: 'media',
      where: { part: { equals: copy } },
      ...as(bob),
    })
    expect(media.docs.map((m) => m.kind).sort()).toEqual(['datasheet', 'image'])
    expect(media.docs.every((m) => ![photo, datasheet].includes(m.id))).toBe(true)
    expect(mine.datasheet).toBe(media.docs.find((m) => m.kind === 'datasheet')!.id)
    const listing = await payload.find({
      collection: 'supplier-parts',
      where: { part: { equals: copy } },
      ...as(bob),
    })
    expect(listing.docs.map((l) => l.sku)).toEqual(['ET5555'])
    // Stock went to Bob's INBOX; Alice's 9 are untouched
    const inbox = (await findInbox(payload, bob))!
    const stock = await payload.find({
      collection: 'stock',
      where: { part: { equals: copy } },
      depth: 0,
      ...as(bob),
    })
    expect(stock.docs.map((s) => [s.location, s.quantity])).toEqual([[inbox.id, 2]])
    const original = await payload.findByID({
      collection: 'parts',
      id: part,
      depth: 0,
      ...as(alice),
    })
    expect(original.totalQuantity).toBe(9)

    // Editing one side leaves the other alone
    await payload.update({
      collection: 'parts',
      id: part,
      data: { description: 'changed' },
      ...as(alice),
    })
    const after = await payload.findByID({ collection: 'parts', id: copy, depth: 0, ...as(bob) })
    expect(after.description).toBe('Precision timer')
  })

  it('stops showing a part, and refuses to copy it, once it is unshared', async () => {
    expect(await setShared(payload, alice, [part], false)).toBe(1)
    expect(await searchCatalog(payload, bob, 'NE555')).toEqual([])
    expect(await sharedMedia(payload, photo)).toBeNull()
    await expect(
      createPart(payload, bob, { name: 'Another NE555', quantity: 0, from: part }),
    ).rejects.toThrow(/no longer shared/)
  })
})
