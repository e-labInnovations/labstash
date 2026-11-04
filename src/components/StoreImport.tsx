'use client'

import Link from 'next/link'
import React, { useState, useTransition } from 'react'

import { storeImport, storeOrders, storePreview } from '@/app/(app)/actions'
import type { ImportedOrder, ListedOrder } from '@/lib/stores/import'

import { FormStatus, inputClass } from './fields'
import { Icon } from './Icon'

type Preview = Extract<Awaited<ReturnType<typeof storePreview>>, { ok: true }>['data']

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Store → key → orders → preview → import. The key lives only in this component's memory:
 * it is sent with each request and gone when you leave the page.
 */
export function StoreImport() {
  const [store, setStore] = useState<'etstore' | 'robu' | null>(null)
  const [key, setKey] = useState('')
  const [orders, setOrders] = useState<ListedOrder[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<ImportedOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = <T,>(
    call: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    then: (data: T) => void,
  ) =>
    startTransition(async () => {
      setError(null)
      const result = await call()
      if (result.ok) then(result.data)
      else setError(result.error)
    })

  if (done) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {done.map((o) => (
            <li key={o.purchaseId} className="rounded-2xl border border-line bg-raised px-4 py-3">
              <Link href={`/orders/${o.purchaseId}`} className="font-semibold text-mask">
                {o.number}
              </Link>
              <p className="text-[15px] text-muted">
                {o.status === 'exists'
                  ? 'Already in your lab'
                  : [
                      `${o.partsCreated} new ${o.partsCreated === 1 ? 'part' : 'parts'}`,
                      `${o.partsMatched} you already had`,
                      o.photos > 0 && `${o.photos} photos`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-muted">
          Open an order when the parcel arrives to receive it into the Inbox.
        </p>
        <Link
          href="/orders"
          className="flex h-13 items-center justify-center rounded-2xl bg-mask font-semibold text-mask-ink"
        >
          Go to orders
        </Link>
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* 1. Store */}
      <fieldset>
        <legend className="mb-2 text-[15px] text-muted">Store</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['etstore', 'ETstore', 'etstore.in'],
              ['robu', 'Robu', 'robu.in'],
            ] as const
          ).map(([value, name, site]) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col rounded-2xl border-2 px-4 py-3 ${
                store === value ? 'border-mask bg-mask-soft' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="store"
                value={value}
                checked={store === value}
                onChange={() => setStore(value)}
                className="sr-only"
              />
              <span className="font-semibold">{name}</span>
              <span className="text-[15px] text-muted">{site}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {store === 'robu' && (
        <p className="rounded-2xl border border-line bg-raised px-4 py-3">
          Robu import is coming. Robu doesn’t let other apps read your orders, so it will work from
          the order details you paste from your Robu account.
        </p>
      )}

      {/* 2. Key */}
      {store === 'etstore' && !orders && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(() => storeOrders(key), setOrders)
          }}
          className="flex flex-col gap-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-[15px] text-muted">ETstore access key</span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              placeholder="shcat_…"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
          </label>
          <details className="rounded-2xl border border-line bg-raised px-4 py-3 text-[15px]">
            <summary className="cursor-pointer font-semibold">How to get the key</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>On a computer, sign in at etstore.in and open Account → Orders.</li>
              <li>
                Open the browser’s developer tools (F12) → Network, and click a request to{' '}
                <code className="break-all text-ink">
                  shopify.com/…/account/customer/api/…/graphql
                </code>
                .
              </li>
              <li>
                Copy the <b className="text-ink">Authorization</b> request header; it starts with{' '}
                <code className="text-ink">shcat_</code>.
              </li>
            </ol>
            <p className="mt-2 text-muted">
              It lasts about an hour and is only used while this page is open; LabStash never saves
              it.
            </p>
          </details>
          <FormStatus state={error ? { error } : null} />
          <button
            type="submit"
            disabled={pending || !key.trim()}
            className="flex h-13 items-center justify-center rounded-2xl bg-mask font-semibold text-mask-ink disabled:opacity-60"
          >
            {pending ? 'Reading your orders…' : 'Show my orders'}
          </button>
        </form>
      )}

      {/* 3. Orders */}
      {store === 'etstore' && orders && !preview && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-muted">
              {orders.length} recent {orders.length === 1 ? 'order' : 'orders'}
            </span>
            <button
              type="button"
              onClick={() => {
                setOrders(null)
                setPicked([])
              }}
              className="text-[15px] font-semibold text-mask"
            >
              Use another key
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {orders.map((o) => {
              const on = picked.includes(o.id)
              return (
                <li key={o.id}>
                  <label
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                      o.imported ? 'border-line opacity-60' : 'cursor-pointer border-line bg-raised'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={o.imported}
                      checked={on}
                      onChange={() =>
                        setPicked((p) => (on ? p.filter((x) => x !== o.id) : [...p, o.id]))
                      }
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 ${
                        on ? 'border-mask bg-mask text-mask-ink' : 'border-line'
                      }`}
                    >
                      {on && <Icon name="check" className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-3">
                        <span className="font-semibold">{o.number}</span>
                        <span className="font-semibold">{inr(o.total)}</span>
                      </span>
                      <span className="block text-[15px] text-muted">
                        {day(o.placedAt)} · {o.items} {o.items === 1 ? 'item' : 'items'}
                        {o.imported ? ' · already imported' : ''}
                      </span>
                      {o.firstItem && (
                        <span className="block truncate text-[15px] text-muted">
                          {o.firstItem}
                          {o.items > 1 ? ` and ${o.items - 1} more` : ''}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <FormStatus state={error ? { error } : null} />
          <button
            type="button"
            disabled={pending || picked.length === 0}
            onClick={() => run(() => storePreview(key, picked), setPreview)}
            className="flex h-13 items-center justify-center rounded-2xl bg-mask font-semibold text-mask-ink disabled:opacity-60"
          >
            {pending
              ? 'Checking the parts…'
              : picked.length
                ? `Preview ${picked.length} ${picked.length === 1 ? 'order' : 'orders'}`
                : 'Tick orders to import'}
          </button>
        </div>
      )}

      {/* 4. Preview */}
      {store === 'etstore' && preview && (
        <div className="flex flex-col gap-4">
          {preview.map((o) => {
            const fresh = o.lines.filter((l) => !l.match).length
            return (
              <section key={o.id} className="rounded-2xl border border-line bg-raised">
                <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
                  <span className="font-semibold">{o.number}</span>
                  <span className="text-[15px] text-muted">
                    {o.lines.length} lines · {fresh} new {fresh === 1 ? 'part' : 'parts'} ·{' '}
                    {inr(o.total)}
                  </span>
                </header>
                <ul>
                  {o.lines.map((l) => (
                    <li
                      key={l.sku}
                      className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2">{l.name}</span>
                        <span className="block text-[14px] text-muted">
                          {l.sku} ·{' '}
                          {l.match ? (
                            <span>adds to your “{l.match.name}”</span>
                          ) : (
                            <span className="font-semibold text-mask">new part</span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold">×{l.quantity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <FormStatus state={error ? { error } : null} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setPreview(null)}
              className="flex h-13 items-center justify-center rounded-2xl border border-line px-5 font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => storeImport(key, picked), setDone)}
              className="flex h-13 flex-1 items-center justify-center rounded-2xl bg-mask font-semibold text-mask-ink disabled:opacity-60"
            >
              {pending
                ? 'Importing…'
                : `Import ${preview.length} ${preview.length === 1 ? 'order' : 'orders'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
