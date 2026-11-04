import { readMediaFile, sharedMedia } from '@/lib/catalog'
import { getSession } from '@/lib/session'

/** A photo or datasheet of a shared part, for signed-in users of any lab. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await getSession()
  if (!user) return new Response('Sign in first', { status: 401 })

  const media = await sharedMedia(payload, (await params).id)
  if (!media) return new Response('Not found', { status: 404 })
  const thumbnail = new URL(request.url).searchParams.get('size') === 'thumbnail'
  try {
    const file = await readMediaFile(payload, media, thumbnail ? 'thumbnail' : undefined)
    return new Response(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`,
        // Sharing can be switched off, so browsers re-check after a while
        'Cache-Control': 'private, max-age=600',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
