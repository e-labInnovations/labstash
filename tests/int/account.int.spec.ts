import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { changePassword, updateProfile } from '@/lib/account'
import { addCategory, deleteCategory, listCategories, updateCategory } from '@/lib/categories'
import { createPart } from '@/lib/parts'

import { freshPayload, newLab, newUser } from './setup'

let payload: Payload
let admin: Awaited<ReturnType<typeof newUser>>
let alice: Awaited<ReturnType<typeof newUser>>
let bob: Awaited<ReturnType<typeof newUser>>

describe('categories in the app', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    admin = await newUser(payload, 'admin@example.com', await newLab(payload, 'Admin lab'), 'admin')
    alice = await newUser(payload, 'alice@example.com', await newLab(payload, 'Alice’s lab'))
    bob = await newUser(payload, 'bob@example.com', await newLab(payload, 'Bob’s lab'))
  })

  it('lets anyone add, and lists the tree with their own part counts', async () => {
    const passives = await addCategory(payload, alice, { name: '  Passives ' })
    const resistors = await addCategory(payload, alice, { name: 'Resistors', parent: passives.id })
    await expect(
      addCategory(payload, bob, { name: 'Resistors', parent: passives.id }),
    ).rejects.toThrow(/already/)
    await expect(addCategory(payload, bob, { name: '   ' })).rejects.toThrow(/name/)
    await createPart(payload, alice, { name: '10K OHM 0603', quantity: 1, category: resistors.id })

    const rows = await listCategories(payload, alice)
    expect(rows.map((r) => [r.label, r.depth, r.parts])).toEqual([
      ['Passives', 0, 0],
      ['Passives › Resistors', 1, 1],
    ])
    // Bob sees the shared tree, but none of Alice's parts
    expect((await listCategories(payload, bob)).map((r) => r.parts)).toEqual([0, 0])
  })

  it('leaves renaming, moving and deleting to the admin', async () => {
    const [passives, resistors] = await listCategories(payload, alice)
    await expect(updateCategory(payload, alice, resistors.id, { name: 'Mine' })).rejects.toThrow(
      /only the admin/,
    )
    await expect(deleteCategory(payload, alice, resistors.id)).rejects.toThrow(/only the admin/)
    // Straight through the API too
    await expect(
      payload.update({
        collection: 'categories',
        id: resistors.id,
        data: { name: 'Mine' },
        user: alice as never,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    // The admin can, from the app (own-lab session)
    await expect(
      updateCategory(payload, admin, passives.id, { name: 'Passives', parent: resistors.id }),
    ).rejects.toThrow(/inside itself/)
    await updateCategory(payload, admin, resistors.id, {
      name: 'Resistors (SMD)',
      parent: passives.id,
    })
    expect((await listCategories(payload, alice)).map((r) => r.label)).toContain(
      'Passives › Resistors (SMD)',
    )
    await expect(deleteCategory(payload, admin, passives.id)).rejects.toThrow(/sub-categories/)
    await expect(deleteCategory(payload, admin, resistors.id)).rejects.toThrow(/1 part uses it/)

    const spare = await addCategory(payload, bob, { name: 'Spare' })
    await deleteCategory(payload, admin, spare.id)
    expect((await listCategories(payload, bob)).map((r) => r.name)).not.toContain('Spare')
  })
})

describe('profile', () => {
  it('changes your own name and password, checking the current one', async () => {
    await updateProfile(payload, alice, { name: '  Alice   A ' })
    expect(
      (await payload.findByID({ collection: 'users', id: alice.id, overrideAccess: true })).name,
    ).toBe('Alice A')

    await expect(
      changePassword(payload, alice, {
        current: 'wrong',
        next: 'newsecret1',
        confirm: 'newsecret1',
      }),
    ).rejects.toThrow(/current password is wrong/)
    await expect(
      changePassword(payload, alice, { current: 'secret', next: 'short', confirm: 'short' }),
    ).rejects.toThrow(/at least 8/)
    await expect(
      changePassword(payload, alice, { current: 'secret', next: 'newsecret1', confirm: 'nope' }),
    ).rejects.toThrow(/don’t match/)

    await changePassword(payload, alice, {
      current: 'secret',
      next: 'newsecret1',
      confirm: 'newsecret1',
    })
    await expect(
      payload.login({
        collection: 'users',
        data: { email: 'alice@example.com', password: 'secret' },
      }),
    ).rejects.toThrow()
    await expect(
      payload.login({
        collection: 'users',
        data: { email: 'alice@example.com', password: 'newsecret1' },
      }),
    ).resolves.toMatchObject({ user: { email: 'alice@example.com' } })
  })
})
