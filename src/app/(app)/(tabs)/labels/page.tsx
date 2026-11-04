import Link from 'next/link'
import React from 'react'

import { LabelPicker } from '@/components/LabelPicker'
import { PageHeader } from '@/components/ui'
import { INBOX_CODE } from '@/collections/Locations'
import { boxLabelsFor, labelsFor } from '@/lib/labels'
import { topLevelLocations } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Labels' }

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; for?: string }>
}) {
  const { box, for: what } = await searchParams
  const forBoxes = what === 'boxes'
  const { payload, user } = await requireSession()
  const [labels, boxes] = await Promise.all([
    forBoxes ? boxLabelsFor(payload, user) : labelsFor(payload, user),
    topLevelLocations(payload, user),
  ])
  const codes = boxes.map((b) => b.location.code).filter((c) => c !== INBOX_CODE)

  return (
    <>
      <PageHeader title="Print labels" back="/locations">
        <p className="mt-1 text-muted">
          {forBoxes
            ? 'Pick boxes and compartments, then print or save the A4 sheet as PDF. Stick each label on its box; scanning it opens the box.'
            : 'Pick parts, then print or save the A4 sheet as PDF. Cut along the lines and stick each label in its compartment; scanning it opens the part.'}
        </p>
        <div className="mt-3 flex gap-1 rounded-xl border border-line p-1 lg:max-w-xs">
          {[
            ['Parts', false],
            ['Boxes', true],
          ].map(([name, boxTab]) => (
            <Link
              key={String(name)}
              href={`/labels${boxTab ? '?for=boxes' : ''}`}
              replace
              aria-current={boxTab === forBoxes ? 'page' : undefined}
              className={`flex h-10 flex-1 items-center justify-center rounded-lg font-semibold ${
                boxTab === forBoxes ? 'bg-mask-soft text-mask' : 'text-muted'
              }`}
            >
              {name}
            </Link>
          ))}
        </div>
      </PageHeader>
      <LabelPicker
        key={forBoxes ? 'boxes' : 'parts'}
        param={forBoxes ? 'boxes' : 'ids'}
        labels={labels}
        boxes={codes}
        initialBox={box && codes.includes(box) ? box : undefined}
      />
    </>
  )
}
