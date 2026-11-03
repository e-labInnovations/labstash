import type { Payload } from 'payload'

import { INBOX_CODE } from '@/collections/Locations'
import type { Part, User } from '@/payload-types'

import { formatValue } from './format'
import { type StockChip, withLocations } from './search'

// Pure layout rules for the A4 label sheet, plus the query that feeds it.

/** A4 minus a 10 mm margin all round leaves 190 × 277 mm for the grid. */
export const LABEL_SIZES = {
  s: { cols: 4, rows: 10, name: 'Small', hint: '40 per page, for compartments' },
  m: { cols: 3, rows: 8, name: 'Medium', hint: '24 per page' },
  l: { cols: 2, rows: 6, name: 'Large', hint: '12 per page, for box lids' },
} as const
export type LabelSize = keyof typeof LABEL_SIZES

export const labelSize = (s: string | undefined): LabelSize =>
  s && s in LABEL_SIZES ? (s as LabelSize) : 'm'

/** Splits labels into A4 pages, skipping `offset` cells on the first (a part-used sheet). */
export const toPages = <T>(items: T[], size: LabelSize, offset = 0) => {
  const per = LABEL_SIZES[size].cols * LABEL_SIZES[size].rows
  const skip = Math.max(0, Math.min(per - 1, Math.floor(offset)))
  const cells: Array<T | null> = [...Array<null>(skip).fill(null), ...items]
  const pages: Array<Array<T | null>> = []
  for (let i = 0; i < cells.length; i += per) pages.push(cells.slice(i, i + per))
  return pages
}

export type Label = { id: string; name: string; detail: string; where: string }

/** What a part's label says: its name, value · package, and the boxes it lives in. */
export const labelFor = (
  part: Pick<Part, 'id' | 'name' | 'value' | 'unit' | 'package'>,
  stock: StockChip[],
): Label => ({
  id: part.id,
  name: part.name,
  detail: [formatValue(part.value, part.unit), part.package].filter(Boolean).join(' · '),
  where: stock
    .map((s) => s.code)
    .filter((c) => c !== INBOX_CODE)
    .join(', '),
})

const byWhere = (a: Label, b: Label) => {
  if (!a.where || !b.where) return Number(!a.where) - Number(!b.where)
  return a.where.localeCompare(b.where, undefined, { numeric: true })
}

/** Labels for every part, or for the given ids in the order given. */
export const labelsFor = async (payload: Payload, user: User, ids?: string[]) => {
  if (ids && ids.length === 0) return []
  const { docs } = await payload.find({
    collection: 'parts',
    where: ids ? { id: { in: ids } } : {},
    pagination: false,
    depth: 0,
    joins: false,
    select: { name: true, value: true, unit: true, package: true },
    user,
    overrideAccess: false,
  })
  const labels = (await withLocations(payload, user, docs)).map(({ part, stock }) =>
    labelFor(part, stock),
  )
  // Box by box, compartment by compartment (B01-2 before B01-10); parts in no box last
  if (!ids) return labels.sort((a, b) => byWhere(a, b) || a.name.localeCompare(b.name))
  const byId = new Map(labels.map((l) => [l.id, l]))
  return ids.map((id) => byId.get(id)).filter((l) => l !== undefined)
}
