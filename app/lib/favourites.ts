// Favourite suppliers (`suppliers.is_favorite`, migration 0153) lead every
// supplier list: the Suppliers table and plant search.

/** Favourites first. Stable: each side keeps the order it arrived in. */
export function favouritesFirst<T>(items: T[], isFavourite: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => Number(isFavourite(b)) - Number(isFavourite(a)))
}

export type Window<T> = { records: T[]; total: number }

/**
 * One page over "the favourites' matches, then everyone else's", each run in
 * the order `read` gives it. `read(scope, from, to)` is one ranged query
 * returning those rows and its scope's full count.
 *
 * PostgREST refuses an offset past the end of a result (PGRST103), so no read
 * starts beyond its run: page 1 asks both runs from 0 at once; a later page
 * counts the favourites first to know where its window falls.
 */
export async function favouritesFirstPage<T>(
  read: (scope: 'favourites' | 'others', from: number, to: number) => Promise<Window<T>>,
  page: number,
  size: number,
): Promise<Window<T>> {
  const from = (page - 1) * size
  const to = from + size - 1
  if (page === 1) {
    const [lead, rest] = await Promise.all([read('favourites', 0, to), read('others', 0, to)])
    return { records: [...lead.records, ...rest.records].slice(0, size), total: lead.total + rest.total }
  }
  const led = (await read('favourites', 0, 0)).total
  const restFrom = Math.max(0, from - led)
  const [lead, rest] = await Promise.all([
    from < led ? read('favourites', from, Math.min(to, led - 1)) : null,
    read('others', restFrom, Math.max(restFrom, to - led)),
  ])
  return { records: [...(lead?.records ?? []), ...rest.records].slice(0, size), total: led + rest.total }
}
