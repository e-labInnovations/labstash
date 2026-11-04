'use server'

import { revalidatePath } from 'next/cache'

import { receiveLines, type LineReceipts } from '@/importers/receiveOrder'
import { addFile, addLink, fileKind, removeFile, removeLink } from '@/lib/attachments'
import { changePassword, updateProfile } from '@/lib/account'
import { createBox } from '@/lib/boxes'
import { addCategory, deleteCategory, updateCategory } from '@/lib/categories'
import { attempt } from '@/lib/result'
import { importOrders, isStore, listOrders, previewOrders } from '@/lib/stores/import'
import { updateLab } from '@/lib/labSettings'
import { setShared } from '@/lib/catalog'
import { createPart, updatePart } from '@/lib/parts'
import { putAwayAll } from '@/lib/putAway'
import { getLab, requireSession } from '@/lib/session'

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
      from: str(form.get('from')),
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
      kicadSymbol: str(form.get('kicadSymbol')),
      kicadFootprint: str(form.get('kicadFootprint')),
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

/** Shares the ticked parts with other labs (`shared=1`), or stops sharing them. */
export async function shareParts(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const parts = form.getAll('part').filter((p): p is string => typeof p === 'string' && !!p)
  const shared = form.get('shared') === '1'
  try {
    const n = await setShared(payload, user, parts, shared)
    revalidatePath('/', 'layout')
    const what = `${n} ${n === 1 ? 'part' : 'parts'}`
    return { ok: shared ? `Shared ${what} with other labs` : `Stopped sharing ${what}` }
  } catch (e) {
    return { error: message(e) }
  }
}

/** A datasheet, KiCad file, 3D model or other file for a part. */
export async function addPartFile(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const file = form.get('file')
  const part = str(form.get('part'))
  const kind = fileKind(form.get('kind'))
  if (!(file instanceof File) || file.size === 0) return { error: 'Pick a file first' }
  if (!part || !kind) return { error: 'Pick what kind of file it is' }
  try {
    await addFile(payload, user, {
      part,
      kind,
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type || 'application/octet-stream',
        name: file.name,
      },
    })
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'File added' }
}

export async function removePartFile(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const id = str(form.get('id'))
  if (!id) return { error: 'File not found' }
  try {
    await removeFile(payload, user, id)
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'File removed' }
}

export async function addPartLink(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const part = str(form.get('part'))
  if (!part) return { error: 'Part not found' }
  try {
    await addLink(payload, user, {
      part,
      label: str(form.get('label')) ?? '',
      url: str(form.get('url')) ?? '',
    })
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Link added' }
}

export async function removePartLink(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const part = str(form.get('part'))
  const link = str(form.get('link'))
  if (!part || !link) return { error: 'Link not found' }
  try {
    await removeLink(payload, user, part, link)
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Link removed' }
}

/** The lab's name, theme and logo (lab admins). */
export async function saveLab(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const lab = await getLab()
  if (!lab) return { error: 'Lab not found' }
  const logo = form.get('logo')
  try {
    await updateLab(payload, user, lab.id, {
      name: str(form.get('name')) ?? '',
      theme: str(form.get('theme')) ?? '',
      logo:
        logo instanceof File && logo.size > 0
          ? { data: Buffer.from(await logo.arrayBuffer()), mimetype: logo.type, name: logo.name }
          : undefined,
      removeLogo: form.get('removeLogo') === '1',
    })
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Lab saved' }
}

/** ETstore orders on the account the key belongs to. The key is never stored. */
export async function storeOrders(key: string) {
  const { payload, user } = await requireSession()
  return attempt(() => listOrders(payload, user, key))
}

export async function storePreview(store: string, key: string, ids: string[]) {
  const { payload, user } = await requireSession()
  return attempt(async () => {
    if (!isStore(store)) throw new Error('Pick a store')
    return previewOrders(payload, user, store, key, ids)
  })
}

export async function storeImport(store: string, key: string, ids: string[]) {
  const { payload, user } = await requireSession()
  const result = await attempt(async () => {
    if (!isStore(store)) throw new Error('Pick a store')
    return importOrders(payload, user, store, key, ids)
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export async function saveProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  try {
    await updateProfile(payload, user, { name: str(form.get('name')) ?? '' })
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Saved' }
}

export async function savePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  try {
    await changePassword(payload, user, {
      current: String(form.get('current') ?? ''),
      next: String(form.get('next') ?? ''),
      confirm: String(form.get('confirm') ?? ''),
    })
  } catch (e) {
    return { error: message(e) }
  }
  return { ok: 'Password changed' }
}

/** New category (anyone), or rename / move one (admin). */
export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const id = str(form.get('id'))
  const input = { name: str(form.get('name')) ?? '', parent: str(form.get('parent')) ?? null }
  try {
    if (id) await updateCategory(payload, user, id, input)
    else await addCategory(payload, user, input)
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: id ? 'Category saved' : 'Category added' }
}

export async function removeCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { payload, user } = await requireSession()
  const id = str(form.get('id'))
  if (!id) return { error: 'Category not found' }
  try {
    await deleteCategory(payload, user, id)
  } catch (e) {
    return { error: message(e) }
  }
  revalidatePath('/', 'layout')
  return { ok: 'Category deleted' }
}
