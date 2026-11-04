import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { receiveLines } from '@/importers/receiveOrder'
import { importOrders } from '@/lib/stores/import'

import { freshPayload, newLab, newUser } from './setup'

const KEY = 'shcat_eyJ0ZXN0.eyJrZXkiOjF9.c2lnbmVk'
const order = (n: number, items: Array<[string, string]>) => ({
  id: `gid://shopify/Order/${n}`,
  name: `#${n}`,
  processedAt: '2026-11-01T10:00:00Z',
  subtotal: { amount: '10' },
  totalTax: { amount: '1' },
  totalShipping: { amount: '0' },
  totalPrice: { amount: '11' },
  lineItems: {
    nodes: items.map(([title, sku], i) => ({
      title,
      quantity: 1,
      sku,
      variantId: `gid://shopify/ProductVariant/${n}${i}`,
      totalPrice: { amount: '5' },
    })),
  },
})
const ORDERS: Record<string, ReturnType<typeof order>> = {
  'gid://shopify/Order/1': order(1, [
    ['Resistor ET9233', 'E9233'],
    ['Switch A2031', 'A2031'],
  ]),
  'gid://shopify/Order/2': order(2, [
    ['Resistor ET9233', 'E9233'],
    ['LED ET1111', 'E1111'],
  ]),
}

let payload: Payload
let admin: Awaited<ReturnType<typeof newUser>>

// Several orders sharing parts, imported and received by the admin in one go: every line must
// link to the order its own transaction just created.
describe('importing then receiving store orders', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        const { query, variables } = JSON.parse(String(init?.body))
        if (query.includes('image'))
          return Response.json({ data: { order: { lineItems: { nodes: [] } } } })
        return Response.json({ data: { order: ORDERS[variables.id] } })
      }),
    )
    admin = await newUser(payload, 'admin@example.com', await newLab(payload, 'Lab'), 'admin')
  })

  it('imports two new orders sharing a part, as the admin', async () => {
    const result = await importOrders(payload, admin, 'etstore', KEY, [
      'gid://shopify/Order/1',
      'gid://shopify/Order/2',
    ])
    expect(result.map((r) => r.status)).toEqual(['imported', 'imported'])
  })

  it('receives an imported order', async () => {
    const purchase = (
      await payload.find({
        collection: 'purchases',
        where: { orderNumber: { equals: '#1' } },
        overrideAccess: true,
      })
    ).docs[0]
    const lines = (
      await payload.find({
        collection: 'purchase-lines',
        where: { purchase: { equals: purchase.id } },
        overrideAccess: true,
      })
    ).docs
    const result = await receiveLines(
      payload,
      purchase.id,
      { [lines[0].id]: 1, [lines[1].id]: 'missing' },
      admin,
    )
    expect(result).toEqual({ received: 1, cancelled: 1 })
  })
})
