'use client'

import React, { useState } from 'react'

import type { Photo } from '@/lib/search'

/* eslint-disable @next/next/no-img-element -- served by Payload/Blob; thumbnails are pre-sized */

/** Main photo with a strip of thumbnails to switch between them. */
export function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [active, setActive] = useState(0)
  if (photos.length === 0) return null
  const current = photos[Math.min(active, photos.length - 1)]

  return (
    <div className="mt-6 lg:mt-0">
      <a href={current.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={current.url}
          alt={current.alt ?? name}
          className="aspect-[4/3] w-full rounded-2xl border border-line bg-white object-contain"
        />
      </a>
      {photos.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
                aria-pressed={i === active}
                className={`block overflow-hidden rounded-lg border-2 ${i === active ? 'border-mask' : 'border-line'}`}
              >
                <img
                  src={p.thumb}
                  alt=""
                  loading="lazy"
                  className="size-16 bg-white object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
