import React from 'react'

import { Sidebar, TabBar } from '@/components/TabBar'
import { SearchBar } from '@/components/ui'
import { requireSession } from '@/lib/session'
import { inboxSummary } from '@/lib/queries'

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const { payload, user } = await requireSession()
  const inbox = await inboxSummary(payload, user)

  return (
    <>
      <Sidebar inboxCount={inbox.parts} search={<SearchBar compact />} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-3xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28 md:px-6 lg:max-w-6xl lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>
      <TabBar inboxCount={inbox.parts} />
    </>
  )
}
