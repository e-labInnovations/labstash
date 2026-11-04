import type { Payload } from 'payload'

/** The lab a CLI run works in: `--lab <name>`, or the only lab there is. */
export const resolveLab = async (payload: Payload, name?: string) => {
  const { docs } = await payload.find({
    collection: 'labs',
    overrideAccess: true,
    pagination: false,
    depth: 0,
    ...(name && { where: { name: { equals: name } } }),
  })
  if (docs.length === 1) return docs[0].id
  throw new Error(
    name
      ? `No lab named "${name}"`
      : `Pick a lab with --lab "<name>": ${docs.map((l) => l.name).join(', ') || 'none yet'}`,
  )
}
