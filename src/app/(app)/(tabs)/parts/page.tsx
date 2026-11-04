import React from 'react'

import { PartsTable } from '@/components/PartsTable'
import { PageHeader } from '@/components/ui'
import { listParams, listParts } from '@/lib/partList'
import { allCategories } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'All parts' }

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = listParams(await searchParams)
  const { payload, user } = await requireSession()
  const [list, categories] = await Promise.all([
    listParts(payload, user, params),
    allCategories(payload, user),
  ])

  return (
    <>
      <PageHeader title="All parts" back="/" />
      <PartsTable list={list} params={params} categories={categories} />
    </>
  )
}
