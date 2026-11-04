'use client'

import React, { useCallback, useMemo, useState, useTransition } from 'react'

import { type ActionState, removeCategory, saveCategory } from '@/app/(app)/actions'
import type { CategoryRow } from '@/lib/categories'

import { Field, FormStatus, SubmitButton, inputClass } from './fields'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { Toast } from './Toast'

type Editing = { mode: 'add'; parent: string | null } | { mode: 'edit'; row: CategoryRow }

/** The shared category tree: anyone adds, the admin also renames, moves and deletes. */
export function CategoryManager({ rows, canEdit }: { rows: CategoryRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows
  }, [rows, query])

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter categories"
          aria-label="Filter categories"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-raised px-4"
        />
        <button
          type="button"
          onClick={() => setEditing({ mode: 'add', parent: null })}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-mask px-4 font-semibold text-mask-ink"
        >
          <Icon name="plus" className="size-5" />
          Add
        </button>
      </div>
      <p className="mt-3 mb-1 text-[15px] text-muted">
        {rows.length} categories, shared by every lab. Numbers are your parts in each.
      </p>

      <ul className="overflow-hidden rounded-2xl border border-line bg-raised">
        {shown.map((r) => {
          const inner = (
            <>
              <span
                className="min-w-0 flex-1 truncate"
                style={{ paddingLeft: query ? 0 : `${r.depth * 1.25}rem` }}
              >
                {query ? r.label : r.name}
              </span>
              {r.parts > 0 && (
                <span className="shrink-0 text-[15px] font-semibold text-muted">{r.parts}</span>
              )}
            </>
          )
          return (
            <li key={r.id} className="border-b border-line last:border-0">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing({ mode: 'edit', row: r })}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface"
                >
                  {inner}
                  <Icon name="edit" className="size-4 shrink-0 text-muted" />
                </button>
              ) : (
                <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">{inner}</div>
              )}
            </li>
          )
        })}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-muted">No matches.</li>}
      </ul>
      {!canEdit && (
        <p className="mt-3 text-[15px] text-muted">
          Only the admin can rename, move or delete categories, since every lab shares them.
        </p>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Edit category' : 'Add a category'}
      >
        {editing && (
          <CategoryForm
            editing={editing}
            rows={rows}
            onDone={(msg) => {
              setEditing(null)
              setToast(msg)
            }}
          />
        )}
      </Sheet>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}

function CategoryForm({
  editing,
  rows,
  onDone,
}: {
  editing: Editing
  rows: CategoryRow[]
  onDone: (msg: string) => void
}) {
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()
  const row = editing.mode === 'edit' ? editing.row : null

  // Somewhere to go: anything but the category itself and what sits below it
  const parents = useMemo(() => {
    if (!row) return rows
    const below = new Set([row.id])
    for (const r of rows) if (r.parent && below.has(r.parent)) below.add(r.id)
    return rows.filter((r) => !below.has(r.id))
  }, [rows, row])

  const run = (call: () => Promise<ActionState>) =>
    startTransition(async () => {
      const result = await call()
      if (result && 'ok' in result) onDone(result.ok)
      else setState(result)
    })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        run(() => saveCategory(null, data))
      }}
      className="flex flex-col gap-5"
    >
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={row?.name ?? ''}
          autoComplete="off"
          className={inputClass}
        />
      </Field>
      <Field label="Inside">
        <select
          name="parent"
          defaultValue={row?.parent ?? (editing.mode === 'add' ? (editing.parent ?? '') : '')}
          className={inputClass}
        >
          <option value="">Top level</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>{row ? 'Save' : 'Add category'}</SubmitButton>
      {row && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete “${row.name}”?`)) return
            const data = new FormData()
            data.set('id', row.id)
            run(() => removeCategory(null, data))
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line font-semibold text-danger disabled:opacity-60"
        >
          <Icon name="trash" className="size-5" />
          Delete
        </button>
      )}
    </form>
  )
}
