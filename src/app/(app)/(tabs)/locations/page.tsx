import Link from 'next/link'
import React from 'react'

import { Empty, PageHeader } from '@/components/ui'
import { topLevelLocations } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Boxes' }

export default async function LocationsPage() {
  const { payload, user } = await requireSession()
  const locations = await topLevelLocations(payload, user)

  return (
    <>
      <PageHeader title="Boxes" />
      {locations.length === 0 ? (
        <Empty>
          No boxes yet. Add them in the{' '}
          <Link
            href="/admin/collections/locations/create"
            className="font-semibold text-mask underline underline-offset-4"
          >
            admin
          </Link>
          , with compartments as children.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-3">
          {locations.map(({ location, children }) => (
            <li key={location.id}>
              <Link
                href={`/l/${encodeURIComponent(location.code)}`}
                className="block rounded-2xl border border-line bg-raised px-4 py-3.5"
              >
                <span className="block text-[21px] font-semibold text-mask">{location.code}</span>
                <span className="block truncate text-[15px] text-muted">
                  {location.name ?? (children ? `${children} compartments` : location.kind)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
