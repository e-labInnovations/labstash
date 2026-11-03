import Link from 'next/link'
import React from 'react'

import { AddBox } from '@/components/AddBox'
import { Icon } from '@/components/Icon'
import { Empty } from '@/components/ui'
import { nextBoxCode } from '@/lib/boxes'
import { topLevelLocations } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Boxes' }

export default async function LocationsPage() {
  const { payload, user } = await requireSession()
  const locations = await topLevelLocations(payload, user)
  const suggested = nextBoxCode(locations.map((l) => l.location.code))

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight lg:text-[34px]">
          Boxes
        </h1>
        <div className="flex gap-2">
          <Link
            href="/labels"
            className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold"
          >
            <Icon name="print" className="size-5" />
            Labels
          </Link>
          <AddBox suggestedCode={suggested} />
        </div>
      </div>
      {locations.length === 0 ? (
        <Empty>No boxes yet. Use Add box to create one with its compartments.</Empty>
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
