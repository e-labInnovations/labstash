'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { type ActionState, saveLab } from '@/app/(app)/actions'
import type { CurrentLab } from '@/lib/session'
import { THEMES, type ThemeKey } from '@/lib/themes'

import { shrink } from './AddPhoto'
import { Field, FormStatus, SubmitButton, inputClass } from './fields'
import { Icon } from './Icon'
import { LabBadge } from './LabBadge'
import { Toast } from './Toast'

const applyTheme = (theme: ThemeKey) => {
  if (theme === 'green') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

/** Name, theme (previewed live as you pick) and logo of the lab. */
export function LabSettingsForm({ lab }: { lab: CurrentLab }) {
  const [name, setName] = useState(lab.name)
  const [theme, setTheme] = useState<ThemeKey>(lab.theme)
  const [logo, setLogo] = useState<{ blob: Blob; preview: string } | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [state, setState] = useState<ActionState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  const saved = useRef(lab.theme)

  // Leaving without saving puts the lab's own theme back
  useEffect(() => () => applyTheme(saved.current), [])
  useEffect(() => () => (logo ? URL.revokeObjectURL(logo.preview) : undefined), [logo])

  const pickTheme = (t: ThemeKey) => {
    setTheme(t)
    applyTheme(t)
  }

  const shown = removeLogo ? null : (logo?.preview ?? lab.logo?.thumb ?? null)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData()
        data.set('name', name)
        data.set('theme', theme)
        if (logo) data.set('logo', logo.blob, 'logo.jpg')
        if (removeLogo) data.set('removeLogo', '1')
        startTransition(async () => {
          const result = await saveLab(null, data)
          setState(result)
          if (result && 'ok' in result) {
            saved.current = theme
            setLogo(null)
            setRemoveLogo(false)
            setToast(result.ok)
          }
        })
      }}
      className="flex max-w-xl flex-col gap-6"
    >
      <div className="rounded-2xl border border-line bg-raised px-5 py-4 text-[22px] font-semibold">
        <LabBadge name={name || 'Lab'} logo={shown} size="lg" />
      </div>

      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-[15px] text-muted">Logo</legend>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const blob = await shrink(file)
              setLogo({ blob, preview: URL.createObjectURL(blob) })
              setRemoveLogo(false)
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold"
          >
            <Icon name="camera" className="size-5" />
            {shown ? 'Change logo' : 'Add logo'}
          </button>
          {shown && (
            <button
              type="button"
              onClick={() => {
                setLogo(null)
                setRemoveLogo(Boolean(lab.logo))
              }}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold text-muted"
            >
              <Icon name="trash" className="size-5" />
              Remove
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-[15px] text-muted">Theme</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-[15px] font-semibold ${
                theme === key ? 'border-mask' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={key}
                checked={theme === key}
                onChange={() => pickTheme(key)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-full border border-line"
                style={{ background: THEMES[key].swatch }}
              >
                {theme === key && (
                  <Icon
                    name="check"
                    className={`size-5 ${key === 'white' ? 'text-black' : 'text-white'}`}
                  />
                )}
              </span>
              {THEMES[key].name}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[15px] text-muted">
          Shown here as you pick; saved for everyone in the lab when you save.
        </p>
      </fieldset>

      <FormStatus state={state} />
      <SubmitButton pending={pending}>Save</SubmitButton>
      <Toast message={toast} onDone={clearToast} />
    </form>
  )
}
