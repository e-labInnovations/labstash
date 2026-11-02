'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export function LoginForm({
  defaultEmail,
  defaultPassword,
}: {
  defaultEmail?: string
  defaultPassword?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setPending(true)
        setError(null)
        const form = new FormData(e.currentTarget)
        // Payload's REST login sets the same session cookie the admin panel uses
        const res = await fetch('/api/users/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
        }).catch(() => null)
        setPending(false)
        if (!res?.ok) {
          setError(
            res ? 'Email or password is wrong.' : 'Can’t reach LabStash. Check your connection.',
          )
          return
        }
        router.replace('/')
        router.refresh()
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[15px] text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={defaultEmail}
          className="h-14 w-full rounded-2xl border border-line bg-raised px-4"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={defaultPassword}
          className="h-14 w-full rounded-2xl border border-line bg-raised px-4"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-14 rounded-2xl bg-mask text-[18px] font-semibold text-mask-ink disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
