import React from 'react'

import { Scanner } from '@/components/Scanner'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Scan' }

export default function ScanPage() {
  return (
    <>
      <PageHeader title="Scan a label">
        <p className="mt-1 text-muted">Point the camera at the QR code on a box or compartment.</p>
      </PageHeader>
      <div className="max-w-md">
        <Scanner />
      </div>
    </>
  )
}
