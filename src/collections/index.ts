import type { CollectionConfig } from 'payload'

import { Categories } from './Categories'
import { Folders } from './Folders'
import { Labs } from './Labs'
import { Locations } from './Locations'
import { Media } from './Media'
import { Parts } from './Parts'
import { PurchaseLines } from './PurchaseLines'
import { Purchases } from './Purchases'
import { Stock } from './Stock'
import { StockMovements } from './StockMovements'
import { SupplierParts } from './SupplierParts'
import { Suppliers } from './Suppliers'
import { Tags } from './Tags'
import { Users } from './Users'

export {
  Categories,
  Folders,
  Labs,
  Locations,
  Media,
  Parts,
  PurchaseLines,
  Purchases,
  Stock,
  StockMovements,
  SupplierParts,
  Suppliers,
  Tags,
  Users,
}

/** Order here is the order in the admin sidebar. */
export const collections: CollectionConfig[] = [
  Parts,
  Stock,
  StockMovements,
  Locations,
  Categories,
  Purchases,
  PurchaseLines,
  Suppliers,
  SupplierParts,
  Media,
  Folders,
  Tags,
  Users,
  Labs,
]
