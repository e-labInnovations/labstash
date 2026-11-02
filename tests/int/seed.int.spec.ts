import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { assertLocalDatabase, seed } from '@/seed'

import { freshPayload } from './setup'

let payload: Payload

describe('seed', () => {
  beforeAll(async () => {
    payload = await freshPayload()
  })

  it('builds boxes, puts parts away and leaves a few in INBOX', async () => {
    const result = await seed(payload)
    expect(result).toEqual({ status: 'seeded', boxes: 5, putAway: 68, inInbox: 3 })

    // 5 boxes + 94 compartments + drawer + INBOX
    expect(await payload.count({ collection: 'locations', overrideAccess: true })).toEqual({
      totalDocs: 101,
    })

    const low = await payload.find({
      collection: 'parts',
      overrideAccess: true,
      where: { lowStock: { equals: true } },
      depth: 0,
    })
    expect(low.docs.map((p) => p.name).sort()).toEqual([
      expect.stringContaining('CH32V003J4M6 SOP8'),
      expect.stringContaining('TP4056'),
      expect.stringContaining('WS2812'),
    ])
  })

  it('puts one part per compartment', async () => {
    const { docs } = await payload.find({
      collection: 'stock',
      overrideAccess: true,
      pagination: false,
      depth: 1,
      populate: { locations: { kind: true } },
    })
    const perCompartment = new Map<string, number>()
    for (const row of docs) {
      const loc = row.location as { id: string; kind: string }
      if (loc.kind === 'compartment')
        perCompartment.set(loc.id, (perCompartment.get(loc.id) ?? 0) + 1)
    }
    expect(Math.max(...perCompartment.values())).toBe(1)
  })

  it('is a no-op the second time', async () => {
    expect(await seed(payload)).toEqual({ status: 'skipped' })
  })

  it('only seeds local databases', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1:5432/x')).not.toThrow()
    expect(() => assertLocalDatabase('postgresql://u:p@ep-cool.neon.tech/x')).toThrow(/non-local/)
  })
})
