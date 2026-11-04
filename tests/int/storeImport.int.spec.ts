import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { importOrders, listOrders, previewOrders } from '@/lib/stores/import'
import { robuOrderIds } from '@/lib/stores/robu'

import { freshPayload, newLab, newUser } from './setup'

// ETstore import against a stand-in for Shopify's Customer Account API and image CDN.
const KEY = 'shcat_eyJ0ZXN0.eyJrZXkiOjF9.c2lnbmVk' // dotted, like real keys
const ORDER = 'gid://shopify/Order/1001'
const ROBU_KEY = 'eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'

const lines = [
  { title: '10K OHM 0603 SMD RESISTOR 1% ET9233', quantity: 100, sku: 'E9233', price: '42.00' },
  { title: 'AMS1117-3.3 SOT-223 LDO regulator ETA1112', quantity: 5, sku: 'A1112', price: '30.00' },
]

let png: Buffer
const calls: string[] = []

const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  calls.push(url)
  if (url.includes('backend.robu.in')) {
    if (new Headers(init?.headers).get('Authorization') !== `Bearer ${ROBU_KEY}`) {
      return Response.json({ errors: [{ message: 'Unauthenticated.' }] })
    }
    const { variables } = JSON.parse(String(init?.body)) as { variables: { id: number } }
    if (variables.id !== 3790001) {
      return Response.json({
        data: { getOrder: { status: false, code: 404, message: 'Order not found', data: null } },
      })
    }
    return Response.json({
      data: {
        getOrder: {
          status: true,
          code: 200,
          message: 'Order details fetched successfully!',
          data: [
            {
              id: '3790001',
              incrementId: '3790001',
              status: 'in_transit',
              createdAt: '2026-11-02 15:31:16',
              subTotal: 600,
              shippingAmount: 49,
              discountAmount: 0,
              codCharges: 0,
              taxAmount: 0,
              grandTotal: 649,
              items: [
                {
                  id: '1',
                  name: 'Double Side 20*30cm FR4 Copper Clad PCB',
                  sku: 'R264392',
                  slug: 'double-side-fr4-pcb',
                  qtyOrdered: 2,
                  qtyCanceled: 0,
                  qtyRefunded: 0,
                  price: 289,
                  total: 578,
                },
                {
                  id: '2',
                  name: 'Out of stock thing',
                  sku: 'R1',
                  slug: 'thing',
                  qtyOrdered: 1,
                  qtyCanceled: 1,
                  qtyRefunded: 0,
                  price: 22,
                  total: 22,
                },
              ],
            },
          ],
        },
      },
    })
  }
  if (url.includes('cdn.shopify.com')) {
    return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })
  }
  const auth = new Headers(init?.headers).get('Authorization')
  if (auth !== KEY) return new Response('', { status: 401 })
  const { query } = JSON.parse(String(init?.body)) as { query: string }
  if (query.includes('customer')) {
    return Response.json({
      data: {
        customer: {
          orders: {
            nodes: [
              {
                id: ORDER,
                name: '#1001',
                processedAt: '2026-11-01T10:00:00Z',
                financialStatus: 'PAID',
                fulfillmentStatus: 'FULFILLED',
                totalPrice: { amount: '85.00' },
                lineItems: { nodes: lines.map((l) => ({ title: l.title, quantity: l.quantity })) },
              },
            ],
          },
        },
      },
    })
  }
  if (query.includes('image')) {
    return Response.json({
      data: {
        order: {
          lineItems: {
            nodes: lines.map((l) => ({
              title: l.title,
              image: { url: `https://cdn.shopify.com/s/files/${l.sku}.png` },
            })),
          },
        },
      },
    })
  }
  return Response.json({
    data: {
      order: {
        id: ORDER,
        name: '#1001',
        processedAt: '2026-11-01T10:00:00Z',
        subtotal: { amount: '60.00' },
        totalTax: { amount: '10.00' },
        totalShipping: { amount: '15.00' },
        totalPrice: { amount: '85.00' },
        lineItems: {
          nodes: lines.map((l, i) => ({
            title: l.title,
            quantity: l.quantity,
            sku: l.sku,
            variantId: `gid://shopify/ProductVariant/${i + 1}`,
            totalPrice: { amount: l.price },
          })),
        },
      },
    },
  })
}

let payload: Payload
let alice: Awaited<ReturnType<typeof newUser>>
let bob: Awaited<ReturnType<typeof newUser>>

describe('ETstore import', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#335' } })
      .png()
      .toBuffer()
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
    await newUser(payload, 'admin@example.com', await newLab(payload, 'Admin lab'), 'admin')
    alice = await newUser(payload, 'alice@example.com', await newLab(payload, 'Alice’s lab'))
    bob = await newUser(payload, 'bob@example.com', await newLab(payload, 'Bob’s lab'))
  })
  afterAll(() => vi.unstubAllGlobals())

  it('refuses keys that are not ETstore keys, and says when one has expired', async () => {
    await expect(listOrders(payload, alice, 'hello')).rejects.toThrow(/starts with shcat_/)
    await expect(listOrders(payload, alice, 'shcat_expired_key_000000')).rejects.toThrow(/expired/)
  })

  it('lists the account’s orders and previews which parts are new', async () => {
    const orders = await listOrders(payload, alice, KEY)
    expect(orders).toEqual([
      expect.objectContaining({ id: ORDER, number: '#1001', total: 85, items: 2, imported: false }),
    ])
    const [preview] = await previewOrders(payload, alice, 'etstore', KEY, [ORDER])
    expect(preview.lines.map((l) => [l.sku, l.quantity, l.match])).toEqual([
      ['ET9233', 100, null],
      ['ETA1112', 5, null],
    ])
    // Previewing writes nothing
    expect((await payload.count({ collection: 'parts', overrideAccess: true })).totalDocs).toBe(0)
  })

  it('imports into the user’s own lab with photos, once', async () => {
    const [result] = await importOrders(payload, alice, 'etstore', KEY, [ORDER])
    expect(result).toMatchObject({
      number: '#1001',
      status: 'imported',
      partsCreated: 2,
      photos: 2,
    })

    const purchase = await payload.findByID({
      collection: 'purchases',
      id: result.purchaseId,
      depth: 0,
      user: alice,
      overrideAccess: false,
    })
    expect(purchase).toMatchObject({ orderNumber: '#1001', total: 85, status: 'ordered' })
    const { docs: links } = await payload.find({
      collection: 'supplier-parts',
      depth: 0,
      user: alice,
      overrideAccess: false,
    })
    expect(links.map((l) => [l.sku, l.url]).sort()).toEqual([
      ['ET9233', 'https://etstore.in/products/e9233'],
      ['ETA1112', 'https://etstore.in/products/a1112'],
    ])
    expect(calls.some((u) => u.includes('cdn.shopify.com') && u.includes('width=1000'))).toBe(true)

    // Listed as imported now; importing again changes nothing
    expect((await listOrders(payload, alice, KEY))[0].imported).toBe(true)
    expect((await importOrders(payload, alice, 'etstore', KEY, [ORDER]))[0].status).toBe('exists')
    const [again] = await previewOrders(payload, alice, 'etstore', KEY, [ORDER])
    expect(again.lines.every((l) => l.match)).toBe(true)
  })

  it('keeps other labs out of it', async () => {
    // Bob has none of it, and can import the same order into his own lab
    expect((await listOrders(payload, bob, KEY))[0].imported).toBe(false)
    expect(
      (await payload.count({ collection: 'parts', user: bob, overrideAccess: false })).totalDocs,
    ).toBe(0)
    const [result] = await importOrders(payload, bob, 'etstore', KEY, [ORDER])
    expect(result).toMatchObject({ status: 'imported', partsCreated: 2 })
    expect(
      (await payload.count({ collection: 'parts', user: alice, overrideAccess: false })).totalDocs,
    ).toBe(2)
  })

  it('limits how many orders go at once', async () => {
    await expect(previewOrders(payload, alice, 'etstore', KEY, [])).rejects.toThrow(/at least one/)
    await expect(
      importOrders(
        payload,
        alice,
        'etstore',
        KEY,
        Array.from({ length: 11 }, (_, i) => `gid://x/${i}`),
      ),
    ).rejects.toThrow(/up to 10/)
  })

  it('imports Robu orders by number or link, leaving cancelled lines out', async () => {
    expect(
      robuOrderIds('https://robu.in/my-account/view-order/3790001/, #3790002\n3790001 abc 12'),
    ).toEqual(['3790001', '3790002'])

    await expect(previewOrders(payload, alice, 'robu', 'nope', ['3790001'])).rejects.toThrow(/eyJ/)
    await expect(
      previewOrders(payload, alice, 'robu', 'eyJa.eyJb.wrong', ['3790001']),
    ).rejects.toThrow(/didn’t accept/)
    await expect(previewOrders(payload, alice, 'robu', ROBU_KEY, ['3790002'])).rejects.toThrow(
      /couldn’t find order 3790002/,
    )

    const [preview] = await previewOrders(payload, alice, 'robu', `Bearer ${ROBU_KEY}`, ['3790001'])
    expect(preview).toMatchObject({ number: '#3790001', total: 649, imported: false })
    expect(preview.lines.map((l) => [l.sku, l.quantity])).toEqual([['R264392', 2]])
    expect(preview.warnings).toEqual([expect.stringContaining('cancelled')])

    const [result] = await importOrders(payload, alice, 'robu', ROBU_KEY, ['3790001'])
    expect(result).toMatchObject({ status: 'imported', partsCreated: 1, photos: 0 })
    const purchase = await payload.findByID({
      collection: 'purchases',
      id: result.purchaseId,
      depth: 1,
      user: alice,
      overrideAccess: false,
    })
    expect(purchase).toMatchObject({
      orderNumber: '#3790001',
      externalId: 'robu:3790001',
      total: 649,
      shipping: 49,
      orderedAt: '2026-11-02T10:01:16.000Z',
    })
    expect(typeof purchase.supplier === 'object' && purchase.supplier?.name).toBe('Robu')
    const { docs } = await payload.find({
      collection: 'supplier-parts',
      where: { sku: { equals: 'R264392' } },
      depth: 0,
      user: alice,
      overrideAccess: false,
    })
    expect(docs[0].url).toBe('https://robu.in/product/double-side-fr4-pcb/')
    expect((await previewOrders(payload, alice, 'robu', ROBU_KEY, ['3790001']))[0].imported).toBe(
      true,
    )
  })
})
