'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import type { CategoryOption } from '@/lib/queries'
import type { StockChip } from '@/lib/search'

import { Icon } from './Icon'
import { LocationChip, PartRow, Quantity } from './ui'

export type PartListRow = {
  part: {
    id: string
    name: string
    value: number | null
    unit: string | null
    package: string | null
    totalQuantity: number
    lowStock: boolean
  }
  mpn: string | null
  valueText: string
  category: string | null
  shared: boolean
  createdAt: string
  stock: StockChip[]
  thumb: string | null
}

const SHOW = {
  all: 'All',
  low: 'Running low',
  out: 'Out of stock',
  inbox: 'In Inbox',
  shared: 'Shared',
} as const
type Show = keyof typeof SHOW

const SORT = {
  name: 'Name',
  box: 'Box',
  most: 'Most stock',
  least: 'Least stock',
  value: 'Value',
  newest: 'Newest',
} as const
type Sort = keyof typeof SORT

const numeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
const firstBox = (r: PartListRow) => r.stock.find((s) => s.code !== 'INBOX')?.code ?? '￿'

const compare: Record<Sort, (a: PartListRow, b: PartListRow) => number> = {
  name: (a, b) => numeric(a.part.name, b.part.name),
  box: (a, b) => numeric(firstBox(a), firstBox(b)) || numeric(a.part.name, b.part.name),
  most: (a, b) => b.part.totalQuantity - a.part.totalQuantity,
  least: (a, b) => a.part.totalQuantity - b.part.totalQuantity,
  // Grouped by unit (Ω, F, V…), then smallest first; parts without a value last
  value: (a, b) =>
    (a.part.value == null ? 1 : 0) - (b.part.value == null ? 1 : 0) ||
    (a.part.unit ?? '').localeCompare(b.part.unit ?? '') ||
    (a.part.value ?? 0) - (b.part.value ?? 0),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
}

const matches: Record<Show, (r: PartListRow) => boolean> = {
  all: () => true,
  low: (r) => r.part.lowStock,
  out: (r) => r.part.totalQuantity === 0,
  inbox: (r) => r.stock.some((s) => s.code === 'INBOX'),
  shared: (r) => r.shared,
}

const pick = <T extends string>(options: Record<T, string>, v: string | null, fallback: T) =>
  v && v in options ? (v as T) : fallback

/** Every part in the lab, filtered and sorted in the browser; the filters live in the URL. */
export function PartsTable({
  rows,
  categories,
}: {
  rows: PartListRow[]
  categories: CategoryOption[]
}) {
  // Read from the address bar, not the server render: Back reuses a cached render of /parts
  const initial = useSearchParams()
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [category, setCategory] = useState(initial.get('category') ?? '')
  const [show, setShow] = useState<Show>(pick(SHOW, initial.get('show'), 'all'))
  const [sort, setSort] = useState<Sort>(pick(SORT, initial.get('sort'), 'name'))

  // Coming back from a part keeps the same view
  useEffect(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (category) params.set('category', category)
    if (show !== 'all') params.set('show', show)
    if (sort !== 'name') params.set('sort', sort)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [query, category, show, sort])

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return rows
      .filter((r) => {
        if (!matches[show](r) || (category && r.category !== category)) return false
        const text = [
          r.part.name,
          r.mpn,
          r.valueText,
          r.part.package,
          r.category,
          ...r.stock.map((s) => s.code),
        ]
          .join(' ')
          .toLowerCase()
        return words.every((w) => text.includes(w))
      })
      .sort(compare[sort])
  }, [rows, query, category, show, sort])

  const pcs = shown.reduce((sum, r) => sum + r.part.totalQuantity, 0)

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, value, package, box…"
          aria-label="Filter parts"
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-line bg-raised px-4 lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            className="h-12 min-w-0 rounded-xl border border-line bg-raised px-3 lg:w-56"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort by"
            className="h-12 min-w-0 rounded-xl border border-line bg-raised px-3 lg:w-44"
          >
            {(Object.keys(SORT) as Sort[]).map((key) => (
              <option key={key} value={key}>
                Sort: {SORT[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(SHOW) as Show[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setShow(key)}
            aria-pressed={show === key}
            className={`h-10 shrink-0 rounded-full border px-4 text-[15px] font-semibold ${
              show === key ? 'border-mask bg-mask-soft text-mask' : 'border-line text-muted'
            }`}
          >
            {SHOW[key]}
          </button>
        ))}
      </div>

      <p className="mt-3 mb-1 text-[15px] text-muted">
        {shown.length} of {rows.length} {rows.length === 1 ? 'part' : 'parts'} · {pcs} pcs
      </p>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {rows.length === 0 ? 'No parts yet.' : 'Nothing matches these filters.'}
        </p>
      ) : (
        <>
          {/* Phones: the same rows as search */}
          <ul className="lg:hidden">
            {shown.map((r) => (
              <PartRow key={r.part.id} part={r.part} stock={r.stock} thumb={r.thumb} />
            ))}
          </ul>

          {/* Desktop: a table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-raised lg:block">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-raised">
                <tr className="border-b border-line text-[14px] text-muted">
                  <th className="px-4 py-3 font-semibold">Part</th>
                  <th className="px-3 py-3 font-semibold">Value</th>
                  <th className="px-3 py-3 font-semibold">Package</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">Where</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.part.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/parts/${r.part.id}`} className="flex items-start gap-3">
                        {r.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- served by Payload/Blob, already resized
                          <img
                            src={r.thumb}
                            alt=""
                            loading="lazy"
                            className="size-10 shrink-0 rounded-lg border border-line bg-white object-contain"
                          />
                        ) : (
                          <span className="size-10 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-medium">{r.part.name}</span>
                          <span className="flex gap-2 text-[14px] text-muted">
                            {r.mpn && <span>{r.mpn}</span>}
                            {r.shared && (
                              <span className="inline-flex items-center gap-1 font-semibold text-mask">
                                <Icon name="share" className="size-3.5" />
                                Shared
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.valueText}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.part.package}</td>
                    <td className="px-3 py-3 text-[15px] text-muted">{r.category}</td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-56 flex-wrap gap-1.5">
                        {r.stock.map((chip) => (
                          <LocationChip key={chip.code} chip={chip} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Quantity n={r.part.totalQuantity} low={r.part.lowStock} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
