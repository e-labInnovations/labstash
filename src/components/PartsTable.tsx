'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState, useTransition } from 'react'

import {
  type ListParams,
  PER_PAGE,
  type PartList,
  SHOW,
  SORT,
  type Show,
  type SortKey,
} from '@/lib/partList'
import type { CategoryOption } from '@/lib/queries'

import { Icon } from './Icon'
import { LocationChip, PartRow, Quantity } from './ui'

const DEFAULTS: ListParams = { q: '', category: '', show: 'all', sort: 'name', page: 1, limit: 50 }

/** The address for a list view, leaving defaults out so links stay short. */
const hrefFor = (pathname: string, p: ListParams) => {
  const qs = new URLSearchParams()
  for (const key of Object.keys(DEFAULTS) as Array<keyof ListParams>) {
    if (p[key] !== DEFAULTS[key]) qs.set(key, String(p[key]))
  }
  const s = qs.toString()
  return s ? `${pathname}?${s}` : pathname
}

/**
 * One page of the lab's parts. Filters, sort and page live in the address; the server does the
 * filtering and paging, so this only renders what it is given.
 */
export function PartsTable({
  list,
  params,
  categories,
}: {
  list: PartList
  params: ListParams
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(params.q)

  const go = (next: Partial<ListParams>) => {
    // Any change other than paging starts again at page 1
    const merged = { ...params, page: 1, ...next }
    startTransition(() => router.replace(hrefFor(pathname, merged), { scroll: false }))
  }

  // Search as you type, without a request per keystroke
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined)
  const type = (text: string) => {
    setQuery(text)
    clearTimeout(typing.current)
    typing.current = setTimeout(() => go({ q: text.trim() }), 300)
  }
  useEffect(() => () => clearTimeout(typing.current), [])

  const { rows, total, pages, page, pcs } = list
  const from = total === 0 ? 0 : (page - 1) * params.limit + 1
  const to = Math.min(total, page * params.limit)

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          value={query}
          onChange={(e) => type(e.target.value)}
          placeholder="Filter by name, value, package, box…"
          aria-label="Filter parts"
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-line bg-raised px-4 lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <select
            value={params.category}
            onChange={(e) => go({ category: e.target.value })}
            aria-label="Category"
            className="h-12 min-w-0 rounded-xl border border-line bg-raised px-3 lg:w-56"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={params.sort}
            onChange={(e) => go({ sort: e.target.value as SortKey })}
            aria-label="Sort by"
            className="h-12 min-w-0 rounded-xl border border-line bg-raised px-3 lg:w-44"
          >
            {(Object.keys(SORT) as SortKey[]).map((key) => (
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
            onClick={() => go({ show: key })}
            aria-pressed={params.show === key}
            className={`h-10 shrink-0 rounded-full border px-4 text-[15px] font-semibold ${
              params.show === key ? 'border-mask bg-mask-soft text-mask' : 'border-line text-muted'
            }`}
          >
            {SHOW[key]}
          </button>
        ))}
      </div>

      <p className="mt-3 mb-1 text-[15px] text-muted" aria-live="polite">
        {total === 0
          ? 'No parts'
          : `${from}–${to} of ${total} ${total === 1 ? 'part' : 'parts'} · ${pcs} pcs`}
      </p>

      <div className={pending ? 'opacity-60 transition-opacity' : undefined}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-muted">
            {params.q || params.category || params.show !== 'all'
              ? 'Nothing matches these filters.'
              : 'No parts yet.'}
          </p>
        ) : (
          <>
            {/* Phones: the same rows as search */}
            <ul className="lg:hidden">
              {rows.map((r) => (
                <PartRow key={r.part.id} part={r.part} stock={r.stock} thumb={r.thumb} />
              ))}
            </ul>

            {/* Desktop: a table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-raised lg:block">
              <table className="w-full border-collapse text-left">
                <thead className="bg-raised">
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
                  {rows.map((r) => (
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

      <nav
        aria-label="Pages"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 pb-4"
      >
        <label className="flex items-center gap-2 text-[15px] text-muted">
          Per page
          <select
            value={params.limit}
            onChange={(e) => go({ limit: Number(e.target.value) })}
            className="h-10 rounded-xl border border-line bg-raised px-2 font-semibold text-ink"
          >
            {PER_PAGE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <PageLink to={page - 1} disabled={page <= 1} go={go}>
              <Icon name="back" className="size-5" />
              <span className="sr-only">Previous page</span>
            </PageLink>
            <span className="min-w-20 text-center text-[15px]">
              Page {page} of {pages}
            </span>
            <PageLink to={page + 1} disabled={page >= pages} go={go}>
              <Icon name="back" className="size-5 rotate-180" />
              <span className="sr-only">Next page</span>
            </PageLink>
          </div>
        )}
      </nav>
    </div>
  )
}

function PageLink({
  to,
  disabled,
  go,
  children,
}: {
  to: number
  disabled: boolean
  go: (next: Partial<ListParams>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        go({ page: to })
        window.scrollTo({ top: 0 })
      }}
      className="grid size-11 place-items-center rounded-xl border border-line disabled:opacity-40"
    >
      {children}
    </button>
  )
}
