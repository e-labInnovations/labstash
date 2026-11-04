import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { LabBadge } from '@/components/LabBadge'
import { LogoutButton } from '@/components/LogoutButton'
import { NameForm, PasswordForm } from '@/components/ProfileForms'
import { PageHeader, Section } from '@/components/ui'
import { getLab, requireSession } from '@/lib/session'

export const metadata = { title: 'Account' }

const rowClass =
  'flex min-h-13 items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-3 font-semibold'

export default async function ProfilePage() {
  const { user } = await requireSession()
  const lab = await getLab()
  const labRole = user.labs?.[0]?.labRole === 'member' ? 'Member' : 'Lab admin'

  return (
    <div className="max-w-xl">
      <PageHeader title="Account" back="/" />

      <div className="flex items-center gap-4 rounded-2xl border border-line bg-raised px-5 py-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-mask text-[24px] font-semibold text-mask-ink"
        >
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          {user.name && (
            <span className="block truncate text-[19px] font-semibold">{user.name}</span>
          )}
          <span className="block truncate text-muted">{user.email}</span>
          <span className="mt-1 flex flex-wrap gap-1.5 text-[13px] font-semibold">
            {user.role === 'admin' && (
              <span className="rounded-full bg-mask px-2.5 py-0.5 text-mask-ink">Admin</span>
            )}
            {lab && (
              <span className="rounded-full bg-mask-soft px-2.5 py-0.5 text-mask">{labRole}</span>
            )}
          </span>
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {lab && (
          <li>
            <Link href="/lab" className={rowClass}>
              <span className="min-w-0 flex-1">
                <LabBadge name={lab.name} logo={lab.logo?.thumb ?? null} />
              </span>
              <Icon name="back" className="size-4 rotate-180 text-muted" />
            </Link>
          </li>
        )}
        <li>
          <Link href="/categories" className={rowClass}>
            <Icon name="tag" className="size-5 text-mask" />
            <span className="flex-1">Categories</span>
            <Icon name="back" className="size-4 rotate-180 text-muted" />
          </Link>
        </li>
        {user.role === 'admin' && (
          <li>
            <Link href="/admin" className={rowClass}>
              <Icon name="external" className="size-5 text-mask" />
              <span className="flex-1">Admin panel — every lab and user</span>
            </Link>
          </li>
        )}
      </ul>

      <Section title="Your name">
        <NameForm name={user.name ?? ''} />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
      <div className="mt-8 mb-4">
        <LogoutButton />
      </div>
    </div>
  )
}
