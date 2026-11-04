import React from 'react'

import { Empty, PageHeader, PartRow } from '@/components/ui'
import { lowStockParts } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Running low' }

export default async function LowStockPage() {
  const { payload, user } = await requireSession()
  const parts = await lowStockParts(payload, user)

  return (
    <>
      <PageHeader title="Running low" back="/">
        <p className="mt-1 text-muted">Parts at or below their reorder level.</p>
      </PageHeader>
      {parts.length === 0 ? (
        <Empty>Nothing is running low. To track a part, edit it and set Reorder at.</Empty>
      ) : (
        <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
          {parts.map((part) => {
            const source = part.sources.find((s) => s.url)
            return (
              <PartRow
                key={part.id}
                part={part}
                trailing={
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[22px] leading-none font-semibold text-enig">
                      {part.totalQuantity ?? 0}
                      <span className="text-[15px] font-medium text-muted"> / {part.minStock}</span>
                    </span>
                    {source?.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[15px] font-semibold text-mask"
                      >
                        {source.supplier}
                      </a>
                    )}
                  </div>
                }
              />
            )
          })}
        </ul>
      )}
    </>
  )
}
