import { notFound } from 'next/navigation'
import React from 'react'

import { EditPartForm } from '@/components/EditPartForm'
import { PageHeader } from '@/components/ui'
import { formatValue } from '@/lib/format'
import { allCategories } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Edit part' }

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user } = await requireSession()
  const [part, categories] = await Promise.all([
    payload
      .findByID({ collection: 'parts', id, depth: 0, joins: false, user, overrideAccess: false })
      .catch(() => null),
    allCategories(payload, user),
  ])
  if (!part) notFound()

  return (
    <>
      <PageHeader title="Edit part" back={`/parts/${id}`} />
      <EditPartForm
        categories={categories}
        part={{
          id: part.id,
          name: part.name,
          value: formatValue(part.value, part.unit) ?? '',
          package: part.package ?? '',
          mpn: part.mpn ?? '',
          manufacturer: part.manufacturer ?? '',
          category: typeof part.category === 'string' ? part.category : (part.category?.id ?? ''),
          minStock: part.minStock == null ? '' : String(part.minStock),
          notes: part.notes ?? '',
          kicadSymbol: part.kicadSymbol ?? '',
          kicadFootprint: part.kicadFootprint ?? '',
        }}
      />
    </>
  )
}
