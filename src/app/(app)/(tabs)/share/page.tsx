import React from 'react'

import { INBOX_CODE } from '@/collections/Locations'
import { SharePicker } from '@/components/SharePicker'
import { PageHeader } from '@/components/ui'
import { labelsFor } from '@/lib/labels'
import { topLevelLocations } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Share parts' }

export default async function SharePage() {
  const { payload, user } = await requireSession()
  const [labels, boxes, shared] = await Promise.all([
    labelsFor(payload, user),
    topLevelLocations(payload, user),
    payload.find({
      collection: 'parts',
      where: { shared: { equals: true } },
      pagination: false,
      depth: 0,
      select: { name: true },
      user,
      overrideAccess: false,
    }),
  ])

  return (
    <>
      <PageHeader title="Share parts" back="/locations">
        <p className="mt-1 text-muted">
          Other labs can find shared parts in search and copy their details, photos, datasheet and
          store links. They never see how many you have, where they are, your orders or notes.
        </p>
      </PageHeader>
      <SharePicker
        labels={labels}
        sharedIds={shared.docs.map((p) => p.id)}
        boxes={boxes.map((b) => b.location.code).filter((c) => c !== INBOX_CODE)}
      />
    </>
  )
}
