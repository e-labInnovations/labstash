// npm run import:etstore -- <order.json> [--dry-run]
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { getPayload } from 'payload'

import config from '../payload.config'
import { STORE_URL, parseEtstoreOrder } from '../importers/etstore'
import { importOrder } from '../importers/importOrder'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'dry-run': { type: 'boolean', default: false } },
})
if (positionals.length !== 1) {
  console.error('Usage: npm run import:etstore -- <order.json> [--dry-run]')
  process.exit(1)
}

const parsed = parseEtstoreOrder(JSON.parse(readFileSync(positionals[0], 'utf8')))
for (const w of parsed.warnings) console.warn(`⚠ ${w}`)

if (values['dry-run']) {
  console.table(
    parsed.lines.map((l) => ({
      sku: l.sku,
      qty: l.quantity,
      name: l.name.slice(0, 50),
      pkg: l.package,
      value: l.value != null ? `${l.value} ${l.unit}` : '',
      category: l.category.join(' › '),
    })),
  )
  console.log(
    `${parsed.order.orderNumber}: ${parsed.lines.length} lines (dry run, nothing written)`,
  )
  process.exit(0)
}

const payload = await getPayload({ config })
const result = await importOrder(payload, parsed, {
  name: 'ETstore',
  website: STORE_URL,
  importer: 'etstore',
})

if (result.status === 'exists') {
  console.log(
    `${parsed.order.orderNumber} already imported (purchase ${result.purchaseId}), nothing to do`,
  )
} else {
  console.log(
    `${parsed.order.orderNumber} imported: ${parsed.lines.length} lines, ` +
      `${result.partsCreated} new parts, ${result.partsMatched} matched existing`,
  )
  console.log(
    `Next: npm run receive -- '${parsed.order.orderNumber}' [--except SKU,…] [--short SKU=qty,…]`,
  )
}
process.exit(0)
