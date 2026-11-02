import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload, PayloadRequest } from 'payload'

import { ensureDevUser } from '../dev/devUser'
import { STORE_URL, parseEtstoreOrder } from '../importers/etstore'
import { importOrder, withTransaction } from '../importers/importOrder'
import { ensureInbox, receiveOrder } from '../importers/receiveOrder'

// Demo stash built from the real order #31860: boxes, compartments, parts put away,
// a few left in the INBOX, reorder levels and some usage history.

const ORDER_FILE = path.resolve(process.cwd(), 'tests/fixtures/etstore-order-31860.json')

type Box = {
  code: string
  name: string
  columns: number
  compartments: number
  takes: string[]
  /** Cheap passives: counts are rough */
  approximate?: boolean
}

// Category (leaf name) → box. Order matters: first box whose list has the category wins.
const BOXES: Box[] = [
  {
    code: 'B01',
    name: 'Resistors',
    columns: 6,
    compartments: 30,
    takes: ['Resistors'],
    approximate: true,
  },
  {
    code: 'B02',
    name: 'Capacitors & LEDs',
    columns: 4,
    compartments: 16,
    takes: ['Capacitors', 'LEDs'],
    approximate: true,
  },
  {
    code: 'B03',
    name: 'Discretes',
    columns: 6,
    compartments: 24,
    takes: ['Diodes', 'Transistors', 'Sensors'],
  },
  {
    code: 'B04',
    name: 'ICs & boards',
    columns: 4,
    compartments: 12,
    takes: ['Microcontrollers', 'Voltage regulators', 'Op-amps', 'Breakout PCBs'],
  },
  {
    code: 'B05',
    name: 'Connectors & switches',
    columns: 4,
    compartments: 12,
    takes: ['Connectors', 'Switches', 'Fuse holders'],
  },
]
const DRAWER = { code: 'DRAWER-1', name: 'Bottom drawer: batteries, modules, tools' }

// Left in INBOX so the put-away flow has something to show
const LEAVE_IN_INBOX = ['ET6008', 'ETA1970', 'ETD11117']

const MIN_STOCK: Record<string, number> = { ET7879: 3, ET5786: 3, ET9232: 20, ETA1841: 4 }

// sku → pieces taken, for history and to push a couple of parts below their reorder level
const USED: Record<string, number> = { ET7879: 1, ETA1841: 2, ET9232: 5, ET9251: 6 }

export const SEED_MARKER = BOXES[0].code

export type SeedResult =
  | { status: 'skipped' }
  | { status: 'seeded'; boxes: number; putAway: number; inInbox: number }

export const seed = async (payload: Payload): Promise<SeedResult> => {
  const marker = await payload.count({
    collection: 'locations',
    overrideAccess: true,
    where: { code: { equals: SEED_MARKER } },
  })
  if (marker.totalDocs > 0) return { status: 'skipped' }

  await ensureDevUser(payload, { force: true })

  const parsed = parseEtstoreOrder(JSON.parse(readFileSync(ORDER_FILE, 'utf8')))
  await importOrder(payload, parsed, { name: 'ETstore', website: STORE_URL, importer: 'etstore' })

  // Only receive what is still outstanding (a re-run after a partial receive is fine)
  const { docs: purchases } = await payload.find({
    collection: 'purchases',
    overrideAccess: true,
    where: { externalId: { equals: parsed.order.externalId } },
    depth: 0,
  })
  if (purchases[0]?.status === 'ordered') {
    await receiveOrder(payload, parsed.order.orderNumber, {
      except: ['ET8068'],
      short: { ET7246: 1 },
    })
  }

  return withTransaction(payload, async (req) => {
    const inbox = await ensureInbox(req)
    const boxCells = new Map<string, string[]>()
    for (const box of BOXES) boxCells.set(box.code, await createBox(box, req))
    const drawer = await create(req, 'locations', {
      code: DRAWER.code,
      name: DRAWER.name,
      kind: 'other',
    })

    const { docs: inboxRows } = await req.payload.find({
      collection: 'stock',
      overrideAccess: true,
      where: { location: { equals: inbox } },
      pagination: false,
      depth: 2,
      req,
    })

    const skuOf = await skuLookup(req)
    const nextCell = new Map<string, number>()
    let putAway = 0

    // Stable order: by category, then name, so neighbouring compartments hold related parts
    const rows = inboxRows
      .map((row) => {
        const part = row.part as {
          id: string
          name: string
          category?: { name: string } | string | null
        }
        const category =
          typeof part.category === 'object' && part.category ? part.category.name : ''
        return { row, part, category, sku: skuOf.get(part.id) ?? '' }
      })
      .sort(
        (a, b) => a.category.localeCompare(b.category) || a.part.name.localeCompare(b.part.name),
      )

    for (const { row, part, category, sku } of rows) {
      if (LEAVE_IN_INBOX.includes(sku)) continue
      const box = BOXES.find((b) => b.takes.includes(category))
      // One part per compartment; a full box overflows into the drawer
      const i = box ? (nextCell.get(box.code) ?? 0) : 0
      const cell = box ? boxCells.get(box.code)![i] : undefined
      const to = cell ?? drawer
      if (box) nextCell.set(box.code, i + 1)
      await move(req, { type: 'move', part: part.id, quantity: row.quantity, from: inbox, to })
      if (cell && box?.approximate) await markApproximate(req, part.id, to)
      putAway++
    }

    for (const [sku, minStock] of Object.entries(MIN_STOCK)) {
      const partId = [...skuOf].find(([, s]) => s === sku)?.[0]
      if (partId) {
        await req.payload.update({
          collection: 'parts',
          overrideAccess: true,
          id: partId,
          data: { minStock },
          req,
        })
      }
    }

    for (const [sku, quantity] of Object.entries(USED)) {
      const partId = [...skuOf].find(([, s]) => s === sku)?.[0]
      if (!partId) continue
      const { docs } = await req.payload.find({
        collection: 'stock',
        overrideAccess: true,
        where: { part: { equals: partId } },
        limit: 1,
        depth: 0,
        req,
      })
      if (docs[0]) {
        await move(req, {
          type: 'use',
          part: partId,
          quantity,
          from: docs[0].location as string,
          note: 'CH32V003 blinky board',
        })
      }
    }

    return {
      status: 'seeded' as const,
      boxes: BOXES.length,
      putAway,
      inInbox: rows.length - putAway,
    }
  })
}

const create = async (
  req: PayloadRequest,
  collection: 'locations',
  data: Record<string, unknown>,
) => (await req.payload.create({ collection, overrideAccess: true, data: data as never, req })).id

const createBox = async (box: Box, req: PayloadRequest) => {
  const id = await create(req, 'locations', {
    code: box.code,
    name: box.name,
    kind: 'box',
    columns: box.columns,
  })
  const cells: string[] = []
  for (let n = 1; n <= box.compartments; n++) {
    cells.push(
      await create(req, 'locations', {
        code: `${box.code}-${String(n).padStart(2, '0')}`,
        kind: 'compartment',
        parent: id,
      }),
    )
  }
  return cells
}

const move = (
  req: PayloadRequest,
  data: {
    type: 'move' | 'use'
    part: string
    quantity: number
    from: string
    to?: string
    note?: string
  },
) =>
  req.payload.create({
    collection: 'stock-movements',
    overrideAccess: true,
    data: { ...data, occurredAt: new Date().toISOString() },
    req,
  })

const markApproximate = async (req: PayloadRequest, part: string, location: string) => {
  const { docs } = await req.payload.find({
    collection: 'stock',
    overrideAccess: true,
    where: { and: [{ part: { equals: part } }, { location: { equals: location } }] },
    limit: 1,
    depth: 0,
    req,
  })
  if (docs[0]) {
    await req.payload.update({
      collection: 'stock',
      overrideAccess: true,
      id: docs[0].id,
      data: { approximate: true },
      req,
    })
  }
}

/** part id → store sku */
const skuLookup = async (req: PayloadRequest) => {
  const { docs } = await req.payload.find({
    collection: 'supplier-parts',
    overrideAccess: true,
    pagination: false,
    depth: 0,
    req,
  })
  return new Map(docs.map((d) => [d.part as string, d.sku]))
}

/** Seeding is for local databases only. */
export const assertLocalDatabase = (url = process.env.DATABASE_URL ?? '') => {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {}
  if (!['localhost', '127.0.0.1', '::1', 'database'].includes(host)) {
    throw new Error(`Refusing to seed a non-local database (host "${host || 'unknown'}")`)
  }
}
