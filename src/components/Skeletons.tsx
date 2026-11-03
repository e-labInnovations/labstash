import React from 'react'

// Shown instantly on navigation (prefetched loading.tsx) while the server renders the page.

export function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-line/70 motion-reduce:animate-none ${className}`}
    />
  )
}

function Busy({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label}>
      {children}
    </div>
  )
}

export function TitleSkeleton() {
  return <Bone className="mb-5 h-8 w-40 lg:h-10" />
}

export function RowsSkeleton({ rows = 6, thumbs = false }: { rows?: number; thumbs?: boolean }) {
  return (
    <ul className="lg:grid lg:grid-cols-2 lg:gap-x-10">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 border-b border-line py-3.5">
          {thumbs && <Bone className="size-12 shrink-0" />}
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-[80%]" />
            <Bone className="h-3.5 w-1/3" />
          </div>
          <Bone className="h-6 w-8 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <Busy label={label}>
      <TitleSkeleton />
      <RowsSkeleton />
    </Busy>
  )
}

export function SearchSkeleton() {
  return (
    <Busy label="Searching">
      <Bone className="h-14 w-full rounded-2xl" />
      <Bone className="mt-5 mb-2 h-3.5 w-24" />
      <RowsSkeleton rows={6} thumbs />
    </Busy>
  )
}

export function PartSkeleton() {
  return (
    <Busy label="Loading part">
      <Bone className="mb-2 h-8 w-[85%] lg:h-10" />
      <Bone className="mb-6 h-4 w-48" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="lg:order-2">
          <Bone className="h-20 w-full rounded-2xl" />
          <Bone className="mt-4 hidden h-13 w-full rounded-2xl lg:block" />
        </div>
        <div className="mt-6 space-y-3 lg:order-1 lg:mt-0">
          <Bone className="aspect-[4/3] w-full rounded-2xl" />
          <Bone className="h-5 w-32" />
          <Bone className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </Busy>
  )
}

export function BoxSkeleton() {
  return (
    <Busy label="Loading box">
      <Bone className="mb-2 h-8 w-24 lg:h-10" />
      <Bone className="mb-6 h-4 w-40" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-line p-2">
          {Array.from({ length: 12 }, (_, i) => (
            <Bone key={i} className="aspect-square" />
          ))}
        </div>
        <div className="mt-8 lg:mt-0">
          <Bone className="mb-3 h-5 w-32" />
          <RowsSkeleton rows={5} />
        </div>
      </div>
    </Busy>
  )
}
