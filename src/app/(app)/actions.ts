'use server'

import { revalidatePath } from 'next/cache'

import { receiveLines, type LineReceipts } from '@/importers/receiveOrder'
import { createBox } from '@/lib/boxes'
import { createPart, updatePart } from '@/lib/parts'
import { putAwayAll } from '@/lib/putAway'
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

export async function editPart(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const id = str(form.get('id'))
  if (!id) return { error: 'Part not found' }
  const minStock = str(form.get('minStock'))
  try {
    await updatePart(payload, user, id, {
      name: str(form.get('name')) ?? '',
      value: str(form.get('value')),
      package: str(form.get('package')),
      mpn: str(form.get('mpn')),
      manufacturer: str(form.get('manufacturer')),
      category: str(form.get('category')),
      minStock: minStock === undefined ? null : Number(minStock),
      notes: str(form.get('notes')),
    })
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: id }
}

/** Everything INBOX holds of the ticked parts, into one box. */
export async function putAwayMany(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const parts = form.getAll('part').filter((p): p is string => typeof p === 'string' && !!p)
  try {
    const moved = await putAwayAll(payload, user, parts, str(form.get('to')) ?? '')
    revalidatePath('/', 'layout')
    return {
      ok: `Put away ${moved.parts} ${moved.parts === 1 ? 'part' : 'parts'}, ${moved.pcs} pcs`,
    }
  } catch (e) {
    return { error: message(e) }
  }
}

/** A photo for a part (media.part) or a box (location.photo), already shrunk by the browser. */
export async function addPhoto(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const file = form.get('photo')
  const part = str(form.get('part'))
  const location = str(form.get('location'))
  if (!(file instanceof File) || file.size === 0) return { error: 'Pick a photo first' }
  if (!file.type.startsWith('image/')) return { error: 'That file isn’t an image' }
  if (!part && !location) return { error: 'Nothing to attach the photo to' }

  try {
    const media = await payload.create({
      collection: 'media',
      data: { alt: str(form.get('alt')), kind: 'image', part },
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
      user,
      overrideAccess: false,
    })
    if (location) {
      await payload.update({
        collection: 'locations',
        id: location,
        data: { photo: media.id },
        user,
        overrideAccess: false,
      })
    }
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Photo added' }
}
