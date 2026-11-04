/** What a data-returning server action sends back: the data, or a message to show. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export const attempt = async <T>(run: () => Promise<T>): Promise<Result<T>> => {
  try {
    return { ok: true, data: await run() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong' }
  }
}
