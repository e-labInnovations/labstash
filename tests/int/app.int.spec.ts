import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import { STORE_URL, parseEtstoreOrder } from '@/importers/etstore'
import { importOrder } from '@/importers/importOrder'
import { receiveLines } from '@/importers/receiveOrder'
import { findInbox, locationContents } from '@/lib/queries'
import { photosFor, searchParts } from '@/lib/search'
import { compartmentCodes, createBox } from '@/lib/boxes'
import { boxLabelsFor, labelsFor } from '@/lib/labels'
import { createPart, updatePart } from '@/lib/parts'
import { putAwayAll } from '@/lib/putAway'
import type { User } from '@/payload-types'

import { freshPayload } from './setup'

// The PWA's read and write paths, run as a signed-in user with access control on.
let payload: Payload
let user: User
let purchaseId: string

const parsed = parseEtstoreOrder(
  JSON.parse(readFileSync(path.resolve(__dirname, '../fixtures/etstore-order-31860.json'), 'utf8')),
)

const lineFor = async (sku: string) => {
  const { docs } = await payload.find({
    collection: 'purchase-lines',
    overrideAccess: true,
    where: { 'supplierPart.sku': { equals: sku } },
    depth: 0,
  })
  return docs[0]
}

describe('app flows as a user', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: 'me@example.com', password: 'secret' },
    })
    const result = await importOrder(payload, parsed, {
      name: 'ETstore',
      website: STORE_URL,
      importer: 'etstore',
    })
    purchaseId = result.purchaseId
  })

  it('anonymous requests see nothing', async () => {
    await expect(payload.find({ collection: 'parts', overrideAccess: false })).rejects.toThrow()
  })

  it('search understands values, packages and store codes', async () => {
    const tenK = await searchParts(payload, user, '10k 0603')
    expect(tenK.map((r) => r.part.name)).toEqual(['10K OHM 0603 SMD RESISTOR 103 1/16W 5% YAGEO'])

    const caps = await searchParts(payload, user, '100nF')
    expect(caps).toHaveLength(1)

    const byCode = await searchParts(payload, user, 'ET7879')
    expect(byCode[0].part.name).toContain('CH32V003J4M6')

    const text = await searchParts(payload, user, 'mosfet sot23')
    expect(text.length).toBeGreaterThanOrEqual(4)
  })

  it('receives chosen lines: full, short and missing', async () => {
    const solder = await lineFor('ET8068')
    const battery = await lineFor('ET7246')
    const mcu = await lineFor('ET7879')

    const result = await receiveLines(
      payload,
      purchaseId,
      { [solder.id]: 'missing', [battery.id]: 1, [mcu.id]: 2 },
      user,
    )
    expect(result).toEqual({ received: 3, cancelled: 1 })

    const inbox = await findInbox(payload, user)
    const contents = await locationContents(payload, user, inbox!.code)
    expect(contents!.here.map((r) => r.quantity).sort()).toEqual([1, 2])

    const purchase = await payload.findByID({
      collection: 'purchases',
      id: purchaseId,
      overrideAccess: true,
    })
    expect(purchase.status).toBe('partial')
  })

  it('rejects receiving more than is outstanding', async () => {
    const mcu = await lineFor('ET5786')
    await expect(receiveLines(payload, purchaseId, { [mcu.id]: 99 }, user)).rejects.toThrow(
      /enter 0–3/,
    )
  })

  it('puts away from INBOX into a compartment and shows it in the box grid', async () => {
    const box = await payload.create({
      collection: 'locations',
      data: { code: 'B03', kind: 'box', columns: 6 },
      user,
      overrideAccess: false,
    })
    const cell = await payload.create({
      collection: 'locations',
      data: { code: 'B03-17', kind: 'compartment', parent: box.id },
      user,
      overrideAccess: false,
    })
    const inbox = (await findInbox(payload, user))!
    const mcuPart = (await lineFor('ET7879')).part as string

    await payload.create({
      collection: 'stock-movements',
      data: {
        type: 'move',
        part: mcuPart,
        quantity: 2,
        from: inbox.id,
        to: cell.id,
        occurredAt: new Date().toISOString(),
      },
      user,
      overrideAccess: false,
    })

    const boxView = await locationContents(payload, user, 'B03')
    expect(boxView!.children).toHaveLength(1)
    expect(boxView!.children[0].stock[0]).toMatchObject({ quantity: 2 })

    const found = await searchParts(payload, user, 'CH32V003J4M6')
    const mcu = found.find((r) => r.part.id === mcuPart)!
    expect(mcu.stock).toEqual([{ code: 'B03-17', quantity: 2, approximate: false }])
  })

  it('adds a box with numbered compartments in one go, and refuses duplicates', async () => {
    const box = await createBox(payload, user, {
      code: ' b09 ',
      name: 'Caps',
      columns: 4,
      compartments: 8,
    })
    expect(box.code).toBe('B09')
    const view = await locationContents(payload, user, 'B09')
    expect(view!.location).toMatchObject({ name: 'Caps', kind: 'box', columns: 4 })
    expect(view!.children.map((c) => c.location.code)).toEqual(compartmentCodes('B09', 8))

    await expect(
      createBox(payload, user, { code: 'B09', columns: 4, compartments: 2 }),
    ).rejects.toThrow(/already used/)
  })

  it('shows photos attached to a part through media.part, with a thumbnail', async () => {
    const mcuPart = (await lineFor('ET7879')).part as string
    const png = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#1f5c46' },
    })
      .png()
      .toBuffer()
    await payload.create({
      collection: 'media',
      data: { alt: 'CH32V003J4M6', part: mcuPart },
      file: { data: png, mimetype: 'image/png', name: 'ch32v003.png', size: png.length },
      user,
      overrideAccess: false,
    })

    const photos = (await photosFor(payload, user, [mcuPart])).get(mcuPart)!
    expect(photos).toHaveLength(1)
    expect(photos[0].thumb).not.toBe(photos[0].url)

    const found = await searchParts(payload, user, 'CH32V003J4M6')
    expect(found.find((r) => r.part.id === mcuPart)!.thumb).toBe(photos[0].thumb)
  })

  it('adds a part without an order: guesses value and package, books stock as an adjust', async () => {
    const box = await createBox(payload, user, {
      code: 'B10',
      columns: 2,
      compartments: 2,
    })
    const slot = await payload.find({
      collection: 'locations',
      overrideAccess: true,
      where: { code: { equals: 'B10-01' } },
      depth: 0,
    })
    const { id } = await createPart(payload, user, {
      name: '  4.7K OHM 1206 resistor ',
      quantity: 12,
      location: slot.docs[0].id,
      minStock: 3,
    })
    const part = await payload.findByID({
      collection: 'parts',
      id,
      overrideAccess: true,
      depth: 0,
    })
    expect(part).toMatchObject({
      name: '4.7K OHM 1206 resistor',
      value: 4700,
      unit: 'Ω',
      package: '1206',
      totalQuantity: 12,
      lowStock: false,
    })
    const moves = await payload.find({
      collection: 'stock-movements',
      overrideAccess: true,
      where: { part: { equals: id } },
      depth: 0,
    })
    expect(moves.docs).toMatchObject([
      {
        type: 'adjust',
        quantity: 12,
        to: slot.docs[0].id,
        note: 'Added without an order',
      },
    ])
    expect(box.code).toBe('B10')

    await expect(
      createPart(payload, user, {
        name: '4.7K OHM 1206 resistor',
        quantity: 1,
      }),
    ).rejects.toThrow(/already exists/)
  })

  it('adds a part with no location into INBOX, and with zero stock books nothing', async () => {
    const { id } = await createPart(payload, user, { name: 'Mystery relay', quantity: 4 })
    const inbox = await findInbox(payload, user)
    expect(inbox).not.toBeNull()
    const stock = await payload.find({
      collection: 'stock',
      overrideAccess: true,
      where: { part: { equals: id } },
      depth: 0,
    })
    expect(stock.docs).toMatchObject([{ location: inbox?.id, quantity: 4 }])

    const empty = await createPart(payload, user, {
      name: 'Wishlist part',
      quantity: 0,
    })
    const none = await payload.count({
      collection: 'stock-movements',
      overrideAccess: true,
      where: { part: { equals: empty.id } },
    })
    expect(none.totalDocs).toBe(0)
  })

  it('edits a part: re-reads the value, keeps stock, refuses a taken name', async () => {
    const { id } = await createPart(payload, user, { name: 'Edit me', quantity: 7 })
    await createPart(payload, user, { name: 'Taken name', quantity: 0 })

    const edited = await updatePart(payload, user, id, {
      name: 'NE555 timer',
      value: '4k7',
      package: 'DIP-8',
      minStock: 10,
    })
    expect(edited).toMatchObject({
      name: 'NE555 timer',
      value: 4700,
      unit: 'Ω',
      package: 'DIP-8',
      minStock: 10,
      totalQuantity: 7,
      lowStock: true,
    })

    // an untouched value the parser can't read back stays as it is
    await payload.update({
      collection: 'parts',
      id,
      data: { value: 1200, unit: 'mAh' },
      overrideAccess: true,
    })
    const kept = await updatePart(payload, user, id, { name: 'NE555 timer', value: '1200 mAh' })
    expect(kept).toMatchObject({ value: 1200, unit: 'mAh', minStock: null, lowStock: false })

    await expect(updatePart(payload, user, id, { name: 'Taken name' })).rejects.toThrow(/exists/)
    await expect(updatePart(payload, user, id, { name: 'x', value: 'lots' })).rejects.toThrow(
      /read the value/,
    )
  })

  it('puts several Inbox parts into one box at once, all of each', async () => {
    const a = await createPart(payload, user, { name: 'Bulk A', quantity: 3 })
    const b = await createPart(payload, user, { name: 'Bulk B', quantity: 5 })
    await createBox(payload, user, { code: 'B11', columns: 1, compartments: 0 })
    const box = await payload.find({
      collection: 'locations',
      where: { code: { equals: 'B11' } },
      overrideAccess: true,
      depth: 0,
    })
    const to = box.docs[0].id

    expect(await putAwayAll(payload, user, [a.id, b.id], to)).toEqual({ parts: 2, pcs: 8 })
    const labels = await labelsFor(payload, user, [b.id, a.id])
    expect(labels.map((l) => [l.name, l.where])).toEqual([
      ['Bulk B', 'B11'],
      ['Bulk A', 'B11'],
    ])
    // nothing left in INBOX for them
    await expect(putAwayAll(payload, user, [a.id], to)).rejects.toThrow(/no longer/)
    const inbox = (await findInbox(payload, user))!
    await expect(putAwayAll(payload, user, [a.id], inbox.id)).rejects.toThrow(/other than INBOX/)
  })

  it('labels boxes and compartments: code, name, what it is, scan opens the box', async () => {
    await createBox(payload, user, { code: 'B12', name: 'Diodes', columns: 2, compartments: 3 })
    const all = await boxLabelsFor(payload, user)
    expect(all.some((l) => l.id === 'INBOX')).toBe(false)
    const b12 = all.filter((l) => l.where.startsWith('B12'))
    expect(b12.map((l) => [l.where, l.name, l.detail, l.href])).toEqual([
      ['B12', 'Diodes', 'Box · 3 compartments', '/l/B12'],
      ['B12-01', '', 'In B12', '/l/B12-01'],
      ['B12-02', '', 'In B12', '/l/B12-02'],
      ['B12-03', '', 'In B12', '/l/B12-03'],
    ])
    expect(b12.map((l) => l.inside)).toEqual([null, 'B12', 'B12', 'B12'])
    const picked = await boxLabelsFor(payload, user, ['B12-03', 'B12', 'NOPE'])
    expect(picked.map((l) => l.id)).toEqual(['B12-03', 'B12'])
  })

  it('a user cannot write stock rows directly', async () => {
    const { docs } = await payload.find({
      collection: 'stock',
      limit: 1,
      user,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: 'stock',
        id: docs[0].id,
        data: { quantity: 500 },
        user,
        overrideAccess: false,
      }),
    ).resolves.toMatchObject({ quantity: docs[0].quantity })
  })
})
