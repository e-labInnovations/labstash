import React from 'react'

import { AddPartForm } from '@/components/AddPartForm'
import { PageHeader } from '@/components/ui'
import { catalogPart } from '@/lib/catalog'
import { allCategories, allLocations, findInbox } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Add part' }

export default async function NewPartPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; from?: string }>
}) {
  const { name, from } = await searchParams
  const { payload, user } = await requireSession()
  const [categories, locations, inbox, shared] = await Promise.all([
    allCategories(payload, user),
    allLocations(payload, user),
    findInbox(payload, user),
    from ? catalogPart(payload, user, from) : null,
  ])

  return (
    <>
      <PageHeader title="Add part" back="/">
        <p className="mt-1 text-muted">
          {shared
            ? 'Copying a shared part: its details, photos, datasheet and store links come along.'
            : 'For parts you already have, without an order.'}
        </p>
      </PageHeader>
      <AddPartForm
        name={shared?.part.name ?? name}
        copy={
          shared
            ? {
                from: shared.part.id,
                package: shared.part.package ?? '',
                mpn: shared.part.mpn ?? '',
                category: shared.category?.id ?? '',
                thumb: shared.photos[0]?.thumb ?? null,
              }
            : undefined
        }
        categories={categories}
        locations={locations}
        inboxId={inbox?.id ?? null}
      />
    </>
  )
}
