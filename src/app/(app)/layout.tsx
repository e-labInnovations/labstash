import type { Metadata, Viewport } from 'next'
import { Barlow } from 'next/font/google'
import React from 'react'

import { NavProgress } from '@/components/NavProgress'
import { ServiceWorker } from '@/components/ServiceWorker'

import './app.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
})

export const metadata: Metadata = {
  title: { default: 'LabStash', template: '%s · LabStash' },
  description: 'Find, take and put away electronic parts.',
  applicationName: 'LabStash',
  appleWebApp: { capable: true, title: 'LabStash', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png', icon: '/icons/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1f5c46' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1813' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable}>
      <body className="font-sans text-[17px] leading-snug antialiased">
        <NavProgress />
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
