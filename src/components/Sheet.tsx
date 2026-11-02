'use client'

import React, { useEffect, useRef } from 'react'

import { Icon } from './Icon'

/** Bottom sheet on a native <dialog>: focus trap, Esc and backdrop close for free. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet mx-auto mt-auto mb-0 w-full max-w-xl rounded-t-3xl bg-raised p-0 text-ink lg:my-auto lg:max-w-md lg:rounded-3xl"
    >
      <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] lg:px-6 lg:pt-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[21px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-10 place-items-center text-muted"
          >
            <Icon name="close" />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  )
}
