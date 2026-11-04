'use client'

import React, { useState, useTransition } from 'react'

import { type ActionState, savePassword, saveProfile } from '@/app/(app)/actions'

import { Field, FormStatus, SubmitButton, inputClass } from './fields'

/** Saves by hand rather than through `action`, which would clear the fields on an error. */
const useSubmit = (action: (s: ActionState, f: FormData) => Promise<ActionState>) => {
  const [state, setState] = useState<ActionState>(null)
  const [pending, startTransition] = useTransition()
  const onSubmit = (e: React.FormEvent<HTMLFormElement>, after?: () => void) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await action(null, data)
      setState(result)
      if (result && 'ok' in result) after?.()
    })
  }
  return { state, pending, onSubmit }
}

export function NameForm({ name }: { name: string }) {
  const { state, pending, onSubmit } = useSubmit(saveProfile)
  return (
    <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-3">
      <Field label="Name">
        <input
          name="name"
          defaultValue={name}
          placeholder="How you’re shown in the app"
          autoComplete="name"
          className={inputClass}
        />
      </Field>
      {state && 'ok' in state ? (
        <p className="text-[15px] text-mask">{state.ok}</p>
      ) : (
        <FormStatus state={state} />
      )}
      <SubmitButton pending={pending}>Save name</SubmitButton>
    </form>
  )
}

export function PasswordForm() {
  const { state, pending, onSubmit } = useSubmit(savePassword)
  return (
    <form
      onSubmit={(e) => {
        const form = e.currentTarget
        onSubmit(e, () => form.reset())
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Current password">
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <Field label="New password (at least 8 characters)">
        <input
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <Field label="New password again">
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      {state && 'ok' in state ? (
        <p className="text-[15px] text-mask">{state.ok}</p>
      ) : (
        <FormStatus state={state} />
      )}
      <SubmitButton pending={pending}>Change password</SubmitButton>
    </form>
  )
}
