import React from 'react'

import { StoreImport } from '@/components/StoreImport'
import { PageHeader } from '@/components/ui'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Import orders' }

export default async function ImportOrdersPage() {
  await requireSession()
  return (
    <>
      <PageHeader title="Import orders" back="/orders">
        <p className="mt-1 text-muted">
          Bring in orders from a store, with their parts, prices and store links. They arrive as
          open orders you receive into the Inbox.
        </p>
      </PageHeader>
      <StoreImport />
    </>
  )
}
