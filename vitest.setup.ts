// Integration tests run against <database>_test on the same server as .env's DATABASE_URL
import { config } from 'dotenv'

config()

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL)
  if (!url.pathname.endsWith('_test')) url.pathname += '_test'
  process.env.DATABASE_URL = url.toString()
}
