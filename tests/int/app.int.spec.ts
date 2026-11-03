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
