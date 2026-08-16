/**
 * GET /a/<agent>/private/artifacts/<slug>/raw — the artifact's HTML, for the
 * iframe on the protected page. Adds the shared secret, which is what lets the
 * harness serve a private artifact at all.
 *
 * PROTECTED: gated by `proxy.ts`, and checked again here.
 */
import {
  fetchPrivateHtml,
  isPublishingAgent,
  isSlug,
  passThroughHtml,
  signedIn,
} from '@/lib/artifacts'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ agent: string; slug: string }> },
) {
  if (!(await signedIn(req))) return new Response('sign in', { status: 401 })
  const { agent, slug } = await params
  if (!isPublishingAgent(agent) || !isSlug(slug)) {
    return new Response('not found', { status: 404 })
  }
  return passThroughHtml(await fetchPrivateHtml(agent, slug))
}
