import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { withTransaction } from '@/importers/importOrder'

import { freshPayload } from './setup'

let payload: Payload
let part: string
let boxA: string
let boxB: string

const move = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'stock-movements',
    overrideAccess: true,
    data: { part, occurredAt: new Date().toISOString(), ...data } as never,
  })

const stockAt = async (location: string) => {
  const { docs } = await payload.find({
    collection: 'stock',
    overrideAccess: true,
    where: { and: [{ part: { equals: part } }, { location: { equals: location } }] },
    depth: 0,
  })
  return docs[0]?.quantity ?? 0
}

const partDoc = () =>
  payload.findByID({ collection: 'parts', overrideAccess: true, id: part, depth: 0 })

describe('stock ledger', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    part = (
      await payload.create({
        collection: 'parts',
        overrideAccess: true,
        data: { name: 'CH32V003J4M6', minStock: 2 },
      })
    ).id
    boxA = (
      await payload.create({
        collection: 'locations',
        overrideAccess: true,
        data: { code: 'B01', kind: 'box' },
      })
    ).id
    boxB = (
      await payload.create({
        collection: 'locations',
        overrideAccess: true,
        data: { code: 'B01-01', kind: 'compartment', parent: boxA },
      })
    ).id
  })

  it('receive adds stock and updates part totals', async () => {
    await move({ type: 'receive', quantity: 5, to: boxA })
    expect(await stockAt(boxA)).toBe(5)
    expect(await partDoc()).toMatchObject({ totalQuantity: 5, lowStock: false })
  })

  it('move shifts stock between locations without changing the total', async () => {
    await move({ type: 'move', quantity: 2, from: boxA, to: boxB })
    expect(await stockAt(boxA)).toBe(3)
    expect(await stockAt(boxB)).toBe(2)
    expect((await partDoc()).totalQuantity).toBe(5)
  })

  it('use that empties a location deletes the stock row and flags low stock', async () => {
    await move({ type: 'use', quantity: 2, from: boxB })
    const { totalDocs } = await payload.find({
      collection: 'stock',
      overrideAccess: true,
      where: { location: { equals: boxB } },
    })
    expect(totalDocs).toBe(0)
    expect(await partDoc()).toMatchObject({ totalQuantity: 3, lowStock: false })
    await move({ type: 'use', quantity: 1, from: boxA })
    expect(await partDoc()).toMatchObject({ totalQuantity: 2, lowStock: true })
  })

  it('rejects going below zero and rolls the movement back', async () => {
    const before = await payload.count({ collection: 'stock-movements', overrideAccess: true })
    await expect(move({ type: 'use', quantity: 99, from: boxA })).rejects.toThrow(
      /Not enough stock at B01/,
    )
    expect(await payload.count({ collection: 'stock-movements', overrideAccess: true })).toEqual(
      before,
    )
    expect(await stockAt(boxA)).toBe(2)
  })

  it('rejects malformed movements', async () => {
    await expect(move({ type: 'move', quantity: 1, from: boxA })).rejects.toThrow(
      /both "from" and "to"/,
    )
    await expect(move({ type: 'adjust', quantity: 1, to: boxA })).rejects.toThrow(/note/)
  })

  it('adjust with a note corrects a count', async () => {
    await move({ type: 'adjust', quantity: 3, to: boxA, note: 'found a strip in the drawer' })
    expect(await stockAt(boxA)).toBe(5)
  })

  it('movements cannot be edited or deleted through the API', async () => {
    const { docs } = await payload.find({
      collection: 'stock-movements',
      overrideAccess: true,
      limit: 1,
    })
    await expect(
      payload.update({
        collection: 'stock-movements',
        id: docs[0].id,
        data: { quantity: 1 },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'stock-movements', id: docs[0].id, overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('ledger-owned fields ignore manual writes; minStock edits re-derive lowStock', async () => {
    await payload.update({
      collection: 'parts',
      overrideAccess: true,
      id: part,
      data: { totalQuantity: 999, lowStock: true } as never,
    })
    expect(await partDoc()).toMatchObject({ totalQuantity: 5, lowStock: false })
    await payload.update({
      collection: 'parts',
      overrideAccess: true,
      id: part,
      data: { minStock: 10 },
    })
    expect(await partDoc()).toMatchObject({ totalQuantity: 5, lowStock: true })
  })

  it('guards still apply to writes after a movement in the same transaction', async () => {
    // Regression: Payload keeps a call's context on the shared req, so the ledger's
    // skip flag used to leak into every later write of the transaction.
    await withTransaction(payload, async (req) => {
      await req.payload.create({
        collection: 'stock-movements',
        overrideAccess: true,
        data: {
          type: 'receive',
          part,
          quantity: 1,
          to: boxB,
          occurredAt: new Date().toISOString(),
        },
        req,
      })
      await req.payload.update({
        collection: 'parts',
        overrideAccess: true,
        id: part,
        data: { totalQuantity: 999, minStock: 6 } as never,
        req,
      })
    })
    expect(await partDoc()).toMatchObject({ totalQuantity: 6, lowStock: true })
  })

  it('nested locations get breadcrumbs', async () => {
    const loc = await payload.findByID({
      collection: 'locations',
      overrideAccess: true,
      id: boxB,
      depth: 0,
    })
    expect(loc.breadcrumbs?.map((b) => b.label)).toEqual(['B01', 'B01-01'])
  })
})
