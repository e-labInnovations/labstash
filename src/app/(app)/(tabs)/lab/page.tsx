import { notFound } from 'next/navigation'
import React from 'react'

import { LabBadge } from '@/components/LabBadge'
import { LabSettingsForm } from '@/components/LabSettingsForm'
import { PageHeader } from '@/components/ui'
import { getLab, requireSession } from '@/lib/session'
import { THEMES } from '@/lib/themes'

export const metadata = { title: 'Lab' }

export default async function LabPage() {
  await requireSession()
  const lab = await getLab()
  if (!lab) notFound()

  return (
    <>
      <PageHeader title="Lab" back="/">
        <p className="mt-1 text-muted">
          {lab.canManage
            ? 'Its name and logo show under LabStash; the theme colours the app for everyone in the lab.'
            : 'Only a lab admin can change the lab’s name, logo and theme.'}
        </p>
      </PageHeader>
      {lab.canManage ? (
        <LabSettingsForm lab={lab} />
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <span className="text-[22px] font-semibold">
            <LabBadge name={lab.name} logo={lab.logo?.thumb ?? null} size="lg" />
          </span>
          <p className="flex items-center gap-2 text-muted">
            Theme
            <span
              className="inline-block size-5 rounded-full border border-line"
              style={{ background: THEMES[lab.theme].swatch }}
            />
            <span className="font-semibold text-ink">{THEMES[lab.theme].name}</span>
          </p>
        </div>
      )}
    </>
  )
}
