import React from 'react'

import { isAdminRole } from '@/access'
import { CategoryManager } from '@/components/CategoryManager'
import { PageHeader } from '@/components/ui'
import { listCategories } from '@/lib/categories'
import { requireSession } from '@/lib/session'

export const metadata = { title: 'Categories' }

export default async function CategoriesPage() {
  const { payload, user } = await requireSession()
  const rows = await listCategories(payload, user)
  return (
    <>
      <PageHeader title="Categories" back="/profile" />
      <CategoryManager rows={rows} canEdit={isAdminRole(user)} />
    </>
  )
}
