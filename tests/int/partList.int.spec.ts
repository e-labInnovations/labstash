import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createBox } from '@/lib/boxes'
import { setShared } from '@/lib/catalog'
import { listParams, listParts } from '@/lib/partList'
import { createPart } from '@/lib/parts'

import { freshPayload, newLab, newUser } from './setup'

// All parts: filtered, sorted and paged by the database, inside the user's own lab.
let payload: Payload
let me: Awaited<ReturnType<typeof newUser>>
let category: string
let boxCell: string
const ids: Record<string, string> = {}

const list = (raw: Record<string, string> = {}) => listParts(payload, me, listParams(raw))

describe('All parts list', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    me = await newUser(payload, 'me@example.com', await newLab(payload, 'My lab'))
    const other = await newUser(payload, 'other@example.com', await newLab(payload, 'Other lab'))
    category = (
      await payload.create({
        collection: 'categories',
        data: { name: 'Resistors' },
        overrideAccess: true,
      })
    ).id
    await createBox(payload, me, { code: 'B07', columns: 2, compartments: 2 })
    boxCell = (
      await payload.find({
        collection: 'locations',
        where: { code: { equals: 'B07-01' } },
        user: me,
        overrideAccess: false,
      })
    ).docs[0].id

    // 25 numbered resistors in INBOX, plus a few distinctive parts
    for (let i = 1; i <= 25; i++) {
      await createPart(payload, me, {
        name: `Resistor ${String(i).padStart(2, '0')} 0603`,
        quantity: 1,
        category,
      })
    }
    ids.tenK = (
      await createPart(payload, me, {
        name: '10K OHM 0805 resistor',
        quantity: 40,
        location: boxCell,
        category,
      })
    ).id
    ids.empty = (await createPart(payload, me, { name: 'Empty drawer part', quantity: 0 })).id
    ids.low = (
      await createPart(payload, me, {
        name: 'Low LED',
        quantity: 2,
        minStock: 5,
        location: boxCell,
      })
    ).id
    await setShared(payload, me, [ids.low], true)
    // Someone else's part with a matching name never shows up
    await createPart(payload, other, { name: '10K OHM 0805 resistor', quantity: 99 })
  })

  it('reads its settings from the address, ignoring nonsense', () => {
    expect(listParams({})).toEqual({
      q: '',
      category: '',
      show: 'all',
      sort: 'name',
      page: 1,
      limit: 50,
    })
    expect(
      listParams({ show: 'secret', sort: 'drop table', page: '-3', limit: '7' }),
    ).toMatchObject({
      show: 'all',
      sort: 'name',
      page: 1,
      limit: 50,
    })
    expect(listParams({ limit: '20', page: '2' })).toMatchObject({ limit: 20, page: 2 })
  })

  it('pages through the whole lab, counting pieces across every page', async () => {
    const first = await list({ limit: '20' })
    expect(first).toMatchObject({ total: 28, pages: 2, page: 1, pcs: 25 + 40 + 2 })
    expect(first.rows).toHaveLength(20)
    const second = await list({ limit: '20', page: '2' })
    expect(second.rows).toHaveLength(8)
    const seen = new Set([...first.rows, ...second.rows].map((r) => r.part.id))
    expect(seen.size).toBe(28)
  })

  it('filters by text, value, box code, category and state', async () => {
    expect((await list({ q: '10k' })).rows.map((r) => r.part.id)).toEqual([ids.tenK])
    // a box code finds what is kept there
    expect((await list({ q: 'b07' })).rows.map((r) => r.part.id).sort()).toEqual(
      [ids.tenK, ids.low].sort(),
    )
    expect((await list({ category })).total).toBe(26)
    expect((await list({ show: 'low' })).rows.map((r) => r.part.id)).toEqual([ids.low])
    expect((await list({ show: 'out' })).rows.map((r) => r.part.id)).toEqual([ids.empty])
    expect((await list({ show: 'shared' })).rows.map((r) => r.part.id)).toEqual([ids.low])
    expect((await list({ show: 'inbox' })).total).toBe(25)
    expect((await list({ q: 'nothing like this' })).total).toBe(0)
  })

  it('sorts in the database, and keeps rows ready to show', async () => {
    const most = await list({ sort: 'most', limit: '20' })
    expect(most.rows[0].part.id).toBe(ids.tenK)
    const least = await list({ sort: 'least', limit: '20' })
    expect(least.rows[0].part.id).toBe(ids.empty)

    const tenK = (await list({ q: '10k' })).rows[0]
    expect(tenK).toMatchObject({
      valueText: '10 kΩ',
      category: 'Resistors',
      stock: [expect.objectContaining({ code: 'B07-01', quantity: 40 })],
    })
  })
})
