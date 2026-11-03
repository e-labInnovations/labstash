import React from 'react'

import { LabelPicker } from '@/components/LabelPicker'
import { PageHeader } from '@/components/ui'
import { INBOX_CODE } from '@/collections/Locations'
import { labelsFor } from '@/lib/labels'
import { topLevelLocations } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Labels' }

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string }>
}) {
  const { box } = await searchParams
  const { payload, user } = await requireSession()
  const [labels, boxes] = await Promise.all([
    labelsFor(payload, user),
    topLevelLocations(payload, user),
  ])
  const codes = boxes.map((b) => b.location.code).filter((c) => c !== INBOX_CODE)

  return (
    <>
      <PageHeader title="Print labels" back="/locations">
        <p className="mt-1 text-muted">
          Pick parts, then print or save the A4 sheet as PDF. Cut along the lines and stick each
          label in its compartment; scanning it opens the part.
        </p>
      </PageHeader>
      <LabelPicker
        labels={labels}
        boxes={codes}
        initialBox={box && codes.includes(box) ? box : undefined}
      />
    </>
  )
}
