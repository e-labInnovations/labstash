import { headers } from 'next/headers'
import Link from 'next/link'
import QRCode from 'qrcode'
import React from 'react'

import { PrintButton } from '@/components/PrintButton'
import { LABEL_SIZES, type Label, boxLabelsFor, labelSize, labelsFor, toPages } from '@/lib/labels'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Label sheet' }

const MAX_LABELS = 400

// Type and QR sizes per label size, in print units so the sheet is the same on any screen
const STYLE = {
  s: { qr: 17, name: 6.5, nameLines: 3, detail: 7, where: 9, code: 16 },
  m: { qr: 22, name: 8, nameLines: 3, detail: 8.5, where: 11, code: 22 },
  l: { qr: 32, name: 11, nameLines: 3, detail: 12, where: 16, code: 36 },
} as const

export default async function LabelSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; boxes?: string; size?: string; skip?: string }>
}) {
  const params = await searchParams
  const size = labelSize(params.size)
  const list = (v?: string) => (v ?? '').split(',').filter(Boolean).slice(0, MAX_LABELS)
  const ids = list(params.ids)
  const boxes = list(params.boxes)
  const skip = Number(params.skip) || 0
  const { payload, user } = await requireSession()
  const labels = (
    await Promise.all([labelsFor(payload, user, ids), boxLabelsFor(payload, user, boxes)])
  )
    .flat()
    .slice(0, MAX_LABELS)

  // Labels point at this deployment, so a scan opens the part in the app
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`
  const qr = new Map(
    await Promise.all(
      labels.map(
        async (l) =>
          [
            l.href,
            await QRCode.toString(`${origin}${l.href}`, {
              type: 'svg',
              margin: 0,
              errorCorrectionLevel: 'M',
            }),
          ] as const,
      ),
    ),
  )

  const onlyBoxes = ids.length === 0 && boxes.length > 0
  const { cols, rows } = LABEL_SIZES[size]
  const pages = toPages(labels, size, skip)
  const link = (next: Partial<{ size: string; skip: number }>) =>
    `/print/labels?${new URLSearchParams({
      size: next.size ?? size,
      skip: String(next.skip ?? skip),
      ...(ids.length > 0 && { ids: ids.join(',') }),
      ...(boxes.length > 0 && { boxes: boxes.join(',') }),
    })}`

  return (
    <div className="min-h-dvh bg-surface print:min-h-0 print:bg-white">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { html, body { background: #fff !important; } }
      `}</style>

      <div className="sticky top-0 z-10 border-b border-line bg-raised/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={onlyBoxes ? '/labels?for=boxes' : '/labels'}
            className="font-semibold text-mask"
          >
            ← Pick {onlyBoxes ? 'boxes' : 'parts'}
          </Link>
          <span className="text-muted">
            {labels.length} {labels.length === 1 ? 'label' : 'labels'} on {pages.length} A4{' '}
            {pages.length === 1 ? 'page' : 'pages'}
          </span>
          <span className="flex gap-1">
            {Object.entries(LABEL_SIZES).map(([key, s]) => (
              <Link
                key={key}
                href={link({ size: key, skip: 0 })}
                aria-current={key === size ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 text-[15px] font-semibold ${
                  key === size ? 'border-mask bg-mask-soft text-mask' : 'border-line text-muted'
                }`}
              >
                {s.name}
              </Link>
            ))}
          </span>
          <span className="ml-auto">
            <PrintButton />
          </span>
        </div>
        <p className="mx-auto mt-1 max-w-[210mm] text-[14px] text-muted">
          In the print dialog choose A4, scale 100% (not “fit”), no headers and footers.
          {skip > 0 ? (
            <>
              {' '}
              Skipping the first {skip}.{' '}
              <Link href={link({ skip: 0 })} className="underline">
                Start at the top
              </Link>
            </>
          ) : (
            labels.length < cols * rows && (
              <>
                {' '}
                Reusing a cut sheet?{' '}
                <Link href={link({ skip: cols })} className="underline">
                  Skip the first row
                </Link>
              </>
            )
          )}
        </p>
      </div>

      {labels.length === 0 ? (
        <p className="p-8 text-center text-muted print:hidden">
          Nothing picked. <Link href="/labels">Pick some</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto py-6 print:overflow-visible print:p-0">
          {pages.map((cells, p) => (
            <section
              key={p}
              className="mx-auto mb-6 bg-white text-black shadow-md last:mb-0 print:m-0 print:shadow-none"
              style={{
                width: '210mm',
                // A hair under 297 mm: rounding must never spill a blank page after each sheet
                height: '296.5mm',
                overflow: 'hidden',
                padding: '10mm',
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                breakAfter: p < pages.length - 1 ? 'page' : 'auto',
                boxSizing: 'border-box',
              }}
            >
              {cells.map((label, i) =>
                label ? (
                  <LabelCell key={i} label={label} svg={qr.get(label.href) ?? ''} size={size} />
                ) : (
                  <div key={i} style={{ border: '0.2mm dashed #ccc' }} />
                ),
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function LabelCell({ label, svg, size }: { label: Label; svg: string; size: keyof typeof STYLE }) {
  const s = STYLE[size]
  return (
    <div
      style={{
        border: '0.2mm dashed #bbb',
        padding: '2mm',
        display: 'flex',
        gap: '2mm',
        alignItems: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-barlow), system-ui, sans-serif',
        lineHeight: 1.15,
      }}
    >
      <div
        style={{ width: `${s.qr}mm`, height: `${s.qr}mm`, flexShrink: 0 }}
        className="[&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div
        style={{
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {label.kind === 'box' && (
            <div
              style={{
                fontSize: `${s.code}pt`,
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '1mm',
              }}
            >
              {label.where}
            </div>
          )}
          <div
            style={{
              fontSize: `${s.name}pt`,
              fontWeight: 600,
              display: '-webkit-box',
              WebkitLineClamp: s.nameLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {label.name}
          </div>
          {label.detail && (
            <div style={{ fontSize: `${s.detail}pt`, fontWeight: 600, marginTop: '0.6mm' }}>
              {label.detail}
            </div>
          )}
        </div>
        {label.kind === 'part' && label.where && (
          <div
            style={{
              fontSize: `${s.where}pt`,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label.where}
          </div>
        )}
      </div>
    </div>
  )
}
