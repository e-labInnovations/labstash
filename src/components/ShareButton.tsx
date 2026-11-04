'use client'

import React, { useCallback, useState, useTransition } from 'react'

import { shareParts } from '@/app/(app)/actions'

import { Icon } from './Icon'
import { Toast } from './Toast'

/** Shares one part with other labs, or stops sharing it. */
export function ShareButton({ part, shared }: { part: string; shared: boolean }) {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const toggle = () => {
    const data = new FormData()
    data.set('part', part)
    data.set('shared', shared ? '0' : '1')
    startTransition(async () => {
      const result = await shareParts(null, data)
      if (result && 'error' in result) setToast(result.error)
      else setToast(shared ? 'No longer shared' : 'Shared: other labs can find and copy it')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={shared}
        title={
          shared
            ? 'Other labs can find and copy this part (never your stock or boxes)'
            : 'Let other labs find and copy this part (never your stock or boxes)'
        }
        className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[15px] font-semibold disabled:opacity-60 ${
          shared ? 'border-mask bg-mask-soft text-mask' : 'border-line'
        }`}
      >
        <Icon name={shared ? 'check' : 'share'} className="size-5" />
        {shared ? 'Shared' : 'Share'}
      </button>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
