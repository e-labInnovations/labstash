import type { DefaultValue } from 'payload'

import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

import { adminOnlyField, isAdmin, labsOf } from '../access'

/** Everything a lab owns. Categories and suppliers stay shared by all labs. */
export const LAB_COLLECTIONS = [
  'parts',
  'locations',
  'stock',
  'stock-movements',
  'purchases',
  'purchase-lines',
  'supplier-parts',
  'media',
] as const

// New records go into the lab picked in the admin panel's lab selector (admin only),
// otherwise into the user's own lab. System jobs (importers, ledger) set it explicitly.
const defaultLab: DefaultValue = ({ req }) => {
  const picked = isAdmin(req.user) && req.headers ? getTenantFromCookie(req.headers, 'text') : null
  return picked ?? labsOf(req.user)[0] ?? undefined
}

export const labs = multiTenantPlugin({
  tenantsSlug: 'labs',
  tenantField: {
    name: 'lab',
    defaultValue: defaultLab,
  },
  tenantsArrayField: {
    includeDefaultField: true,
    arrayFieldName: 'labs',
    arrayTenantFieldName: 'lab',
    arrayFieldAccess: { create: adminOnlyField, update: adminOnlyField },
    tenantFieldAccess: { create: adminOnlyField, update: adminOnlyField },
    rowFields: [
      {
        // Most labs are one person, who runs it; extra people can be plain members
        name: 'labRole',
        type: 'select',
        defaultValue: 'admin',
        options: [
          { label: 'Lab admin — can change the lab’s name, logo and theme', value: 'admin' },
          { label: 'Member', value: 'member' },
        ],
        access: { create: adminOnlyField, update: adminOnlyField },
      },
    ],
  },
  userHasAccessToAllTenants: isAdmin,
  i18n: {
    translations: {
      en: {
        'assign-tenant-button-label': 'Move to lab',
        'assign-tenant-modal-title': 'Move "{{title}}" to a lab',
        'field-assignedTenant-label': 'Lab',
        'nav-tenantSelector-label': 'Lab',
      },
    },
  },
  collections: Object.fromEntries(LAB_COLLECTIONS.map((slug) => [slug, {}])),
})
