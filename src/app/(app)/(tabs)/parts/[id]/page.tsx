import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { AddPhoto } from '@/components/AddPhoto'
import { Icon } from '@/components/Icon'
import { PartActions } from '@/components/PartActions'
import { PhotoGallery } from '@/components/PhotoGallery'
import { PageHeader, Quantity, Section } from '@/components/ui'
import { formatValue } from '@/lib/format'
import { allLocations, partDetail } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import type { Category, Media } from '@/payload-types'

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user } = await requireSession()
  const [detail, locations] = await Promise.all([
    partDetail(payload, user, id),
    allLocations(payload, user),
  ])
  if (!detail) notFound()
  const { part, stock, sources, photos } = detail

  const category = part.category as Category | null
  const datasheet = part.datasheet as Media | null
  const value = formatValue(part.value, part.unit)

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader title={part.name} back="/">
        <p className="mt-1 flex flex-wrap gap-x-3 text-muted">
          {value && <span>{value}</span>}
          {part.package && <span>{part.package}</span>}
          {category && (
            <span>{category.breadcrumbs?.map((b) => b.label).join(' › ') ?? category.name}</span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/parts/${part.id}/edit`}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold"
          >
            <Icon name="edit" className="size-5" />
            Edit
          </Link>
          <AddPhoto part={part.id} alt={part.name} />
          <Link
            href={`/print/labels?size=s&ids=${part.id}`}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold"
          >
            <Icon name="print" className="size-5" />
            Label
          </Link>
        </div>
      </PageHeader>

      {/* Desktop: details on the left, a sticky stock + actions panel on the right */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-10 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">
          <div className="flex items-end justify-between rounded-2xl border border-line bg-raised px-5 py-4">
            <div>
              <span className="block text-[15px] text-muted">In stock</span>
              {part.minStock != null && (
                <span className="text-[15px] text-muted">Reorder at {part.minStock}</span>
              )}
            </div>
            <Quantity n={part.totalQuantity ?? 0} low={Boolean(part.lowStock)} />
          </div>
          <PartActions
            partId={part.id}
            held={stock.map((s) => ({
              locationId: s.location.id,
              code: s.location.code,
              quantity: s.quantity,
            }))}
            locations={locations}
          />
        </aside>

        <div className="lg:col-start-1 lg:row-start-1 lg:[&>section:first-child]:mt-0">
          <PhotoGallery photos={photos} name={part.name} />
          <Section title="Where it is">
            {stock.length === 0 ? (
              <p className="text-muted">None on hand. Use Fix count if you find some.</p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-line bg-raised">
                {stock.map((row) => (
                  <li key={row.id} className="border-b border-line last:border-0">
                    <Link
                      href={`/l/${encodeURIComponent(row.location.code)}`}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span>
                        <span className="text-[19px] font-semibold text-mask">
                          {row.location.code}
                        </span>
                        {row.location.name && (
                          <span className="ml-2 text-muted">{row.location.name}</span>
                        )}
                      </span>
                      <span className="text-[19px] font-semibold">
                        {row.approximate ? '≈' : ''}
                        {row.quantity}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {(datasheet?.url || sources.length > 0) && (
            <Section title="Buy and docs">
              <ul className="flex flex-col gap-2">
                {datasheet?.url && <ExternalRow href={datasheet.url} label="Datasheet" />}
                {sources.map((s) => (
                  <ExternalRow
                    key={s.id}
                    href={s.url ?? undefined}
                    label={`${s.supplier} ${s.sku}`}
                  />
                ))}
              </ul>
            </Section>
          )}

          {part.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-line">{part.notes}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function ExternalRow({ href, label }: { href?: string; label: string }) {
  if (!href) return <li className="px-1 text-muted">{label}</li>
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-2xl border border-line bg-raised px-4 py-3 font-medium"
      >
        {label}
        <Icon name="external" className="size-5 text-muted" />
      </a>
    </li>
  )
}
