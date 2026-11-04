import React from 'react'

// Stroke icons drawn on a 24px grid; one component so the set stays consistent.
const paths = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  search: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM20 20l-4.8-4.8',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
  orders: 'M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM9 9h6M9 13h6',
  box: 'M4 5h16v14H4zM4 12h16M12 5v14',
  back: 'M15 5l-7 7 7 7',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  close: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  print: 'M7 9V4h10v5M7 17H4v-8h16v8h-3M7 14h10v6H7z',
  check: 'M5 12.5l4.5 4.5L19 7',
  share:
    'M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}
