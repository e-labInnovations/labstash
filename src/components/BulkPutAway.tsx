'use client'

import React, { useActionState, useCallback, useEffect, useState } from 'react'

import { putAwayMany, type ActionState } from '@/app/(app)/actions'
import type { LocationOption } from '@/lib/queries'

import { FormStatus, LocationPicker, SubmitButton, rememberLocation } from './fields'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { Toast } from './Toast'

export type InboxItem = { partId: string; name: string; quantity: number }

/** Tick several Inbox parts and put all of each into one box. */
export function BulkPutAway({
  items,
  inboxId,
  locations,
}: {
  items: InboxItem[]
  inboxId: string
  locations: LocationOption[]
}) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  // Stays mounted when the Inbox shrinks to one row (or none), so the toast can still show
  return (
    <>
      {items.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 shrink-0 items-center rounded-xl border border-line px-4 font-semibold"
        >
          Put several away
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Put several away">
        {open && (
          <BulkForm
            items={items}
            inboxId={inboxId}
            locations={locations}
            onDone={(msg) => {
              setOpen(false)
              setToast(msg)
            }}
          />
        )}
      </Sheet>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}

function BulkForm({
  items,
  inboxId,
  locations,
  onDone,
}: {
  items: InboxItem[]
  inboxId: string
  locations: LocationOption[]
  onDone: (msg: string) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(putAwayMany, null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (state && 'ok' in state) onDone(state.ok)
  }, [state, onDone])

  const all = picked.size === items.length
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <form
      action={(form) => {
        const to = form.get('to')
        if (typeof to === 'string' && to) rememberLocation(to)
        action(form)
      }}
      className="flex flex-col gap-5"
    >
      <fieldset>
        <div className="mb-1.5 flex items-center justify-between">
          <legend className="text-[15px] text-muted">
            {picked.size ? `${picked.size} of ${items.length} picked` : 'Which parts'}
          </legend>
          <button
            type="button"
            onClick={() => setPicked(all ? new Set() : new Set(items.map((i) => i.partId)))}
            className="text-[15px] font-semibold text-mask"
          >
            {all ? 'Clear' : 'Pick all'}
          </button>
        </div>
        <ul className="max-h-[38vh] overflow-y-auto rounded-xl border border-line">
          {items.map((item) => {
            const on = picked.has(item.partId)
            return (
              <li key={item.partId} className="border-b border-line last:border-0">
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    name="part"
                    value={item.partId}
                    checked={on}
                    onChange={() => toggle(item.partId)}
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
                  <span className="line-clamp-2 min-w-0 flex-1 text-[16px]">{item.name}</span>
                  <span className="shrink-0 font-semibold">{item.quantity}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      <LocationPicker name="to" label="All into" locations={locations} exclude={[inboxId]} />
      <FormStatus state={state} />
      <SubmitButton pending={pending}>
        {picked.size ? `Put ${picked.size} away` : 'Put away'}
      </SubmitButton>
    </form>
  )
}
