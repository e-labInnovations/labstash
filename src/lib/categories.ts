import type { Payload } from 'payload'

import { isAdminRole } from '@/access'
import { idOf } from '@/ledger/rules'
import type { User } from '@/payload-types'

// Categories are shared by every lab. Anyone adds one; only the admin renames, moves or
// deletes (access on the collection says the same, this gives friendlier errors).

export type CategoryRow = {
  id: string
  name: string
  parent: string | null
  /** "Passives › Resistors" */
  label: string
  depth: number
  /** Parts in the user's own lab filed here (not counting sub-categories) */
  parts: number
}

const as = (user: User) => ({ user, overrideAccess: false as const })

/** Every category as a tree in reading order, with how many of the user's parts use each. */
export const listCategories = async (payload: Payload, user: User): Promise<CategoryRow[]> => {
  const [{ docs }, { docs: parts }] = await Promise.all([
    payload.find({
      collection: 'categories',
      pagination: false,
      depth: 0,
      select: { name: true, parent: true, breadcrumbs: true },
      ...as(user),
    }),
    payload.find({
      collection: 'parts',
      pagination: false,
      depth: 0,
      joins: false,
      select: { category: true },
      ...as(user),
    }),
  ])
  const count = new Map<string, number>()
  for (const p of parts) {
    const c = idOf(p.category)
    if (c) count.set(c, (count.get(c) ?? 0) + 1)
  }
  return docs
    .map((c) => {
      const trail = c.breadcrumbs?.map((b) => b.label ?? '') ?? []
      return {
        id: c.id,
        name: c.name,
        parent: idOf(c.parent),
        label: trail.join(' › ') || c.name,
        depth: Math.max(0, trail.length - 1),
        parts: count.get(c.id) ?? 0,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

const clean = (name: string) => {
  const n = name.trim().replace(/\s+/g, ' ')
  if (!n) throw new Error('Give the category a name')
  if (n.length > 60) throw new Error('Keep the name under 60 characters')
  return n
}

/** Sibling names must differ, so the tree stays readable. */
const refuseTwin = async (
  payload: Payload,
  name: string,
  parent: string | null,
  except?: string,
) => {
  const { docs } = await payload.find({
    collection: 'categories',
    where: {
      and: [
        { name: { equals: name } },
        parent ? { parent: { equals: parent } } : { parent: { exists: false } },
        ...(except ? [{ id: { not_equals: except } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) throw new Error(`There is already a “${name}” there`)
}

export const addCategory = async (
  payload: Payload,
  user: User,
  input: { name: string; parent?: string | null },
) => {
  const name = clean(input.name)
  const parent = input.parent || null
  await refuseTwin(payload, name, parent)
  return payload.create({
    collection: 'categories',
    data: { name, parent },
    ...as(user),
  })
}

const mustBeAdmin = (user: User) => {
  if (!isAdminRole(user)) {
    throw new Error('Categories are shared by every lab, so only the admin can change them')
  }
}

export const updateCategory = async (
  payload: Payload,
  user: User,
  id: string,
  input: { name: string; parent?: string | null },
) => {
  mustBeAdmin(user)
  const name = clean(input.name)
  const parent = input.parent || null
  // A category can't sit inside itself or anything below it
  for (let at = parent; at;) {
    if (at === id) throw new Error('A category can’t go inside itself')
    const up = await payload.findByID({
      collection: 'categories',
      id: at,
      depth: 0,
      select: { parent: true },
      overrideAccess: true,
    })
    at = idOf(up.parent)
  }
  await refuseTwin(payload, name, parent, id)
  return payload.update({
    collection: 'categories',
    id,
    data: { name, parent },
    ...as(user),
  })
}

/** Only unused categories go: no parts in any lab, no sub-categories. */
export const deleteCategory = async (payload: Payload, user: User, id: string) => {
  mustBeAdmin(user)
  const [{ totalDocs: parts }, { totalDocs: children }] = await Promise.all([
    payload.count({
      collection: 'parts',
      where: { category: { equals: id } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'categories',
      where: { parent: { equals: id } },
      overrideAccess: true,
    }),
  ])
  if (children > 0) throw new Error('Move or delete its sub-categories first')
  if (parts > 0) {
    throw new Error(
      `${parts} ${parts === 1 ? 'part uses' : 'parts use'} it (in any lab); move them to another category first`,
    )
  }
  await payload.delete({ collection: 'categories', id, ...as(user) })
}
