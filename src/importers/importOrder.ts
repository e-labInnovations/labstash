import type { Payload, PayloadRequest } from 'payload'

import type { ParsedOrder } from './etstore'

export type SupplierSpec = {
  name: string
  website?: string
  importer: 'etstore' | 'robu' | 'abest' | 'manual'
}

export type ImportResult =
  | { status: 'exists'; purchaseId: string }
  | {
      status: 'imported'
      purchaseId: string
      partsCreated: number
      partsMatched: number
      warnings: string[]
    }

/**
 * Creates supplier, parts, supplier-parts, purchase and lines for an order in one
 * transaction. Re-running for the same order is a no-op; parts already bought
 * from this supplier (same sku) are reused.
 */
export const importOrder = async (
  payload: Payload,
  parsed: ParsedOrder,
  supplierSpec: SupplierSpec,
): Promise<ImportResult> => {
  const existing = await payload.find({
    collection: 'purchases',
    overrideAccess: true,
    where: { externalId: { equals: parsed.order.externalId } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) return { status: 'exists', purchaseId: existing.docs[0].id }

  return withTransaction(payload, async (req) => {
    const supplier = await ensureSupplier(supplierSpec, req)
    const categoryId = categoryResolver(req)
    let partsCreated = 0
    let partsMatched = 0

    const purchase = await req.payload.create({
      collection: 'purchases',
      overrideAccess: true,
      data: { supplier, status: 'ordered', ...parsed.order },
      req,
    })

    for (const line of parsed.lines) {
      const { docs } = await req.payload.find({
        collection: 'supplier-parts',
        overrideAccess: true,
        where: { and: [{ supplier: { equals: supplier } }, { sku: { equals: line.sku } }] },
        limit: 1,
        depth: 0,
        req,
      })
      let supplierPart = docs[0]
      if (supplierPart) {
        partsMatched++
      } else {
        const part = await req.payload.create({
          collection: 'parts',
          overrideAccess: true,
          data: {
            name: line.name,
            package: line.package,
            value: line.value,
            unit: line.unit as never,
            category: await categoryId(line.category),
          },
          req,
        })
        supplierPart = await req.payload.create({
          collection: 'supplier-parts',
          overrideAccess: true,
          data: {
            supplier,
            part: part.id,
            sku: line.sku,
            title: line.title,
            handle: line.handle,
            variantId: line.variantId,
            url: line.url,
          },
          req,
        })
        partsCreated++
      }

      await req.payload.create({
        collection: 'purchase-lines',
        overrideAccess: true,
        data: {
          purchase: purchase.id,
          title: line.title,
          part: supplierPart.part as string,
          supplierPart: supplierPart.id,
          qtyOrdered: line.quantity,
          lineTotal: line.lineTotal,
        },
        req,
      })
    }

    return {
      status: 'imported' as const,
      purchaseId: purchase.id,
      partsCreated,
      partsMatched,
      warnings: parsed.warnings,
    }
  })
}

export const withTransaction = async <T>(
  payload: Payload,
  fn: (req: PayloadRequest) => Promise<T>,
  user?: PayloadRequest['user'],
) => {
  const transactionID = (await payload.db.beginTransaction()) ?? undefined
  const req = { payload, transactionID, user } as PayloadRequest
  try {
    const result = await fn(req)
    if (transactionID) await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

const ensureSupplier = async (spec: SupplierSpec, req: PayloadRequest) => {
  const { docs } = await req.payload.find({
    collection: 'suppliers',
    overrideAccess: true,
    where: { name: { equals: spec.name } },
    limit: 1,
    depth: 0,
    req,
  })
  if (docs[0]) return docs[0].id
  return (
    await req.payload.create({ collection: 'suppliers', overrideAccess: true, data: spec, req })
  ).id
}

/** Finds or creates a category path like ['Passives', 'Resistors'] and returns the leaf id. */
const categoryResolver = (req: PayloadRequest) => {
  const cache = new Map<string, string>()

  return async (path: string[]): Promise<string | null> => {
    let parent: string | null = null
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join(' › ')
      let id: string | undefined = cache.get(key)
      if (!id) {
        const { docs }: { docs: Array<{ id: string }> } = await req.payload.find({
          collection: 'categories',
          overrideAccess: true,
          where: {
            and: [
              { name: { equals: path[i] } },
              parent ? { parent: { equals: parent } } : { parent: { exists: false } },
            ],
          },
          limit: 1,
          depth: 0,
          req,
        })
        id =
          docs[0]?.id ??
          (
            await req.payload.create({
              collection: 'categories',
              overrideAccess: true,
              data: { name: path[i], parent },
              req,
            })
          ).id
        cache.set(key, id)
      }
      parent = id
    }
    return parent
  }
}
