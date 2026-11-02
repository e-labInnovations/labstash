import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ReceiveForm } from '@/components/ReceiveForm'
import { PageHeader, Section } from '@/components/ui'
import { purchaseWithLines } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import type { Part, Supplier } from '@/payload-types'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user } = await requireSession()
  const data = await purchaseWithLines(payload, user, id)
  if (!data) notFound()
  const { purchase, lines } = data

  const partId = (p: string | Part) => (typeof p === 'object' ? p.id : p)
  const open = lines
    .filter((l) => !l.cancelled && (l.qtyReceived ?? 0) < l.qtyOrdered)
    .map((l) => ({
      id: l.id,
      title: l.title,
      partId: partId(l.part),
      ordered: l.qtyOrdered,
      outstanding: l.qtyOrdered - (l.qtyReceived ?? 0),
    }))
  const closed = lines.filter((l) => l.cancelled || (l.qtyReceived ?? 0) >= l.qtyOrdered)

  return (
    <>
      <PageHeader
        title={`${(purchase.supplier as Supplier).name} ${purchase.orderNumber}`}
        back="/orders"
      >
        <p className="mt-1 text-muted">
          {lines.length} lines
          {purchase.total != null && `, ₹${purchase.total.toLocaleString('en-IN')} paid`}
        </p>
      </PageHeader>

      {open.length > 0 ? (
        <>
          <p className="mb-2 text-muted">
            Mark anything that didn’t come, then receive the rest into the Inbox.
          </p>
          <ReceiveForm purchaseId={purchase.id} lines={open} />
        </>
      ) : (
        <p className="rounded-2xl bg-mask-soft px-5 py-4 font-medium text-mask">
          Everything on this order is accounted for.
        </p>
      )}

      {closed.length > 0 && (
        <Section title="Already handled">
          <ul>
            {closed.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0"
              >
                <Link href={`/parts/${partId(l.part)}`} className="line-clamp-2 text-muted">
                  {l.title}
                </Link>
                <span className="shrink-0 text-[15px] text-muted">
                  {l.cancelled ? 'Missing' : `${l.qtyReceived} received`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
