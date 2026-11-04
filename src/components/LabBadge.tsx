import React from 'react'

const BOX = {
  sm: 'size-6 rounded-md text-[13px]',
  md: 'size-9 rounded-lg text-[17px]',
  lg: 'size-16 rounded-2xl text-[28px]',
} as const

/** The lab's logo, or its initial on the theme colour. */
export function LabLogo({
  name,
  logo,
  size = 'sm',
}: {
  name: string
  logo: string | null
  size?: keyof typeof BOX
}) {
  return logo ? (
    // Letterboxed on the page's own colour, so wide or tall logos never show white bars
    // eslint-disable-next-line @next/next/no-img-element -- served by Payload/Blob, already resized
    <img
      src={logo}
      alt=""
      className={`${BOX[size]} shrink-0 border border-line bg-raised object-contain`}
    />
  ) : (
    <span
      aria-hidden
      className={`${BOX[size]} grid shrink-0 place-items-center bg-mask font-semibold text-mask-ink`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** The lab's logo and its name on one line. */
export function LabBadge({
  name,
  logo,
  size = 'sm',
}: {
  name: string
  logo: string | null
  size?: keyof typeof BOX
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LabLogo name={name} logo={logo} size={size} />
      <span className="truncate">{name}</span>
    </span>
  )
}
