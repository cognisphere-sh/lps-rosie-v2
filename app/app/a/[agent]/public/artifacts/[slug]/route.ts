/**
 * GET /a/<agent>/public/artifacts/<slug> — a published artifact, open to anyone.
 *
 * Straight pass-through to the harness's `artifacts` plugin. No secret: the
 * plugin serves this path only while the artifact is flagged public, and 404s
 * for a private one. This path is exempt from the gate in `proxy.ts`.
 */
import { artifactUpstream, isPublishingAgent, isSlug, passThroughHtml } from '@/lib/artifacts'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agent: string; slug: string }> },
) {
  const { agent, slug } = await params
  if (!isPublishingAgent(agent) || !isSlug(slug)) {
    return new Response('not found', { status: 404 })
  }
  return passThroughHtml(await fetch(artifactUpstream(agent, 'public', slug)))
}
