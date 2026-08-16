/**
 * /a/<agent>/private/artifacts/<slug> — the protected artifact page.
 *
 * PROTECTED: `proxy.ts` gates everything that isn't the public artifact path.
 *
 * The app owns the chrome (the share toggle) and the artifact itself renders in
 * a sandboxed iframe. That split is deliberate: agent-authored HTML is served
 * with `Content-Security-Policy: sandbox`, so it has an opaque origin and can
 * never read this app's cookies or storage — which also means a control drawn
 * *inside* it could not authenticate to the app. The toggle therefore lives
 * out here, where the session is real.
 */
import { notFound } from 'next/navigation'

import { artifactMeta, isPublishingAgent, isSlug } from '@/lib/artifacts'

import ShareToggle from './ShareToggle'

export const dynamic = 'force-dynamic'

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ agent: string; slug: string }>
}) {
  const { agent, slug } = await params
  if (!isPublishingAgent(agent) || !isSlug(slug)) notFound()

  const info = await artifactMeta(agent, slug)
  if (!info) notFound()

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        margin: 0,
      }}
    >
      <ShareToggle agent={agent} slug={slug} initial={info} />
      <iframe
        src={`/a/${agent}/private/artifacts/${slug}/raw`}
        title={slug}
        style={{ flex: 1, width: '100%', border: 0 }}
      />
    </main>
  )
}
