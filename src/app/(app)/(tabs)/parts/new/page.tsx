import React from 'react'

import { AddPartForm } from '@/components/AddPartForm'
import { PageHeader } from '@/components/ui'
import { allCategories, allLocations, findInbox } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Add part' }

export default async function NewPartPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams
  const { payload, user } = await requireSession()
  const [categories, locations, inbox] = await Promise.all([
    allCategories(payload, user),
    allLocations(payload, user),
    findInbox(payload, user),
  ])

  return (
    <>
      <PageHeader title="Add part" back="/">
        <p className="mt-1 text-muted">For parts you already have, without an order.</p>
      </PageHeader>
      <AddPartForm
        name={name}
        categories={categories}
        locations={locations}
        inboxId={inbox?.id ?? null}
      />
    </>
  )
}
