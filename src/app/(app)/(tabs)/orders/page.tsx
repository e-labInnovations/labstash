import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { Empty, Section } from '@/components/ui'
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight lg:text-[34px]">
          Orders
        </h1>
        <Link
          href="/orders/import"
          className="flex h-11 items-center gap-1.5 rounded-xl bg-mask px-4 font-semibold whitespace-nowrap text-mask-ink"
        >
          <Icon name="plus" className="size-5" />
          Import
        </Link>
      </div>
      {purchases.length === 0 ? (
        <Empty>No orders yet. Use Import to bring in your ETstore orders.</Empty>
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
