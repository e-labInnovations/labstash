'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

/** Where a scanned code should take you: our own /l/… or /parts/… URLs, else treat it as a location code. */
export const routeForCode = (raw: string): string => {
  const text = raw.trim()
  try {
    const url = new URL(text)
    if (/^\/(l|parts)\//.test(url.pathname)) return url.pathname
  } catch {}
  return `/l/${encodeURIComponent(text.toUpperCase())}`
}

export function Scanner() {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const start = async () => {
      try {
        // Native on Android Chrome; the polyfill (zxing wasm) covers iOS Safari
        const Detector =
          'BarcodeDetector' in window
            ? (
                window as unknown as {
                  BarcodeDetector: typeof import('barcode-detector/ponyfill').BarcodeDetector
                }
              ).BarcodeDetector
            : (await import('barcode-detector/ponyfill')).BarcodeDetector
        const detector = new Detector({ formats: ['qr_code'] })

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (stopped || !video.current) return
        video.current.srcObject = stream
        await video.current.play()

        const tick = async () => {
          if (stopped || !video.current) return
          const codes = await detector.detect(video.current).catch(() => [])
          if (codes[0]?.rawValue) {
            navigator.vibrate?.(30)
            router.push(routeForCode(codes[0].rawValue))
            return
          }
          timer = setTimeout(tick, 200)
        }
        tick()
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera access is blocked. Allow it in the browser settings, or type the code below.'
            : 'This browser can’t use the camera here. Type the code below.',
        )
      }
    }
    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [router])

  return (
    <div className="flex flex-col gap-5">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink">
        <video ref={video} muted playsInline className="size-full object-cover" />
        {/* Viewfinder: the label should sit inside this square */}
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/85" />
        {error && (
          <p className="absolute inset-x-4 bottom-4 rounded-xl bg-raised px-4 py-3 text-[15px] text-ink">
            {error}
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) router.push(routeForCode(manual))
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type a code, e.g. B03-17"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Location code"
          className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-raised px-4"
        />
        <button type="submit" className="h-14 rounded-2xl bg-mask px-5 font-semibold text-mask-ink">
          Open
        </button>
      </form>
    </div>
  )
}
