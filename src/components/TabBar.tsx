'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { BoxMark } from './BoxMark'
import { Icon, type IconName } from './Icon'

const tabs: Array<{ href: string; label: string; icon: IconName; match: RegExp }> = [
  { href: '/', label: 'Home', icon: 'home', match: /^\/($|search|parts|low-stock|catalog)/ },
  { href: '/locations', label: 'Boxes', icon: 'box', match: /^\/(locations|l\/|labels|share)/ },
  { href: '/scan', label: 'Scan', icon: 'scan', match: /^\/scan/ },
  { href: '/inbox', label: 'Inbox', icon: 'inbox', match: /^\/inbox/ },
  { href: '/orders', label: 'Orders', icon: 'orders', match: /^\/orders/ },
]

/** Highlights a tab the moment it is tapped, before the next page has rendered. */
function TabContent({ active, children }: { active: boolean; children: React.ReactNode }) {
  const { pending } = useLinkStatus()
  return (
    <span
      className={`contents ${pending && !active ? '[&>svg]:text-mask [&>[data-label]]:text-mask' : ''}`}
    >
      {children}
    </span>
  )
}

function Badge({ n, className }: { n: number; className: string }) {
  if (n <= 0) return null
  return (
    <span
      className={`min-w-5 rounded-full bg-enig px-1.5 text-center text-[11px] leading-5 font-semibold text-raised ${className}`}
    >
      {n}
    </span>
  )
}

/** Phones and tablets: thumb-reach tabs along the bottom. */
export function TabBar({ inboxCount }: { inboxCount: number }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match.test(pathname)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-medium ${
                  active ? 'text-mask' : 'text-muted'
                }`}
              >
                <TabContent active={active}>
                  <Icon name={tab.icon} />
                  <span data-label>{tab.label}</span>
                  {tab.icon === 'inbox' && (
                    <Badge n={inboxCount} className="absolute top-2 left-[calc(50%+6px)]" />
                  )}
                </TabContent>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Desktop: the same destinations as a left rail, with search always in reach. */
export function Sidebar({ inboxCount, search }: { inboxCount: number; search: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-raised px-4 py-6 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <BoxMark className="size-9" />
        <span className="text-[22px] font-semibold tracking-tight">LabStash</span>
      </Link>
      {/* Home has its own big search field */}
      {pathname !== '/' && <div className="mb-5">{search}</div>}
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = tab.match.test(pathname)
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 font-medium ${
                    active ? 'bg-mask-soft text-mask' : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  <TabContent active={active}>
                    <Icon name={tab.icon} className="size-5" />
                    <span data-label className="flex-1">
                      {tab.label}
                    </span>
                    {tab.icon === 'inbox' && <Badge n={inboxCount} className="" />}
                  </TabContent>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <Link
        href="/admin"
        className="mt-auto flex h-11 items-center rounded-xl px-3 text-[15px] text-muted hover:bg-surface hover:text-ink"
      >
        Admin panel
      </Link>
    </aside>
  )
}
