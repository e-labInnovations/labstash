import React from 'react'

/** The lab's logo (or its initial on the theme colour) and its name. */
export function LabBadge({
  name,
  logo,
  size = 'sm',
}: {
  name: string
  logo: string | null
  size?: 'sm' | 'lg'
}) {
  const box = size === 'lg' ? 'size-16 rounded-2xl text-[28px]' : 'size-6 rounded-md text-[13px]'
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by Payload/Blob, already resized
        <img
          src={logo}
          alt=""
          className={`${box} shrink-0 border border-line bg-white object-contain`}
        />
      ) : (
        <span
          aria-hidden
          className={`${box} grid shrink-0 place-items-center bg-mask-soft font-semibold text-mask`}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  )
}
