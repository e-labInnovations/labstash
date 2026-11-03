'use client'

import { useRouter } from 'next/navigation'
import React, { startTransition, useActionState, useEffect, useState } from 'react'

import { addPart, type ActionState } from '@/app/(app)/actions'
import type { CategoryOption, LocationOption } from '@/lib/queries'

import {
  Field,
  FormStatus,
  LocationPicker,
  QtyStepper,
  SubmitButton,
  inputClass,
  rememberLocation,
} from './fields'

/** A part that didn't come from an order, with however many you have and where they are. */
export function AddPartForm({
  name = '',
  categories,
  locations,
  inboxId,
}: {
  name?: string
  categories: CategoryOption[]
  locations: LocationOption[]
  inboxId: string | null
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(addPart, null)
  // INBOX unless a box is picked; the picker reads recent boxes from storage, so it only
  // mounts after a tap (never during server render)
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    if (state && 'ok' in state) router.replace(`/parts/${state.ok}`)
  }, [state, router])

  return (
    <form
      // Submitted by hand rather than through `action`, which resets the form and would
      // wipe what was typed when the server says no (e.g. a duplicate name)
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const loc = data.get('location')
        if (typeof loc === 'string' && loc) rememberLocation(loc)
        startTransition(() => action(data))
      }}
      className="flex max-w-xl flex-col gap-5"
    >
      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={name}
          placeholder="10k resistor 1/4 W"
          autoComplete="off"
          className={inputClass}
        />
      </Field>
      <p className="-mt-3 text-[15px] text-muted">
        Values like 10k, 100nF and packages like 0603 or SOP-8 in the name are picked up for search.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Package">
          <input
            name="package"
            placeholder="0603, TO-220"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Part number">
          <input name="mpn" placeholder="NE555P" autoComplete="off" className={inputClass} />
        </Field>
      </div>

      <Field label="Category">
        <select name="category" defaultValue="" className={inputClass}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <QtyStepper name="quantity" initial={1} label="How many you have" />

      {choosing ? (
        <LocationPicker
          name="location"
          label="Where they are"
          locations={locations}
          exclude={inboxId ? [inboxId] : []}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
          <span>
            <span className="block text-[15px] text-muted">Where they are</span>
            <span className="font-semibold">INBOX, to put away later</span>
          </span>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="h-11 shrink-0 rounded-xl border border-line px-4 font-semibold"
          >
            Pick a box
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Reorder at">
          <input
            name="minStock"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Optional"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Where from">
          <input
            name="note"
            placeholder="Salvaged, gift…"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
      </div>

      <FormStatus state={state} />
      <SubmitButton pending={pending}>Add part</SubmitButton>
    </form>
  )
}
