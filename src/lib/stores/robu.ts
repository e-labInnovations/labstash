import {
  type ParsedOrder,
  cleanTitle,
  guessCategory,
  guessPackage,
  guessValue,
} from '@/importers/etstore'

import { StoreKeyError } from './etstore'

// robu.in: its own My Account pages read an order with getOrder(id) on its GraphQL API, using
// the customer's login token. We ask for the same order, minus the addresses we have no use
// for. The token is passed in for each call and never stored.

const API = 'https://backend.robu.in/graphql'
export const ROBU_URL = 'https://robu.in'

/** Accepts the token as copied: with or without "Bearer ", or the userAccessToken cookie value. */
export const checkRobuKey = (key: string) => {
  const k = key.trim().replace(/^Bearer\s+/i, '')
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k)) {
    throw new StoreKeyError('That doesn’t look like a Robu login token; it starts with eyJ')
  }
  return k
}

/**
 * Robu order numbers from what was pasted: numbers, or links like
 * robu.in/my-account/view-order/3792996/, separated by spaces, commas or new lines.
 */
export const robuOrderIds = (text: string) => {
  const ids = text
    .split(/[\s,]+/)
    .map((t) => t.match(/view-order\/(\d+)/)?.[1] ?? t.replace(/^#/, ''))
    .filter((t) => /^\d{4,}$/.test(t))
  return [...new Set(ids)]
}

type RobuOrder = {
  id: string
  incrementId: string
  status: string
  createdAt: string
  subTotal: number
  shippingAmount: number
  discountAmount: number
  codCharges: number
  taxAmount: number
  grandTotal: number
  items: Array<{
    id: string
    name: string
    sku: string
    slug: string | null
    qtyOrdered: number
    qtyCanceled: number
    qtyRefunded: number
    price: number
    total: number
  }>
}

const QUERY = `query GetOrder($id: Int!) { getOrder(id: $id) { status code message data {
  id incrementId status createdAt subTotal shippingAmount discountAmount codCharges taxAmount
  grandTotal items { id name sku slug qtyOrdered qtyCanceled qtyRefunded price total }
} } }`

const fetchRaw = async (key: string, id: string): Promise<RobuOrder> => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${checkRobuKey(key)}` },
    body: JSON.stringify({
      operationName: 'GetOrder',
      query: QUERY,
      variables: { id: Number(id) },
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Robu didn’t answer (${res.status}). Try again in a moment.`)
  const body = (await res.json()) as {
    data?: {
      getOrder: { status: boolean; message: string | null; data: RobuOrder[] | null } | null
    }
    errors?: Array<{ message: string }>
  }
  const error = body.errors?.[0]?.message
  if (error && /unauth/i.test(error)) {
    throw new StoreKeyError('Robu didn’t accept the token; sign in at robu.in and copy it again.')
  }
  const order = body.data?.getOrder
  if (error || !order?.status || !order.data?.[0]) {
    throw new Error(`Robu couldn’t find order ${id}${order?.message ? `: ${order.message}` : ''}`)
  }
  return order.data[0]
}

/** Robu's dates are Indian time without a zone. */
const istToIso = (s: string) => new Date(`${s.replace(' ', 'T')}+05:30`).toISOString()

/** One Robu order as purchase lines; cancelled quantities are left out. */
export const fetchRobuOrder = async (key: string, id: string): Promise<ParsedOrder> => {
  const o = await fetchRaw(key, id)
  const warnings: string[] = []
  const lines = o.items.flatMap((item) => {
    const quantity = item.qtyOrdered - item.qtyCanceled
    if (quantity <= 0) {
      warnings.push(`“${item.name}” was cancelled — left out`)
      return []
    }
    const value = guessValue(item.name)
    return [
      {
        sku: item.sku,
        title: item.name,
        name: cleanTitle(item.name, null),
        handle: item.slug,
        variantId: item.id,
        url: item.slug ? `${ROBU_URL}/product/${item.slug}/` : null,
        quantity,
        lineTotal: item.total,
        package: guessPackage(item.name),
        value: value?.value ?? null,
        unit: value?.unit ?? null,
        category: guessCategory(item.name),
      },
    ]
  })
  return {
    order: {
      orderNumber: `#${o.incrementId}`,
      externalId: `robu:${o.id}`,
      orderedAt: istToIso(o.createdAt),
      subtotal: o.subTotal,
      tax: o.taxAmount,
      shipping: o.shippingAmount + o.codCharges,
      total: o.grandTotal,
    },
    lines,
    warnings,
  }
}
