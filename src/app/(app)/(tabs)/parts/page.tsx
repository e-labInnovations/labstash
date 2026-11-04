import React from 'react'

import { type PartListRow, PartsTable } from '@/components/PartsTable'
import { PageHeader } from '@/components/ui'
import { formatValue } from '@/lib/format'
import { allCategories } from '@/lib/queries'
import { withLocations } from '@/lib/search'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'All parts' }

export default async function PartsPage() {
  const { payload, user } = await requireSession()
  const [{ docs }, categories] = await Promise.all([
    payload.find({
      collection: 'parts',
      pagination: false,
      sort: 'name',
      depth: 0,
      joins: false,
      select: {
        name: true,
        mpn: true,
        value: true,
        unit: true,
        package: true,
        category: true,
        totalQuantity: true,
        lowStock: true,
        shared: true,
        createdAt: true,
      },
      user,
      overrideAccess: false,
    }),
    allCategories(payload, user),
  ])
  const categoryLabel = new Map(categories.map((c) => [c.id, c.label]))
  const rows: PartListRow[] = (await withLocations(payload, user, docs)).map(
    ({ part, stock, thumb }) => {
      const categoryId = typeof part.category === 'object' ? part.category?.id : part.category
      return {
        part: {
          id: part.id,
          name: part.name,
          value: part.value ?? null,
          unit: part.unit ?? null,
          package: part.package ?? null,
          totalQuantity: part.totalQuantity ?? 0,
          lowStock: Boolean(part.lowStock),
        },
        mpn: part.mpn ?? null,
        valueText: formatValue(part.value, part.unit) ?? '',
        category: categoryId ? (categoryLabel.get(categoryId) ?? null) : null,
        shared: Boolean(part.shared),
        createdAt: part.createdAt,
        stock,
        thumb,
      }
    },
  )

  return (
    <>
      <PageHeader title="All parts" back="/" />
      <PartsTable
        rows={rows}
        categories={categories.filter((c) => rows.some((r) => r.category === c.label))}
      />
    </>
  )
}
