'use client'

import React, { useActionState, useCallback, useEffect, useState } from 'react'

import { recordMovement, type ActionState } from '@/app/(app)/actions'
import type { LocationOption } from '@/lib/queries'

import { FormStatus, LocationPicker, QtyStepper, SubmitButton, rememberLocation } from './fields'
import { Sheet } from './Sheet'
import { Toast } from './Toast'

/** "Put away" on an INBOX row: a move out of INBOX into a box. */
export function PutAway({
  partId,
  partName,
  inboxId,
  quantity,
  locations,
}: {
  partId: string
  partName: string
  inboxId: string
  quantity: number
  locations: LocationOption[]
}) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 shrink-0 rounded-xl bg-mask px-4 text-[16px] font-semibold text-mask-ink"
      >
        Put away
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Put away">
        <p className="-mt-2 mb-4 line-clamp-2 text-muted">{partName}</p>
        <PutAwayForm
          partId={partId}
          inboxId={inboxId}
          quantity={quantity}
          locations={locations}
          onDone={(msg) => {
            setOpen(false)
            setToast(msg)
          }}
        />
      </Sheet>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}

function PutAwayForm({
  partId,
  inboxId,
  quantity,
  locations,
  onDone,
}: {
  partId: string
  inboxId: string
  quantity: number
  locations: LocationOption[]
  onDone: (msg: string) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordMovement, null)
  useEffect(() => {
    if (state && 'ok' in state) onDone(state.ok.replace('Moved', 'Put away'))
  }, [state, onDone])

  return (
    <form
      action={(form) => {
        const to = form.get('to')
        if (typeof to === 'string' && to) rememberLocation(to)
        action(form)
      }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="part" value={partId} />
      <input type="hidden" name="kind" value="move" />
      <input type="hidden" name="from" value={inboxId} />
      <LocationPicker name="to" label="Into" locations={locations} exclude={[inboxId]} />
      <QtyStepper name="quantity" max={quantity} initial={quantity} />
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Put away</SubmitButton>
    </form>
  )
}
