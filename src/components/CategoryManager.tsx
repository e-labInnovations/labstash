'use client'

import {
  type CollisionDetection,
  DndContext,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
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

      <CategoryList
        rows={shown}
        all={rows}
        flat={Boolean(query.trim())}
        canEdit={canEdit}
        onEdit={(row) => setEditing({ mode: 'edit', row })}
        onMoved={setToast}
      />
      <p className="mt-3 text-[15px] text-muted">
        {canEdit
          ? 'Drag a category by its handle onto another to move it inside, or onto Top level. On a phone, press and hold the handle first.'
          : 'Only the admin can rename, move or delete categories, since every lab shares them.'}
      </p>

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

/** Every category below `id`, and `id` itself: where it can't be moved to. */
const subtree = (all: CategoryRow[], id: string) => {
  const below = new Set([id])
  for (const r of all) if (r.parent && below.has(r.parent)) below.add(r.id)
  return below
}

const TOP = 'top'

/** Drop where the pointer is (finger or mouse); the keyboard has no pointer, so nearest. */
const dropTarget: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)

function CategoryList({
  rows,
  all,
  flat,
  canEdit,
  onEdit,
  onMoved,
}: {
  rows: CategoryRow[]
  all: CategoryRow[]
  /** Filtered: full paths, no indenting */
  flat: boolean
  canEdit: boolean
  onEdit: (row: CategoryRow) => void
  onMoved: (message: string) => void
}) {
  const [dragging, setDragging] = useState<CategoryRow | null>(null)
  const [pending, startTransition] = useTransition()
  // Mouse after a small move; touch after a press-and-hold so the page still scrolls
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const row = all.find((r) => r.id === active.id)
    if (!row || !over) return
    const parent = over.id === TOP ? null : String(over.id)
    if (parent === row.parent) return
    if (parent && subtree(all, row.id).has(parent)) {
      onMoved('A category can’t go inside itself')
      return
    }
    const data = new FormData()
    data.set('id', row.id)
    data.set('name', row.name)
    if (parent) data.set('parent', parent)
    const target = parent ? all.find((r) => r.id === parent)?.name : 'the top level'
    startTransition(async () => {
      const result = await saveCategory(null, data)
      onMoved(result && 'error' in result ? result.error : `Moved “${row.name}” into ${target}`)
    })
  }

  const list = (
    <ul
      className={`overflow-hidden rounded-2xl border border-line bg-raised ${pending ? 'opacity-60' : ''}`}
    >
      {rows.map((r) => (
        <CategoryItem
          key={r.id}
          row={r}
          flat={flat}
          canEdit={canEdit}
          blocked={dragging ? subtree(all, dragging.id).has(r.id) : false}
          onEdit={() => onEdit(r)}
        />
      ))}
      {rows.length === 0 && <li className="px-4 py-6 text-center text-muted">No matches.</li>}
    </ul>
  )
  if (!canEdit) return list

  return (
    <DndContext
      sensors={sensors}
      // The Top level strip appears once dragging starts and shifts the list: keep measuring
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      collisionDetection={dropTarget}
      onDragStart={({ active }) => setDragging(all.find((r) => r.id === active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <TopLevelDrop visible={dragging !== null && dragging.parent !== null} />
      {list}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="flex h-12 w-max max-w-72 items-center gap-2 rounded-xl border border-mask bg-raised px-4 font-semibold whitespace-nowrap shadow-lg">
            <Icon name="tag" className="size-5 text-mask" />
            {dragging.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function TopLevelDrop({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TOP, disabled: !visible })
  if (!visible) return null
  return (
    <div
      ref={setNodeRef}
      className={`mb-2 flex h-12 items-center justify-center rounded-xl border-2 border-dashed font-semibold ${
        isOver ? 'border-mask bg-mask-soft text-mask' : 'border-line text-muted'
      }`}
    >
      Top level
    </div>
  )
}

function CategoryItem({
  row,
  flat,
  canEdit,
  blocked,
  onEdit,
}: {
  row: CategoryRow
  flat: boolean
  canEdit: boolean
  /** The category being dragged, or one inside it: not a place it can go */
  blocked: boolean
  onEdit: () => void
}) {
  const {
    setNodeRef: handle,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: row.id, disabled: !canEdit })
  const { setNodeRef: target, isOver } = useDroppable({ id: row.id, disabled: !canEdit || blocked })
  const label = (
    <>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ paddingLeft: flat ? 0 : `${row.depth * 1.25}rem` }}
      >
        {flat ? row.label : row.name}
      </span>
      {row.parts > 0 && (
        <span className="shrink-0 text-[15px] font-semibold text-muted">{row.parts}</span>
      )}
    </>
  )

  if (!canEdit) {
    return (
      <li className="border-b border-line last:border-0">
        <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">{label}</div>
      </li>
    )
  }
  return (
    <li
      ref={target}
      className={`flex items-center border-b border-line last:border-0 ${
        isOver ? 'bg-mask-soft' : ''
      } ${isDragging || blocked ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        ref={handle}
        {...listeners}
        {...attributes}
        aria-label={`Move ${row.name}`}
        className="grid h-12 w-10 shrink-0 cursor-grab touch-none place-items-center text-muted active:cursor-grabbing"
      >
        <Icon name="grip" className="size-5" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left hover:bg-surface"
      >
        {label}
        <Icon name="edit" className="size-4 shrink-0 text-muted" />
      </button>
    </li>
  )
}
