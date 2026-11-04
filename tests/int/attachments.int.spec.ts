import type { Payload } from 'payload'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import { managedLabs } from '@/access'
import { addFile, addLink, partFiles, removeFile, removeLink } from '@/lib/attachments'
import { catalogPart, setShared } from '@/lib/catalog'
import { updateLab } from '@/lib/labSettings'
import { createPart } from '@/lib/parts'

import { freshPayload, newLab, newUser } from './setup'

let payload: Payload
let labA: string
let labB: string
let alice: Awaited<ReturnType<typeof newUser>>
let bob: Awaited<ReturnType<typeof newUser>>
let part: string

const file = (name: string, text = 'x') => ({
  data: Buffer.from(text),
  mimetype: 'application/octet-stream',
  name,
})
const as = (user: object) => ({ user: user as never, overrideAccess: false as const })
const getPart = (id: string, user: object) =>
  payload.findByID({ collection: 'parts', id, depth: 0, ...as(user) })

describe('part files and links', () => {
  beforeAll(async () => {
    payload = await freshPayload()
    labA = await newLab(payload, 'Alice’s lab')
    labB = await newLab(payload, 'Bob’s lab')
    // The first account becomes the admin; Alice and Bob are ordinary users
    await newUser(payload, 'admin@example.com', labA, 'admin')
    alice = await newUser(payload, 'alice@example.com', labA)
    bob = await newUser(payload, 'bob@example.com', labB)
    part = (await createPart(payload, alice, { name: 'AMS1117-3.3 SOT-223', quantity: 1 })).id
  })

  it('files datasheets, KiCad files and 3D models; the first datasheet is the part’s', async () => {
    const pdf = await addFile(payload, alice, {
      part,
      kind: 'datasheet',
      file: { ...file('ams1117.pdf', '%PDF-1.4'), mimetype: 'application/pdf' },
    })
    await addFile(payload, alice, { part, kind: 'footprint', file: file('SOT-223.kicad_mod') })
    await addFile(payload, alice, { part, kind: 'model3d', file: file('SOT-223.step') })
    await addFile(payload, alice, { part, kind: 'symbol', file: file('ams1117.kicad_sym') })
    expect((await getPart(part, alice)).datasheet).toBe(pdf.id)
    expect((await partFiles(payload, alice, part)).map((f) => f.kind)).toEqual([
      'datasheet',
      'symbol',
      'footprint',
      'model3d',
    ])

    await removeFile(payload, alice, pdf.id)
    expect((await getPart(part, alice)).datasheet ?? null).toBeNull()
    expect(await partFiles(payload, alice, part)).toHaveLength(3)
  })

  it('refuses big files and other labs’ parts', async () => {
    await expect(
      addFile(payload, alice, {
        part,
        kind: 'other',
        file: file('big.bin', 'x'.repeat(4_200_000)),
      }),
    ).rejects.toThrow(/over 4 MB/)
    await expect(
      addFile(payload, bob, { part, kind: 'other', file: file('sneaky.txt') }),
    ).rejects.toThrow()
    const [first] = await partFiles(payload, alice, part)
    await expect(removeFile(payload, bob, first.id)).rejects.toThrow()
    await expect(addLink(payload, bob, { part, label: 'x', url: 'example.com' })).rejects.toThrow()
  })

  it('keeps links tidy and only to web pages', async () => {
    await addLink(payload, alice, { part, label: ' Datasheet ', url: 'www.ti.com/lit/ds/ams1117' })
    await expect(
      addLink(payload, alice, { part, label: 'Bad', url: 'javascript:alert(1)' }),
    ).rejects.toThrow(/http/)
    await expect(addLink(payload, alice, { part, label: '', url: 'ti.com' })).rejects.toThrow(
      /name/,
    )
    const links = (await getPart(part, alice)).links!
    expect(links.map((l) => [l.label, l.url])).toEqual([
      ['Datasheet', 'https://www.ti.com/lit/ds/ams1117'],
    ])
    await removeLink(payload, alice, part, links[0].id!)
    expect((await getPart(part, alice)).links).toEqual([])
  })

  it('copies files and links along with a shared part', async () => {
    await addLink(payload, alice, { part, label: 'Product page', url: 'https://example.com/ams' })
    await setShared(payload, alice, [part], true)
    expect((await catalogPart(payload, bob, part))!.files.map((f) => f.kind)).toEqual([
      'symbol',
      'footprint',
      'model3d',
    ])

    const copy = (
      await createPart(payload, bob, { name: 'AMS1117-3.3 SOT-223', quantity: 0, from: part })
    ).id
    const files = await partFiles(payload, bob, copy)
    expect(files.map((f) => [f.kind, f.filename])).toEqual([
      ['symbol', expect.stringContaining('ams1117')],
      ['footprint', expect.stringContaining('SOT-223')],
      ['model3d', expect.stringContaining('SOT-223')],
    ])
    expect((await getPart(copy, bob)).links!.map((l) => l.url)).toEqual(['https://example.com/ams'])
  })
})

describe('lab settings', () => {
  it('lets lab admins rename, theme and brand their own lab only', async () => {
    const member = await newUser(payload, 'member@example.com', labA)
    await payload.update({
      collection: 'users',
      id: member.id,
      data: { labs: [{ lab: labA, labRole: 'member' }] },
      overrideAccess: true,
    })
    const memberNow = {
      ...(await payload.findByID({ collection: 'users', id: member.id, overrideAccess: true })),
      collection: 'users' as const,
      _ownLabOnly: true as const,
    }
    expect(managedLabs(alice)).toEqual([labA])
    expect(managedLabs(memberNow)).toEqual([])

    await expect(
      updateLab(payload, memberNow, labA, { name: 'Mine now', theme: 'red' }),
    ).rejects.toThrow(/lab admin/)
    await expect(updateLab(payload, alice, labB, { name: 'Bob’s?', theme: 'red' })).rejects.toThrow(
      /lab admin/,
    )
    await expect(updateLab(payload, alice, labA, { name: 'Lab', theme: 'neon' })).rejects.toThrow(
      /themes/,
    )
    // Straight through the API too
    await expect(
      payload.update({ collection: 'labs', id: labA, data: { theme: 'red' }, ...as(memberNow) }),
    ).rejects.toThrow()

    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#5b2d82' },
    })
      .png()
      .toBuffer()
    const logo = { data: png, mimetype: 'image/png', name: 'logo.png' }
    await updateLab(payload, alice, labA, { name: '  Alice’s   bench ', theme: 'purple', logo })
    const first = await payload.findByID({ collection: 'labs', id: labA, depth: 0, ...as(alice) })
    expect(first).toMatchObject({ name: 'Alice’s bench', theme: 'purple' })
    expect(first.logo).toBeTruthy()

    // A new logo replaces (and deletes) the old one
    await updateLab(payload, alice, labA, { name: 'Alice’s bench', theme: 'purple', logo })
    const second = await payload.findByID({ collection: 'labs', id: labA, depth: 0, ...as(alice) })
    expect(second.logo).not.toBe(first.logo)
    await expect(
      payload.findByID({ collection: 'media', id: first.logo as string, overrideAccess: true }),
    ).rejects.toThrow()
    await updateLab(payload, alice, labA, {
      name: 'Alice’s bench',
      theme: 'green',
      removeLogo: true,
    })
    expect(
      (await payload.findByID({ collection: 'labs', id: labA, depth: 0, ...as(alice) })).logo ??
        null,
    ).toBeNull()
  })
})
