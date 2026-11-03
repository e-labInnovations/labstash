import React from 'react'

import { BulkPutAway } from '@/components/BulkPutAway'
import { PutAway } from '@/components/PutAway'
import { Empty, PageHeader, PartRow } from '@/components/ui'
import { allLocations, locationContents } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import { INBOX_CODE } from '@/collections/Locations'

export const metadata = { title: 'Inbox' }

export default async function InboxPage() {
  const { payload, user } = await requireSession()
  const [inbox, locations] = await Promise.all([
    locationContents(payload, user, INBOX_CODE),
    allLocations(payload, user),
  ])
  const rows = inbox?.here ?? []
  const pcs = rows.reduce((s, r) => s + r.quantity, 0)

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Inbox">
          <p className="mt-1 text-muted">
            {rows.length
              ? `${rows.length} ${rows.length === 1 ? 'part' : 'parts'}, ${pcs} pcs received and not yet in a box.`
              : 'Received parts wait here until you put them away.'}
          </p>
        </PageHeader>
        {inbox && (
          <BulkPutAway
            inboxId={inbox.location.id}
            locations={locations}
            items={rows.map((r) => ({
              partId: r.part.id,
              name: r.part.name,
              quantity: r.quantity,
            }))}
          />
        )}
      </div>
      {rows.length === 0 || !inbox ? (
        <Empty>Inbox is empty. Receive an order to fill it.</Empty>
      ) : (
        <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
          {rows.map((row) => (
            <PartRow
              key={row.id}
              part={row.part}
              trailing={
                <div className="flex items-center gap-3">
                  <span className="text-[20px] font-semibold">{row.quantity}</span>
                  <PutAway
                    partId={row.part.id}
                    partName={row.part.name}
                    inboxId={inbox.location.id}
                    quantity={row.quantity}
                    locations={locations}
                  />
                </div>
              }
            />
          ))}
        </ul>
      )}
    </>
  )
}
