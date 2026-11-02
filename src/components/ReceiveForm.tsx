'use client'

import Link from 'next/link'
import React, { useActionState, useState } from 'react'

import { receive, type ActionState } from '@/app/(app)/actions'

import { FormStatus, SubmitButton } from './fields'
import { Segmented } from './PartActions'

export type OpenLine = {
  id: string
  title: string
  partId: string
  outstanding: number
  ordered: number
}

type Choice = 'arrived' | 'short' | 'missing'

/** Tick off what came in the parcel. Defaults to "everything arrived". */
export function ReceiveForm({ purchaseId, lines }: { purchaseId: string; lines: OpenLine[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(receive, null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [short, setShort] = useState<Record<string, number>>({})

  if (state && 'ok' in state) {
    return (
      <div className="rounded-2xl bg-mask-soft px-5 py-6">
        <p className="text-[19px] font-semibold text-mask">{state.ok}</p>
        <Link
          href="/inbox"
          className="mt-3 inline-block font-semibold text-mask underline underline-offset-4"
        >
          Put them away
        </Link>
      </div>
    )
  }

  const missing = Object.values(choices).filter((c) => c === 'missing').length
  const pcs = lines.reduce((sum, l) => {
    const c = choices[l.id] ?? 'arrived'
    return sum + (c === 'arrived' ? l.outstanding : c === 'short' ? (short[l.id] ?? 0) : 0)
  }, 0)

  return (
    <form action={action}>
      <input type="hidden" name="purchase" value={purchaseId} />
      <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
        {lines.map((line) => {
          const choice = choices[line.id] ?? 'arrived'
          const value =
            choice === 'missing'
              ? 'missing'
              : choice === 'short'
                ? String(short[line.id] ?? 0)
                : String(line.outstanding)
          return (
            <li key={line.id} className="border-b border-line py-4 last:border-0">
              <input type="hidden" name={`line:${line.id}`} value={value} />
              <div className="mb-2 flex items-start justify-between gap-3">
                <Link href={`/parts/${line.partId}`} className="line-clamp-2 font-medium">
                  {line.title}
                </Link>
                <span className="shrink-0 text-[20px] font-semibold">×{line.outstanding}</span>
              </div>
              <Segmented<Choice>
                value={choice}
                onChange={(c) => setChoices((s) => ({ ...s, [line.id]: c }))}
                options={[
                  { value: 'arrived', label: 'Arrived' },
                  { value: 'short', label: 'Short', disabled: line.outstanding < 2 },
                  { value: 'missing', label: 'Missing' },
                ]}
              />
              {choice === 'short' && (
                <label className="mt-3 flex items-center gap-3">
                  <span className="text-muted">Got</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={short[line.id] ?? ''}
                    onChange={(e) =>
                      setShort((s) => ({
                        ...s,
                        [line.id]: Math.min(
                          line.outstanding,
                          Number(e.target.value.replace(/\D/g, '')) || 0,
                        ),
                      }))
                    }
                    className="h-12 w-24 rounded-xl border border-line bg-surface text-center text-[20px] font-semibold"
                    aria-label={`Quantity received of ${line.title}`}
                  />
                  <span className="text-muted">of {line.outstanding}</span>
                </label>
              )}
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-4 flex flex-col gap-3 bg-surface pt-3 lg:bottom-0 lg:items-end lg:pb-6 lg:[&>button]:max-w-sm">
        <FormStatus state={state} />
        <SubmitButton pending={pending}>
          Receive {pcs} pcs{missing ? `, ${missing} missing` : ''}
        </SubmitButton>
      </div>
    </form>
  )
}
