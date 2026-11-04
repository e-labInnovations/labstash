import type { EtstoreOrderFile } from '@/importers/etstore'

// ETstore runs on Shopify. A signed-in customer can read their own orders through Shopify's
// Customer Account API with a short-lived key (shcat_…, about an hour) from their browser
// session. The key is passed in for each call and never stored.

const API = 'https://shopify.com/73002320123/account/customer/api/2026-01/graphql'

export class StoreKeyError extends Error {}

export const checkKey = (key: string) => {
  const k = key.trim()
  if (!/^shcat_[A-Za-z0-9._-]{10,}$/.test(k)) {
    throw new StoreKeyError('That doesn’t look like an ETstore key; it starts with shcat_')
  }
  return k
}

const ask = async <T>(key: string, query: string, variables: Record<string, unknown> = {}) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: checkKey(key) },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (res.status === 401 || res.status === 403) {
    throw new StoreKeyError('ETstore didn’t accept the key; it may have expired. Copy a fresh one.')
  }
  if (!res.ok) throw new Error(`ETstore didn’t answer (${res.status}). Try again in a moment.`)
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length || !body.data) {
    throw new Error(`ETstore: ${body.errors?.[0]?.message ?? 'no data'}`)
  }
  return body.data
}

export type StoreOrderSummary = {
  id: string
  number: string
  placedAt: string
  total: number
  paid: string | null
  shipped: string | null
  firstItem: string | null
  items: number
}

/** The customer's most recent orders, newest first. */
export const listEtstoreOrders = async (key: string): Promise<StoreOrderSummary[]> => {
  const data = await ask<{
    customer: {
      orders: {
        nodes: Array<{
          id: string
          name: string
          processedAt: string
          financialStatus: string | null
          fulfillmentStatus: string | null
          totalPrice: { amount: string }
          lineItems: { nodes: Array<{ title: string; quantity: number }> }
        }>
      }
    }
  }>(
    key,
    `query { customer { orders(first: 50, sortKey: PROCESSED_AT, reverse: true) { nodes {
      id name processedAt financialStatus fulfillmentStatus totalPrice { amount }
      lineItems(first: 250) { nodes { title quantity } }
    } } } }`,
  )
  return data.customer.orders.nodes.map((o) => ({
    id: o.id,
    number: o.name,
    placedAt: o.processedAt,
    total: Number(o.totalPrice.amount),
    paid: o.financialStatus,
    shipped: o.fulfillmentStatus,
    firstItem: o.lineItems.nodes[0]?.title ?? null,
    items: o.lineItems.nodes.length,
  }))
}

/** "… ET7489" → ET7489: the store code ends every ETstore title. */
const CODE = /\b(ET[A-Z]?\d{3,})\s*$/i

/**
 * The ET code a title ends with. Some titles drop the "ET" ("… Switches A2031"); when that
 * bare code is the item's own SKU, it is the same product code (A2031 → ETA2031).
 */
export const storeCode = (title: string, sku: string | null) => {
  const full = title.match(CODE)?.[1]?.toUpperCase()
  if (full) return full
  const bare = title.match(/\b([A-Z]?\d{3,})\s*$/i)?.[1]?.toUpperCase()
  return bare && sku && bare === sku.toUpperCase() ? `ET${bare}` : null
}

/** One order, shaped like the order files the importer reads. */
export const fetchEtstoreOrder = async (key: string, id: string): Promise<EtstoreOrderFile> => {
  const data = await ask<{
    order: {
      id: string
      name: string
      processedAt: string
      subtotal: { amount: string } | null
      totalTax: { amount: string } | null
      totalShipping: { amount: string } | null
      totalPrice: { amount: string }
      lineItems: {
        nodes: Array<{
          title: string
          quantity: number
          sku: string | null
          variantId: string | null
          totalPrice: { amount: string } | null
        }>
      }
    } | null
  }>(
    key,
    `query ($id: ID!) { order(id: $id) {
      id name processedAt
      subtotal { amount } totalTax { amount } totalShipping { amount } totalPrice { amount }
      lineItems(first: 250) { nodes { title quantity sku variantId totalPrice { amount } } }
    } }`,
    { id },
  )
  const o = data.order
  if (!o) throw new Error('ETstore couldn’t find that order')
  const amount = (m: { amount: string } | null) => Number(m?.amount ?? 0)
  return {
    store: 'etstore.in',
    order: o.name,
    orderGid: o.id,
    placed: o.processedAt,
    totals: {
      subtotal: amount(o.subtotal),
      tax: amount(o.totalTax),
      shipping: amount(o.totalShipping),
      paid: amount(o.totalPrice),
    },
    items: o.lineItems.nodes.map((l) => ({
      title: l.title,
      etCode: storeCode(l.title, l.sku),
      // The product handle is the variant SKU in lower case (ET7489 sells as G7489 → g7489)
      handle: l.sku ? l.sku.toLowerCase() : null,
      variantGid: l.variantId ?? '',
      quantity: l.quantity,
      lineTotalInr: amount(l.totalPrice),
    })),
  }
}

/**
 * Product photo per store code, best effort: a failure here never blocks an import.
 * Shopify's CDN resizes on request, so photos arrive at a sensible size.
 */
export const etstorePhotos = async (key: string, id: string): Promise<Map<string, string>> => {
  try {
    const data = await ask<{
      order: { lineItems: { nodes: Array<{ title: string; image: { url: string } | null }> } }
    }>(
      key,
      `query ($id: ID!) { order(id: $id) { lineItems(first: 250) { nodes { title image { url } } } } }`,
      {
        id,
      },
    )
    const photos = new Map<string, string>()
    for (const l of data.order.lineItems.nodes) {
      const code = l.title.match(CODE)?.[1]?.toUpperCase()
      if (code && l.image?.url) photos.set(code, l.image.url)
    }
    return photos
  } catch {
    return new Map()
  }
}
