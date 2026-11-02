import Link from 'next/link'
import React from 'react'

import { Empty, PageHeader, Section } from '@/components/ui'
import { openPurchases } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import type { Purchase, Supplier } from '@/payload-types'

export const metadata = { title: 'Orders' }

const statusText: Record<Purchase['status'], string> = {
  ordered: 'Waiting',
  partial: 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
}

export default async function OrdersPage() {
  const { payload, user } = await requireSession()
  const purchases = await openPurchases(payload, user)
  const open = purchases.filter((p) => p.status === 'ordered' || p.status === 'partial')
  const done = purchases.filter((p) => p.status === 'received' || p.status === 'cancelled')

  return (
    <>
      <PageHeader title="Orders" />
      {purchases.length === 0 ? (
        <Empty>No orders yet. Import one with npm run import:etstore.</Empty>
      ) : (
        <>
          {open.length > 0 ? (
            <OrderList purchases={open} />
          ) : (
            <p className="text-muted">Nothing on the way.</p>
          )}
          {done.length > 0 && (
            <Section title="Done">
              <OrderList purchases={done} />
            </Section>
          )}
        </>
      )}
    </>
  )
}

function OrderList({ purchases }: { purchases: Purchase[] }) {
  return (
    <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
      {purchases.map((p) => (
        <li key={p.id}>
          <Link
            href={`/orders/${p.id}`}
            className="block rounded-2xl border border-line bg-raised px-4 py-3.5"
          >
            <span className="flex items-baseline justify-between">
              <span className="text-[19px] font-semibold">
                {(p.supplier as Supplier).name} {p.orderNumber}
              </span>
              {p.total != null && (
                <span className="font-medium">₹{p.total.toLocaleString('en-IN')}</span>
              )}
            </span>
            <span className="mt-0.5 flex justify-between text-[15px] text-muted">
              <span
                className={
                  p.status === 'ordered' || p.status === 'partial' ? 'font-medium text-enig' : ''
                }
              >
                {statusText[p.status]}
              </span>
              {p.orderedAt && (
                <span>
                  {new Date(p.orderedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
