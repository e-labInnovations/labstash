'use client'

import { useRouter } from 'next/navigation'
import React, { startTransition, useActionState, useEffect } from 'react'

import { editPart, type ActionState } from '@/app/(app)/actions'
import type { CategoryOption } from '@/lib/queries'

import { Field, FormStatus, SubmitButton, inputClass } from './fields'

export type EditablePart = {
  id: string
  name: string
  value: string
  package: string
  mpn: string
  manufacturer: string
  category: string
  minStock: string
  notes: string
  kicadSymbol: string
  kicadFootprint: string
}

/** Everything about a part except how many there are; stock changes go through the ledger. */
export function EditPartForm({
  part,
  categories,
}: {
  part: EditablePart
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionState, FormData>(editPart, null)

  useEffect(() => {
    if (state && 'ok' in state) router.replace(`/parts/${state.ok}`)
  }, [state, router])

  return (
    <form
      // Submitted by hand so a refusal (duplicate name, unreadable value) keeps the edits
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="flex max-w-xl flex-col gap-5"
    >
      <input type="hidden" name="id" value={part.id} />
      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={part.name}
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Value">
          <input
            name="value"
            defaultValue={part.value}
            placeholder="10k, 100nF, 3.3V"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Package">
          <input
            name="package"
            defaultValue={part.package}
            placeholder="0603, TO-220"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Part number">
          <input name="mpn" defaultValue={part.mpn} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Maker">
          <input
            name="manufacturer"
            defaultValue={part.manufacturer}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Category">
        <select name="category" defaultValue={part.category} className={inputClass}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Reorder at">
        <input
          name="minStock"
          defaultValue={part.minStock}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Optional"
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="KiCad symbol">
          <input
            name="kicadSymbol"
            defaultValue={part.kicadSymbol}
            placeholder="Device:R"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="KiCad footprint">
          <input
            name="kicadFootprint"
            defaultValue={part.kicadFootprint}
            placeholder="Resistor_SMD:R_0603_1608Metric"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </div>
      <p className="-mt-3 text-[15px] text-muted">
        Library names. Add the files themselves under Files and links on the part.
      </p>

      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={part.notes}
          rows={3}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3"
        />
      </Field>

      <p className="-mt-2 text-[15px] text-muted">
        To change how many you have, use Fix count on the part.
      </p>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  )
}
