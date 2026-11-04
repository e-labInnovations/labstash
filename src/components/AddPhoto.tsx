'use client'

import React, { useCallback, useRef, useState, useTransition } from 'react'

import { addPhoto } from '@/app/(app)/actions'

import { Icon } from './Icon'
import { Toast } from './Toast'

const MAX_EDGE = 1600

/** Phone photos are 3–12 MB; a 1600 px JPEG is a few hundred kB and plenty for a part. */
export const shrink = async (file: File): Promise<Blob> => {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85))
    if (blob) return blob
  } catch {}
  // Formats the browser can't decode go up as they are, if they fit
  return file
}

/** Opens the camera (or the gallery) and attaches the photo to a part or a box. */
export function AddPhoto({
  part,
  location,
  alt,
  label = 'Add photo',
}: {
  part?: string
  location?: string
  alt: string
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const upload = async (file: File) => {
    setBusy(true)
    const photo = await shrink(file)
    setBusy(false)
    if (photo.size > 3.8 * 1024 * 1024) {
      setToast('That photo is too large. Try a smaller one.')
      return
    }
    const data = new FormData()
    const base = alt.replace(/[^\w-]+/g, '-').slice(0, 40) || 'photo'
    data.set('photo', photo, `${base}-${Date.now()}.${photo.type === 'image/jpeg' ? 'jpg' : 'img'}`)
    data.set('alt', alt)
    if (part) data.set('part', part)
    if (location) data.set('location', location)
    startTransition(async () => {
      const result = await addPhoto(null, data)
      setToast(result && 'error' in result ? result.error : 'Photo added')
    })
  }

  const working = busy || pending

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />
      <button
        type="button"
        disabled={working}
        onClick={() => input.current?.click()}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold disabled:opacity-60"
      >
        <Icon name="camera" className="size-5" />
        {working ? 'Uploading…' : label}
      </button>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
