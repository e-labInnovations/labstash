import React from 'react'

import { Empty, PartRow, SearchBar } from '@/components/ui'
import { searchParts } from '@/lib/search'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Search' }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const { payload, user } = await requireSession()
  const results = q.trim() ? await searchParts(payload, user, q) : []

  return (
    <>
      <SearchBar defaultValue={q} autoFocus={!q} />
      <div className="mt-4">
        {!q.trim() ? (
          <p className="text-muted">
            Search by name, part number, value or package. “10k 0603” finds 10 kΩ resistors in 0603.
          </p>
        ) : results.length === 0 ? (
          <Empty>Nothing matches “{q}”. Try fewer words, or just the value like “100nF”.</Empty>
        ) : (
          <>
            <p className="mb-1 text-[15px] text-muted">
              {results.length === 50
                ? 'First 50 matches'
                : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
            </p>
            <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
              {results.map(({ part, stock, thumb }) => (
                <PartRow key={part.id} part={part} stock={stock} thumb={thumb} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
