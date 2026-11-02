import type { PayloadRequest } from 'payload'

/**
 * Runs `fn` as a ledger write: fields guarded by `ledgerOwned` accept new values.
 *
 * Payload merges a call's `context` into the shared `req.context` and never removes it,
 * so passing `context: { skipLedger: true }` would leak into every later write on the
 * same request (one transaction). This sets the flag only for the duration of `fn`.
 */
export const asLedger = async <T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> => {
  req.context ??= {}
  const previous = req.context.skipLedger
  req.context.skipLedger = true
  try {
    return await fn()
  } finally {
    req.context.skipLedger = previous
  }
}
