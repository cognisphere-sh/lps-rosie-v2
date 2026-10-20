import type { ARDetail } from '@/lib/availability'

const REQUEST_REF = /(?<![\p{L}\p{N}])AR(?:\s*[-‐‑‒–—―]\s*|\s*#\s*|\s+)\d+(?![\p{L}\p{N}])/giu

/** Hide an internal availability-request reference in supplier-facing copy. */
export function redactPartnerRequestRefs(text: string): string {
  return text.replace(REQUEST_REF, 'availability request')
}

/** What a request reads as when it has no job name of its own. */
export const partnerRequestName = (r: ARDetail) =>
  r.recordName || (r.jobName ? redactPartnerRequestRefs(r.jobName) : 'Availability request')
