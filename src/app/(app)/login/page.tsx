import { redirect } from 'next/navigation'
import React from 'react'

import { devUser, isDev } from '@/dev/devUser'
import { BoxMark } from '@/components/BoxMark'
import { getSession } from '@/lib/session'

import { LoginForm } from './LoginForm'

export const metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const { user } = await getSession()
  if (user) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <BoxMark />
      <h1 className="mt-6 mb-1 text-[32px] font-semibold tracking-tight">LabStash</h1>
      <p className="mb-8 text-muted">Sign in to find and put away parts.</p>
      <LoginForm
        defaultEmail={isDev ? devUser.email : undefined}
        defaultPassword={isDev ? devUser.password : undefined}
      />
    </main>
  )
}
