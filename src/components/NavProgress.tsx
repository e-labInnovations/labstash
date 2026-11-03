'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useRef, useState } from 'react'

// Thin bar along the top while a navigation is in flight, modelled on Payload's admin
// ProgressBar: wait briefly (fast navigations never flash), creep towards 93% on an
// easing curve, then jump to 100% and fade once the new URL has rendered.

const START_DELAY = 150
const TICK = 250
const FADE = 200

function Bar() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [progress, setProgress] = useState<number | null>(null)
  const active = useRef(false)
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>
    tick?: ReturnType<typeof setInterval>
  }>({})

  // Start on in-app link taps and GET form submits (search)
  useEffect(() => {
    const start = () => {
      if (active.current) return
      active.current = true
      timers.current.delay = setTimeout(() => {
        setProgress(0.08)
        timers.current.tick = setInterval(() => {
          setProgress((p) => {
            const current = p ?? 0
            return current + (0.93 - current) * Math.random() * 0.2
          })
        }, TICK)
      }, START_DELAY)
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const a = (e.target as Element).closest('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname.startsWith('/admin')) return
      if (url.pathname === location.pathname && url.search === location.search) return
      start()
    }
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement
      if (!e.defaultPrevented && form.method.toLowerCase() === 'get') start()
    }

    document.addEventListener('click', onClick)
    document.addEventListener('submit', onSubmit)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('submit', onSubmit)
    }
  }, [])

  // The new route rendered: finish and fade
  useEffect(() => {
    if (!active.current) return
    active.current = false
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.tick)
    setProgress((p) => (p === null ? null : 1))
    const t = setTimeout(() => setProgress(null), FADE * 2)
    return () => clearTimeout(t)
  }, [pathname, search])

  if (progress === null) return null
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] transition-opacity ${progress === 1 ? 'opacity-0 delay-200' : 'opacity-100'}`}
      style={{ transitionDuration: `${FADE}ms` }}
    >
      <div
        className="h-full bg-enig transition-[width] ease-out motion-reduce:transition-none"
        style={{ width: `${progress * 100}%`, transitionDuration: `${FADE}ms` }}
      />
    </div>
  )
}

export function NavProgress() {
  // useSearchParams needs a Suspense boundary so the shell can still prerender
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
