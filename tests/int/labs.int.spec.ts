import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { isAdmin } from '@/access'
import { STORE_URL, parseEtstoreOrder } from '@/importers/etstore'
import { importOrder } from '@/importers/importOrder'
import { receiveLines } from '@/importers/receiveOrder'
import { createBox } from '@/lib/boxes'
import { createPart } from '@/lib/parts'
import { findInbox } from '@/lib/queries'
import { searchParts } from '@/lib/search'

import { freshPayload, newLab, newUser } from './setup'

// Two people, two separate labs: nothing in one is visible or writable from the other,
// whichever way it is asked (app helpers, Local API, the admin's API key).
let payload: Payload
let labA: string
let labB: string
let alice: Awaited<ReturnType<typeof newUser>>
let bob: Awaited<ReturnType<typeof newUser>>
let admin: Awaited<ReturnType<typeof newUser>>
let alicePart: string
let bobPart: string
let bobBox: string

const as = (user: object) => ({ user: user as never, overrideAccess: false as const })
const etstore = { name: 'ETstore', website: STORE_URL, importer: 'etstore' as const }
const parsed = parseEtstoreOrder(
  JSON.parse(readFileSync(path.resolve(__dirname, '../fixtures/etstore-order-31860.json'), 'utf8')),
)

describe('separate labs', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    labA = await newLab(payload, 'Alice’s lab')
    labB = await newLab(payload, 'Bob’s lab')
    admin = await newUser(payload, 'admin@example.com', labA, 'admin')
    alice = await newUser(payload, 'alice@example.com', labA)
    bob = await newUser(payload, 'bob@example.com', labB)
    alicePart = (await createPart(payload, alice, { name: 'NE555 SOP-8', quantity: 4 })).id
    bobPart = (await createPart(payload, bob, { name: 'NE555 SOP-8', quantity: 7 })).id
    bobBox = (await createBox(payload, bob, { code: 'B01', columns: 2, compartments: 0 })).id
  })

  it('gives every lab its own INBOX, part names and box codes', async () => {
    const [inboxA, inboxB] = [await findInbox(payload, alice), await findInbox(payload, bob)]
    expect(inboxA!.id).not.toBe(inboxB!.id)
    // Alice can have a B01 too, and her own NE555; a second one in her lab is refused
    await expect(
      createBox(payload, alice, { code: 'B01', columns: 2, compartments: 0 }),
    ).resolves.toMatchObject({ code: 'B01' })
    await expect(
      createBox(payload, alice, { code: 'B01', columns: 2, compartments: 0 }),
    ).rejects.toThrow(/already used/)
    await expect(createPart(payload, alice, { name: 'NE555 SOP-8', quantity: 0 })).rejects.toThrow(
      /already exists/,
    )
  })

  it('shows each user only their own lab', async () => {
    const found = await searchParts(payload, alice, 'NE555')
    expect(found.map((r) => r.part.id)).toEqual([alicePart])
    expect((await payload.find({ collection: 'stock', ...as(bob) })).docs).toHaveLength(1)
    await expect(
      payload.findByID({ collection: 'parts', id: bobPart, ...as(alice) }),
    ).rejects.toThrow()
    const { docs: users } = await payload.find({ collection: 'users', ...as(alice) })
    expect(users.map((u) => u.email)).toEqual(['alice@example.com'])
    const { docs: labs } = await payload.find({ collection: 'labs', ...as(alice) })
    expect(labs.map((l) => l.id)).toEqual([labA])
  })

  it('refuses writes into another lab', async () => {
    await expect(
      payload.update({ collection: 'parts', id: bobPart, data: { name: 'mine' }, ...as(alice) }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'parts', id: bobPart, ...as(alice) }),
    ).rejects.toThrow()
    // Naming the other lab outright
    await expect(
      payload.create({ collection: 'parts', data: { name: 'Sneaky', lab: labB }, ...as(alice) }),
    ).rejects.toThrow()
    // Using the other lab's part or box in a stock change
    await expect(
      payload.create({
        collection: 'stock-movements',
        data: {
          type: 'adjust',
          occurredAt: new Date().toISOString(),
          part: bobPart,
          quantity: 1,
          to: (await findInbox(payload, alice))!.id,
        },
        ...as(alice),
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'stock-movements',
        data: {
          type: 'adjust',
          occurredAt: new Date().toISOString(),
          part: alicePart,
          quantity: 1,
          to: bobBox,
        },
        ...as(alice),
      }),
    ).rejects.toThrow()
    // A photo on the other lab's part
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'x', part: bobPart },
        file: { data: Buffer.from('x'), mimetype: 'text/plain', name: 'x.txt', size: 1 },
        ...as(alice),
      }),
    ).rejects.toThrow()

    const bobStock = await payload.find({
      collection: 'stock',
      where: { part: { equals: bobPart } },
      overrideAccess: true,
    })
    expect(bobStock.docs.map((s) => s.quantity)).toEqual([7])
  })

  it('imports the same store order into each lab separately', async () => {
    const a = await importOrder(payload, parsed, etstore, labA)
    const b = await importOrder(payload, parsed, etstore, labB)
    expect(a.status).toBe('imported')
    expect(b).toMatchObject({ status: 'imported', partsMatched: 0 })
    expect(a.purchaseId).not.toBe(b.purchaseId)
    // Alice cannot receive Bob's order
    await expect(receiveLines(payload, b.purchaseId, {}, alice)).rejects.toThrow(/not found/)
    const { totalDocs } = await payload.count({ collection: 'purchases', ...as(alice) })
    expect(totalDocs).toBe(1)
  })

  it('keeps the admin to their own lab in the app and over an API key', async () => {
    const appCount = (await payload.count({ collection: 'parts', ...as(admin) })).totalDocs
    const ownLab = await payload.count({
      collection: 'parts',
      where: { lab: { equals: labA } },
      overrideAccess: true,
    })
    expect(appCount).toBe(ownLab.totalDocs)

    const { _ownLabOnly, ...panel } = admin
    expect(_ownLabOnly).toBe(true)
    expect(isAdmin(panel)).toBe(true)
    const all = await payload.count({ collection: 'parts', overrideAccess: true })
    expect((await payload.count({ collection: 'parts', ...as(panel) })).totalDocs).toBe(
      all.totalDocs,
    )

    const apiKey = { ...panel, _strategy: 'api-key' }
    expect(isAdmin(apiKey)).toBe(false)
    expect((await payload.count({ collection: 'parts', ...as(apiKey) })).totalDocs).toBe(
      ownLab.totalDocs,
    )
  })

  it('keeps users out of roles, labs and the shared lists', async () => {
    const updated = await payload.update({
      collection: 'users',
      id: alice.id,
      data: { role: 'admin', labs: [{ lab: labB }] },
      ...as(alice),
    })
    expect(updated.role).toBe('user')
    expect(updated.labs?.map((l) => (typeof l.lab === 'object' ? l.lab.id : l.lab))).toEqual([labA])
    expect(isAdmin(alice)).toBe(false)

    // Shared categories: anyone may add one, only the admin may change it
    const theirs = await payload.create({
      collection: 'categories',
      data: { name: 'Mine' },
      ...as(alice),
    })
    await expect(
      payload.update({
        collection: 'categories',
        id: theirs.id,
        data: { name: 'x' },
        ...as(alice),
      }),
    ).rejects.toThrow()
    await expect(payload.find({ collection: 'categories', ...as(alice) })).resolves.toBeDefined()
    // A user passed without the `users` marker is still kept to their own lab
    const { collection: _c, ...unmarked } = alice
    const mine = await payload.count({ collection: 'parts', ...as(alice) })
    expect(await payload.count({ collection: 'parts', ...as(unmarked) })).toEqual(mine)
    // Photos are no longer public
    await expect(payload.find({ collection: 'media', overrideAccess: false })).rejects.toThrow()
  })
})
