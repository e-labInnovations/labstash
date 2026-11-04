import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { PartRow, SearchBar, Section } from '@/components/ui'
import { homeStats, lowStockParts, recentMovements } from '@/lib/queries'
import { LabBadge } from '@/components/LabBadge'
import { getLab, requireSession } from '@/lib/session'
import type { StockMovement } from '@/payload-types'

export default async function HomePage() {
  const { payload, user } = await requireSession()
  const [stats, recent, low, lab] = await Promise.all([
    homeStats(payload, user),
    recentMovements(payload, user, 10),
    lowStockParts(payload, user),
    getLab(),
  ])

  return (
    <>
      {/* Phones: the lab is the title, with add and account as round buttons */}
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <Link href="/lab" className="flex min-w-0 flex-1 text-[24px] font-semibold tracking-tight">
          {lab ? <LabBadge name={lab.name} logo={lab.logo?.thumb ?? null} size="md" /> : 'LabStash'}
        </Link>
        <Link
          href="/parts/new"
          aria-label="Add part"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-mask text-mask-ink"
        >
          <Icon name="plus" className="size-6" />
        </Link>
        <Link
          href="/profile"
          aria-label="Account"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-raised text-[17px] font-semibold"
        >
          {(user.name || user.email).charAt(0).toUpperCase()}
        </Link>
      </div>
      {/* Desktop: the sidebar carries the lab and account */}
      <div className="mb-6 hidden items-center justify-between gap-3 lg:flex">
        <h1 className="text-[34px] font-semibold tracking-tight">Your stash</h1>
        <Link
          href="/parts/new"
          className="flex h-11 items-center gap-1.5 rounded-xl bg-mask px-4 font-semibold whitespace-nowrap text-mask-ink"
        >
          <Icon name="plus" className="size-5" />
          Add part
        </Link>
      </div>
      <SearchBar />

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        <Stat
          href="/parts"
          n={stats.parts}
          label={stats.parts === 1 ? 'part' : 'parts'}
          tone="quiet"
        />
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
      className={`relative rounded-2xl px-3 py-3 ${tone === 'enig' ? 'bg-enig-soft' : 'border border-line bg-raised'}`}
    >
      {/* Every tile opens its list */}
      <Icon
        name="back"
        className={`absolute top-3 right-3 size-4 rotate-180 ${tone === 'enig' ? 'text-enig' : 'text-muted'}`}
      />
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
