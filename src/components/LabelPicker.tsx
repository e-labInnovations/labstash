'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { LABEL_SIZES, type Label, type LabelSize } from '@/lib/labels'

import { Icon } from './Icon'

const inBox = (label: Label, box: string) =>
  label.where.split(', ').some((c) => c === box || c.startsWith(`${box}-`))

const NOUN = { ids: ['part', 'parts'], boxes: ['box', 'boxes'] } as const

const LEVELS = { all: 'All', main: 'Main boxes', inner: 'Compartments' } as const
type Level = keyof typeof LEVELS
const atLevel = (label: Label, level: Level) =>
  level === 'all' || (level === 'main') === !label.inside

/** Pick parts or boxes (by search or a whole box at a time) and open them as an A4 label sheet. */
export function LabelPicker({
  labels,
  boxes,
  initialBox,
  param = 'ids',
}: {
  labels: Label[]
  boxes: string[]
  initialBox?: string
  /** Which sheet parameter the picked ids go in: part ids, or box codes */
  param?: keyof typeof NOUN
}) {
  const [one, many] = NOUN[param]
  const [query, setQuery] = useState('')
  const [box, setBox] = useState<string | null>(initialBox ?? null)
  const [picked, setPicked] = useState<string[]>(() =>
    initialBox ? labels.filter((l) => inBox(l, initialBox)).map((l) => l.id) : [],
  )
  const [size, setSize] = useState<LabelSize>(param === 'boxes' ? 'm' : 's')
  const [level, setLevel] = useState<Level>('all')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return labels.filter(
      (l) =>
        (!box || inBox(l, box)) &&
        atLevel(l, level) &&
        (!q || `${l.name} ${l.detail} ${l.where}`.toLowerCase().includes(q)),
    )
  }, [labels, box, level, query])

  // Hidden labels would still print, so switching level unpicks what it hides
  const pickLevel = (next: Level) => {
    setLevel(next)
    const byId = new Map(labels.map((l) => [l.id, l]))
    setPicked((prev) => prev.filter((id) => atLevel(byId.get(id)!, next)))
  }

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

  const sheet = `/print/labels?size=${size}&${param}=${picked.map(encodeURIComponent).join(',')}`

  return (
    <div className="pb-24 lg:pb-0">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          param === 'boxes' ? 'Filter by code or name' : 'Filter by name, value, package or box'
        }
        aria-label={`Filter ${many}`}
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-line bg-raised px-4"
      />
      {param === 'boxes' && (
        <div className="mt-3 flex gap-1 rounded-xl border border-line p-1 lg:max-w-md">
          {(Object.keys(LEVELS) as Level[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pickLevel(key)}
              aria-pressed={level === key}
              className={`h-10 flex-1 rounded-lg text-[15px] font-semibold ${
                level === key ? 'bg-mask-soft text-mask' : 'text-muted'
              }`}
            >
              {LEVELS[key]}
            </button>
          ))}
        </div>
      )}
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
          {shown.length} {shown.length === 1 ? one : many}
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
                {l.kind === 'box' ? (
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">
                      <b>{l.where}</b>
                      {l.name && ` · ${l.name}`}
                    </span>
                    {l.detail && <span className="block text-[15px] text-muted">{l.detail}</span>}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">{l.name}</span>
                    <span className="block text-[15px] text-muted">
                      {[l.detail, l.where || 'not in a box'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                )}
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
              Pick {many} to print
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
