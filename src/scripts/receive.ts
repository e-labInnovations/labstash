// npm run receive -- <orderNumber> [--except SKU,SKU] [--short SKU=qty,SKU=qty]
import { parseArgs } from 'node:util'
import { getPayload } from 'payload'

import config from '../payload.config'
import { receiveOrder } from '../importers/receiveOrder'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    except: { type: 'string', default: '' },
    short: { type: 'string', default: '' },
  },
})
if (positionals.length !== 1) {
  console.error(
    'Usage: npm run receive -- <orderNumber> [--except SKU,SKU] [--short SKU=qty,SKU=qty]',
  )
  process.exit(1)
}

const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
const short = Object.fromEntries(
  list(values.short).map((pair) => {
    const [sku, qty] = pair.split('=')
    if (!sku || !qty || !Number.isInteger(Number(qty)))
      throw new Error(`Bad --short entry: ${pair}`)
    return [sku, Number(qty)]
  }),
)

const payload = await getPayload({ config })
const result = await receiveOrder(payload, positionals[0], { except: list(values.except), short })

const pcs = result.received.reduce((s, r) => s + r.quantity, 0)
console.log(`Received ${result.received.length} lines (${pcs} pcs) into INBOX`)
if (result.cancelled.length) console.log(`Cancelled: ${result.cancelled.join(', ')}`)
if (result.skipped.length)
  console.log(`Skipped (already received/cancelled): ${result.skipped.join(', ')}`)
process.exit(0)
