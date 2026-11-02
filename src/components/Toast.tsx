'use client'

import React, { useEffect } from 'react'

/** Confirms a finished action, sitting just above the tab bar. The parent clears it via onDone. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [message, onDone])

  if (!message) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 lg:bottom-8 lg:left-64 mx-auto max-w-md rounded-2xl bg-ink px-5 py-3.5 text-center font-medium text-surface shadow-lg"
    >
      {message}
    </div>
  )
}
