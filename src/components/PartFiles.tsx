'use client'

import React, { useCallback, useState, useTransition } from 'react'

import {
  type ActionState,
  addPartFile,
  addPartLink,
  removePartFile,
  removePartLink,
} from '@/app/(app)/actions'
import { FILE_KINDS, type FileKind, MAX_FILE_BYTES, type PartFile } from '@/lib/attachments'

import { Field, FormStatus, SubmitButton, inputClass } from './fields'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'
import { Toast } from './Toast'

const ICON: Record<FileKind, IconName> = {
  datasheet: 'file',
  symbol: 'chip',
  footprint: 'pads',
  model3d: 'cube',
  other: 'file',
}

const size = (bytes: number | null) =>
  bytes == null
    ? ''
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} kB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export type PartLink = { id: string; label: string; url: string }
export type StoreLink = { key: string; label: string; url: string | null }

const rowClass =
  'flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-2.5'

/**
 * A part's datasheets, KiCad files, 3D models and links. Editable on your own part;
 * read-only (no add or remove) when shown from another lab's shared catalog.
 */
export function PartFiles({
  part,
  files,
  links,
  stores = [],
  kicad = {},
  readOnly = false,
}: {
  part: string
  files: PartFile[]
  links: PartLink[]
  stores?: StoreLink[]
  kicad?: { symbol?: string | null; footprint?: string | null }
  readOnly?: boolean
}) {
  const [sheet, setSheet] = useState<'file' | 'link' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const [pending, startTransition] = useTransition()

  const remove = (label: string, run: () => Promise<ActionState>) => {
    if (!window.confirm(`Remove ${label}?`)) return
    startTransition(async () => {
      const result = await run()
      setToast(result && 'error' in result ? result.error : `Removed ${label}`)
    })
  }
  const form = (entries: Record<string, string>) => {
    const data = new FormData()
    for (const [k, v] of Object.entries(entries)) data.set(k, v)
    return data
  }

  const refs = [
    ['KiCad symbol', kicad.symbol],
    ['KiCad footprint', kicad.footprint],
  ].filter((r): r is [string, string] => Boolean(r[1]))
  const empty = files.length + links.length + stores.length + refs.length === 0

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-semibold">Files and links</h2>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheet('file')}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold"
            >
              <Icon name="plus" className="size-5" />
              File
            </button>
            <button
              type="button"
              onClick={() => setSheet('link')}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[15px] font-semibold"
            >
              <Icon name="plus" className="size-5" />
              Link
            </button>
          </div>
        )}
      </div>

      {empty ? (
        <p className="text-muted">
          {readOnly
            ? 'No files or links.'
            : 'No files yet. Add a datasheet, KiCad symbol or footprint, 3D model, or a link.'}
        </p>
      ) : (
        <ul className={`flex flex-col gap-2 ${pending ? 'opacity-60' : ''}`}>
          {files.map((f) => (
            <li key={f.id} className={rowClass}>
              <Icon name={ICON[f.kind]} className="size-6 shrink-0 text-mask" />
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.filename}</span>
                <span className="block text-[14px] text-muted">
                  {[FILE_KINDS[f.kind].label, size(f.size)].filter(Boolean).join(' · ')}
                </span>
              </a>
              <a
                href={f.url}
                download={f.filename}
                aria-label={`Download ${f.filename}`}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface"
              >
                <Icon name="back" className="size-5 -rotate-90" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${f.filename}`}
                  onClick={() => remove(f.filename, () => removePartFile(null, form({ id: f.id })))}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Icon name="trash" className="size-5" />
                </button>
              )}
            </li>
          ))}
          {links.map((l) => (
            <li key={l.id} className={rowClass}>
              <Icon name="link" className="size-6 shrink-0 text-mask" />
              <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <span className="block truncate font-medium">{l.label}</span>
                <span className="block truncate text-[14px] text-muted">{host(l.url)}</span>
              </a>
              <Icon name="external" className="size-5 shrink-0 text-muted" />
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove link ${l.label}`}
                  onClick={() =>
                    remove(`the link “${l.label}”`, () =>
                      removePartLink(null, form({ part, link: l.id })),
                    )
                  }
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Icon name="trash" className="size-5" />
                </button>
              )}
            </li>
          ))}
          {stores.map((s) => (
            <li key={s.key} className={rowClass}>
              <Icon name="orders" className="size-6 shrink-0 text-mask" />
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 font-medium"
                >
                  {s.label}
                </a>
              ) : (
                <span className="min-w-0 flex-1 font-medium">{s.label}</span>
              )}
              {s.url && <Icon name="external" className="size-5 shrink-0 text-muted" />}
            </li>
          ))}
          {refs.map(([label, value]) => (
            <li key={label} className={rowClass}>
              <Icon
                name={label === 'KiCad symbol' ? 'chip' : 'pads'}
                className="size-6 shrink-0 text-mask"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-muted">{label} (library)</span>
                <span className="block font-mono text-[15px] break-all">{value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <Sheet open={sheet === 'file'} onClose={() => setSheet(null)} title="Add a file">
            {sheet === 'file' && (
              <AddFileForm
                part={part}
                onDone={(msg) => {
                  setSheet(null)
                  setToast(msg)
                }}
              />
            )}
          </Sheet>
          <Sheet open={sheet === 'link'} onClose={() => setSheet(null)} title="Add a link">
            {sheet === 'link' && (
              <AddLinkForm
                part={part}
                onDone={(msg) => {
                  setSheet(null)
                  setToast(msg)
                }}
              />
            )}
          </Sheet>
        </>
      )}
      <Toast message={toast} onDone={clearToast} />
    </section>
  )
}

function AddFileForm({ part, onDone }: { part: string; onDone: (msg: string) => void }) {
  const [kind, setKind] = useState<FileKind>('datasheet')
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const file = data.get('file')
        if (file instanceof File && file.size > MAX_FILE_BYTES) {
          setState({ error: 'That file is over 4 MB, too large to add from the app' })
          return
        }
        startTransition(async () => {
          const result = await addPartFile(null, data)
          if (result && 'ok' in result) onDone(result.ok)
          else setState(result)
        })
      }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="part" value={part} />
      <fieldset>
        <legend className="mb-1.5 text-[15px] text-muted">What is it</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FILE_KINDS) as FileKind[]).map((k) => (
            <label
              key={k}
              className={`flex h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 font-semibold ${
                kind === k ? 'border-mask bg-mask-soft text-mask' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              <Icon name={ICON[k]} className="size-5" />
              {FILE_KINDS[k].label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="File (up to 4 MB)">
        <input
          name="file"
          type="file"
          required
          accept={FILE_KINDS[kind].accept || undefined}
          className="block w-full text-[15px] file:mr-3 file:h-11 file:rounded-xl file:border file:border-line file:bg-raised file:px-4 file:font-semibold"
        />
      </Field>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Add file</SubmitButton>
    </form>
  )
}

const LINK_LABELS = ['Datasheet', 'Product page', 'KiCad library', 'Application note']

function AddLinkForm({ part, onDone }: { part: string; onDone: (msg: string) => void }) {
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await addPartLink(null, data)
          if (result && 'ok' in result) onDone(result.ok)
          else setState(result)
        })
      }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="part" value={part} />
      <Field label="Name">
        <input
          name="label"
          required
          list="link-labels"
          defaultValue="Datasheet"
          autoComplete="off"
          className={inputClass}
        />
        <datalist id="link-labels">
          {LINK_LABELS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="Web address">
        <input
          name="url"
          required
          inputMode="url"
          placeholder="https://…"
          autoComplete="off"
          className={inputClass}
        />
      </Field>
      <FormStatus state={state} />
      <SubmitButton pending={pending}>Add link</SubmitButton>
    </form>
  )
}
