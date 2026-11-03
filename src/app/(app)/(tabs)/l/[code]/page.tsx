import Link from 'next/link'
import React from 'react'

import { AddPhoto } from '@/components/AddPhoto'
import { Icon } from '@/components/Icon'
import { Empty, PageHeader, PartRow, Section } from '@/components/ui'
import { idOf } from '@/ledger/rules'
import { locationContents } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import type { Location, Part, Stock } from '@/payload-types'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: decodeURIComponent((await params).code) }
}

export default async function LocationPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code)
  const { payload, user } = await requireSession()
  const data = await locationContents(payload, user, code)

  if (!data) {
    return (
      <>
        <PageHeader title={code} back="/locations" />
        <Empty>No location has the code “{code}”. Create it in the admin, then scan again.</Empty>
      </>
    )
  }

  const { location, here, children } = data
  const photo = location.photo
    ? await payload
        .findByID({
          collection: 'media',
          id: idOf(location.photo)!,
          depth: 0,
          user,
          overrideAccess: false,
        })
        .catch(() => null)
    : null
  const trail = location.breadcrumbs?.slice(0, -1) ?? []
  const parentCode = trail.at(-1)?.label

  return (
    <>
      <PageHeader
        title={location.code}
        back={parentCode ? `/l/${encodeURIComponent(parentCode)}` : '/locations'}
      >
        <p className="mt-1 text-muted">
          {trail.length > 0 && <span>In {trail.map((b) => b.label).join(' › ')}. </span>}
          {location.name}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/labels?box=${encodeURIComponent(trail[0]?.label ?? location.code)}`}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold"
          >
            <Icon name="print" className="size-5" />
            Print labels
          </Link>
          <AddPhoto
            location={location.id}
            alt={location.name ?? location.code}
            label={photo ? 'New photo' : 'Add photo'}
          />
        </div>
      </PageHeader>

      {photo?.url && (
        <a href={photo.url} target="_blank" rel="noreferrer" className="mb-2 block lg:max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by Payload/Blob */}
          <img
            src={photo.variants?.thumbnail?.url ?? photo.url}
            alt={location.name ?? location.code}
            className="aspect-[4/3] w-full rounded-2xl border border-line bg-white object-cover"
          />
        </a>
      )}

      {children.length === 0 ? (
        <Section title="In here">
          {here.length === 0 ? (
            <Empty>Empty. Put parts away here from the Inbox.</Empty>
          ) : (
            <StockList rows={here} />
          )}
        </Section>
      ) : (
        // Desktop: the box on the left, what's in each compartment on the right
        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="lg:sticky lg:top-10">
            <BoxGrid parent={location} cells={children} />
          </div>
          <div className="lg:[&>section:first-child]:mt-0">
            <Section title="Compartments">
              <CompartmentList parent={location} cells={children} />
            </Section>
            {here.length > 0 && (
              <Section title="Loose in this box">
                <StockList rows={here} />
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * The box as you see it from above: one cell per compartment, filled cells show how
 * many different parts are inside. Tap a cell to open it.
 */
function BoxGrid({
  parent,
  cells,
}: {
  parent: Location
  cells: Array<{ location: Location; stock: Stock[] }>
}) {
  const columns = parent.columns ?? Math.min(6, Math.ceil(Math.sqrt(cells.length * 1.5)))
  const short = shortCode(parent)

  return (
    <div
      className="grid gap-1.5 rounded-2xl border-2 border-mask/60 bg-raised p-2 lg:gap-2 lg:p-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map(({ location, stock }) => {
        const filled = stock.length > 0
        const first = filled ? (stock[0].part as Part) : null
        return (
          <Link
            key={location.id}
            href={`/l/${encodeURIComponent(location.code)}`}
            aria-label={`${location.code}: ${filled ? `${stock.length} kinds of parts` : 'empty'}`}
            className={`flex aspect-square flex-col justify-between rounded-lg p-1.5 text-[13px] leading-tight lg:p-2 lg:text-[15px] ${
              filled ? 'bg-mask-soft text-ink' : 'border border-dashed border-line text-muted'
            }`}
          >
            <span className="font-semibold">{short(location.code)}</span>
            {first && (
              <span className="line-clamp-2 text-[11px] text-muted lg:text-[12px]" aria-hidden>
                {stock.length > 1 ? `${stock.length} kinds` : first.name}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/** "B03-17" inside B03 → "17" */
const shortCode = (parent: Location) => (c: string) =>
  (c.startsWith(parent.code) ? c.slice(parent.code.length).replace(/^[-/ ]/, '') : c) || c

/** Every filled compartment with what's in it, so the whole box reads without tapping. */
function CompartmentList({
  parent,
  cells,
}: {
  parent: Location
  cells: Array<{ location: Location; stock: Stock[] }>
}) {
  const filled = cells.filter((c) => c.stock.length > 0)
  if (filled.length === 0) {
    return <p className="text-muted">All {cells.length} compartments are empty.</p>
  }
  const short = shortCode(parent)
  return (
    <ul>
      {filled.map(({ location, stock }) => (
        <li key={location.id} className="flex gap-4 border-b border-line py-2.5 last:border-0">
          <Link
            href={`/l/${encodeURIComponent(location.code)}`}
            className="w-10 shrink-0 text-[19px] font-semibold text-mask"
          >
            {short(location.code)}
          </Link>
          <ul className="min-w-0 flex-1">
            {stock.map((row) => {
              const part = row.part as Part
              return (
                <li key={row.id} className="flex justify-between gap-3">
                  <Link href={`/parts/${part.id}`} className="truncate">
                    {part.name}
                  </Link>
                  <span className="shrink-0 font-semibold">
                    {row.approximate ? '≈' : ''}
                    {row.quantity}
                  </span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function StockList({ rows }: { rows: Array<Stock & { part: Part }> }) {
  return (
    <ul>
      {rows.map((row) => (
        <PartRow
          key={row.id}
          part={row.part}
          trailing={
            <span className="shrink-0 text-[22px] leading-none font-semibold">
              {row.approximate ? '≈' : ''}
              {row.quantity}
            </span>
          }
        />
      ))}
    </ul>
  )
}
