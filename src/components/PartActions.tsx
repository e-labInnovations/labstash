'use client'

import React, { useActionState, useCallback, useEffect, useState } from 'react'

import { recordMovement, type ActionState } from '@/app/(app)/actions'
import type { LocationOption } from '@/lib/queries'

import { FormStatus, LocationPicker, QtyStepper, SubmitButton, rememberLocation } from './fields'
import { Sheet } from './Sheet'
import { Toast } from './Toast'

export type HeldAt = { locationId: string; code: string; quantity: number }

type Kind = 'use' | 'move' | 'adjust'

const titles: Record<Kind, string> = { use: 'Take', move: 'Move', adjust: 'Fix the count' }

export function PartActions({
  partId,
  held,
  locations,
}: {
  partId: string
  held: HeldAt[]
  locations: LocationOption[]
}) {
  const [kind, setKind] = useState<Kind | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const has = held.length > 0

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_auto] gap-2 lg:max-w-none lg:grid-cols-1">
          <ActionButton primary disabled={!has} onClick={() => setKind('use')}>
            Take
          </ActionButton>
          <ActionButton disabled={!has} onClick={() => setKind('move')}>
            Move
          </ActionButton>
          <ActionButton onClick={() => setKind('adjust')}>Fix count</ActionButton>
        </div>
      </div>

      <Sheet open={kind !== null} onClose={() => setKind(null)} title={kind ? titles[kind] : ''}>
        {kind && (
          <MovementForm
            key={kind}
            kind={kind}
            partId={partId}
            held={held}
            locations={locations}
            onDone={(msg) => {
              setKind(null)
              setToast(msg)
            }}
          />
        )}
      </Sheet>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}

function ActionButton({
  primary,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-13 rounded-2xl px-4 text-[17px] font-semibold disabled:opacity-40 ${
        primary ? 'bg-mask text-mask-ink' : 'border border-line bg-raised'
      }`}
    >
      {children}
    </button>
  )
}

function MovementForm({
  kind,
  partId,
  held,
  locations,
  onDone,
}: {
  kind: Kind
  partId: string
  held: HeldAt[]
  locations: LocationOption[]
  onDone: (message: string) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordMovement, null)
  const [from, setFrom] = useState(held[0]?.locationId ?? '')
  const [direction, setDirection] = useState<'add' | 'remove'>(held.length ? 'remove' : 'add')
  const max = held.find((h) => h.locationId === from)?.quantity

  useEffect(() => {
    if (state && 'ok' in state) onDone(state.ok)
  }, [state, onDone])

  const submitKind = kind === 'adjust' ? direction : kind

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
      <input type="hidden" name="kind" value={submitKind} />

      {kind === 'adjust' && (
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'add', label: 'Found more' },
            { value: 'remove', label: 'Have fewer', disabled: !held.length },
          ]}
        />
      )}

      {(kind !== 'adjust' || direction === 'remove') && (
        <FromChooser held={held} value={from} onChange={setFrom} />
      )}

      {(kind === 'move' || (kind === 'adjust' && direction === 'add')) && (
        <LocationPicker
          name="to"
          label={kind === 'move' ? 'Move to' : 'Where are they'}
          locations={locations}
          exclude={kind === 'move' ? [from] : []}
        />
      )}

      <QtyStepper
        key={from}
        name="quantity"
        max={kind === 'adjust' && direction === 'add' ? undefined : max}
      />

      {kind === 'adjust' && (
        <label className="block">
          <span className="mb-1.5 block text-[15px] text-muted">Why</span>
          <input
            name="note"
            required
            placeholder={
              direction === 'add' ? 'Found a strip in the drawer' : 'Counted them, 3 were missing'
            }
            className="h-12 w-full rounded-xl border border-line bg-surface px-4"
          />
        </label>
      )}

      <FormStatus state={state} />
      <SubmitButton pending={pending}>{titles[kind]}</SubmitButton>
    </form>
  )
}

function FromChooser({
  held,
  value,
  onChange,
}: {
  held: HeldAt[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[15px] text-muted">From</legend>
      <input type="hidden" name="from" value={value} />
      <div className="flex flex-wrap gap-2">
        {held.map((h) => (
          <button
            key={h.locationId}
            type="button"
            aria-pressed={h.locationId === value}
            onClick={() => onChange(h.locationId)}
            className={`h-12 rounded-xl border px-4 font-semibold ${
              h.locationId === value ? 'border-2 border-mask bg-mask-soft text-mask' : 'border-line'
            }`}
          >
            {h.code} <span className="font-medium text-muted">×{h.quantity}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; disabled?: boolean }>
}) {
  return (
    <div
      role="radiogroup"
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-line/60 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`h-11 rounded-lg text-[16px] font-semibold disabled:opacity-40 ${
            o.value === value ? 'bg-raised text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
