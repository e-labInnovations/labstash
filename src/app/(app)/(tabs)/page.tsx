import Link from 'next/link'
import React from 'react'

import { PartRow, SearchBar, Section } from '@/components/ui'
import { homeStats, lowStockParts, recentMovements } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import type { StockMovement } from '@/payload-types'

export default async function HomePage() {
  const { payload, user } = await requireSession()
  const [stats, recent, low] = await Promise.all([
    homeStats(payload, user),
    recentMovements(payload, user, 10),
    lowStockParts(payload, user),
  ])

  return (
    <>
      <div className="mb-4 flex items-center justify-between lg:mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[34px]">
          <span className="lg:hidden">LabStash</span>
          <span className="hidden lg:inline">Your stash</span>
        </h1>
        <span className="text-[15px] text-muted">{stats.parts} parts</span>
      </div>
      <SearchBar />

      <div className="mt-4 grid grid-cols-3 gap-2 lg:gap-4">
        <Stat
          href="/inbox"
          n={stats.inbox}
          label="to put away"
          tone={stats.inbox ? 'enig' : 'quiet'}
        />
        <Stat
          href="/low-stock"
          n={stats.lowStock}
          label="running low"
          tone={stats.lowStock ? 'enig' : 'quiet'}
        />
        <Stat href="/orders" n={stats.openOrders} label="open orders" tone="quiet" />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <Section title="Recent">
          {recent.length === 0 ? (
            <p className="text-muted">Nothing yet. Received and taken parts show up here.</p>
          ) : (
            <ul>
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="flex items-baseline gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="w-16 shrink-0 text-[14px] text-muted">{when(m.occurredAt)}</span>
                  <span className="min-w-0 flex-1">
                    <MovementLine m={m} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Phones get the "running low" tile; desktop has room for the list itself */}
        <div className="hidden lg:block">
          <Section
            title="Running low"
            action={
              low.length > 6 && (
                <Link href="/low-stock" className="text-[15px] font-semibold text-mask">
                  All {low.length}
                </Link>
              )
            }
          >
            {low.length === 0 ? (
              <p className="text-muted">Nothing below its reorder level.</p>
            ) : (
              <ul>
                {low.slice(0, 6).map((part) => (
                  <PartRow key={part.id} part={part} />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function Stat({
  href,
  n,
  label,
  tone,
}: {
  href: string
  n: number
  label: string
  tone: 'enig' | 'quiet'
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-3 py-3 ${tone === 'enig' ? 'bg-enig-soft' : 'border border-line bg-raised'}`}
    >
      <span
        className={`block text-[28px] leading-none font-semibold ${tone === 'enig' ? 'text-enig' : ''}`}
      >
        {n}
      </span>
      <span className="mt-1 block text-[14px] text-muted">{label}</span>
    </Link>
  )
}

const code = (l: StockMovement['from']) => (l && typeof l === 'object' ? l.code : null)

function MovementLine({ m }: { m: StockMovement }) {
  const part = typeof m.part === 'object' ? m.part : null
  const name = (
    <Link href={`/parts/${part?.id ?? m.part}`} className="font-medium">
      {part?.name ?? 'part'}
    </Link>
  )
  const from = code(m.from)
  const to = code(m.to)
  const verb = {
    receive: 'Received',
    move: 'Moved',
    use: 'Took',
    adjust: to ? 'Found' : 'Wrote off',
  }[m.type]
  return (
    <span className="line-clamp-2">
      {verb} {m.quantity} {name}
      <span className="text-muted">
        {from && ` from ${from}`}
        {to && ` to ${to}`}
      </span>
    </span>
  )
}

const when = (iso: string) => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
