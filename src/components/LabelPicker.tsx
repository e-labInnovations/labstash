'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { LABEL_SIZES, type Label, type LabelSize } from '@/lib/labels'

import { Icon } from './Icon'

const inBox = (label: Label, box: string) =>
  label.where.split(', ').some((c) => c === box || c.startsWith(`${box}-`))

/** Pick parts (by search or a whole box at a time) and open them as an A4 label sheet. */
export function LabelPicker({
  labels,
  boxes,
  initialBox,
}: {
  labels: Label[]
  boxes: string[]
  initialBox?: string
}) {
  const [query, setQuery] = useState('')
  const [box, setBox] = useState<string | null>(initialBox ?? null)
  const [picked, setPicked] = useState<string[]>(() =>
    initialBox ? labels.filter((l) => inBox(l, initialBox)).map((l) => l.id) : [],
  )
  const [size, setSize] = useState<LabelSize>('s')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return labels.filter(
      (l) =>
        (!box || inBox(l, box)) &&
        (!q || `${l.name} ${l.detail} ${l.where}`.toLowerCase().includes(q)),
    )
  }, [labels, box, query])

  const isPicked = new Set(picked)
  const allShown = shown.length > 0 && shown.every((l) => isPicked.has(l.id))
  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleShown = () =>
    setPicked((prev) =>
      allShown
        ? prev.filter((id) => !shown.some((l) => l.id === id))
        : [...prev, ...shown.map((l) => l.id).filter((id) => !prev.includes(id))],
    )

  const sheet = `/print/labels?size=${size}&ids=${picked.join(',')}`

  return (
    <div className="pb-24 lg:pb-0">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name, value, package or box"
        aria-label="Filter parts"
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-line bg-raised px-4"
      />
      {boxes.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[null, ...boxes].map((code) => (
            <button
              key={code ?? 'all'}
              type="button"
              onClick={() => setBox(code)}
              aria-pressed={box === code}
              className={`h-10 shrink-0 rounded-full border px-4 text-[15px] font-semibold ${
                box === code ? 'border-mask bg-mask-soft text-mask' : 'border-line text-muted'
              }`}
            >
              {code ?? 'All boxes'}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 mb-1 flex items-center justify-between">
        <span className="text-[15px] text-muted">
          {shown.length} {shown.length === 1 ? 'part' : 'parts'}
        </span>
        {shown.length > 0 && (
          <button type="button" onClick={toggleShown} className="font-semibold text-mask">
            {allShown ? 'Unpick these' : 'Pick these'}
          </button>
        )}
      </div>
      <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
        {shown.map((l) => {
          const on = isPicked.has(l.id)
          return (
            <li key={l.id} className="border-b border-line">
              <label className="flex cursor-pointer items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(l.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${
                    on ? 'border-mask bg-mask text-mask-ink' : 'border-line'
                  }`}
                >
                  {on && <Icon name="check" className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium">{l.name}</span>
                  <span className="block text-[15px] text-muted">
                    {[l.detail, l.where || 'not in a box'].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {/* Phones: a bar above the tabs; desktop: inline at the end */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-xl items-center gap-2 lg:mx-0">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as LabelSize)}
            aria-label="Label size"
            className="h-13 rounded-2xl border border-line bg-raised px-3 font-semibold"
          >
            {Object.entries(LABEL_SIZES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.name} · {s.cols * s.rows}/page
              </option>
            ))}
          </select>
          {picked.length > 0 ? (
            <Link
              href={sheet}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-mask font-semibold text-mask-ink"
            >
              <Icon name="print" className="size-5" />
              {picked.length} {picked.length === 1 ? 'label' : 'labels'}
            </Link>
          ) : (
            <span className="flex h-13 flex-1 items-center justify-center rounded-2xl border border-dashed border-line text-muted">
              Pick parts to print
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
