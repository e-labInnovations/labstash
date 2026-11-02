import type { FieldHook } from 'payload'

import { isLowStock } from './rules'

/** Field is owned by the ledger: other writes keep the stored value. */
export const ledgerOwned: FieldHook = ({ value, originalDoc, context, field }) => {
  if (context.skipLedger) return value
  const name = 'name' in field ? field.name : undefined
  const stored = name ? originalDoc?.[name] : undefined
  return stored ?? ('defaultValue' in field ? field.defaultValue : undefined)
}

/** Re-derive lowStock when minStock is edited by hand. */
export const deriveLowStock: FieldHook = ({ value, siblingData, originalDoc, context }) => {
  if (context.skipLedger) return value
  const minStock = siblingData.minStock !== undefined ? siblingData.minStock : originalDoc?.minStock
  return isLowStock(originalDoc?.totalQuantity ?? 0, minStock)
}
