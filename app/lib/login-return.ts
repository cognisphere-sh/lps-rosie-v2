/** Only the job identifier is needed to restore a signed-out deep link. */
export function jobLoginReturn(pathname: string, searchParams: URLSearchParams): string {
  if (pathname !== '/jobs') return pathname
  const ids = searchParams.getAll('jr')
  const id = ids.length === 1 ? ids[0] : ''
  // Never put unrelated query values (including credentials) in the login URL.
  return id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
    ? `/jobs?jr=${id}`
    : pathname
}

/** Validate the untrusted `next` on /login before passing it to the router. */
export function loginDestination(next: string | null, fallback: string): string {
  if (fallback === '/change-password' || !next || !next.startsWith('/') || next.startsWith('//') ||
      /[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  let url: URL
  try { url = new URL(next, 'https://login-return.local') } catch { return fallback }
  if (url.origin !== 'https://login-return.local' || url.hash ||
      /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.pathname) ||
      /^\/(?:login|api)(?:\/|$)/i.test(url.pathname)) return fallback
  // Reject all other query parameters rather than carrying arbitrary values
  // (OAuth codes, passwords, tokens) into history or an auth redirect.
  if (url.pathname === '/jobs' && [...url.searchParams.keys()].every((key) => key === 'jr')) {
    return jobLoginReturn(url.pathname, url.searchParams)
  }
  return url.pathname
}
