import { onJobEvent, sseResponse } from '@/lib/chat-realtime'
import { requirePartnerAccess } from '@/lib/partner-auth'

export const dynamic = 'force-dynamic'

/** Data-free invalidations; all records are fetched through supplier-scoped APIs. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePartnerAccess(req, (await params).id)
  if (!gate.ok) return gate.res
  return sseResponse(req, (send) => onJobEvent(send))
}
