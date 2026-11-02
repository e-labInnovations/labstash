import React from 'react'

/** The app mark: an organiser box seen from above, one compartment filled. */
export function BoxMark({ className = 'size-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="10" fill="var(--mask)" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={9 + c * 11}
            y={9 + r * 11}
            width="8"
            height="8"
            rx="2"
            fill={r === 1 && c === 2 ? 'var(--enig)' : 'var(--mask-ink)'}
          />
        )),
      )}
    </svg>
  )
}
