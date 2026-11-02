import Link from 'next/link'
import React from 'react'

import { formatValue } from '@/lib/format'
import type { StockChip } from '@/lib/search'

import { Icon } from './Icon'

export function PageHeader({
  title,
  back,
  children,
}: {
  title: React.ReactNode
  back?: string
  children?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex items-start gap-2">
      {back && (
        <Link
          href={back}
          aria-label="Back"
          className="-ml-2 grid size-10 shrink-0 place-items-center text-muted"
        >
          <Icon name="back" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance lg:text-[34px]">
          {title}
        </h1>
        {children}
      </div>
    </header>
  )
}

export function SearchBar({
  defaultValue,
  autoFocus,
  compact,
  className = '',
}: {
  defaultValue?: string
  autoFocus?: boolean
  /** Sidebar size: shorter field, shorter hint */
  compact?: boolean
  className?: string
}) {
  return (
    <form action="/search" role="search" className={`relative ${className}`}>
      <Icon
        name="search"
        className={`pointer-events-none absolute top-1/2 size-5 -translate-y-1/2 text-muted ${compact ? 'left-3' : 'left-4'}`}
      />
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={compact ? 'Search parts' : '10k 0603, CH32V003, usb-c…'}
        aria-label="Search parts"
        className={`w-full border border-line placeholder:text-muted/70 focus:border-mask focus:outline-none ${
          compact
            ? 'h-11 rounded-xl bg-surface pr-3 pl-10 text-[16px]'
            : 'h-14 rounded-2xl bg-raised pr-4 pl-12 text-[17px]'
        }`}
      />
    </form>
  )
}

/** The physical answer to "where is it": box code and how many are there. */
export function LocationChip({ chip }: { chip: StockChip }) {
  return (
    <Link
      href={`/l/${encodeURIComponent(chip.code)}`}
      className="inline-flex items-baseline gap-1 rounded-md bg-mask-soft px-2 py-0.5 text-[14px] font-semibold text-mask"
    >
      {chip.code}
      <span className="font-medium text-ink/70">
        {chip.approximate ? '≈' : '×'}
        {chip.quantity}
      </span>
    </Link>
  )
}

type PartLike = {
  id: string
  name: string
  package?: string | null
  value?: number | null
  unit?: string | null
  totalQuantity?: number | null
  lowStock?: boolean | null
}

export function PartRow({
  part,
  stock,
  trailing,
}: {
  part: PartLike
  stock?: StockChip[]
  trailing?: React.ReactNode
}) {
  const value = formatValue(part.value, part.unit)
  return (
    <li className="border-b border-line py-3 last:border-0">
      <div className="flex items-start gap-3">
        <Link href={`/parts/${part.id}`} className="min-w-0 flex-1">
          <span className="line-clamp-2 font-medium">{part.name}</span>
          {(value || part.package) && (
            <span className="mt-0.5 flex gap-2 text-[15px] text-muted">
              {value && <span>{value}</span>}
              {part.package && <span>{part.package}</span>}
            </span>
          )}
        </Link>
        {trailing ?? <Quantity n={part.totalQuantity ?? 0} low={Boolean(part.lowStock)} />}
      </div>
      {stock && stock.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stock.map((chip) => (
            <LocationChip key={chip.code} chip={chip} />
          ))}
        </div>
      )}
    </li>
  )
}

export function Quantity({ n, low }: { n: number; low?: boolean }) {
  return (
    <span
      className={`shrink-0 text-right text-[22px] leading-none font-semibold ${
        n === 0 ? 'text-danger' : low ? 'text-enig' : 'text-ink'
      }`}
    >
      {n}
      <span className="sr-only"> in stock{low ? ', low' : ''}</span>
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">
      {children}
    </div>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
