'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import type { LocationOption } from '@/lib/queries'

import { Icon } from './Icon'

export function QtyStepper({
  name,
  max,
  initial = 1,
  label = 'Quantity',
}: {
  name: string
  max?: number
  initial?: number
  label?: string
}) {
  const [n, setN] = useState(initial)
  const clamp = (v: number) => Math.max(0, max != null ? Math.min(max, v) : v)
  return (
    <div>
      <span className="mb-1.5 block text-[15px] text-muted">
        {label}
        {max != null && <span> (up to {max})</span>}
      </span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setN((v) => clamp(v - 1))}
          aria-label="One less"
          className="grid size-14 place-items-center rounded-xl border border-line"
        >
          <Icon name="minus" />
        </button>
        <input
          name={name}
          inputMode="numeric"
          pattern="[0-9]*"
          value={n}
          onChange={(e) => setN(clamp(Number(e.target.value.replace(/\D/g, '')) || 0))}
          aria-label={label}
          className="h-14 w-full min-w-0 flex-1 rounded-xl border border-line bg-surface text-center text-[24px] font-semibold"
        />
        <button
          type="button"
          onClick={() => setN((v) => clamp(v + 1))}
          aria-label="One more"
          className="grid size-14 place-items-center rounded-xl border border-line"
        >
          <Icon name="plus" />
        </button>
        {max != null && max > 1 && (
          <button
            type="button"
            onClick={() => setN(max)}
            className="h-14 rounded-xl border border-line px-4 text-[15px] font-semibold"
          >
            All
          </button>
        )}
      </div>
    </div>
  )
}

const RECENT_KEY = 'labstash:recent-locations'

const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

export const rememberLocation = (id: string) => {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {}
}

/** Type-to-filter location list; recent picks float to the top. Submits the id under `name`. */
export function LocationPicker({
  name,
  label,
  locations,
  exclude = [],
}: {
  name: string
  label: string
  locations: LocationOption[]
  exclude?: string[]
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  // Only ever mounted inside an opened sheet, so reading storage here never runs on the server
  const [recent] = useState<string[]>(readRecent)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = locations.filter((l) => !exclude.includes(l.id))
    const hits = q
      ? pool.filter((l) => l.code.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q))
      : [
          ...recent.map((id) => pool.find((l) => l.id === id)).filter((l) => l !== undefined),
          ...pool.filter((l) => !recent.includes(l.id)),
        ]
    return hits.slice(0, 8)
  }, [query, locations, exclude, recent])

  const chosen = locations.find((l) => l.id === selected)

  return (
    <fieldset>
      <legend className="mb-1.5 text-[15px] text-muted">{label}</legend>
      <input type="hidden" name={name} value={selected ?? ''} />
      {chosen ? (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex h-14 w-full items-center justify-between rounded-xl border-2 border-mask bg-mask-soft px-4 text-left"
        >
          <span>
            <span className="text-[19px] font-semibold text-mask">{chosen.code}</span>
            {chosen.name && <span className="ml-2 text-muted">{chosen.name}</span>}
          </span>
          <span className="text-[15px] text-muted">Change</span>
        </button>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Box or compartment code"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-line bg-surface px-4"
          />
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {options.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelected(l.id)}
                  className="h-12 w-full truncate rounded-xl border border-line px-2 text-[16px] font-semibold"
                >
                  {l.code}
                </button>
              </li>
            ))}
          </ul>
          {options.length === 0 && (
            <p className="mt-2 text-[15px] text-muted">
              {query.trim() ? `No location matches “${query.trim()}”.` : 'No boxes yet.'}{' '}
              <Link
                href="/admin/collections/locations/create"
                className="font-semibold text-mask underline underline-offset-4"
              >
                Add one in the admin
              </Link>
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}

export const inputClass = 'h-12 w-full rounded-xl border border-line bg-surface px-4'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] text-muted">{label}</span>
      {children}
    </label>
  )
}

export function FormStatus({ state }: { state: { ok: string } | { error: string } | null }) {
  if (!state || !('error' in state)) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger"
    >
      <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
      {state.error}
    </p>
  )
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 w-full rounded-2xl bg-mask text-[18px] font-semibold text-mask-ink disabled:opacity-60"
    >
      {pending ? 'Saving…' : children}
    </button>
  )
}
