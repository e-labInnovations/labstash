import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { STORE_URL, parseEtstoreOrder } from '@/importers/etstore'
import { importOrder } from '@/importers/importOrder'
import { receiveOrder } from '@/importers/receiveOrder'

import { freshPayload } from './setup'

const parsed = parseEtstoreOrder(
  JSON.parse(readFileSync(path.resolve(__dirname, '../fixtures/etstore-order-31860.json'), 'utf8')),
)
const etstore = { name: 'ETstore', website: STORE_URL, importer: 'etstore' as const }

let payload: Payload

const partBySku = async (sku: string) => {
  const { docs } = await payload.find({
    collection: 'supplier-parts',
    overrideAccess: true,
    where: { sku: { equals: sku } },
    depth: 0,
  })
  return payload.findByID({
    collection: 'parts',
    overrideAccess: true,
    id: docs[0].part as string,
    depth: 1,
  })
}

describe('ETstore import + receive (order #31860)', () => {
  beforeAll(async () => {
    payload = await freshPayload()
  })

  it('imports every line as ordered, with no stock yet', async () => {
    const result = await importOrder(payload, parsed, etstore)
    expect(result).toMatchObject({ status: 'imported', partsCreated: 72, partsMatched: 0 })

    expect(await payload.count({ collection: 'parts', overrideAccess: true })).toEqual({
      totalDocs: 72,
    })
    expect(await payload.count({ collection: 'purchase-lines', overrideAccess: true })).toEqual({
      totalDocs: 72,
    })
    expect(await payload.count({ collection: 'stock', overrideAccess: true })).toEqual({
      totalDocs: 0,
    })

    const purchase = await payload.findByID({
      collection: 'purchases',
      overrideAccess: true,
      id: result.purchaseId,
      depth: 0,
    })
    expect(purchase).toMatchObject({ orderNumber: '#31860', status: 'ordered', total: 1706.26 })
  })

  it('stores parsed attributes and a nested category', async () => {
    const r = await partBySku('ET9233')
    expect(r).toMatchObject({
      name: '4.7K OHM 0603 SMD RESISTOR 1/16W 4K7 472 5%',
      package: '0603',
      value: 4700,
      unit: 'Ω',
    })
    expect(typeof r.category === 'object' && r.category?.breadcrumbs?.map((b) => b.label)).toEqual([
      'Passives',
      'Resistors',
    ])
  })

  it('re-importing the same order is a no-op', async () => {
    expect((await importOrder(payload, parsed, etstore)).status).toBe('exists')
    expect(await payload.count({ collection: 'parts', overrideAccess: true })).toEqual({
      totalDocs: 72,
    })
  })

  it('a new order reuses parts already bought by sku', async () => {
    const reorder = {
      ...parsed,
      order: { ...parsed.order, orderNumber: '#99999', externalId: 'gid://shopify/Order/1' },
      lines: parsed.lines.slice(0, 3),
    }
    expect(await importOrder(payload, reorder, etstore)).toMatchObject({
      partsCreated: 0,
      partsMatched: 3,
    })
  })

  it('rejects receive options naming skus that are not on the order', async () => {
    await expect(receiveOrder(payload, '#31860', { except: ['ET0000'] })).rejects.toThrow(
      /Not on this order: ET0000/,
    )
    expect(await payload.count({ collection: 'stock-movements', overrideAccess: true })).toEqual({
      totalDocs: 0,
    })
  })

  it('receives into INBOX, cancelling missing lines and booking short ones', async () => {
    const result = await receiveOrder(payload, '#31860', {
      except: ['ET8068'],
      short: { ET7246: 1 },
    })
    expect(result.cancelled).toEqual(['ET8068'])
    expect(result.received).toHaveLength(71)
    expect(result.received.reduce((s, r) => s + r.quantity, 0)).toBe(1188 - 1 - 1)

    const battery = await partBySku('ET7246')
    expect(battery.totalQuantity).toBe(1)

    const { docs } = await payload.find({
      collection: 'purchases',
      overrideAccess: true,
      where: { orderNumber: { equals: '#31860' } },
    })
    expect(docs[0].status).toBe('partial') // the battery line is still 1 short
  })

  it('receiving the rest completes the purchase and skips finished lines', async () => {
    const result = await receiveOrder(payload, '#31860')
    expect(result.received).toEqual([{ sku: 'ET7246', quantity: 1 }])
    const { docs } = await payload.find({
      collection: 'purchases',
      overrideAccess: true,
      where: { orderNumber: { equals: '#31860' } },
    })
    expect(docs[0].status).toBe('received')
  })
})
