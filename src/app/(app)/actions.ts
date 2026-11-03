'use server'

import { revalidatePath } from 'next/cache'

import { receiveLines, type LineReceipts } from '@/importers/receiveOrder'
import { createBox } from '@/lib/boxes'
import { createPart } from '@/lib/parts'
import { requireSession } from '@/lib/session'

export type ActionState = { ok: string } | { error: string } | null

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

const num = (v: FormDataEntryValue | null) => Number(v ?? NaN)
const str = (v: FormDataEntryValue | null) => (typeof v === 'string' && v ? v : undefined)

/**
 * One form for every stock change: take (use), move, put away (move from INBOX)
 * and adjust. The ledger hooks validate and apply it.
 */
export async function recordMovement(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()

  const kind = str(form.get('kind'))
  const part = str(form.get('part'))
  const quantity = num(form.get('quantity'))
  const from = str(form.get('from'))
  const to = str(form.get('to'))
  const note = str(form.get('note'))

  const type = kind === 'add' || kind === 'remove' ? 'adjust' : kind
  if (!part || !type || !['use', 'move', 'adjust'].includes(type))
    return { error: 'Pick what to do first' }

  try {
    await payload.create({
      collection: 'stock-movements',
      data: {
        type: type as 'use' | 'move' | 'adjust',
        part,
        quantity,
        from: kind === 'add' ? undefined : from,
        to: kind === 'remove' || kind === 'use' ? undefined : to,
        note,
        occurredAt: new Date().toISOString(),
      },
      user,
      overrideAccess: false,
    })
  } catch (e) {
    return { error: message(e) }
  }

  revalidatePath('/', 'layout')
  const verb =
    { use: 'Took', move: 'Moved', add: 'Added', remove: 'Removed' }[kind as string] ?? 'Saved'
  return { ok: `${verb} ${quantity}` }
}

export async function receive(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const purchase = str(form.get('purchase'))
  if (!purchase) return { error: 'Order not found' }

  const receipts: LineReceipts = {}
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('line:') || typeof value !== 'string') continue
    receipts[key.slice(5)] = value === 'missing' ? 'missing' : Number(value)
  }

  try {
    const { received, cancelled } = await receiveLines(payload, purchase, receipts, user)
    revalidatePath('/', 'layout')
    const parts = [`Received ${received} pcs into INBOX`]
    if (cancelled) parts.push(`${cancelled} marked missing`)
    return { ok: parts.join(', ') }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function addBox(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  try {
    const box = await createBox(payload, user, {
      code: str(form.get('code')) ?? '',
      name: str(form.get('name')),
      columns: num(form.get('columns')),
      compartments: num(form.get('compartments')),
    })
    revalidatePath('/', 'layout')
    return { ok: box.code }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function addPart(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const minStock = str(form.get('minStock'))
  try {
    const part = await createPart(payload, user, {
      name: str(form.get('name')) ?? '',
      package: str(form.get('package')),
      mpn: str(form.get('mpn')),
      category: str(form.get('category')),
      minStock: minStock === undefined ? undefined : Number(minStock),
      quantity: num(form.get('quantity')),
      location: str(form.get('location')),
      note: str(form.get('note')),
    })
    revalidatePath('/', 'layout')
    return { ok: part.id }
  } catch (e) {
    return { error: message(e) }
  }
}
