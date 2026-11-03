'use client'

import React from 'react'

import { Icon } from './Icon'

/** The browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-11 items-center gap-2 rounded-xl bg-mask px-4 font-semibold text-mask-ink"
    >
      <Icon name="print" className="size-5" />
      Print or save PDF
    </button>
  )
}
