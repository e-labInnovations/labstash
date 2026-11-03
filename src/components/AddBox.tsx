'use client'

import { useRouter } from 'next/navigation'
import React, { useActionState, useEffect, useState } from 'react'

import { addBox, type ActionState } from '@/app/(app)/actions'

import { FormStatus, QtyStepper, SubmitButton } from './fields'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

/** "Add box" button + sheet: code, name, grid width and how many compartments to create. */
export function AddBox({ suggestedCode }: { suggestedCode: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-1.5 rounded-xl bg-mask px-4 font-semibold text-mask-ink"
      >
        <Icon name="plus" className="size-5" />
        Add box
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add box">
        <AddBoxForm suggestedCode={suggestedCode} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

function AddBoxForm({ suggestedCode, onDone }: { suggestedCode: string; onDone: () => void }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(addBox, null)

  useEffect(() => {
    if (state && 'ok' in state) {
      onDone()
      router.push(`/l/${encodeURIComponent(state.ok)}`)
    }
  }, [state, onDone, router])

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[15px] text-muted">Code</span>
          <input
            name="code"
            required
            defaultValue={suggestedCode}
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[18px] font-semibold"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] text-muted">Name</span>
          <input
            name="name"
            placeholder="SMD capacitors"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-line bg-surface px-4"
          />
        </label>
      </div>
      <QtyStepper name="compartments" initial={24} label="Compartments" />
      <QtyStepper name="columns" initial={6} label="Compartments per row" />
      <p className="-mt-2 text-[15px] text-muted">
        Compartments are numbered left to right, top to bottom: {suggestedCode}-01, {suggestedCode}
        -02…
      </p>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Add box</SubmitButton>
    </form>
  )
}
