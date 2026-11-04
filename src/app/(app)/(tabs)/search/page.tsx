import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { Empty, PartRow, SearchBar } from '@/components/ui'
import { type CatalogItem, searchCatalog } from '@/lib/catalog'
import { formatValue } from '@/lib/format'
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
  const [results, shared] = q.trim()
    ? await Promise.all([searchParts(payload, user, q), searchCatalog(payload, user, q)])
    : [[], []]

  return (
    <>
      <SearchBar defaultValue={q} autoFocus={!q} />
      <div className="mt-4">
        {!q.trim() ? (
          <p className="text-muted">
            Search by name, part number, value or package. “10k 0603” finds 10 kΩ resistors in 0603.
          </p>
        ) : results.length === 0 ? (
          <Empty>
            Nothing in your lab matches “{q}”.{' '}
            {shared.length === 0 && 'Try fewer words, or just the value like “100nF”. '}
            <Link
              href={`/parts/new?name=${encodeURIComponent(q.trim())}`}
              className="font-semibold text-mask underline underline-offset-4"
            >
              Add it as a new part
            </Link>
          </Empty>
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

        {shared.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 flex items-center gap-2 text-[19px] font-semibold">
              <Icon name="share" className="size-5 text-mask" />
              From other labs
            </h2>
            <p className="mb-1 text-[15px] text-muted">
              Shared parts you can copy into your lab, with their photos and links.
            </p>
            <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
              {shared.map((item) => (
                <CatalogRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

function CatalogRow({ item }: { item: CatalogItem }) {
  const value = formatValue(item.value, item.unit)
  return (
    <li className="border-b border-line py-3 last:border-0">
      <Link href={`/catalog/${item.id}`} className="flex items-start gap-3">
        {item.thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- served by the catalog route
          <img
            src={item.thumb}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-lg border border-line bg-white object-contain"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-medium">{item.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[15px] text-muted">
            {[value, item.package, item.mpn].filter(Boolean).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-mask px-3 py-1 text-[14px] font-semibold text-mask">
          Add
        </span>
      </Link>
    </li>
  )
}
