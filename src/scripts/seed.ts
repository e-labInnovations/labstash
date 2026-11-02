// npm run seed [-- --fresh]
// Local demo data from order #31860. --fresh wipes the local database first.
import { parseArgs } from 'node:util'
import { getPayload } from 'payload'

import config from '../payload.config'
import { devUser } from '../dev/devUser'
import { assertLocalDatabase, seed } from '../seed'

const { values } = parseArgs({ options: { fresh: { type: 'boolean', default: false } } })

assertLocalDatabase()
const payload = await getPayload({ config })

if (values.fresh) {
  payload.logger.info('Wiping the local database and re-running migrations')
  await payload.db.migrateFresh({ forceAcceptWarning: true })
}

const result = await seed(payload)
if (result.status === 'skipped') {
  console.log('Already seeded (box B01 exists). Run `npm run seed -- --fresh` to start over.')
} else {
  console.log(
    `Seeded ${result.boxes} boxes, put away ${result.putAway} parts, ${result.inInbox} left in INBOX.`,
  )
  console.log(`Sign in as ${devUser.email} / ${devUser.password}`)
}
process.exit(0)
