import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Icon } from '@/components/Icon'
import { PhotoGallery } from '@/components/PhotoGallery'
import { ExternalRow, PageHeader, Section } from '@/components/ui'
import { catalogPart } from '@/lib/catalog'
import { formatValue } from '@/lib/format'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Shared part' }

/** A part another lab shares: what it is, and a way to copy it into your own lab. */
export default async function CatalogPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user } = await requireSession()
  const shared = await catalogPart(payload, user, id)
  if (!shared) notFound()
  const { part, category, photos, datasheet, listings } = shared

  // Already have one by that name? Point there instead of making a duplicate
  const { docs: mine } = await payload.find({
    collection: 'parts',
    where: { name: { equals: part.name } },
    limit: 1,
    depth: 0,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  const value = formatValue(part.value, part.unit)
  const details = [
    ['Part number', part.mpn],
    ['Maker', part.manufacturer],
    ['KiCad symbol', part.kicadSymbol],
    ['KiCad footprint', part.kicadFootprint],
  ].filter((d): d is [string, string] => Boolean(d[1]))

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader title={part.name} back="/search">
        <p className="mt-1 flex flex-wrap gap-x-3 text-muted">
          {value && <span>{value}</span>}
          {part.package && <span>{part.package}</span>}
          {category && <span>{category.label}</span>}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mask-soft px-3 py-1 text-[14px] font-semibold text-mask">
          <Icon name="share" className="size-4" />
          Shared by another lab
        </p>
      </PageHeader>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
        <aside className="mt-4 lg:sticky lg:top-10 lg:col-start-2 lg:row-start-1 lg:mt-0">
          {mine[0] ? (
            <Link
              href={`/parts/${mine[0].id}`}
              className="flex h-13 items-center justify-center rounded-2xl border border-line font-semibold"
            >
              You have this already — open yours
            </Link>
          ) : (
            <Link
              href={`/parts/new?from=${part.id}`}
              className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-mask font-semibold text-mask-ink"
            >
              <Icon name="plus" className="size-5" />
              Add to my lab
            </Link>
          )}
          <p className="mt-2 text-[14px] text-muted">
            Copies the details, photos, datasheet and store links. How many you have and where they
            go are yours to fill in.
          </p>
        </aside>

        <div className="lg:col-start-1 lg:row-start-1 lg:[&>section:first-child]:mt-0">
          <PhotoGallery photos={photos} name={part.name} />
          {(details.length > 0 || part.description) && (
            <Section title="Details">
              {details.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {details.map(([label, text]) => (
                    <React.Fragment key={label}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="min-w-0 break-words">{text}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
              {part.description && <p className="mt-3 whitespace-pre-line">{part.description}</p>}
            </Section>
          )}
          {(datasheet || listings.length > 0) && (
            <Section title="Buy and docs">
              <ul className="flex flex-col gap-2">
                {datasheet && <ExternalRow href={datasheet.url} label="Datasheet" />}
                {listings.map((l) => (
                  <ExternalRow
                    key={`${l.supplier?.id}-${l.sku}`}
                    href={l.url ?? undefined}
                    label={`${l.supplier?.name ?? 'Store'} ${l.sku}`}
                  />
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
